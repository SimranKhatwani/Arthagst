import mongoose from 'mongoose';
import ExpenseCategory from './expenseCategory.model.js';
import Expense from './expense.model.js';
import ExpenseSequence from './expenseSequence.model.js';
import BankAccount from '../banking/bankAccount.model.js';
import Party from '../parties/party.model.js';
import Tenant from '../tenants/tenant.model.js';
import { getFinancialYear, round2, resolveStateCode } from '../sales/sales.calculator.js';

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
 * Helper to escape regex special characters
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * ==========================================
 * EXPENSE CATEGORIES
 * ==========================================
 */

export const createCategory = async (tenantId, data) => {
  const existing = await ExpenseCategory.findOne({
    tenantId,
    name: { $regex: new RegExp(`^${escapeRegex(data.name.trim())}$`, 'i') },
    isDeleted: false,
  });

  if (existing) {
    const error = new Error(`Expense category '${data.name}' already exists`);
    error.statusCode = 409;
    throw error;
  }

  const category = new ExpenseCategory({
    tenantId,
    name: data.name.trim(),
    description: data.description ? data.description.trim() : '',
  });

  await category.save();
  return category;
};

export const getCategories = async (tenantId, options = {}) => {
  const query = { tenantId, isDeleted: false };
  if (options.isActive !== undefined) {
    query.isActive = options.isActive === 'true' || options.isActive === true;
  }

  const categories = await ExpenseCategory.find(query).sort({ name: 1 });
  return categories;
};

export const getCategoryById = async (tenantId, categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    const error = new Error('Invalid category ID format');
    error.statusCode = 400;
    throw error;
  }

  const category = await ExpenseCategory.findOne({
    _id: categoryId,
    tenantId,
    isDeleted: false,
  });

  if (!category) {
    const error = new Error('Expense category not found');
    error.statusCode = 404;
    throw error;
  }

  return category;
};

export const updateCategory = async (tenantId, categoryId, data) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    const error = new Error('Invalid category ID format');
    error.statusCode = 400;
    throw error;
  }

  const category = await ExpenseCategory.findOne({
    _id: categoryId,
    tenantId,
    isDeleted: false,
  });

  if (!category) {
    const error = new Error('Expense category not found');
    error.statusCode = 404;
    throw error;
  }

  if (data.name && data.name.trim().toLowerCase() !== category.name.toLowerCase()) {
    const duplicate = await ExpenseCategory.findOne({
      tenantId,
      name: { $regex: new RegExp(`^${escapeRegex(data.name.trim())}$`, 'i') },
      _id: { $ne: category._id },
      isDeleted: false,
    });

    if (duplicate) {
      const error = new Error(`Expense category '${data.name}' already exists`);
      error.statusCode = 409;
      throw error;
    }

    category.name = data.name.trim();
  }

  if (data.description !== undefined) {
    category.description = data.description.trim();
  }

  if (data.isActive !== undefined) {
    category.isActive = Boolean(data.isActive);
  }

  await category.save();
  return category;
};

export const deleteCategory = async (tenantId, categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    const error = new Error('Invalid category ID format');
    error.statusCode = 400;
    throw error;
  }

  const category = await ExpenseCategory.findOne({
    _id: categoryId,
    tenantId,
    isDeleted: false,
  });

  if (!category) {
    const error = new Error('Expense category not found');
    error.statusCode = 404;
    throw error;
  }

  // Check if any expenses are linked to this category
  const linkedExpense = await Expense.exists({
    tenantId,
    categoryId: category._id,
  });

  if (linkedExpense) {
    const error = new Error(
      'Cannot delete category because it has associated expenses. You can deactivate it instead.'
    );
    error.statusCode = 400;
    throw error;
  }

  category.isDeleted = true;
  await category.save();

  return { message: 'Category deleted successfully' };
};

/**
 * ==========================================
 * EXPENSES
 * ==========================================
 */

/**
 * Generate sequential expense document number atomically
 */
export const generateExpenseNumber = async (
  tenantId,
  date = new Date(),
  session = null
) => {
  const financialYear = getFinancialYear(date);
  const query = { tenantId, financialYear };
  const update = { $inc: { sequence: 1 } };
  const options = { upsert: true, returnDocument: 'after' };
  if (session) options.session = session;

  const seq = await ExpenseSequence.findOneAndUpdate(query, update, options);
  const formattedNumber = `EXP/${financialYear}/${String(seq.sequence).padStart(4, '0')}`;

  return {
    documentNumber: formattedNumber,
    financialYear,
  };
};

