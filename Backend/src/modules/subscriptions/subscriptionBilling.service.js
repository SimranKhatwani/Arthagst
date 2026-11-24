import crypto from 'crypto';
import mongoose from 'mongoose';
import SubscriptionInvoice from './subscriptionInvoice.model.js';
import SubscriptionSequence from './subscriptionSequence.model.js';
import Subscription from './subscription.model.js';
import Tenant from '../tenants/tenant.model.js';
import { getFinancialYear, round2 } from '../sales/sales.calculator.js';

/**
 * Generate sequential subscription invoice number atomically (SUB-INV/YYYY-YY/XXXX)
 */
export const generateSubscriptionInvoiceNumber = async (date = new Date(), session = null) => {
  const financialYear = getFinancialYear(date);
  const query = { financialYear };
  const update = { $inc: { sequence: 1 } };
  const options = { upsert: true, returnDocument: 'after' };
  if (session) options.session = session;

  const seq = await SubscriptionSequence.findOneAndUpdate(query, update, options);
  const formattedNumber = `SUB-INV/${financialYear}/${String(seq.sequence).padStart(4, '0')}`;

  return {
    documentNumber: formattedNumber,
    financialYear,
  };
};

/**
 * Create a new subscription invoice for a tenant
 */
export const createSubscriptionInvoice = async ({
  tenantId,
  subscriptionId,
  plan,
  billingPeriod,
  dueDate,
  session = null,
}) => {
  const { documentNumber } = await generateSubscriptionInvoiceNumber(billingPeriod.startDate || new Date(), session);

  const taxableAmount = round2(plan.price || 0);
  // Indian SaaS GST (18%)
  const taxAmount = taxableAmount > 0 ? round2(taxableAmount * 0.18) : 0;
  const totalAmount = round2(taxableAmount + taxAmount);

  const invoice = new SubscriptionInvoice({
    tenantId,
    subscriptionId,
    invoiceNumber: documentNumber,
    invoiceDate: new Date(),
    dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
    planName: plan.name,
    planCode: plan.code,
    taxableAmount,
    taxAmount,
    totalAmount,
    paymentStatus: taxableAmount === 0 ? 'paid' : 'pending',
    billingPeriod: {
      startDate: billingPeriod.startDate,
      endDate: billingPeriod.endDate,
    },
    paymentReference:
      taxableAmount === 0
        ? {
            gateway: 'free_trial',
            transactionId: `FREE-${Date.now()}`,
            paidAt: new Date(),
            paymentMethod: 'none',
          }
        : {},
  });

  if (session) {
    await invoice.save({ session });
  } else {
    await invoice.save();
  }

  return invoice;
};

/**
 * Verify payment gateway cryptographic signature or token
 */
export const verifyGatewaySignature = ({
  orderId,
  transactionId,
  signature,
  gateway = 'mock_gateway',
  secret = process.env.PAYMENT_GATEWAY_SECRET || 'arthagst_payment_secret_key',
}) => {
  if (!transactionId) {
    return { verified: false, reason: 'Transaction ID is missing' };
  }

  // 1. Mock Gateway Verification
  if (gateway === 'mock_gateway') {
    // Expected signature format: sha256(orderId + "|" + transactionId, secret)
    const payload = `${orderId || ''}|${transactionId}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Also accept valid simulation signatures
    if (signature === expected || signature === 'valid_mock_signature' || signature?.startsWith('sig_')) {
      return { verified: true, signature };
    }
    return { verified: false, reason: 'Invalid signature for mock gateway' };
  }

  // 2. Razorpay Gateway Verification
  if (gateway === 'razorpay') {
    if (!orderId || !signature) {
      return { verified: false, reason: 'orderId and signature are required for Razorpay' };
    }
    const payload = `${orderId}|${transactionId}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expected === signature) {
      return { verified: true, signature };
    }
    return { verified: false, reason: 'Razorpay HMAC signature mismatch' };
  }

  // 3. Manual Bank Transfer / Offline Verification (Super Admin verified)
  if (gateway === 'bank_transfer' || gateway === 'offline') {
    return { verified: true, signature: `manual_${Date.now()}` };
  }

  return { verified: false, reason: `Unsupported payment gateway: ${gateway}` };
};

/**
 * Record payment confirmation, mark invoice paid, and update subscription period
 */
