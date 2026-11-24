import { ZodError } from 'zod';
import * as accountingService from './accounting.service.js';
import {
  createAccountSchema,
  updateAccountSchema,
  queryAccountsSchema,
  createJournalEntrySchema,
  reverseJournalEntrySchema,
  queryJournalEntriesSchema,
  generalLedgerQuerySchema,
  trialBalanceQuerySchema,
  financialReportQuerySchema,
  closeFinancialYearSchema,
} from './accounting.validation.js';
import { sendResponse, formatZodErrors } from '../../utils/apiResponse.js';

/**
 * -------------------------------------------------------------
 * Chart of Accounts (COA) Controllers
 * -------------------------------------------------------------
 */

export const seedAccounts = async (req, res, next) => {
  try {
    const accounts = await accountingService.seedAccounts(req.tenantId);
    return sendResponse(res, 200, true, 'Default Chart of Accounts seeded successfully', accounts);
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const validatedData = createAccountSchema.parse(req.body);
    const account = await accountingService.createAccount(req.tenantId, validatedData);
    return sendResponse(res, 201, true, 'Account created successfully', account);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getAccounts = async (req, res, next) => {
  try {
    const validatedQuery = queryAccountsSchema.parse(req.query);
    const accounts = await accountingService.getAccounts(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Accounts retrieved successfully', accounts);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getAccountById = async (req, res, next) => {
  try {
    const account = await accountingService.getAccountById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Account details retrieved successfully', account);
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const validatedData = updateAccountSchema.parse(req.body);
    const account = await accountingService.updateAccount(req.tenantId, req.params.id, validatedData);
    return sendResponse(res, 200, true, 'Account updated successfully', account);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const result = await accountingService.deleteAccount(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, result.message, null);
  } catch (error) {
    next(error);
  }
};

/**
 * -------------------------------------------------------------
 * Journal Entry Controllers
 * -------------------------------------------------------------
 */

export const createJournalEntry = async (req, res, next) => {
  try {
    const validatedData = createJournalEntrySchema.parse(req.body);
    const entry = await accountingService.createJournalEntry(
      req.tenantId,
      req.user?._id,
      validatedData
    );
    return sendResponse(res, 201, true, 'Journal entry posted successfully', entry);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getJournalEntries = async (req, res, next) => {
  try {
    const validatedQuery = queryJournalEntriesSchema.parse(req.query);
    const result = await accountingService.getJournalEntries(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Journal entries retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getJournalEntryById = async (req, res, next) => {
  try {
    const entry = await accountingService.getJournalEntryById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Journal entry retrieved successfully', entry);
  } catch (error) {
    next(error);
  }
};

export const reverseJournalEntry = async (req, res, next) => {
  try {
    const validatedData = reverseJournalEntrySchema.parse(req.body || {});
    const result = await accountingService.reverseJournalEntry(
      req.tenantId,
      req.user?._id,
      req.params.id,
      validatedData
    );
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

/**
 * -------------------------------------------------------------
 * Financial Reports Controllers
 * -------------------------------------------------------------
 */

export const getGeneralLedger = async (req, res, next) => {
  try {
    const validatedQuery = generalLedgerQuerySchema.parse(req.query);
    const report = await accountingService.getGeneralLedger(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'General Ledger retrieved successfully', report);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getTrialBalance = async (req, res, next) => {
  try {
    const validatedQuery = trialBalanceQuerySchema.parse(req.query);
    const report = await accountingService.getTrialBalance(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Trial Balance retrieved successfully', report);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getProfitAndLoss = async (req, res, next) => {
  try {
    const validatedQuery = financialReportQuerySchema.parse(req.query);
    const report = await accountingService.getProfitAndLoss(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Profit & Loss statement retrieved successfully', report);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getBalanceSheet = async (req, res, next) => {
  try {
    const validatedQuery = financialReportQuerySchema.parse(req.query);
    const report = await accountingService.getBalanceSheet(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Balance Sheet retrieved successfully', report);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getCashFlowStatement = async (req, res, next) => {
  try {
    const validatedQuery = financialReportQuerySchema.parse(req.query);
    const report = await accountingService.getCashFlowStatement(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Cash Flow statement retrieved successfully', report);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const closeFinancialYear = async (req, res, next) => {
  try {
    const validatedData = closeFinancialYearSchema.parse(req.body);
    const result = await accountingService.closeFinancialYear(
      req.tenantId,
      req.user?._id,
      validatedData
    );
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};
