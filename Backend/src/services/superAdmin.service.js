import mongoose from 'mongoose';
import Tenant from '../models/tenant.model.js';
import User from '../models/user.model.js';
import Subscription from '../models/subscription.model.js';
import Plan from '../models/plan.model.js';
import SubscriptionInvoice from '../models/subscriptionInvoice.model.js';
import Product from '../models/product.model.js';
import Warehouse from '../models/warehouse.model.js';
import SalesInvoice from '../models/salesInvoice.model.js';
import { logAuditAction } from './auditLog.service.js';
import { calculatePeriodEnd } from './subscription.service.js';
import { round2 } from './sales.calculator.js';

/**
 * 1. Platform Dashboard Statistics
 */
export const getPlatformDashboard = async () => {
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalUsers,
    subscriptionsByStatus,
    paidInvoicesSum,
    expiringTrialsCount,
    pastDueCount,
    activeSubscriptions,
  ] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ isActive: true }),
    Tenant.countDocuments({ isActive: false }),
    User.countDocuments({ isSuperAdmin: { $ne: true } }),
    Subscription.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    SubscriptionInvoice.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
    ]),
    Subscription.countDocuments({
      status: 'trial',
      trialEndDate: { $gte: now, $lte: next7Days },
    }),
    Subscription.countDocuments({
      status: 'past_due',
    }),
    Subscription.find({ status: { $in: ['active', 'trial'] } }),
  ]);

  // Status mapping
  const statusCounts = {
    trial: 0,
    active: 0,
    past_due: 0,
    suspended: 0,
    cancelled: 0,
    expired: 0,
  };
  subscriptionsByStatus.forEach((item) => {
    if (statusCounts[item._id] !== undefined) {
      statusCounts[item._id] = item.count;
    }
  });

  // Calculate MRR (Monthly Recurring Revenue)
  let mrr = 0;
  for (const sub of activeSubscriptions) {
    const price = sub.planSnapshot?.price || 0;
    const cycle = sub.billingCycle || 'monthly';
    if (cycle === 'monthly') mrr += price;
    else if (cycle === 'quarterly') mrr += price / 3;
    else if (cycle === 'yearly') mrr += price / 12;
  }
  mrr = round2(mrr);

  const totalRevenue = round2(paidInvoicesSum[0]?.totalRevenue || 0);

  return {
    tenants: {
      total: totalTenants,
      active: activeTenants,
      suspended: suspendedTenants,
    },
    users: {
      total: totalUsers,
    },
    subscriptions: {
      ...statusCounts,
      expiringTrialsInNext7Days: expiringTrialsCount,
      pastDueCount,
    },
    financials: {
      totalRevenue,
      mrr,
      arr: round2(mrr * 12),
    },
  };
};

/**
 * 2. Search & Filter Tenants
 */
