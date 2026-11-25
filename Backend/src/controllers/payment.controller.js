import { ZodError } from 'zod';
import * as paymentService from '../services/payment.service.js';
import {
  createPaymentSchema,
  cancelPaymentSchema,
  queryPaymentsSchema,
  allocatePaymentSchema,
} from '../validators/payment.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

export const createPayment = async (req, res, next) => {
  try {
    const validatedData = createPaymentSchema.parse(req.body);
    const payment = await paymentService.createPayment(
      req.tenantId,
      req.user._id,
      validatedData
    );
    const msg =
      payment.direction === 'in'
        ? 'Payment receipt recorded successfully'
        : 'Supplier payment recorded successfully';
    return sendResponse(res, 201, true, msg, payment);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getPayments = async (req, res, next) => {
  try {
    const validatedQuery = queryPaymentsSchema.parse(req.query);
    const result = await paymentService.getPayments(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Payments retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Payment details retrieved successfully', payment);
  } catch (error) {
    next(error);
  }
};

export const cancelPayment = async (req, res, next) => {
  try {
    const validatedData = cancelPaymentSchema.parse(req.body);
    const payment = await paymentService.cancelPayment(
      req.tenantId,
      req.user._id,
      req.params.id,
      validatedData.cancellationReason
    );
    return sendResponse(res, 200, true, 'Payment cancelled and reversed successfully', payment);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const allocatePayment = async (req, res, next) => {
  try {
    const { allocations } = allocatePaymentSchema.parse(req.body);
    const payment = await paymentService.allocatePayment(
      req.tenantId,
      req.user?._id || req.userId,
      req.params.id,
      allocations
    );
    return sendResponse(res, 200, true, 'Payment allocated successfully', payment);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export default {
  createPayment,
  getPayments,
  getPaymentById,
  cancelPayment,
  allocatePayment,
};
