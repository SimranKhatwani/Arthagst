import { ZodError } from 'zod';
import * as expenseService from './expense.service.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createExpenseSchema,
  cancelExpenseSchema,
  queryExpensesSchema,
} from './expense.validation.js';
import { sendResponse, formatZodErrors } from '../../utils/apiResponse.js';

/**
 * Categories Controllers
 */

export const createCategory = async (req, res, next) => {
  try {
    const validatedData = createCategorySchema.parse(req.body);
    const category = await expenseService.createCategory(req.tenantId, validatedData);
    return sendResponse(res, 201, true, 'Expense category created successfully', category);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const categories = await expenseService.getCategories(req.tenantId, req.query);
    return sendResponse(res, 200, true, 'Expense categories retrieved successfully', categories);
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const category = await expenseService.getCategoryById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Expense category retrieved successfully', category);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const validatedData = updateCategorySchema.parse(req.body);
    const category = await expenseService.updateCategory(req.tenantId, req.params.id, validatedData);
    return sendResponse(res, 200, true, 'Expense category updated successfully', category);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const result = await expenseService.deleteCategory(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * Expenses Controllers
 */

export const createExpense = async (req, res, next) => {
  try {
    const validatedData = createExpenseSchema.parse(req.body);
    const expense = await expenseService.createExpense(
      req.tenantId,
      req.user._id,
      validatedData
    );
    return sendResponse(res, 201, true, 'Expense recorded successfully', expense);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getExpenses = async (req, res, next) => {
  try {
    const validatedQuery = queryExpensesSchema.parse(req.query);
    const result = await expenseService.getExpenses(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Expenses retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getExpenseById = async (req, res, next) => {
  try {
    const expense = await expenseService.getExpenseById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Expense details retrieved successfully', expense);
  } catch (error) {
    next(error);
  }
};

export const cancelExpense = async (req, res, next) => {
  try {
    const validatedData = cancelExpenseSchema.parse(req.body);
    const expense = await expenseService.cancelExpense(
      req.tenantId,
      req.user._id,
      req.params.id,
      validatedData.cancellationReason
    );
    return sendResponse(res, 200, true, 'Expense cancelled and reversed successfully', expense);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export default {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  createExpense,
  getExpenses,
  getExpenseById,
  cancelExpense,
};