export const getTenants = async (query = {}) => {
  const filter = {};

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { businessName: regex },
      { tenantCode: regex },
      { email: regex },
      { phone: regex },
      { ownerName: regex },
    ];
  }

  if (query.subscriptionStatus) {
    filter.subscriptionStatus = query.subscriptionStatus;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [tenants, total] = await Promise.all([
    Tenant.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Tenant.countDocuments(filter),
  ]);

  // Enhance each tenant with their subscription and counts
  const tenantIds = tenants.map((t) => t._id);
  const subscriptions = await Subscription.find({ tenantId: { $in: tenantIds } }).lean();
  const subMap = new Map();
  subscriptions.forEach((s) => subMap.set(s.tenantId.toString(), s));

  const enhancedTenants = tenants.map((t) => {
    const sub = subMap.get(t._id.toString());
    return {
      ...t,
      subscription: sub
        ? {
            id: sub._id,
            planName: sub.planSnapshot?.name,
            planCode: sub.planSnapshot?.code,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
            trialEndDate: sub.trialEndDate,
            autoRenew: sub.autoRenew,
          }
        : null,
    };
  });

  return {
    tenants: enhancedTenants,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 3. View Full Tenant Details
 */
export const getTenantDetails = async (tenantId) => {
  if (!mongoose.isValidObjectId(tenantId)) {
    const error = new Error('Invalid tenant ID format');
    error.statusCode = 400;
    throw error;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const error = new Error('Tenant not found');
    error.statusCode = 404;
    throw error;
  }

  const [subscription, invoices, users, productCount, warehouseCount, salesInvoiceCount] =
    await Promise.all([
      Subscription.findOne({ tenantId }),
      SubscriptionInvoice.find({ tenantId }).sort({ invoiceDate: -1 }).limit(10),
      User.find({ tenantId }).select('-password').sort({ createdAt: -1 }),
      Product.countDocuments({ tenantId, isDeleted: { $ne: true } }),
      Warehouse.countDocuments({ tenantId, isDeleted: { $ne: true } }),
      SalesInvoice.countDocuments({ tenantId, invoiceStatus: { $ne: 'cancelled' } }),
    ]);

  return {
    tenant,
    subscription,
    invoices,
    users,
    usage: {
      users: users.length,
      products: productCount,
      warehouses: warehouseCount,
      invoices: salesInvoiceCount,
    },
  };
};

/**
 * 4. Activate a Tenant
 */
export const activateTenant = async (superAdminUser, tenantId, reason = '') => {
  if (!mongoose.isValidObjectId(tenantId)) {
    const error = new Error('Invalid tenant ID format');
    error.statusCode = 400;
    throw error;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const error = new Error('Tenant not found');
    error.statusCode = 404;
    throw error;
  }

  tenant.isActive = true;
  await tenant.save();

  // If subscription was suspended, reactivate
  const subscription = await Subscription.findOne({ tenantId });
  if (subscription && subscription.status === 'suspended') {
    subscription.status = 'active';
    subscription.history.push({
      action: 'reactivated',
      fromPlanCode: subscription.planSnapshot.code,
      toPlanCode: subscription.planSnapshot.code,
      amount: 0,
      date: new Date(),
      notes: `Reactivated by Super Admin: ${reason || 'Account enabled'}`,
      performedBy: superAdminUser._id,
    });
    await subscription.save();
    tenant.subscriptionStatus = 'active';
    await tenant.save();
  }

  // Audit Log
  await logAuditAction({
    actor: superAdminUser,
    action: 'TENANT_ACTIVATED',
    targetType: 'tenant',
    targetId: tenant._id,
    targetName: tenant.businessName,
    details: { reason },
  });

  return {
    message: `Tenant '${tenant.businessName}' has been activated successfully.`,
    tenant,
    subscription,
  };
};

/**
 * 5. Suspend a Tenant
 */
export const suspendTenant = async (superAdminUser, tenantId, reason = '') => {
  if (!mongoose.isValidObjectId(tenantId)) {
    const error = new Error('Invalid tenant ID format');
    error.statusCode = 400;
    throw error;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const error = new Error('Tenant not found');
    error.statusCode = 404;
    throw error;
  }

  tenant.isActive = false;
  tenant.subscriptionStatus = 'suspended';
  await tenant.save();

  const subscription = await Subscription.findOne({ tenantId });
  if (subscription) {
    subscription.status = 'suspended';
    subscription.history.push({
      action: 'suspended',
      fromPlanCode: subscription.planSnapshot.code,
      toPlanCode: subscription.planSnapshot.code,
      amount: 0,
      date: new Date(),
      notes: `Suspended by Super Admin: ${reason || 'Administrative suspension'}`,
      performedBy: superAdminUser._id,
    });
    await subscription.save();
  }

  // Audit Log
  await logAuditAction({
    actor: superAdminUser,
    action: 'TENANT_SUSPENDED',
    targetType: 'tenant',
    targetId: tenant._id,
    targetName: tenant.businessName,
    details: { reason },
  });

  return {
    message: `Tenant '${tenant.businessName}' has been suspended.`,
    tenant,
    subscription,
  };
};

/**
 * 6. Assign or Change Subscription by Super Admin
 */
export const assignSubscription = async (
  superAdminUser,
  tenantId,
  { planId, billingCycle = 'monthly', trialDays = 0, overrideAmount = null, autoRenew = true, notes = '' }
) => {
  if (!mongoose.isValidObjectId(tenantId)) {
    const error = new Error('Invalid tenant ID format');
    error.statusCode = 400;
    throw error;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const error = new Error('Tenant not found');
    error.statusCode = 404;
    throw error;
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    const error = new Error('Plan not found');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  let periodEnd;
  let status = 'active';

  if (plan.isTrial || trialDays > 0) {
    const days = trialDays || plan.trialDays || 14;
    periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    status = 'trial';
  } else {
    periodEnd = calculatePeriodEnd(now, billingCycle);
    status = 'active';
  }

  const planSnapshot = {
    name: plan.name,
    code: plan.code,
    price: overrideAmount !== null ? overrideAmount : plan.price,
    billingCycle,
    limits: { ...plan.limits },
    features: [...plan.features],
  };

  let subscription = await Subscription.findOne({ tenantId });
  const oldPlanCode = subscription ? subscription.planSnapshot?.code : 'NONE';

  if (!subscription) {
    subscription = new Subscription({
      tenantId,
      planId: plan._id,
      planSnapshot,
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      billingCycle,
      amount: planSnapshot.price,
      status,
      autoRenew,
      history: [],
    });
  } else {
    subscription.planId = plan._id;
    subscription.planSnapshot = planSnapshot;
    subscription.billingCycle = billingCycle;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = periodEnd;
    subscription.amount = planSnapshot.price;
    subscription.status = status;
    subscription.autoRenew = autoRenew;
  }

  subscription.history.push({
    action: 'plan_changed',
    fromPlanCode: oldPlanCode,
    toPlanCode: plan.code,
    amount: planSnapshot.price,
    date: now,
    notes: `Assigned by Super Admin. ${notes}`,
    performedBy: superAdminUser._id,
  });

  await subscription.save();

  tenant.subscriptionStatus = status;
  tenant.isActive = true;
  await tenant.save();

  // Audit Log
  await logAuditAction({
    actor: superAdminUser,
    action: 'SUBSCRIPTION_ASSIGNED',
    targetType: 'subscription',
    targetId: subscription._id,
    targetName: `${tenant.businessName} - ${plan.name}`,
    details: { oldPlanCode, newPlanCode: plan.code, amount: planSnapshot.price, notes },
  });

  return {
    message: `Plan '${plan.name}' assigned to '${tenant.businessName}' successfully.`,
    subscription,
    tenant,
  };
};

/**
 * 7. Platform-wide Usage Statistics
 */
export const getPlatformUsageStatistics = async () => {
  const [totalTenants, totalUsers, totalProducts, totalWarehouses, totalInvoices] = await Promise.all([
    Tenant.countDocuments(),
    User.countDocuments({ isSuperAdmin: { $ne: true } }),
    Product.countDocuments({ isDeleted: { $ne: true } }),
    Warehouse.countDocuments({ isDeleted: { $ne: true } }),
    SalesInvoice.countDocuments({ invoiceStatus: { $ne: 'cancelled' } }),
  ]);

  return {
    totalTenants,
    totalUsers,
    totalProducts,
    totalWarehouses,
    totalInvoices,
  };
};

/**
 * 8. Subscription Revenue Report
 */
export const getSubscriptionRevenueReport = async (query = {}) => {
  const filter = { paymentStatus: 'paid' };

  if (query.startDate || query.endDate) {
    filter.invoiceDate = {};
    if (query.startDate) filter.invoiceDate.$gte = new Date(query.startDate);
    if (query.endDate) filter.invoiceDate.$lte = new Date(query.endDate);
  }

  const [revenueByPlan, revenueByMonth] = await Promise.all([
    SubscriptionInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$planCode',
          planName: { $first: '$planName' },
          totalRevenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]),
    SubscriptionInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } },
          totalRevenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    revenueByPlan,
    revenueByMonth,
  };
};

export default {
  getPlatformDashboard,
  getTenants,
  getTenantDetails,
  activateTenant,
  suspendTenant,
  assignSubscription,
  getPlatformUsageStatistics,
  getSubscriptionRevenueReport,
};
