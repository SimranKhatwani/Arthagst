import mongoose from 'mongoose';
import Subscription from '../models/subscription.model.js';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';
import Warehouse from '../models/warehouse.model.js';
import SalesInvoice from '../models/salesInvoice.model.js';

/**
 * Get tenant active subscription or trial
 */
export const getTenantSubscription = async (tenantId) => {
  if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
    return null;
  }

  const subscription = await Subscription.findOne({ tenantId });
  return subscription;
};

/**
 * Check if tenant has access to a specific feature flag
 */
export const checkFeatureAccess = async (tenantId, featureKey) => {
  const subscription = await getTenantSubscription(tenantId);

  if (!subscription) {
    return {
      allowed: false,
      reason: 'No active subscription found for tenant. Please subscribe to a plan.',
      planName: 'None',
      planCode: 'NONE',
    };
  }

  // Suspended or expired tenants cannot use features
  if (['suspended', 'expired'].includes(subscription.status)) {
    return {
      allowed: false,
      reason: `Tenant subscription is ${subscription.status}. Access restricted.`,
      planName: subscription.planSnapshot?.name || 'Unknown',
      planCode: subscription.planSnapshot?.code || 'UNKNOWN',
    };
  }

  const features = subscription.planSnapshot?.features || [];
  const allowed = features.includes(featureKey);

  return {
    allowed,
    planName: subscription.planSnapshot?.name || 'Trial',
    planCode: subscription.planSnapshot?.code || 'TRIAL',
    reason: allowed
      ? 'Access granted'
      : `Feature '${featureKey}' is not included in your ${subscription.planSnapshot?.name || 'current'} plan. Please upgrade to access this feature.`,
  };
};

/**
 * Check whether a tenant has exceeded their plan's resource limits
 */
export const checkUsageLimit = async (tenantId, limitType, increment = 1) => {
  const subscription = await getTenantSubscription(tenantId);

  if (!subscription) {
    return {
      allowed: false,
      current: 0,
      limit: 0,
      remaining: 0,
      reason: 'No active subscription found for tenant.',
    };
  }

  const limits = subscription.planSnapshot?.limits || {};
  let maxAllowed = 0;
  let currentUsage = 0;

  switch (limitType) {
    case 'users':
    case 'maxUsers':
      maxAllowed = limits.maxUsers !== undefined ? limits.maxUsers : 2;
      currentUsage = await User.countDocuments({ tenantId, isActive: true });
      break;

    case 'products':
    case 'maxProducts':
      maxAllowed = limits.maxProducts !== undefined ? limits.maxProducts : 100;
      currentUsage = await Product.countDocuments({ tenantId, isDeleted: { $ne: true } });
      break;

    case 'warehouses':
    case 'maxWarehouses':
      maxAllowed = limits.maxWarehouses !== undefined ? limits.maxWarehouses : 1;
      currentUsage = await Warehouse.countDocuments({ tenantId, isDeleted: { $ne: true } });
      break;

    case 'invoices':
    case 'maxInvoices':
      maxAllowed = limits.maxInvoices !== undefined ? limits.maxInvoices : 50;
      // Invoices count within current billing period
      currentUsage = await SalesInvoice.countDocuments({
        tenantId,
        invoiceDate: {
          $gte: subscription.currentPeriodStart,
          $lte: subscription.currentPeriodEnd,
        },
        invoiceStatus: { $ne: 'cancelled' },
      });
      break;

    case 'storage':
    case 'storageLimit':
      maxAllowed = limits.storageLimit !== undefined ? limits.storageLimit : 1024;
      currentUsage = 0; // MB
      break;

    default:
      return { allowed: true, current: 0, limit: -1, remaining: 'unlimited' };
  }

  // -1 denotes unlimited capacity
  if (maxAllowed === -1) {
    return {
      allowed: true,
      current: currentUsage,
      limit: -1,
      remaining: 'unlimited',
      planName: subscription.planSnapshot?.name,
    };
  }

  const wouldExceed = currentUsage + increment > maxAllowed;
  const remaining = Math.max(0, maxAllowed - currentUsage);

  return {
    allowed: !wouldExceed,
    current: currentUsage,
    limit: maxAllowed,
    remaining,
    planName: subscription.planSnapshot?.name,
    reason: wouldExceed
      ? `Plan limit reached: You have reached the maximum allowed ${limitType} (${maxAllowed}) for your ${subscription.planSnapshot?.name} plan. Please upgrade to add more.`
      : 'Within plan limits',
  };
};

/**
 * Return detailed usage overview for tenant dashboard
 */
export const getUsageOverview = async (tenantId) => {
  const subscription = await getTenantSubscription(tenantId);

  if (!subscription) {
    return null;
  }

  const limits = subscription.planSnapshot?.limits || {};

  const [usersCount, productsCount, warehousesCount, invoicesCount] = await Promise.all([
    User.countDocuments({ tenantId, isActive: true }),
    Product.countDocuments({ tenantId, isDeleted: { $ne: true } }),
    Warehouse.countDocuments({ tenantId, isDeleted: { $ne: true } }),
    SalesInvoice.countDocuments({
      tenantId,
      invoiceDate: {
        $gte: subscription.currentPeriodStart,
        $lte: subscription.currentPeriodEnd,
      },
      invoiceStatus: { $ne: 'cancelled' },
    }),
  ]);

  return {
    subscription: {
      status: subscription.status,
      planName: subscription.planSnapshot.name,
      planCode: subscription.planSnapshot.code,
      billingCycle: subscription.billingCycle,
      startDate: subscription.startDate,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndDate: subscription.trialEndDate,
      autoRenew: subscription.autoRenew,
    },
    limits: {
      users: {
        used: usersCount,
        max: limits.maxUsers,
        remaining: limits.maxUsers === -1 ? 'unlimited' : Math.max(0, limits.maxUsers - usersCount),
      },
      products: {
        used: productsCount,
        max: limits.maxProducts,
        remaining: limits.maxProducts === -1 ? 'unlimited' : Math.max(0, limits.maxProducts - productsCount),
      },
      warehouses: {
        used: warehousesCount,
        max: limits.maxWarehouses,
        remaining: limits.maxWarehouses === -1 ? 'unlimited' : Math.max(0, limits.maxWarehouses - warehousesCount),
      },
      invoices: {
        used: invoicesCount,
        max: limits.maxInvoices,
        remaining: limits.maxInvoices === -1 ? 'unlimited' : Math.max(0, limits.maxInvoices - invoicesCount),
      },
    },
    features: subscription.planSnapshot.features || [],
  };
};

export default {
  getTenantSubscription,
  checkFeatureAccess,
  checkUsageLimit,
  getUsageOverview,
};
