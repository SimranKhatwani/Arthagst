import mongoose from 'mongoose';
import Plan from '../models/plan.model.js';
import Subscription from '../models/subscription.model.js';
import Tenant from '../models/tenant.model.js';
import { seedDefaultPlans } from './plan.seed.js';
import { createSubscriptionInvoice } from './subscriptionBilling.service.js';
import { getUsageOverview } from './subscriptionLimit.service.js';
import * as notificationService from './notification.service.js';
import * as auditLogService from './auditLog.service.js';

/**
 * Helper to compute period end date based on billing cycle
 */
export const calculatePeriodEnd = (startDate, billingCycle) => {
  const start = new Date(startDate);
  const end = new Date(start);

  switch (billingCycle) {
    case 'quarterly':
      end.setMonth(end.getMonth() + 3);
      break;
    case 'yearly':
      end.setFullYear(end.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      end.setMonth(end.getMonth() + 1);
      break;
  }

  return end;
};

/**
 * -------------------------------------------------------------
 * PLAN MANAGEMENT SERVICES
 * -------------------------------------------------------------
 */

export const createPlan = async (data) => {
  const code = data.code.trim().toUpperCase();
  const existing = await Plan.findOne({ code });
  if (existing) {
    const error = new Error(`Plan with code '${code}' already exists`);
    error.statusCode = 409;
    throw error;
  }

  const plan = new Plan({
    name: data.name.trim(),
    code,
    description: data.description || '',
    price: data.price !== undefined ? data.price : 0,
    billingCycle: data.billingCycle || 'monthly',
    trialDays: data.trialDays !== undefined ? data.trialDays : 0,
    limits: {
      maxUsers: data.limits?.maxUsers !== undefined ? data.limits.maxUsers : 2,
      maxProducts: data.limits?.maxProducts !== undefined ? data.limits.maxProducts : 100,
      maxInvoices: data.limits?.maxInvoices !== undefined ? data.limits.maxInvoices : 50,
      maxWarehouses: data.limits?.maxWarehouses !== undefined ? data.limits.maxWarehouses : 1,
      storageLimit: data.limits?.storageLimit !== undefined ? data.limits.storageLimit : 1024,
    },
    features: Array.isArray(data.features) ? data.features : [],
    isActive: data.isActive !== undefined ? data.isActive : true,
    isPublic: data.isPublic !== undefined ? data.isPublic : true,
    isTrial: data.isTrial !== undefined ? data.isTrial : false,
  });

  await plan.save();
  return plan;
};

export const updatePlan = async (id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid plan ID format');
    error.statusCode = 400;
    throw error;
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    const error = new Error('Plan not found');
    error.statusCode = 404;
    throw error;
  }

  // Updating the plan definition does NOT retroactively alter active subscriptions
  // because existing subscriptions preserve their historical configuration inside planSnapshot.
  if (data.name !== undefined) plan.name = data.name.trim();
  if (data.description !== undefined) plan.description = data.description;
  if (data.price !== undefined) plan.price = data.price;
  if (data.billingCycle !== undefined) plan.billingCycle = data.billingCycle;
  if (data.trialDays !== undefined) plan.trialDays = data.trialDays;
  if (data.features !== undefined && Array.isArray(data.features)) plan.features = data.features;
  if (data.isActive !== undefined) plan.isActive = data.isActive;
  if (data.isPublic !== undefined) plan.isPublic = data.isPublic;

  if (data.limits) {
    plan.limits = {
      ...plan.limits,
      ...data.limits,
    };
  }

  await plan.save();
  return plan;
};

export const togglePlanStatus = async (id, isActive) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid plan ID format');
    error.statusCode = 400;
    throw error;
  }

  const plan = await Plan.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!plan) {
    const error = new Error('Plan not found');
    error.statusCode = 404;
    throw error;
  }
  return plan;
};

export const getPlans = async (query = {}, isSuperAdmin = false) => {
  await seedDefaultPlans();

  const filter = {};
  if (!isSuperAdmin) {
    filter.isActive = true;
    filter.isPublic = true;
  } else {
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;
    if (query.isPublic !== undefined) filter.isPublic = query.isPublic === 'true' || query.isPublic === true;
  }

  const plans = await Plan.find(filter).sort({ price: 1, createdAt: 1 });
  return plans;
};

export const getPlanById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid plan ID format');
    error.statusCode = 400;
    throw error;
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    const error = new Error('Plan not found');
    error.statusCode = 404;
    throw error;
  }
  return plan;
};

/**
 * -------------------------------------------------------------
 * TENANT SUBSCRIPTION SERVICES
 * -------------------------------------------------------------
 */

/**
 * Start or initialize trial subscription for a tenant (e.g. upon registration)
 */
