import { ZodError } from 'zod';
import * as purchasesService from '../services/purchases.service.js';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  createGRNSchema,
  createPurchaseBillSchema,
  updatePurchaseBillSchema,
  createPurchaseReturnSchema,
  queryPurchasesSchema,
} from '../validators/purchases.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * ==========================================
 * Purchase Orders Controllers
 * ==========================================
 */
export const createPurchaseOrder = async (req, res, next) => {
  try {
    const validatedData = createPurchaseOrderSchema.parse(req.body);
    const po = await purchasesService.createPurchaseOrder(req.tenantId, req.user?._id, validatedData);
    return sendResponse(res, 201, true, 'Purchase order created successfully', po);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getPurchaseOrders = async (req, res, next) => {
  try {
    const validatedQuery = queryPurchasesSchema.parse(req.query);
    const result = await purchasesService.getPurchaseOrders(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Purchase orders retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getPurchaseOrderById = async (req, res, next) => {
  try {
    const po = await purchasesService.getPurchaseOrderById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Purchase order details retrieved successfully', po);
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseOrder = async (req, res, next) => {
  try {
    const validatedData = updatePurchaseOrderSchema.parse(req.body);
    const po = await purchasesService.updatePurchaseOrder(req.tenantId, req.params.id, validatedData);
    return sendResponse(res, 200, true, 'Purchase order updated successfully', po);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const approvePurchaseOrder = async (req, res, next) => {
  try {
    const po = await purchasesService.approvePurchaseOrder(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Purchase order approved successfully', po);
  } catch (error) {
    next(error);
  }
};

export const cancelPurchaseOrder = async (req, res, next) => {
  try {
    const po = await purchasesService.cancelPurchaseOrder(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Purchase order cancelled successfully', po);
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * Goods Receipt Notes (GRN) Controllers
 * ==========================================
 */
export const createGRN = async (req, res, next) => {
  try {
    const validatedData = createGRNSchema.parse(req.body);
    const grn = await purchasesService.createGRN(req.tenantId, req.user?._id, validatedData);
    return sendResponse(res, 201, true, 'Goods Receipt Note (GRN) created successfully', grn);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getGRNs = async (req, res, next) => {
  try {
    const validatedQuery = queryPurchasesSchema.parse(req.query);
    const result = await purchasesService.getGRNs(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'GRNs retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getGRNById = async (req, res, next) => {
  try {
    const grn = await purchasesService.getGRNById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'GRN details retrieved successfully', grn);
  } catch (error) {
    next(error);
  }
};

export const postGRN = async (req, res, next) => {
  try {
    const grn = await purchasesService.postGRN(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'GRN posted and warehouse stock updated successfully', grn);
  } catch (error) {
    next(error);
  }
};

export const cancelGRN = async (req, res, next) => {
  try {
    const grn = await purchasesService.cancelGRN(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'GRN cancelled and stock reversed successfully', grn);
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * Purchase Bills Controllers
 * ==========================================
 */
export const createPurchaseBill = async (req, res, next) => {
  try {
    const validatedData = createPurchaseBillSchema.parse(req.body);
    const bill = await purchasesService.createPurchaseBill(req.tenantId, req.user?._id, validatedData);
    return sendResponse(res, 201, true, 'Draft purchase bill created successfully', bill);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getPurchaseBills = async (req, res, next) => {
  try {
    const validatedQuery = queryPurchasesSchema.parse(req.query);
    const result = await purchasesService.getPurchaseBills(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Purchase bills retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getPurchaseBillById = async (req, res, next) => {
  try {
    const bill = await purchasesService.getPurchaseBillById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Purchase bill details retrieved successfully', bill);
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseBill = async (req, res, next) => {
  try {
    const validatedData = updatePurchaseBillSchema.parse(req.body);
    const bill = await purchasesService.updatePurchaseBill(req.tenantId, req.params.id, validatedData);
    return sendResponse(res, 200, true, 'Purchase bill updated successfully', bill);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const postPurchaseBill = async (req, res, next) => {
  try {
    const bill = await purchasesService.postPurchaseBill(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'Purchase bill finalized and posted successfully', bill);
  } catch (error) {
    next(error);
  }
};

export const cancelPurchaseBill = async (req, res, next) => {
  try {
    const bill = await purchasesService.cancelPurchaseBill(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'Purchase bill cancelled successfully', bill);
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * Purchase Returns & Debit Notes Controllers
 * ==========================================
 */
export const createPurchaseReturn = async (req, res, next) => {
  try {
    const validatedData = createPurchaseReturnSchema.parse(req.body);
    const debitNote = await purchasesService.createPurchaseReturn(req.tenantId, req.user?._id, validatedData);
    return sendResponse(res, 201, true, 'Purchase return / debit note drafted successfully', debitNote);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getDebitNotes = async (req, res, next) => {
  try {
    const validatedQuery = queryPurchasesSchema.parse(req.query);
    const result = await purchasesService.getDebitNotes(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Debit notes retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getDebitNoteById = async (req, res, next) => {
  try {
    const debitNote = await purchasesService.getDebitNoteById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Debit note details retrieved successfully', debitNote);
  } catch (error) {
    next(error);
  }
};

export const postDebitNote = async (req, res, next) => {
  try {
    const debitNote = await purchasesService.postDebitNote(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'Debit note posted and stock reduced successfully', debitNote);
  } catch (error) {
    next(error);
  }
};

export default {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createGRN,
  getGRNs,
  getGRNById,
  postGRN,
  cancelGRN,
  createPurchaseBill,
  getPurchaseBills,
  getPurchaseBillById,
  updatePurchaseBill,
  postPurchaseBill,
  cancelPurchaseBill,
  createPurchaseReturn,
  getDebitNotes,
  getDebitNoteById,
  postDebitNote,
};
