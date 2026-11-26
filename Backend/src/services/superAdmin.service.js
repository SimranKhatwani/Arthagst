import mongoose from 'mongoose';
import Tenant from '../models/tenant.model.js';
import User from '../models/user.model.js';
import Subscription from '../models/subscription.model.js';
import Plan from '../models/plan.model.js';
import SubscriptionInvoice from '../models/subscriptionInvoice.model.js';
import Product from '../models/product.model.js';
import Warehouse from '../models/warehouse.model.js';
import SalesInvoice from '../models/salesInvoice.model.js';
import Party from '../models/party.model.js';
import PurchaseBill from '../models/purchaseBill.model.js';
import Payment from '../models/payment.model.js';
import Account from '../models/account.model.js';
import JournalEntry from '../models/journalEntry.model.js';
import Expense from '../models/expense.model.js';
import StockMovement from '../models/stockMovement.model.js';
import Settings from '../models/settings.model.js';
import Ticket from '../models/ticket.model.js';
import Announcement from '../models/announcement.model.js';
import FeatureFlag from '../models/featureFlag.model.js';
import PlatformSetting from '../models/platformSetting.model.js';
import { logAuditAction } from './auditLog.service.js';
import { calculatePeriodEnd } from './subscription.service.js';
import { round2 } from './sales.calculator.js';

/**
 * Universal helper to resolve a tenant by MongoDB ObjectId OR tenantCode (case-insensitive)
 */