export const startTrial = async (tenantId, { trialDays = 14, planCode = 'TRIAL', session = null } = {}) => {
  await seedDefaultPlans(session);

  let plan = await Plan.findOne({ code: planCode }).session(session);
  if (!plan) {
    plan = await Plan.findOne({ isTrial: true }).session(session);
  }
  if (!plan) {
    plan = await Plan.findOne({}).sort({ price: 1 }).session(session);
  }

  const now = new Date();
  const effectiveTrialDays = trialDays || plan.trialDays || 14;
  const trialEnd = new Date(now.getTime() + effectiveTrialDays * 24 * 60 * 60 * 1000);

  const planSnapshot = {
    name: plan.name,
    code: plan.code,
    price: plan.price,
    billingCycle: plan.billingCycle,
    limits: {
      maxUsers: plan.limits?.maxUsers !== undefined ? plan.limits.maxUsers : 2,
      maxProducts: plan.limits?.maxProducts !== undefined ? plan.limits.maxProducts : 50,
      maxInvoices: plan.limits?.maxInvoices !== undefined ? plan.limits.maxInvoices : 30,
      maxWarehouses: plan.limits?.maxWarehouses !== undefined ? plan.limits.maxWarehouses : 1,
      storageLimit: plan.limits?.storageLimit !== undefined ? plan.limits.storageLimit : 512,
    },
    features: plan.features || [],
  };

  const subscriptionPayload = {
    tenantId,
    planId: plan._id,
    planSnapshot,
    startDate: now,
    trialStartDate: now,
    trialEndDate: trialEnd,
    currentPeriodStart: now,
    currentPeriodEnd: trialEnd,
    billingCycle: plan.billingCycle || 'monthly',
    amount: 0,
    status: 'trial',
    autoRenew: true,
    history: [
      {
        action: 'trial_started',
        fromPlanCode: '',
        toPlanCode: plan.code,
        amount: 0,
        date: now,
        notes: `${effectiveTrialDays}-day trial initiated`,
      },
    ],
  };

  let subscription;
  if (session) {
    const existing = await Subscription.findOne({ tenantId }).session(session);
    if (existing) return existing;

    const [created] = await Subscription.create([subscriptionPayload], { session });
    subscription = created;

    // Create free trial invoice ($0)
    await createSubscriptionInvoice({
      tenantId,
      subscriptionId: subscription._id,
      plan: planSnapshot,
      billingPeriod: { startDate: now, endDate: trialEnd },
      dueDate: trialEnd,
      session,
    });

    await Tenant.findByIdAndUpdate(tenantId, { subscriptionStatus: 'trial' }, { session });
  } else {
    const existing = await Subscription.findOne({ tenantId });
    if (existing) return existing;

    subscription = await Subscription.create(subscriptionPayload);

    await createSubscriptionInvoice({
      tenantId,
      subscriptionId: subscription._id,
      plan: planSnapshot,
      billingPeriod: { startDate: now, endDate: trialEnd },
      dueDate: trialEnd,
    });

    await Tenant.findByIdAndUpdate(tenantId, { subscriptionStatus: 'trial' });
  }

  return subscription;
};

/**
 * View current subscription and usage for a tenant
 */
export const getCurrentSubscription = async (tenantId) => {
  const subscription = await Subscription.findOne({ tenantId }).populate('planId');
  if (!subscription) {
    const error = new Error('No active subscription found for this tenant');
    error.statusCode = 404;
    throw error;
  }

  const usage = await getUsageOverview(tenantId);
  return {
    subscription,
    usage,
  };
};

/**
 * Upgrade or Downgrade plan for a tenant
 */
export const upgradeOrDowngradePlan = async ({
  tenantId,
  newPlanId,
  billingCycle = 'monthly',
  autoRenew = true,
  userId = null,
}) => {
  if (!mongoose.isValidObjectId(newPlanId)) {
    const error = new Error('Invalid plan ID format');
    error.statusCode = 400;
    throw error;
  }

  const newPlan = await Plan.findById(newPlanId);
  if (!newPlan || !newPlan.isActive) {
    const error = new Error('Target plan not found or is currently inactive');
    error.statusCode = 400;
    throw error;
  }

  let subscription = await Subscription.findOne({ tenantId });
  if (!subscription) {
    const error = new Error('Subscription not found for this tenant');
    error.statusCode = 404;
    throw error;
  }

  const oldPlanCode = subscription.planSnapshot?.code;
  const isUpgrade = (newPlan.price || 0) >= (subscription.planSnapshot?.price || 0);

  const now = new Date();
  const periodEnd = calculatePeriodEnd(now, billingCycle);

  const newSnapshot = {
    name: newPlan.name,
    code: newPlan.code,
    price: newPlan.price,
    billingCycle,
    limits: { ...newPlan.limits },
    features: [...newPlan.features],
  };

  // Generate subscription invoice for the new plan
  const invoice = await createSubscriptionInvoice({
    tenantId,
    subscriptionId: subscription._id,
    plan: newSnapshot,
    billingPeriod: { startDate: now, endDate: periodEnd },
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
  });

  // If free plan, switch immediately
  if (newPlan.price === 0) {
    subscription.planId = newPlan._id;
    subscription.planSnapshot = newSnapshot;
    subscription.billingCycle = billingCycle;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = periodEnd;
    subscription.amount = 0;
    subscription.status = newPlan.isTrial ? 'trial' : 'active';
    subscription.autoRenew = autoRenew;

    subscription.history.push({
      action: isUpgrade ? 'upgraded' : 'downgraded',
      fromPlanCode: oldPlanCode,
      toPlanCode: newPlan.code,
      amount: 0,
      date: now,
      notes: `Plan changed to ${newPlan.name}`,
      performedBy: userId,
    });

    await subscription.save();
    await Tenant.findByIdAndUpdate(tenantId, { subscriptionStatus: subscription.status });
  }

  return {
    message: `Plan change initiated to ${newPlan.name}. Please pay invoice to activate.`,
    invoice,
    subscription,
    isImmediate: newPlan.price === 0,
  };
};

