import { ZodError } from 'zod';
import * as subscriptionService from '../services/subscription.service.js';
import * as billingService from '../services/subscriptionBilling.service.js';
import * as limitService from '../services/subscriptionLimit.service.js';
import {
  upgradePlanSchema,
  cancelSubscriptionSchema,
  paymentConfirmationSchema,
} from '../validators/subscription.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

export const getPublicPlans = async (req, res, next) => {
  try {
    const plans = await subscriptionService.getPlans(req.query, false);
    return sendResponse(res, 200, true, 'Available subscription plans retrieved successfully', plans);
  } catch (error) {
    next(error);
  }
};

export const getPlanDetails = async (req, res, next) => {
  try {
    const plan = await subscriptionService.getPlanById(req.params.id);
    return sendResponse(res, 200, true, 'Plan details retrieved successfully', plan);
  } catch (error) {
    next(error);
  }
};

export const getCurrentSubscription = async (req, res, next) => {
  try {
    const data = await subscriptionService.getCurrentSubscription(req.tenantId);
    return sendResponse(res, 200, true, 'Current subscription details retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionUsage = async (req, res, next) => {
  try {
    const usage = await limitService.getUsageOverview(req.tenantId);
    return sendResponse(res, 200, true, 'Plan resource usage retrieved successfully', usage);
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionHistory = async (req, res, next) => {
  try {
    const history = await subscriptionService.getSubscriptionHistory(req.tenantId);
    return sendResponse(res, 200, true, 'Subscription history retrieved successfully', history);
  } catch (error) {
    next(error);
  }
};

export const upgradeOrDowngrade = async (req, res, next) => {
  try {
    const validatedData = upgradePlanSchema.parse(req.body);
    const result = await subscriptionService.upgradeOrDowngradePlan({
      tenantId: req.tenantId,
      newPlanId: validatedData.planId,
      billingCycle: validatedData.billingCycle,
      autoRenew: validatedData.autoRenew,
      userId: req.user?._id,
    });
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const renewSubscription = async (req, res, next) => {
  try {
    const result = await subscriptionService.renewSubscription({
      tenantId: req.tenantId,
      userId: req.user?._id,
    });
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    next(error);
  }
};

export const cancelSubscription = async (req, res, next) => {
  try {
    const validatedData = cancelSubscriptionSchema.parse(req.body);
    const result = await subscriptionService.cancelSubscription({
      tenantId: req.tenantId,
      cancellationReason: validatedData.cancellationReason,
      userId: req.user?._id,
    });
    return sendResponse(res, 200, true, result.message, result.subscription);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getInvoices = async (req, res, next) => {
  try {
    const result = await billingService.getTenantInvoices(req.tenantId, req.query);
    return sendResponse(res, 200, true, 'Subscription invoices retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

export const confirmPayment = async (req, res, next) => {
  try {
    const validatedData = paymentConfirmationSchema.parse(req.body);
    const result = await billingService.processPaymentConfirmation({
      invoiceId: validatedData.invoiceId,
      gateway: validatedData.gateway,
      transactionId: validatedData.transactionId,
      orderId: validatedData.orderId,
      paymentMethod: validatedData.paymentMethod,
      signature: validatedData.signature,
      userId: req.user?._id,
      metadata: validatedData.metadata,
    });
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};