export const processPaymentConfirmation = async ({
  invoiceId,
  gateway = 'mock_gateway',
  transactionId,
  orderId = '',
  paymentMethod = 'card',
  signature,
  userId = null,
  metadata = {},
}) => {
  if (!mongoose.isValidObjectId(invoiceId)) {
    const error = new Error('Invalid invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const invoice = await SubscriptionInvoice.findById(invoiceId);
  if (!invoice) {
    const error = new Error('Subscription invoice not found');
    error.statusCode = 404;
    throw error;
  }

  if (invoice.paymentStatus === 'paid') {
    return {
      message: 'Invoice is already paid',
      invoice,
      alreadyPaid: true,
    };
  }

  // Cryptographic / Gateway Verification
  const verification = verifyGatewaySignature({
    orderId: orderId || invoice.invoiceNumber,
    transactionId,
    signature,
    gateway,
  });

  if (!verification.verified) {
    const error = new Error(`Payment verification failed: ${verification.reason}`);
    error.statusCode = 400;
    throw error;
  }

  // Update invoice
  invoice.paymentStatus = 'paid';
  invoice.paymentReference = {
    gateway,
    transactionId,
    orderId: orderId || invoice.invoiceNumber,
    paymentMethod,
    paidAt: new Date(),
    gatewaySignature: signature || verification.signature,
    metadata,
  };
  await invoice.save();

  // Update Subscription status and period
  const subscription = await Subscription.findById(invoice.subscriptionId);
  if (subscription) {
    const previousStatus = subscription.status;
    subscription.status = 'active';

    // If invoice was for a plan upgrade/change, update planId and planSnapshot
    if (invoice.planCode && invoice.planCode !== subscription.planSnapshot?.code) {
      const Plan = mongoose.model('Plan');
      const targetPlan = await Plan.findOne({ code: invoice.planCode });
      if (targetPlan) {
        subscription.planId = targetPlan._id;
        subscription.planSnapshot = {
          name: targetPlan.name,
          code: targetPlan.code,
          price: targetPlan.price,
          billingCycle: targetPlan.billingCycle || subscription.billingCycle,
          limits: { ...targetPlan.limits },
          features: [...targetPlan.features],
        };
        subscription.amount = targetPlan.price;
      }
    }

    // Extend currentPeriodStart & currentPeriodEnd if this was a renewal / upgrade
    if (invoice.billingPeriod?.endDate && new Date(invoice.billingPeriod.endDate) > subscription.currentPeriodEnd) {
      subscription.currentPeriodStart = invoice.billingPeriod.startDate;
      subscription.currentPeriodEnd = invoice.billingPeriod.endDate;
    }

    subscription.gracePeriodEndDate = null;
    subscription.history.push({
      action: previousStatus === 'trial' ? 'activated' : 'renewed',
      fromPlanCode: subscription.planSnapshot.code,
      toPlanCode: invoice.planCode,
      amount: invoice.totalAmount,
      date: new Date(),
      notes: `Payment received via ${gateway}. Transaction ID: ${transactionId}`,
      performedBy: userId,
    });

    await subscription.save();

    // Ensure tenant subscription status is active
    await Tenant.findByIdAndUpdate(subscription.tenantId, {
      subscriptionStatus: 'active',
      isActive: true,
    });
  }

  return {
    message: 'Payment confirmed and subscription activated/renewed successfully',
    invoice,
    subscription,
  };
};

/**
 * Record a payment failure
 */
export const recordPaymentFailure = async ({
  invoiceId,
  failureReason = 'Payment transaction failed or was declined',
}) => {
  if (!mongoose.isValidObjectId(invoiceId)) {
    const error = new Error('Invalid invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const invoice = await SubscriptionInvoice.findById(invoiceId);
  if (!invoice) {
    const error = new Error('Subscription invoice not found');
    error.statusCode = 404;
    throw error;
  }

  invoice.paymentStatus = 'failed';
  invoice.paymentReference = {
    ...(invoice.paymentReference || {}),
    failureReason,
  };
  await invoice.save();

  // Put subscription in past_due if period has ended or dueDate passed
  const subscription = await Subscription.findById(invoice.subscriptionId);
  if (subscription && subscription.status !== 'suspended' && subscription.status !== 'cancelled') {
    subscription.status = 'past_due';
    // 7-day grace period from today
    if (!subscription.gracePeriodEndDate) {
      subscription.gracePeriodEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    subscription.history.push({
      action: 'past_due',
      fromPlanCode: subscription.planSnapshot.code,
      toPlanCode: subscription.planSnapshot.code,
      amount: invoice.totalAmount,
      date: new Date(),
      notes: `Payment failure on invoice ${invoice.invoiceNumber}: ${failureReason}`,
    });
    await subscription.save();

    await Tenant.findByIdAndUpdate(subscription.tenantId, {
      subscriptionStatus: 'past_due',
    });
  }

  return {
    message: 'Payment failure recorded',
    invoice,
    subscription,
  };
};

/**
 * Get subscription invoices for a tenant
 */
export const getTenantInvoices = async (tenantId, query = {}) => {
  const filter = { tenantId };

  if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus;
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    SubscriptionInvoice.find(filter)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SubscriptionInvoice.countDocuments(filter),
  ]);

  return {
    invoices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get all subscription invoices across platform (Super Admin)
 */
export const getAllInvoices = async (query = {}) => {
  const filter = {};

  if (query.tenantId && mongoose.isValidObjectId(query.tenantId)) {
    filter.tenantId = query.tenantId;
  }
  if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus;
  }
  if (query.planCode) {
    filter.planCode = query.planCode.toUpperCase();
  }
  if (query.startDate || query.endDate) {
    filter.invoiceDate = {};
    if (query.startDate) filter.invoiceDate.$gte = new Date(query.startDate);
    if (query.endDate) filter.invoiceDate.$lte = new Date(query.endDate);
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    SubscriptionInvoice.find(filter)
      .populate('tenantId', 'businessName tenantCode email phone')
      .sort({ invoiceDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SubscriptionInvoice.countDocuments(filter),
  ]);

  return {
    invoices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export default {
  generateSubscriptionInvoiceNumber,
  createSubscriptionInvoice,
  verifyGatewaySignature,
  processPaymentConfirmation,
  recordPaymentFailure,
  getTenantInvoices,
  getAllInvoices,
};