/**
 * Renew subscription for another period
 */
export const renewSubscription = async ({ tenantId, userId = null }) => {
  const subscription = await Subscription.findOne({ tenantId });
  if (!subscription) {
    const error = new Error('Subscription not found for this tenant');
    error.statusCode = 404;
    throw error;
  }

  const plan = await Plan.findById(subscription.planId);
  const planSnapshot = subscription.planSnapshot;

  const newPeriodStart = subscription.currentPeriodEnd > new Date() ? subscription.currentPeriodEnd : new Date();
  const newPeriodEnd = calculatePeriodEnd(newPeriodStart, subscription.billingCycle);

  const invoice = await createSubscriptionInvoice({
    tenantId,
    subscriptionId: subscription._id,
    plan: planSnapshot,
    billingPeriod: { startDate: newPeriodStart, endDate: newPeriodEnd },
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    message: 'Subscription renewal invoice generated',
    invoice,
    subscription,
  };
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async ({ tenantId, cancellationReason = '', userId = null }) => {
  const subscription = await Subscription.findOne({ tenantId });
  if (!subscription) {
    const error = new Error('Subscription not found for this tenant');
    error.statusCode = 404;
    throw error;
  }

  if (subscription.status === 'cancelled') {
    const error = new Error('Subscription is already cancelled');
    error.statusCode = 400;
    throw error;
  }

  subscription.status = 'cancelled';
  subscription.cancellationDate = new Date();
  subscription.cancellationReason = cancellationReason;
  subscription.autoRenew = false;

  subscription.history.push({
    action: 'cancelled',
    fromPlanCode: subscription.planSnapshot.code,
    toPlanCode: subscription.planSnapshot.code,
    amount: 0,
    date: new Date(),
    notes: `Subscription cancelled. Reason: ${cancellationReason || 'User requested cancellation'}`,
    performedBy: userId,
  });

  await subscription.save();

  // Tenant subscription status is updated to cancelled
  await Tenant.findByIdAndUpdate(tenantId, {
    subscriptionStatus: 'cancelled',
  });

  // Notification for subscription cancellation
  await notificationService.createNotification({
    tenantId,
    title: 'Subscription Cancelled',
    message: 'Your SaaS subscription has been cancelled. Access remains until the current period ends.',
    notificationType: 'subscription',
    referenceType: 'Subscription',
    referenceId: subscription._id,
  });

  // Audit Log for cancellation
  await auditLogService.logAuditAction({
    tenantId,
    userId,
    action: 'SUBSCRIPTION_CANCELLED',
    module: 'subscriptions',
    entityType: 'Subscription',
    entityId: subscription._id,
    targetName: subscription.planSnapshot?.name || 'Subscription',
    description: `Subscription cancelled. Reason: ${cancellationReason || 'User request'}`,
    changes: { cancellationReason },
  });

  return {
    message: 'Subscription cancelled successfully. You will retain access until the end of the current period.',
    subscription,
  };
};

/**
 * Get subscription change history for tenant
 */
export const getSubscriptionHistory = async (tenantId) => {
  const subscription = await Subscription.findOne({ tenantId })
    .select('history')
    .populate('history.performedBy', 'name email');

  if (!subscription) {
    return [];
  }

  return subscription.history.sort((a, b) => new Date(b.date) - new Date(a.date));
};

export default {
  calculatePeriodEnd,
  createPlan,
  updatePlan,
  togglePlanStatus,
  getPlans,
  getPlanById,
  startTrial,
  getCurrentSubscription,
  upgradeOrDowngradePlan,
  renewSubscription,
  cancelSubscription,
  getSubscriptionHistory,
};
