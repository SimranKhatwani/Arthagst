import Plan from './plan.model.js';

export const DEFAULT_PLANS = [
  {
    name: 'Free Trial',
    code: 'TRIAL',
    description: '14-day free trial with standard GST invoicing and basic inventory tracking.',
    price: 0,
    billingCycle: 'monthly',
    trialDays: 14,
    limits: {
      maxUsers: 2,
      maxProducts: 50,
      maxInvoices: 30,
      maxWarehouses: 1,
      storageLimit: 512,
    },
    features: ['inventory', 'gst_returns', 'reports', 'banking', 'expenses'],
    isActive: true,
    isPublic: true,
    isTrial: true,
  },
  {
    name: 'Starter Plan',
    code: 'STARTER',
    description: 'Ideal for small retail and trading businesses requiring GST billing and e-Way bills.',
    price: 999,
    billingCycle: 'monthly',
    trialDays: 0,
    limits: {
      maxUsers: 3,
      maxProducts: 500,
      maxInvoices: 300,
      maxWarehouses: 1,
      storageLimit: 2048,
    },
    features: ['inventory', 'gst_returns', 'reports', 'banking', 'expenses', 'e_way_bill'],
    isActive: true,
    isPublic: true,
    isTrial: false,
  },
  {
    name: 'Growth Plan',
    code: 'GROWTH',
    description: 'For growing businesses requiring E-Invoicing, full double-entry accounting and multi-warehouses.',
    price: 2499,
    billingCycle: 'monthly',
    trialDays: 0,
    limits: {
      maxUsers: 10,
      maxProducts: 5000,
      maxInvoices: 2000,
      maxWarehouses: 5,
      storageLimit: 10240,
    },
    features: [
      'inventory',
      'gst_returns',
      'reports',
      'banking',
      'expenses',
      'e_invoice',
      'e_way_bill',
      'accounting',
      'multi_warehouse',
    ],
    isActive: true,
    isPublic: true,
    isTrial: false,
  },
  {
    name: 'Enterprise Plan',
    code: 'ENTERPRISE',
    description: 'Unlimited capacity, full ERP feature set, advanced audit logging and priority support.',
    price: 5999,
    billingCycle: 'monthly',
    trialDays: 0,
    limits: {
      maxUsers: -1, // Unlimited
      maxProducts: -1,
      maxInvoices: -1,
      maxWarehouses: -1,
      storageLimit: -1,
    },
    features: [
      'inventory',
      'gst_returns',
      'reports',
      'banking',
      'expenses',
      'e_invoice',
      'e_way_bill',
      'accounting',
      'multi_warehouse',
      'audit_logs',
      'api_access',
      'priority_support',
    ],
    isActive: true,
    isPublic: true,
    isTrial: false,
  },
];

/**
 * Seed default plans if they do not exist
 */
export const seedDefaultPlans = async (session = null) => {
  const seeded = [];
  for (const planDef of DEFAULT_PLANS) {
    let plan = await Plan.findOne({ code: planDef.code }).session(session);
    if (!plan) {
      if (session) {
        const [created] = await Plan.create([planDef], { session });
        plan = created;
      } else {
        plan = await Plan.create(planDef);
      }
    }
    seeded.push(plan);
  }
  return seeded;
};

export default {
  DEFAULT_PLANS,
  seedDefaultPlans,
};