export const findTenantByIdOrCode = async (identifier) => {
  if (!identifier) return null;
  const strId = String(identifier).trim();
  if (mongoose.isValidObjectId(strId)) {
    const t = await Tenant.findById(strId);
    if (t) return t;
  }
  const cleanCode = strId.toUpperCase();
  return Tenant.findOne({
    $or: [{ tenantCode: cleanCode }, { tenantCode: strId }],
  });
};

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
  const tenant = await findTenantByIdOrCode(tenantId);
  if (!tenant) {
    const error = new Error(`Tenant '${tenantId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const tid = tenant._id;
  const [subscription, invoices, users, productCount, warehouseCount, salesInvoiceCount] =
    await Promise.all([
      Subscription.findOne({ tenantId: tid }),
      SubscriptionInvoice.find({ tenantId: tid }).sort({ invoiceDate: -1 }).limit(10),
      User.find({ tenantId: tid }).select('-password').sort({ createdAt: -1 }),
      Product.countDocuments({ tenantId: tid, isDeleted: { $ne: true } }),
      Warehouse.countDocuments({ tenantId: tid, isDeleted: { $ne: true } }),
      SalesInvoice.countDocuments({ tenantId: tid, invoiceStatus: { $ne: 'cancelled' } }),
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
  const tenant = await findTenantByIdOrCode(tenantId);
  if (!tenant) {
    const error = new Error(`Tenant '${tenantId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  tenant.isActive = true;
  await tenant.save();

  // If subscription was suspended, reactivate
  const subscription = await Subscription.findOne({ tenantId: tenant._id });
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
    details: { reason, tenantCode: tenant.tenantCode },
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
  const tenant = await findTenantByIdOrCode(tenantId);
  if (!tenant) {
    const error = new Error(`Tenant '${tenantId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  tenant.isActive = false;
  tenant.subscriptionStatus = 'suspended';
  await tenant.save();

  const subscription = await Subscription.findOne({ tenantId: tenant._id });
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
    details: { reason, tenantCode: tenant.tenantCode },
  });

  return {
    message: `Tenant '${tenant.businessName}' has been suspended.`,
    tenant,
    subscription,
  };
};

/**
 * 5a. Create/Provision New Tenant by Super Admin (with Owner User and Subscription)
 */
export const createTenant = async (superAdminUser, data) => {
  const normalizedCode = (data.tenantCode || '').toUpperCase().trim();
  const normalizedEmail = (data.email || '').toLowerCase().trim();

  const existingTenant = await Tenant.findOne({ tenantCode: normalizedCode });
  if (existingTenant) {
    const error = new Error(`Tenant code '${normalizedCode}' is already registered.`);
    error.statusCode = 409;
    throw error;
  }

  const existingSuper = await User.findOne({ email: normalizedEmail, isSuperAdmin: true });
  if (existingSuper) {
    const error = new Error(`Email '${normalizedEmail}' is reserved for Platform SuperAdmin.`);
    error.statusCode = 409;
    throw error;
  }

  let session = null;
  let useTx = true;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (err) {
    useTx = false;
    session = null;
  }

  try {
    const tenantPayload = {
      tenantCode: normalizedCode,
      businessName: data.businessName,
      ownerName: data.ownerName,
      email: normalizedEmail,
      phone: data.phone,
      city: data.city || '',
      state: data.state || '',
      businessAddress: data.businessAddress || '',
      GSTIN: data.GSTIN || null,
      PAN: data.PAN || null,
      subscriptionStatus: 'active',
      isActive: true,
    };

    let tenant;
    let user;

    if (useTx && session) {
      const [t] = await Tenant.create([tenantPayload], { session });
      tenant = t;

      const [u] = await User.create(
        [
          {
            tenantId: tenant._id,
            name: data.ownerName,
            email: normalizedEmail,
            phone: data.phone,
            password: data.password,
            role: 'owner',
            permissions: ['all'],
            isActive: true,
          },
        ],
        { session }
      );
      user = u;

      const planCode = data.planCode || (data.planName || 'Growth').toUpperCase().replace(/\s+/g, '_');
      let plan = await Plan.findOne({ $or: [{ code: planCode }, { name: data.planName }] }).session(session);
      if (!plan) {
        plan = await Plan.findOne({ code: 'GROWTH' }).session(session);
      }
      if (!plan) {
        plan = await Plan.findOne({}).session(session);
      }

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 365);

      await Subscription.create(
        [
          {
            tenantId: tenant._id,
            planId: plan._id,
            planSnapshot: {
              code: plan.code,
              name: plan.name,
              price: plan.pricePerMonth || 1999,
              billingCycle: 'yearly',
              limits: plan.limits || { maxUsers: 10, maxInvoices: 2000, maxProducts: 500, maxWarehouses: 2 },
              features: plan.features || ['GST Invoicing', 'Inventory & Ledgers'],
            },
            status: 'active',
            billingCycle: 'yearly',
            startDate: now,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            amount: (plan.pricePerMonth || 1999) * 12,
            autoRenew: true,
          },
        ],
        { session }
      );

      await session.commitTransaction();
    } else {
      tenant = await Tenant.create(tenantPayload);
      try {
        user = await User.create({
          tenantId: tenant._id,
          name: data.ownerName,
          email: normalizedEmail,
          phone: data.phone,
          password: data.password,
          role: 'owner',
          permissions: ['all'],
          isActive: true,
        });

        const planCode = data.planCode || (data.planName || 'Growth').toUpperCase().replace(/\s+/g, '_');
        let plan = await Plan.findOne({ $or: [{ code: planCode }, { name: data.planName }] });
        if (!plan) {
          plan = await Plan.findOne({ code: 'GROWTH' });
        }
        if (!plan) {
          plan = await Plan.findOne({});
        }

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 365);

        await Subscription.create({
          tenantId: tenant._id,
          planId: plan._id,
          planSnapshot: {
            code: plan.code,
            name: plan.name,
            price: plan.pricePerMonth || 1999,
            billingCycle: 'yearly',
            limits: plan.limits || { maxUsers: 10, maxInvoices: 2000, maxProducts: 500, maxWarehouses: 2 },
            features: plan.features || ['GST Invoicing', 'Inventory & Ledgers'],
          },
          status: 'active',
          billingCycle: 'yearly',
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          amount: (plan.pricePerMonth || 1999) * 12,
          autoRenew: true,
        });
      } catch (userErr) {
        await Tenant.findByIdAndDelete(tenant._id);
        throw userErr;
      }
    }

    await logAuditAction({
      actor: superAdminUser,
      action: 'TENANT_PROVISIONED',
      targetType: 'tenant',
      targetId: tenant._id,
      targetName: tenant.businessName,
      details: { tenantCode: tenant.tenantCode, ownerEmail: user.email },
    });

    return {
      tenant,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (err) {
    if (useTx && session && session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * 5b. Update Tenant Details by Super Admin
 */
export const updateTenant = async (superAdminUser, tenantId, data) => {
  const tenant = await findTenantByIdOrCode(tenantId);
  if (!tenant) {
    const error = new Error(`Tenant '${tenantId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  if (data.businessName !== undefined) tenant.businessName = data.businessName;
  if (data.ownerName !== undefined) tenant.ownerName = data.ownerName;
  if (data.email !== undefined) tenant.email = data.email.toLowerCase().trim();
  if (data.phone !== undefined) tenant.phone = data.phone;
  if (data.city !== undefined) tenant.city = data.city;
  if (data.state !== undefined) tenant.state = data.state;
  if (data.businessAddress !== undefined) tenant.businessAddress = data.businessAddress;
  if (data.GSTIN !== undefined) tenant.GSTIN = data.GSTIN || null;
  if (data.PAN !== undefined) tenant.PAN = data.PAN || null;
  if (data.isActive !== undefined) tenant.isActive = data.isActive;
  if (data.subscriptionStatus !== undefined) tenant.subscriptionStatus = data.subscriptionStatus;

  await tenant.save();

  if (data.ownerName || data.email) {
    const updateFields = {};
    if (data.ownerName) updateFields.name = data.ownerName;
    if (data.email) updateFields.email = data.email.toLowerCase().trim();
    await User.updateMany({ tenantId: tenant._id, role: 'owner' }, { $set: updateFields });
  }

  await logAuditAction({
    actor: superAdminUser,
    action: 'TENANT_UPDATED',
    targetType: 'tenant',
    targetId: tenant._id,
    targetName: tenant.businessName,
    details: data,
  });

  return tenant;
};

/**
 * 5c. Delete Tenant by Super Admin (with full cascade cleanup)
 */
export const deleteTenant = async (superAdminUser, tenantId) => {
  const tenant = await findTenantByIdOrCode(tenantId);
  if (!tenant) {
    const error = new Error(`Tenant '${tenantId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  // Prevent accidental deletion of default master tenant
  if (tenant.tenantCode === 'ARTHA') {
    const error = new Error("The default master tenant 'ARTHA' is system-protected and cannot be deleted.");
    error.statusCode = 403;
    throw error;
  }

  const tid = tenant._id;
  await Promise.allSettled([
    Tenant.findByIdAndDelete(tid),
    User.deleteMany({ tenantId: tid }),
    Subscription.deleteMany({ tenantId: tid }),
    SubscriptionInvoice.deleteMany({ tenantId: tid }),
    Product.deleteMany({ tenantId: tid }),
    Warehouse.deleteMany({ tenantId: tid }),
    SalesInvoice.deleteMany({ tenantId: tid }),
    Party.deleteMany({ tenantId: tid }),
    PurchaseBill.deleteMany({ tenantId: tid }),
    Payment.deleteMany({ tenantId: tid }),
    Account.deleteMany({ tenantId: tid }),
    JournalEntry.deleteMany({ tenantId: tid }),
    Expense.deleteMany({ tenantId: tid }),
    StockMovement.deleteMany({ tenantId: tid }),
    Settings.deleteMany({ tenantId: tid }),
  ]);

  await logAuditAction({
    actor: superAdminUser,
    action: 'TENANT_DELETED',
    targetType: 'tenant',
    targetId: tid,
    targetName: tenant.businessName,
    details: { tenantCode: tenant.tenantCode, email: tenant.email },
  });

  return {
    success: true,
    message: `Tenant '${tenant.businessName}' (${tenant.tenantCode}) deleted successfully.`,
    tenantId: tid,
    tenantCode: tenant.tenantCode,
  };
};

/**
 * 5d. Reset Tenant Owner Password by Super Admin
 */
export const resetTenantOwnerPassword = async (superAdminUser, tenantId, newPassword) => {
  if (!newPassword || newPassword.length < 6) {
    const error = new Error('Password must be at least 6 characters long');
    error.statusCode = 400;
    throw error;
  }

  const tenant = await findTenantByIdOrCode(tenantId);
  if (!tenant) {
    const error = new Error(`Tenant '${tenantId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const tid = tenant._id;
  let user = await User.findOne({ tenantId: tid, role: 'owner' });
  if (!user) {
    user = await User.findOne({ tenantId: tid, role: 'admin' });
  }
  if (!user) {
    user = await User.findOne({ tenantId: tid });
  }

  if (!user) {
    const error = new Error('No owner or admin user found for this tenant');
    error.statusCode = 404;
    throw error;
  }

  user.password = newPassword; // Pre-save hook will hash with bcrypt!
  await user.save();

  await logAuditAction({
    actor: superAdminUser,
    action: 'TENANT_PASSWORD_RESET',
    targetType: 'user',
    targetId: user._id,
    targetName: user.email,
    details: { tenantId: tid, tenantCode: tenant.tenantCode, userEmail: user.email },
  });

  return {
    message: `Password reset successfully for ${user.email}`,
    email: user.email,
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
  const tenant = await findTenantByIdOrCode(tenantId);
  if (!tenant) {
    const error = new Error(`Tenant '${tenantId}' not found`);
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

/**
 * 9. Cross-Tenant Platform Users
 */
export const getPlatformUsers = async (query = {}) => {
  const filter = { isSuperAdmin: { $ne: true } };

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { role: regex }];
  }

  if (query.role) {
    filter.role = query.role;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate('tenantId', 'businessName tenantCode subscriptionStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const toggleUserStatus = async (superAdminUser, userId, isActive) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  user.isActive = isActive;
  await user.save();

  await logAuditAction({
    actor: superAdminUser,
    action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    targetType: 'user',
    targetId: user._id,
    targetName: user.email,
  });

  return {
    message: `User '${user.name}' has been ${isActive ? 'activated' : 'deactivated'}`,
    user,
  };
};

/**
 * 10. Cross-Tenant Subscriptions
 */
export const getPlatformSubscriptions = async (query = {}) => {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const [subscriptions, total] = await Promise.all([
    Subscription.find(filter)
      .populate('tenantId', 'businessName tenantCode ownerName email phone city state')
      .populate('planId', 'name code price billingCycle')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Subscription.countDocuments(filter),
  ]);

  return {
    subscriptions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 11. Support Tickets
 */
export const getTickets = async (query = {}) => {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }
  if (query.priority) {
    filter.priority = query.priority;
  }
  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ subject: regex }, { ticketNo: regex }, { tenantName: regex }];
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate('tenantId', 'businessName tenantCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Ticket.countDocuments(filter),
  ]);

  return {
    tickets,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const createTicket = async (superAdminUser, data) => {
  const ticketCount = await Ticket.countDocuments();
  const ticketNo = data.ticketNo || `SUP-${400 + ticketCount + 1}`;

  const ticket = await Ticket.create({
    ticketNo,
    tenantId: data.tenantId || null,
    tenantName: data.tenantName || data.tenant || 'Direct Support',
    subject: data.subject,
    description: data.description || '',
    priority: data.priority || 'Medium',
    status: data.status || 'Open',
    assignedTo: data.assignedTo || null,
  });

  await logAuditAction({
    actor: superAdminUser,
    action: 'TICKET_CREATED',
    targetType: 'ticket',
    targetId: ticket._id,
    targetName: ticket.ticketNo,
    details: { subject: ticket.subject },
  });

  return ticket;
};

export const updateTicketStatus = async (superAdminUser, ticketId, status) => {
  let ticket;
  if (mongoose.isValidObjectId(ticketId)) {
    ticket = await Ticket.findById(ticketId);
  } else {
    ticket = await Ticket.findOne({ ticketNo: ticketId });
  }

  if (!ticket) {
    const error = new Error('Support ticket not found');
    error.statusCode = 404;
    throw error;
  }

  ticket.status = status;
  await ticket.save();

  await logAuditAction({
    actor: superAdminUser,
    action: 'TICKET_STATUS_UPDATED',
    targetType: 'ticket',
    targetId: ticket._id,
    targetName: ticket.ticketNo,
    details: { status },
  });

  return ticket;
};

/**
 * 12. Announcements
 */
export const getAnnouncements = async (query = {}) => {
  const filter = {};
  if (query.status) {
    filter.status = query.status;
  }

  const announcements = await Announcement.find(filter)
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean();

  return announcements;
};

export const createAnnouncement = async (superAdminUser, data) => {
  const announcement = await Announcement.create({
    title: data.title,
    message: data.message || '',
    targetAudience: data.targetAudience || data.target || 'All Active Tenants',
    status: data.status || 'Published',
    publishedAt: data.publishedAt || new Date(),
    createdBy: superAdminUser._id,
  });

  await logAuditAction({
    actor: superAdminUser,
    action: 'ANNOUNCEMENT_PUBLISHED',
    targetType: 'announcement',
    targetId: announcement._id,
    targetName: announcement.title,
  });

  return announcement;
};

export const updateAnnouncementStatus = async (superAdminUser, id, status) => {
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    const error = new Error('Announcement not found');
    error.statusCode = 404;
    throw error;
  }

  announcement.status = status;
  await announcement.save();

  await logAuditAction({
    actor: superAdminUser,
    action: 'ANNOUNCEMENT_STATUS_UPDATED',
    targetType: 'announcement',
    targetId: announcement._id,
    targetName: announcement.title,
    details: { status },
  });

  return announcement;
};

/**
 * 13. Feature Flags
 */
export const getFeatureFlags = async () => {
  let flags = await FeatureFlag.find().sort({ createdAt: 1 }).lean();

  // If no flags exist yet, seed initial standard defaults
  if (!flags || flags.length === 0) {
    const defaultFlags = [
      { key: 'pos_split_payment', name: 'POS Split Tender Payments', description: 'Allow Cash + UPI + Card split tender in POS Billing', enabled: true },
      { key: 'gstr2b_auto_recon', name: 'GSTR-2B Smart Matching', description: 'Highlight tax and GSTIN mismatches in GSTR-2B recon', enabled: true },
      { key: 'einvoice_qr_preview', name: 'E-Invoice Simulated IRN & QR', description: 'Enable simulated IRP QR preview on tax invoices', enabled: true },
      { key: 'multi_currency_export', name: 'Multi-Currency Export Invoices', description: 'Beta support for USD/EUR export invoices', enabled: false },
    ];
    await FeatureFlag.insertMany(defaultFlags);
    flags = await FeatureFlag.find().sort({ createdAt: 1 }).lean();
  }

  return flags;
};

export const toggleFeatureFlag = async (superAdminUser, idOrKey, enabled) => {
  let flag;
  if (mongoose.isValidObjectId(idOrKey)) {
    flag = await FeatureFlag.findById(idOrKey);
  }
  if (!flag) {
    flag = await FeatureFlag.findOne({ key: idOrKey });
  }

  if (!flag) {
    const error = new Error('Feature flag not found');
    error.statusCode = 404;
    throw error;
  }

  flag.enabled = enabled !== undefined ? Boolean(enabled) : !flag.enabled;
  await flag.save();

  await logAuditAction({
    actor: superAdminUser,
    action: 'FEATURE_FLAG_TOGGLED',
    targetType: 'feature_flag',
    targetId: flag._id,
    targetName: flag.key,
    details: { enabled: flag.enabled },
  });

  return flag;
};

/**
 * 14. Platform System Settings
 */
export const getPlatformSettings = async () => {
  let settings = await PlatformSetting.findOne({ key: 'global_platform_settings' });
  if (!settings) {
    settings = await PlatformSetting.create({
      key: 'global_platform_settings',
      defaultTrialDays: 14,
      supportEmail: 'support@arthagst.demo',
      sandboxMode: true,
      maintenanceMode: false,
    });
  }
  return settings;
};

export const updatePlatformSettings = async (superAdminUser, data) => {
  let settings = await PlatformSetting.findOne({ key: 'global_platform_settings' });
  if (!settings) {
    settings = new PlatformSetting({ key: 'global_platform_settings' });
  }

  if (data.defaultTrialDays !== undefined) settings.defaultTrialDays = Number(data.defaultTrialDays);
  if (data.supportEmail !== undefined) settings.supportEmail = data.supportEmail;
  if (data.sandboxMode !== undefined) settings.sandboxMode = Boolean(data.sandboxMode);
  if (data.maintenanceMode !== undefined) settings.maintenanceMode = Boolean(data.maintenanceMode);

  await settings.save();

  await logAuditAction({
    actor: superAdminUser,
    action: 'PLATFORM_SETTINGS_UPDATED',
    targetType: 'system_settings',
    targetId: settings._id,
    targetName: 'global_platform_settings',
    details: data,
  });

  return settings;
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
  getPlatformUsers,
  toggleUserStatus,
  getPlatformSubscriptions,
  getTickets,
  createTicket,
  updateTicketStatus,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncementStatus,
  getFeatureFlags,
  toggleFeatureFlag,
  getPlatformSettings,
  updatePlatformSettings,
};
