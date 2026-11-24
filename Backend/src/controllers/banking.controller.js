import { ZodError } from 'zod';
import * as bankingService from '../services/banking.service.js';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  queryBankAccountsSchema,
  updateStatusSchema,
} from '../validators/banking.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

export const createAccount = async (req, res, next) => {
  try {
    const validatedData = createBankAccountSchema.parse(req.body);
    const account = await bankingService.createBankAccount(req.tenantId, validatedData);
    return sendResponse(res, 201, true, 'Bank account created successfully', account);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getAccounts = async (req, res, next) => {
  try {
    const validatedQuery = queryBankAccountsSchema.parse(req.query);
    const result = await bankingService.getBankAccounts(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Bank accounts retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getAccountById = async (req, res, next) => {
  try {
    const account = await bankingService.getBankAccountById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Bank account details retrieved successfully', account);
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const validatedData = updateBankAccountSchema.parse(req.body);
    const account = await bankingService.updateBankAccount(req.tenantId, req.params.id, validatedData);
    return sendResponse(res, 200, true, 'Bank account updated successfully', account);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const updateAccountStatus = async (req, res, next) => {
  try {
    const { isActive } = updateStatusSchema.parse(req.body);
    const account = await bankingService.updateBankAccountStatus(req.tenantId, req.params.id, isActive);
    return sendResponse(res, 200, true, `Account ${isActive ? 'activated' : 'deactivated'} successfully`, account);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const result = await bankingService.deleteBankAccount(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = updateAccountStatus;

export default {
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  updateAccountStatus,
  updateStatus,
  deleteAccount,
};
