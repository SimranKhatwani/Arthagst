import mongoose from 'mongoose';
import BankAccount from './bankAccount.model.js';

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

export default {
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  updateBankAccount,
  updateBankAccountStatus,
  deleteBankAccount,
};
