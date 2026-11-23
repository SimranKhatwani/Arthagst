import { ZodError } from 'zod';
import * as eInvoiceService from './eInvoice.service.js';
import {
  generateEInvoiceSchema,
  cancelEInvoiceSchema,
  queryEInvoiceSchema,
} from './eInvoice.validation.js';
import { sendResponse, formatZodErrors } from '../../utils/apiResponse.js';

export const generateEInvoice = async (req, res, next) => {
  try {
    const validatedData = generateEInvoiceSchema.parse(req.body);
    const eInvoice = await eInvoiceService.generateEInvoice(
      req.tenantId,
      req.user._id,
      validatedData
    );
    return sendResponse(res, 201, true, 'E-Invoice (IRN) generated successfully', eInvoice);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const cancelEInvoice = async (req, res, next) => {
  try {
    const validatedData = cancelEInvoiceSchema.parse(req.body);
    const eInvoice = await eInvoiceService.cancelEInvoice(
      req.tenantId,
      req.user._id,
      req.params.id,
      validatedData
    );
    return sendResponse(res, 200, true, 'E-Invoice (IRN) cancelled successfully', eInvoice);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getEInvoices = async (req, res, next) => {
  try {
    const validatedQuery = queryEInvoiceSchema.parse(req.query);
    const result = await eInvoiceService.getEInvoices(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'E-Invoices retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getEInvoiceById = async (req, res, next) => {
  try {
    const eInvoice = await eInvoiceService.getEInvoiceById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'E-Invoice details retrieved successfully', eInvoice);
  } catch (error) {
    next(error);
  }
};

export const getEInvoiceByInvoiceId = async (req, res, next) => {
  try {
    const eInvoice = await eInvoiceService.getEInvoiceByInvoiceId(req.tenantId, req.params.invoiceId);
    if (!eInvoice) {
      return sendResponse(res, 200, true, 'No E-Invoice generated for this sales invoice', null);
    }
    return sendResponse(res, 200, true, 'E-Invoice retrieved successfully', eInvoice);
  } catch (error) {
    next(error);
  }
};

export const checkEligibility = async (req, res, next) => {
  try {
    const eligibility = await eInvoiceService.checkEligibility(req.tenantId, req.params.invoiceId);
    return sendResponse(res, 200, true, 'E-Invoice eligibility checked', eligibility);
  } catch (error) {
    next(error);
  }
};

export default {
  generateEInvoice,
  cancelEInvoice,
  getEInvoices,
  getEInvoiceById,
  getEInvoiceByInvoiceId,
  checkEligibility,
};
