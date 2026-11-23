import { ZodError } from 'zod';
import * as eWayBillService from './eWayBill.service.js';
import {
  generateEWayBillSchema,
  updateVehicleSchema,
  updateTransporterSchema,
  extendValiditySchema,
  cancelEWayBillSchema,
  queryEWayBillSchema,
} from './eWayBill.validation.js';
import { sendResponse, formatZodErrors } from '../../utils/apiResponse.js';

export const generateEWayBill = async (req, res, next) => {
  try {
    const validatedData = generateEWayBillSchema.parse(req.body);
    const ewb = await eWayBillService.generateEWayBill(
      req.tenantId,
      req.user._id,
      validatedData
    );
    return sendResponse(res, 201, true, 'E-Way Bill generated successfully', ewb);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const updateVehicle = async (req, res, next) => {
  try {
    const validatedData = updateVehicleSchema.parse(req.body);
    const ewb = await eWayBillService.updateVehicle(
      req.tenantId,
      req.user._id,
      req.params.id,
      validatedData
    );
    return sendResponse(res, 200, true, 'Vehicle details updated successfully', ewb);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const updateTransporter = async (req, res, next) => {
  try {
    const validatedData = updateTransporterSchema.parse(req.body);
    const ewb = await eWayBillService.updateTransporter(
      req.tenantId,
      req.user._id,
      req.params.id,
      validatedData
    );
    return sendResponse(res, 200, true, 'Transporter details updated successfully', ewb);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const extendValidity = async (req, res, next) => {
  try {
    const validatedData = extendValiditySchema.parse(req.body);
    const ewb = await eWayBillService.extendValidity(
      req.tenantId,
      req.user._id,
      req.params.id,
      validatedData
    );
    return sendResponse(res, 200, true, 'E-Way Bill validity extended successfully', ewb);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const cancelEWayBill = async (req, res, next) => {
  try {
    const validatedData = cancelEWayBillSchema.parse(req.body);
    const ewb = await eWayBillService.cancelEWayBill(
      req.tenantId,
      req.user._id,
      req.params.id,
      validatedData
    );
    return sendResponse(res, 200, true, 'E-Way Bill cancelled successfully', ewb);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getEWayBills = async (req, res, next) => {
  try {
    const validatedQuery = queryEWayBillSchema.parse(req.query);
    const result = await eWayBillService.getEWayBills(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'E-Way Bills retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getEWayBillById = async (req, res, next) => {
  try {
    const ewb = await eWayBillService.getEWayBillById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'E-Way Bill details retrieved successfully', ewb);
  } catch (error) {
    next(error);
  }
};

export const getEWayBillByInvoiceId = async (req, res, next) => {
  try {
    const ewbs = await eWayBillService.getEWayBillByInvoiceId(req.tenantId, req.params.invoiceId);
    return sendResponse(res, 200, true, 'E-Way Bills retrieved successfully', ewbs);
  } catch (error) {
    next(error);
  }
};

export default {
  generateEWayBill,
  updateVehicle,
  updateTransporter,
  extendValidity,
  cancelEWayBill,
  getEWayBills,
  getEWayBillById,
  getEWayBillByInvoiceId,
};
