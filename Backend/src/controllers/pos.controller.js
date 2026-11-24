import { ZodError } from 'zod';
import * as posService from '../services/pos.service.js';
import {
  createPosBillSchema,
  updatePosBillSchema,
  finalizePosBillSchema,
  cancelPosBillSchema,
  queryPosBillsSchema,
  queryPosProductsSchema,
  queryPosDailySummarySchema,
} from '../validators/pos.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * Create POS Bill
 * POST /api/pos/bills
 */
export const createBill = async (req, res, next) => {
  try {
    const validatedData = createPosBillSchema.parse(req.body);
    const bill = await posService.createPosBill(
      req.tenantId,
      req.user,
      validatedData
    );

    const message = bill.invoiceStatus === 'posted'
      ? 'POS bill created and finalized successfully'
      : 'Draft POS bill created successfully';

    return sendResponse(res, 201, true, message, bill);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Finalize an existing draft POS Bill
 * POST /api/pos/bills/:id/finalize
 */
export const finalizeBill = async (req, res, next) => {
  try {
    const validatedData = finalizePosBillSchema.parse(req.body);
    const bill = await posService.finalizePosBill(
      req.tenantId,
      req.user,
      req.params.id,
      validatedData
    );

    return sendResponse(res, 200, true, 'POS bill finalized successfully', bill);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Get POS Bill by ID
 * GET /api/pos/bills/:id
 */
export const getBillById = async (req, res, next) => {
  try {
    const bill = await posService.getPosBillById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'POS bill retrieved successfully', bill);
  } catch (error) {
    next(error);
  }
};

/**
 * List POS Bills with pagination and filters
 * GET /api/pos/bills
 */
export const getBills = async (req, res, next) => {
  try {
    const validatedQuery = queryPosBillsSchema.parse(req.query);
    const result = await posService.getPosBills(req.tenantId, validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'POS bills retrieved successfully',
      data: result.bills,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Update draft POS Bill
 * PATCH /api/pos/bills/:id
 */
export const updateDraftBill = async (req, res, next) => {
  try {
    const validatedData = updatePosBillSchema.parse(req.body);
    const bill = await posService.updateDraftPosBill(
      req.tenantId,
      req.user,
      req.params.id,
      validatedData
    );

    return sendResponse(res, 200, true, 'Draft POS bill updated successfully', bill);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Cancel POS Bill
 * POST /api/pos/bills/:id/cancel
 */
export const cancelBill = async (req, res, next) => {
  try {
    const validatedData = cancelPosBillSchema.parse(req.body);
    const bill = await posService.cancelPosBill(
      req.tenantId,
      req.user,
      req.params.id,
      validatedData.cancellationReason
    );

    return sendResponse(res, 200, true, 'POS bill cancelled successfully', bill);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Get thermal receipt payload for printing
 * GET /api/pos/bills/:id/receipt
 */
export const getReceipt = async (req, res, next) => {
  try {
    const receipt = await posService.getPosReceiptData(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'POS receipt data retrieved successfully', receipt);
  } catch (error) {
    next(error);
  }
};

/**
 * Search POS Products with live inventory availability
 * GET /api/pos/products
 */
export const getProducts = async (req, res, next) => {
  try {
    const validatedQuery = queryPosProductsSchema.parse(req.query);
    const result = await posService.searchPosProducts(req.tenantId, validatedQuery);

    return res.status(200).json({
      success: true,
      message: 'POS products retrieved successfully',
      data: result.products,
      pagination: result.pagination,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Search POS Customers
 * GET /api/pos/customers
 */
export const getCustomers = async (req, res, next) => {
  try {
    const result = await posService.searchPosCustomers(req.tenantId, req.query);
    return sendResponse(res, 200, true, 'POS customers retrieved successfully', result.customers);
  } catch (error) {
    next(error);
  }
};

/**
 * Daily POS Sales Summary
 * GET /api/pos/daily-summary
 */
export const getDailySummary = async (req, res, next) => {
  try {
    const validatedQuery = queryPosDailySummarySchema.parse(req.query);
    const summary = await posService.getPosDailySummary(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Daily POS summary retrieved successfully', summary);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Cashier-wise POS Sales Summary
 * GET /api/pos/cashier-summary
 */
export const getCashierSummary = async (req, res, next) => {
  try {
    const summary = await posService.getPosCashierSummary(req.tenantId, req.query);
    return sendResponse(res, 200, true, 'Cashier POS summary retrieved successfully', summary);
  } catch (error) {
    next(error);
  }
};

export default {
  createBill,
  finalizeBill,
  getBillById,
  getBills,
  updateDraftBill,
  cancelBill,
  getReceipt,
  getProducts,
  getCustomers,
  getDailySummary,
  getCashierSummary,
};