/**
 * Record a new business expense
 */
export const createExpense = async (tenantId, userId, data) => {
  return runTransaction(async (session) => {
    // 1. Validate Category
    if (!mongoose.isValidObjectId(data.categoryId)) {
      const error = new Error('Invalid category ID format');
      error.statusCode = 400;
      throw error;
    }

    const category = await ExpenseCategory.findOne({
      _id: data.categoryId,
      tenantId,
      isDeleted: false,
    }).session(session);

    if (!category) {
      const error = new Error('Expense category not found');
      error.statusCode = 404;
      throw error;
    }

    if (!category.isActive) {
      const error = new Error(`Expense category '${category.name}' is inactive`);
      error.statusCode = 400;
      throw error;
    }

    // 2. Validate Bank Account if provided
    let resolvedBankAccount = null;
    if (data.bankAccountId) {
      if (!mongoose.isValidObjectId(data.bankAccountId)) {
        const error = new Error('Invalid bank account ID format');
        error.statusCode = 400;
        throw error;
      }

      resolvedBankAccount = await BankAccount.findOne({
        _id: data.bankAccountId,
        tenantId,
        isDeleted: false,
      }).session(session);

      if (!resolvedBankAccount) {
        const error = new Error('Bank account not found in your organization');
        error.statusCode = 404;
        throw error;
      }

      if (!resolvedBankAccount.isActive) {
        const error = new Error(`Bank account '${resolvedBankAccount.accountName}' is inactive`);
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Validate Party if provided
    let resolvedParty = null;
    if (data.partyId) {
      if (!mongoose.isValidObjectId(data.partyId)) {
        const error = new Error('Invalid party ID format');
        error.statusCode = 400;
        throw error;
      }

      resolvedParty = await Party.findOne({
        _id: data.partyId,
        tenantId,
        isDeleted: false,
      }).session(session);

      if (!resolvedParty) {
        const error = new Error('Party not found in your organization');
        error.statusCode = 404;
        throw error;
      }
    }

    // 4. Compute GST and Taxes
    const expenseDate = data.expenseDate ? new Date(data.expenseDate) : new Date();
    let totalAmount = round2(data.amount);
    let taxableAmount = 0;
    let gstRate = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let cess = 0;
    const isGSTApplicable = Boolean(data.isGSTApplicable);
    const isITCClaimable = Boolean(data.isITCClaimable);

    if (isGSTApplicable) {
      gstRate = Number(data.gstRate) || 0;

      if (data.taxableAmount !== undefined && data.taxableAmount !== null) {
        taxableAmount = round2(data.taxableAmount);
        const taxTotal = round2((taxableAmount * gstRate) / 100);
        // If user gave both taxableAmount and amount, prioritize consistent sum
        totalAmount = round2(taxableAmount + taxTotal);
      } else {
        // Amount provided is total inclusive of GST
        taxableAmount = round2(totalAmount / (1 + gstRate / 100));
      }

      const totalTax = round2(totalAmount - taxableAmount);

      // Check if inter-state or intra-state
      let isInterState = false;
      if (resolvedParty) {
        const tenant = await Tenant.findById(tenantId).session(session);
        const tenantStateCode = resolveStateCode(tenant?.stateCode || tenant?.state);
        const partyStateCode = resolveStateCode(
          resolvedParty?.billingAddress?.state ||
          resolvedParty?.state ||
          (resolvedParty?.GSTIN ? resolvedParty.GSTIN.substring(0, 2) : '')
        );

        if (tenantStateCode && partyStateCode && tenantStateCode !== partyStateCode) {
          isInterState = true;
        }
      }

      if (isInterState) {
        igst = totalTax;
        cgst = 0;
        sgst = 0;
      } else {
        cgst = round2(totalTax / 2);
        sgst = round2(totalTax - cgst);
        igst = 0;
      }
    } else {
      taxableAmount = totalAmount;
      gstRate = 0;
      cgst = 0;
      sgst = 0;
      igst = 0;
      cess = 0;
    }

    // 5. Update Bank Account Balance
    if (resolvedBankAccount) {
      await BankAccount.findByIdAndUpdate(
        resolvedBankAccount._id,
        {
          $inc: { currentBalance: -totalAmount },
        },
        { session }
      );
    }

    // 6. Generate Expense Sequence
    const { documentNumber, financialYear } = await generateExpenseNumber(
      tenantId,
      expenseDate,
      session
    );

    // 7. Create Expense Document
    const expense = new Expense({
      tenantId,
      expenseNumber: documentNumber,
      financialYear,
      categoryId: category._id,
      categoryName: category.name,
      expenseDate,
      amount: totalAmount,
      taxableAmount,
      gstRate,
      cgst,
      sgst,
      igst,
      cess,
      isGSTApplicable,
      isITCClaimable,
      paymentMethod: data.paymentMethod || 'cash',
      bankAccountId: resolvedBankAccount ? resolvedBankAccount._id : null,
      bankAccountName: resolvedBankAccount ? resolvedBankAccount.accountName : '',
      partyId: resolvedParty ? resolvedParty._id : null,
      payeeName: data.payeeName || (resolvedParty ? resolvedParty.name : ''),
      referenceNumber: data.referenceNumber || '',
      receiptUrl: data.receiptUrl || '',
      notes: data.notes || '',
      status: 'paid',
      createdBy: userId,
    });

    await expense.save({ session });
    return expense;
  });
};

/**
 * Cancel an expense and reverse bank account balance atomically
 */
export const cancelExpense = async (tenantId, userId, expenseId, cancellationReason) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(expenseId)) {
      const error = new Error('Invalid expense ID format');
      error.statusCode = 400;
      throw error;
    }

    const expense = await Expense.findOne({
      _id: expenseId,
      tenantId,
    }).session(session);

    if (!expense) {
      const error = new Error('Expense not found');
      error.statusCode = 404;
      throw error;
    }

    if (expense.status === 'cancelled') {
      const error = new Error('Expense has already been cancelled');
      error.statusCode = 400;
      throw error;
    }

    // Reverse bank account balance if payment was made via bank account
    if (expense.bankAccountId) {
      await BankAccount.findByIdAndUpdate(
        expense.bankAccountId,
        {
          $inc: { currentBalance: expense.amount },
        },
        { session }
      );
    }

    expense.status = 'cancelled';
    expense.cancelledAt = new Date();
    expense.cancellationReason = cancellationReason;

    await expense.save({ session });
    return expense;
  });
};

