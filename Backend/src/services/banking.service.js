import mongoose from 'mongoose';
import BankAccount from '../models/bankAccount.model.js';
import BankTransaction from '../models/bankTransaction.model.js';

/**
 * Transaction helper with retry on write conflicts
 */
const runTransaction = async (operation, maxRetries = 10) => {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        session.startTransaction();
        const result = await operation(session);
        await session.commitTransaction();
        return result;
      } catch (error) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        const isTransient =
          error.hasErrorLabel?.('TransientTransactionError') ||
          error.code === 112 ||
          error.codeName === 'WriteConflict';

        if (isTransient && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 40 * attempt + Math.random() * 40));
          continue;
        }
        throw error;
      }
    }
  } finally {
    session.endSession();
  }
};

/**
 * Create a new bank or cash account
 */
export const createBankAccount = async (tenantId, data) => {
  const activeCount = await BankAccount.countDocuments({
    tenantId,
    isDeleted: false,
  });

  let shouldBeDefault = data.isDefault;
  if (activeCount === 0) {
    shouldBeDefault = true;
  }

  if (shouldBeDefault) {
    await BankAccount.updateMany(
      { tenantId, isDefault: true },
      { isDefault: false }
    );
  }

  const opening = Number(data.openingBalance) || 0;

  const account = new BankAccount({
    ...data,
    tenantId,
    openingBalance: opening,
    currentBalance: opening,
    isDefault: shouldBeDefault,
  });

  await account.save();
  return account;
};

/**
 * List bank accounts with pagination, search, and filters
 */
export const getBankAccounts = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    accountType,
    isActive,
    isDefault,
    sortBy = 'accountName',
    sortOrder = 'asc',
  } = options;

  const query = {
    tenantId,
    isDeleted: false,
  };

  if (accountType) {
    query.accountType = accountType;
  }

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  if (isDefault !== undefined) {
    query.isDefault = isDefault;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { accountName: searchRegex },
      { bankName: searchRegex },
      { accountHolderName: searchRegex },
      { accountNumber: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortBy]: sortDirection };

  const [accounts, total] = await Promise.all([
    BankAccount.find(query).sort(sortOptions).skip(skip).limit(limit),
    BankAccount.countDocuments(query),
  ]);

  return {
    accounts,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get bank account by ID
 */
export const getBankAccountById = async (tenantId, accountId) => {
  if (!mongoose.isValidObjectId(accountId)) {
    const error = new Error('Invalid account ID format');
    error.statusCode = 400;
    throw error;
  }

  const account = await BankAccount.findOne({
    _id: accountId,
    tenantId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('Bank account not found');
    error.statusCode = 404;
    throw error;
  }

  return account;
};

/**
 * Update bank account details
 */
export const updateBankAccount = async (tenantId, accountId, data) => {
  if (!mongoose.isValidObjectId(accountId)) {
    const error = new Error('Invalid account ID format');
    error.statusCode = 400;
    throw error;
  }

  const account = await BankAccount.findOne({
    _id: accountId,
    tenantId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('Bank account not found');
    error.statusCode = 404;
    throw error;
  }

  if (data.isDefault === true && !account.isDefault) {
    await BankAccount.updateMany(
      { tenantId, _id: { $ne: accountId }, isDefault: true },
      { isDefault: false }
    );
    account.isDefault = true;
  }

  const allowedFields = [
    'accountName',
    'accountType',
    'bankName',
    'accountHolderName',
    'accountNumber',
    'IFSC',
    'isActive',
  ];

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      account[field] = data[field];
    }
  });

  await account.save();
  return account;
};

/**
 * Update bank account active status
 */
