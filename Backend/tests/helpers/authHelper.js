import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../../src/models/user.model.js';
import Tenant from '../../src/models/tenant.model.js';
import Plan from '../../src/models/plan.model.js';
import Subscription from '../../src/models/subscription.model.js';
import { seedDefaultAccounts } from '../../src/services/accounting.seed.js';
import { seedDefaultPlans } from '../../src/services/plan.seed.js';

export const createTenantAndUser = async ({
  tenantCode = `TEST-${Date.now().toString().slice(-4)}`,
  businessName = 'Test Organization',
  ownerName = 'Test Owner',
  email = `owner.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@test.com`,
  password = 'Password@123',
  role = 'owner',
  subscriptionStatus = 'active',
} = {}) => {
  // Ensure default plans exist
  await seedDefaultPlans().catch(() => {});

  const tenant = await Tenant.create({
    tenantCode,
    businessName,
    ownerName,
    email,
    phone: '9876543210',
    subscriptionStatus,
    isActive: true,
    financialYearStart: '04-01',
    GSTIN: '27AAPFU0939F1ZV',
    PAN: 'AAPFU0939F',
    stateCode: '27',
    state: 'Maharashtra',
    city: 'Mumbai',
    businessAddress: '101 Business Hub, Mumbai',
    pincode: '400001',
  });

  const user = await User.create({
    tenantId: tenant._id,
    name: ownerName,
    email: email.toLowerCase(),
    password,
    role,
    isActive: true,
    isSuperAdmin: false,
  });

  // Seed default accounting chart for this tenant
  await seedDefaultAccounts(tenant._id).catch(() => {});

  // Create an active enterprise subscription snapshot with ample test limits
  const plan = (await Plan.findOne({ code: 'GROWTH' })) || (await Plan.findOne());
  if (plan) {
    await Subscription.create({
      tenantId: tenant._id,
      planId: plan._id,
      planSnapshot: {
        name: plan.name,
        code: plan.code,
        price: plan.price,
        billingCycle: plan.billingCycle,
        limits: {
          maxUsers: 50,
          maxProducts: 2000,
          maxInvoices: 2000,
          maxWarehouses: 20,
          storageLimit: 10240,
        },
        features: ['inventory', 'gst_returns', 'reports', 'banking', 'expenses', 'e_way_bill', 'e_invoice', 'accounting', 'all'],
      },
      status: subscriptionStatus,
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  const token = jwt.sign(
    { userId: user._id, tenantId: tenant._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return { tenant, user, token };
};

export const createSuperAdmin = async ({
  email = `superadmin.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@platform.com`,
  password = 'Superadmin@12345',
} = {}) => {
  const superAdmin = await User.create({
    name: 'Super Admin',
    email: email.toLowerCase(),
    password,
    role: 'super_admin',
    isSuperAdmin: true,
    isActive: true,
    tenantId: null,
  });

  const token = jwt.sign(
    { userId: superAdmin._id, role: 'super_admin', isSuperAdmin: true },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  return { superAdmin, token };
};