/**
 * Get paginated list of expenses with filters
 */
export const getExpenses = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    bankAccountId,
    partyId,
    paymentMethod,
    status,
    startDate,
    endDate,
    sortBy = 'expenseDate',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (categoryId && mongoose.isValidObjectId(categoryId)) query.categoryId = categoryId;
  if (bankAccountId && mongoose.isValidObjectId(bankAccountId)) query.bankAccountId = bankAccountId;
  if (partyId && mongoose.isValidObjectId(partyId)) query.partyId = partyId;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (status) query.status = status;

  if (startDate || endDate) {
    query.expenseDate = {};
    if (startDate) query.expenseDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.expenseDate.$lte = end;
    }
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { expenseNumber: searchRegex },
      { categoryName: searchRegex },
      { payeeName: searchRegex },
      { referenceNumber: searchRegex },
      { notes: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [expenses, total] = await Promise.all([
    Expense.find(query)
      .populate('categoryId', 'name description')
      .populate('bankAccountId', 'accountName accountType bankName accountNumber')
      .populate('partyId', 'name email phone GSTIN')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Expense.countDocuments(query),
  ]);

  return {
    expenses,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get expense by ID
 */
export const getExpenseById = async (tenantId, expenseId) => {
  if (!mongoose.isValidObjectId(expenseId)) {
    const error = new Error('Invalid expense ID format');
    error.statusCode = 400;
    throw error;
  }

  const expense = await Expense.findOne({
    _id: expenseId,
    tenantId,
  })
    .populate('categoryId', 'name description')
    .populate('bankAccountId', 'accountName accountType bankName accountNumber IFSC')
    .populate('partyId', 'name email phone GSTIN PAN')
    .populate('createdBy', 'name email')
    .lean();

  if (!expense) {
    const error = new Error('Expense not found');
    error.statusCode = 404;
    throw error;
  }

  return expense;
};

export default {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  generateExpenseNumber,
  createExpense,
  cancelExpense,
  getExpenses,
  getExpenseById,
};