export const updateBankAccountStatus = async (tenantId, accountId, isActive) => {
  if (!mongoose.isValidObjectId(accountId)) {
    const error = new Error('Invalid account ID format');
    error.statusCode = 400;
    throw error;
  }

  const account = await BankAccount.findOne({
    _id: accountId,
    tenantId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('Bank account not found');
    error.statusCode = 404;
    throw error;
  }

  if (account.isDefault && !isActive) {
    const error = new Error('Cannot deactivate the default account. Designate another account as default first.');
    error.statusCode = 400;
    throw error;
  }

  account.isActive = isActive;
  await account.save();
  return account;
};

/**
 * Soft delete bank account with safety checks
 */
export const deleteBankAccount = async (tenantId, accountId) => {
  if (!mongoose.isValidObjectId(accountId)) {
    const error = new Error('Invalid account ID format');
    error.statusCode = 400;
    throw error;
  }

  const account = await BankAccount.findOne({
    _id: accountId,
    tenantId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('Bank account not found');
    error.statusCode = 404;
    throw error;
  }

  // 1. Check if financial transactions are linked to this account
  if (mongoose.models.Payment) {
    const hasPayments = await mongoose.model('Payment').exists({
      bankAccountId: accountId,
      tenantId,
      status: { $ne: 'cancelled' },
    });

    if (hasPayments) {
      const error = new Error('Cannot delete bank account linked to financial transactions. Deactivate it instead.');
      error.statusCode = 400;
      throw error;
    }
  }

  if (mongoose.models.Expense) {
    const hasExpenses = await mongoose.model('Expense').exists({
      bankAccountId: accountId,
      tenantId,
      status: { $ne: 'cancelled' },
    });

    if (hasExpenses) {
      const error = new Error('Cannot delete bank account linked to expenses. Deactivate it instead.');
      error.statusCode = 400;
      throw error;
    }
  }

  // If default, designate another active account if available
  if (account.isDefault) {
    const nextAccount = await BankAccount.findOne({
      tenantId,
      _id: { $ne: accountId },
      isActive: true,
      isDeleted: false,
    });

    if (nextAccount) {
      nextAccount.isDefault = true;
      await nextAccount.save();
    }
  }

  account.isDeleted = true;
  account.isActive = false;
  account.isDefault = false;
  await account.save();

  return {
    id: account._id,
    accountName: account.accountName,
    message: 'Bank account deleted successfully',
  };
};

/**
 * Transfer funds between two bank/cash accounts (Contra transfer)
 */
export const transferFunds = async (tenantId, userId, data) => {
  return runTransaction(async (session) => {
    const { fromAccountId, toAccountId, amount, date, referenceNumber, notes } = data;

    if (fromAccountId === toAccountId) {
      const error = new Error('Source and destination accounts must be different');
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.isValidObjectId(fromAccountId) || !mongoose.isValidObjectId(toAccountId)) {
      const error = new Error('Invalid account ID format');
      error.statusCode = 400;
      throw error;
    }

    const transferAmount = Number(amount);
    if (transferAmount <= 0) {
      const error = new Error('Transfer amount must be greater than zero');
      error.statusCode = 400;
      throw error;
    }

    const fromAccount = await BankAccount.findOne({
      _id: fromAccountId,
      tenantId,
      isDeleted: false,
    }).session(session);

    if (!fromAccount) {
      const error = new Error('Source bank account not found');
      error.statusCode = 404;
      throw error;
    }

    if (!fromAccount.isActive) {
      const error = new Error(`Source account '${fromAccount.accountName}' is inactive`);
      error.statusCode = 400;
      throw error;
    }

    const toAccount = await BankAccount.findOne({
      _id: toAccountId,
      tenantId,
      isDeleted: false,
    }).session(session);

    if (!toAccount) {
      const error = new Error('Destination bank account not found');
      error.statusCode = 404;
      throw error;
    }

    if (!toAccount.isActive) {
      const error = new Error(`Destination account '${toAccount.accountName}' is inactive`);
      error.statusCode = 400;
      throw error;
    }

    const transferDate = date ? new Date(date) : new Date();

    // Deduct from source
    fromAccount.currentBalance = Math.round((fromAccount.currentBalance - transferAmount) * 100) / 100;
    await fromAccount.save({ session });

    // Add to destination
    toAccount.currentBalance = Math.round((toAccount.currentBalance + transferAmount) * 100) / 100;
    await toAccount.save({ session });

    // Create Outward Transaction
    const txnOut = new BankTransaction({
      tenantId,
      bankAccountId: fromAccount._id,
      transactionType: 'transfer_out',
      amount: transferAmount,
      balanceAfter: fromAccount.currentBalance,
      transactionDate: transferDate,
      referenceNumber: referenceNumber || '',
      fromAccountId: fromAccount._id,
      toAccountId: toAccount._id,
      description: notes || `Transfer to ${toAccount.accountName}`,
      createdBy: userId,
    });
    await txnOut.save({ session });

    // Create Inward Transaction
    const txnIn = new BankTransaction({
      tenantId,
      bankAccountId: toAccount._id,
      transactionType: 'transfer_in',
      amount: transferAmount,
      balanceAfter: toAccount.currentBalance,
      transactionDate: transferDate,
      referenceNumber: referenceNumber || '',
      fromAccountId: fromAccount._id,
      toAccountId: toAccount._id,
      description: notes || `Transfer from ${fromAccount.accountName}`,
      createdBy: userId,
    });
    await txnIn.save({ session });

    return {
      message: 'Funds transferred successfully',
      transferAmount,
      transferDate,
      fromAccount: {
        id: fromAccount._id,
        accountName: fromAccount.accountName,
        currentBalance: fromAccount.currentBalance,
      },
      toAccount: {
        id: toAccount._id,
        accountName: toAccount.accountName,
        currentBalance: toAccount.currentBalance,
      },
      outwardTransactionId: txnOut._id,
      inwardTransactionId: txnIn._id,
    };
  });
};

/**
 * Record a direct deposit or withdrawal on a bank/cash account
 */
export const createBankTransaction = async (tenantId, userId, data) => {
  return runTransaction(async (session) => {
    const { bankAccountId, transactionType, amount, date, referenceNumber, description } = data;

    if (!mongoose.isValidObjectId(bankAccountId)) {
      const error = new Error('Invalid account ID format');
      error.statusCode = 400;
      throw error;
    }

    const txnAmount = Number(amount);
    if (txnAmount <= 0) {
      const error = new Error('Transaction amount must be greater than zero');
      error.statusCode = 400;
      throw error;
    }

    const account = await BankAccount.findOne({
      _id: bankAccountId,
      tenantId,
      isDeleted: false,
    }).session(session);

    if (!account) {
      const error = new Error('Bank account not found');
      error.statusCode = 404;
      throw error;
    }

    if (!account.isActive) {
      const error = new Error(`Account '${account.accountName}' is inactive`);
      error.statusCode = 400;
      throw error;
    }

    const txnDate = date ? new Date(date) : new Date();

    if (transactionType === 'deposit') {
      account.currentBalance = Math.round((account.currentBalance + txnAmount) * 100) / 100;
    } else if (transactionType === 'withdrawal') {
      account.currentBalance = Math.round((account.currentBalance - txnAmount) * 100) / 100;
    } else {
      const error = new Error("Invalid transaction type. Expected 'deposit' or 'withdrawal'");
      error.statusCode = 400;
      throw error;
    }

    await account.save({ session });

    const txn = new BankTransaction({
      tenantId,
      bankAccountId: account._id,
      transactionType,
      amount: txnAmount,
      balanceAfter: account.currentBalance,
      transactionDate: txnDate,
      referenceNumber: referenceNumber || '',
      description: description || `${transactionType.toUpperCase()} on ${account.accountName}`,
      createdBy: userId,
    });
    await txn.save({ session });

    return {
      message: `${transactionType === 'deposit' ? 'Deposit' : 'Withdrawal'} recorded successfully`,
      account: {
        id: account._id,
        accountName: account.accountName,
        currentBalance: account.currentBalance,
      },
      transaction: txn,
    };
  });
};

/**
 * Get paginated bank transactions
 */
export const getBankTransactions = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 20,
    bankAccountId,
    transactionType,
    startDate,
    endDate,
    sortBy = 'transactionDate',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (bankAccountId && mongoose.isValidObjectId(bankAccountId)) {
    query.bankAccountId = bankAccountId;
  }

  if (transactionType) {
    query.transactionType = transactionType;
  }

  if (startDate || endDate) {
    query.transactionDate = {};
    if (startDate) query.transactionDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.transactionDate.$lte = end;
    }
  }

  const skip = (Math.max(1, page) - 1) * Math.min(100, limit);
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortBy]: sortDirection };

  const [transactions, total] = await Promise.all([
    BankTransaction.find(query)
      .populate('bankAccountId', 'accountName accountType bankName accountNumber')
      .populate('fromAccountId', 'accountName')
      .populate('toAccountId', 'accountName')
      .populate('createdBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(Math.min(100, limit)),
    BankTransaction.countDocuments(query),
  ]);

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export default {
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  updateBankAccount,
  updateBankAccountStatus,
  deleteBankAccount,
  transferFunds,
  createBankTransaction,
  getBankTransactions,
};
