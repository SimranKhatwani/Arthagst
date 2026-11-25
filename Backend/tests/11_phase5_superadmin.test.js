import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Tenant from '../src/models/tenant.model.js';
import Plan from '../src/models/plan.model.js';
import Subscription from '../src/models/subscription.model.js';
import SubscriptionInvoice from '../src/models/subscriptionInvoice.model.js';
import { createTenantAndUser } from './helpers/authHelper.js';

describe('Phase 5: SuperAdmin Panel Backend Integration & Multi-Tenant Fleet Governance', () => {
  let superAdminUser, superAdminToken;
  let tenant1, user1, token1;
  let tenant2, user2, token2;
  let customPlan;
  let createdTicket;
  let createdAnnouncement;
  let createdFeatureFlag;

  beforeAll(async () => {
    // 1. Create Platform Super Admin
    superAdminUser = await User.create({
      name: 'Master Platform SuperAdmin',
      email: 'master.superadmin@arthagst.platform',
      password: 'SuperAdminSecret@2026',
      role: 'super_admin',
      isSuperAdmin: true,
      isActive: true,
    });

    // 2. Setup Tenants for Fleet Testing
    const res1 = await createTenantAndUser({
      tenantCode: 'FLT-TEN-01',
      businessName: 'Apex Fleet Logistics Pvt Ltd',
      email: 'owner@apexfleet.in',
    });
    tenant1 = res1.tenant;
    user1 = res1.user;
    token1 = res1.token;

    const res2 = await createTenantAndUser({
      tenantCode: 'FLT-TEN-02',
      businessName: 'Vanguard Retail Systems',
      email: 'admin@vanguardretail.in',
    });
    tenant2 = res2.tenant;
    user2 = res2.user;
    token2 = res2.token;

    // 3. Create initial Subscription and Invoice for Tenant 1
    const testPlan = await Plan.create({
      name: 'Growth Fleet',
      code: 'GROWTH_FLEET',
      description: 'Fleet Growth Plan',
      price: 1999,
      annualPrice: 19990,
      billingCycle: 'monthly',
      limits: { maxUsers: 10, maxInvoices: 2000, maxWarehouses: 3 },
      features: ['Multi-Warehouse', 'GSTR-2B Auto Recon'],
      isActive: true,
    });

    let sub1 = await Subscription.findOne({ tenantId: tenant1._id });
    if (!sub1) {
      sub1 = await Subscription.create({
        tenantId: tenant1._id,
        planId: testPlan._id,
        planSnapshot: {
          name: testPlan.name,
          code: testPlan.code,
          price: testPlan.price,
          billingCycle: 'monthly',
          limits: testPlan.limits,
          features: testPlan.features,
        },
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billingCycle: 'monthly',
        amount: 1999,
        status: 'active',
        autoRenew: true,
        history: [],
      });
    } else {
      sub1.status = 'active';
      await sub1.save();
    }

    await SubscriptionInvoice.create({
      tenantId: tenant1._id,
      subscriptionId: sub1._id,
      invoiceNumber: 'SUB-INV-2026-001',
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      planName: testPlan.name,
      planCode: testPlan.code,
      taxableAmount: 1694.07,
      taxAmount: 304.93,
      totalAmount: 1999,
      paymentStatus: 'paid',
      billingPeriod: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      paymentReference: {
        gateway: 'Razorpay',
        transactionId: 'txn_sa_test_998811',
        paymentMethod: 'UPI Autopay',
        paidAt: new Date(),
      },
    });
  });

  describe('1. SuperAdmin Authentication & Security Separation', () => {
    it('should authenticate super admin via POST /api/super-admin/login', async () => {
      const res = await request(app)
        .post('/api/super-admin/login')
        .send({
          email: 'master.superadmin@arthagst.platform',
          password: 'SuperAdminSecret@2026',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('super_admin');
      expect(res.body.data.user.isSuperAdmin).toBe(true);
      superAdminToken = res.body.data.token;
    });

    it('should authenticate super admin via POST /api/super-admin/auth/login', async () => {
      const res = await request(app)
        .post('/api/super-admin/auth/login')
        .send({
          email: 'master.superadmin@arthagst.platform',
          password: 'SuperAdminSecret@2026',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject invalid password with 401', async () => {
      const res = await request(app)
        .post('/api/super-admin/login')
        .send({
          email: 'master.superadmin@arthagst.platform',
          password: 'WrongPassword@999',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-superadmin tenant admin from accessing SuperAdmin endpoints with 403', async () => {
      const res = await request(app)
        .get('/api/super-admin/dashboard')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/super-admin/dashboard');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Platform Telemetry & Dashboard Analytics', () => {
    it('should return aggregated platform dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/super-admin/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenants).toBeDefined();
      expect(res.body.data.tenants.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data.tenants.active).toBeGreaterThanOrEqual(1);
      expect(res.body.data.financials.mrr).toBeGreaterThanOrEqual(0);
      expect(res.body.data.financials.totalRevenue).toBeGreaterThanOrEqual(1999);
    });

    it('should return usage statistics across platform', async () => {
      const res = await request(app)
        .get('/api/super-admin/reports/usage')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalTenants).toBeGreaterThanOrEqual(2);
      expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Tenant Lifecycle Management (List, Detail, Suspend, Activate)', () => {
    it('should list all tenants with pagination and subscription status', async () => {
      const res = await request(app)
        .get('/api/super-admin/tenants')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .query({ search: 'Apex Fleet' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenants).toBeDefined();
      expect(res.body.data.tenants.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.tenants[0].businessName).toBe('Apex Fleet Logistics Pvt Ltd');
      expect(res.body.data.tenants[0].subscription).toBeDefined();
    });

    it('should return full tenant details with usage and users', async () => {
      const res = await request(app)
        .get(`/api/super-admin/tenants/${tenant1._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenant._id.toString()).toBe(tenant1._id.toString());
      expect(res.body.data.subscription).toBeDefined();
      expect(res.body.data.usage).toBeDefined();
      expect(res.body.data.users).toBeInstanceOf(Array);
    });

    it('should suspend an active tenant and its subscription', async () => {
      const res = await request(app)
        .post(`/api/super-admin/tenants/${tenant1._id}/suspend`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'Payment dispute audit' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await Tenant.findById(tenant1._id);
      expect(updated.isActive).toBe(false);
      expect(updated.subscriptionStatus).toBe('suspended');

      const sub = await Subscription.findOne({ tenantId: tenant1._id });
      expect(sub.status).toBe('suspended');
    });

    it('should reactivate a suspended tenant and its subscription', async () => {
      const res = await request(app)
        .post(`/api/super-admin/tenants/${tenant1._id}/activate`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'Audit resolved cleanly' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await Tenant.findById(tenant1._id);
      expect(updated.isActive).toBe(true);
      expect(updated.subscriptionStatus).toBe('active');

      const sub = await Subscription.findOne({ tenantId: tenant1._id });
      expect(sub.status).toBe('active');
    });
  });

  describe('4. Plan Management (Create, List, Update, Toggle Status)', () => {
    it('should create a new subscription plan', async () => {
      const res = await request(app)
        .post('/api/super-admin/plans')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Platinum Enterprise Plus',
          code: 'PLATINUM_ENT_PLUS',
          description: 'Tier for top enterprises with 100 branches',
          price: 9999,
          annualPrice: 99990,
          billingCycle: 'monthly',
          limits: { maxUsers: 100, maxInvoices: 100000, maxWarehouses: 50 },
          features: ['Dedicated CA Support', 'Custom Role RBAC', 'Multi-GSTIN Console'],
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('PLATINUM_ENT_PLUS');
      customPlan = res.body.data;
    });

    it('should list all subscription plans including newly created', async () => {
      const res = await request(app)
        .get('/api/super-admin/plans')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const plans = Array.isArray(res.body.data) ? res.body.data : res.body.data.plans;
      expect(plans.some((p) => p.code === 'PLATINUM_ENT_PLUS')).toBe(true);
    });

    it('should update plan pricing and limits', async () => {
      const res = await request(app)
        .put(`/api/super-admin/plans/${customPlan._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Platinum Enterprise Plus 2026',
          price: 11999,
          annualPrice: 119990,
          limits: { maxUsers: 120, maxInvoices: 150000, maxWarehouses: 60 },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.price).toBe(11999);
      expect(res.body.data.limits.maxUsers).toBe(120);
    });

    it('should toggle plan active status', async () => {
      const res = await request(app)
        .patch(`/api/super-admin/plans/${customPlan._id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('5. Plan Assignment & Cross-Tenant Subscriptions', () => {
    it('should assign a plan to a tenant and update subscription history', async () => {
      const res = await request(app)
        .post(`/api/super-admin/tenants/${tenant2._id}/subscription`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          planId: customPlan._id,
          billingCycle: 'monthly',
          overrideAmount: 8999,
          notes: 'Special SuperAdmin promotional rate',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscription.amount).toBe(8999);

      const tenantCheck = await Tenant.findById(tenant2._id);
      expect(tenantCheck.subscriptionStatus).toBe('active');
    });

    it('should list cross-tenant subscriptions via GET /api/super-admin/subscriptions', async () => {
      const res = await request(app)
        .get('/api/super-admin/subscriptions')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscriptions).toBeDefined();
      expect(res.body.data.subscriptions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Platform Users Management', () => {
    it('should list users across all tenants via GET /api/super-admin/users', async () => {
      const res = await request(app)
        .get('/api/super-admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toBeDefined();
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(2);
    });

    it('should toggle user active status via PATCH /api/super-admin/users/:id/status', async () => {
      const res = await request(app)
        .patch(`/api/super-admin/users/${user1._id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);

      // Reactivate
      const res2 = await request(app)
        .patch(`/api/super-admin/users/${user1._id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ isActive: true });

      expect(res2.status).toBe(200);
      expect(res2.body.data.isActive).toBe(true);
    });
  });

  describe('7. Platform Payments & Revenue Analytics', () => {
    it('should retrieve platform subscription invoices via GET /api/super-admin/invoices', async () => {
      const res = await request(app)
        .get('/api/super-admin/invoices')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoices).toBeDefined();
      expect(res.body.data.invoices.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.invoices[0].paymentStatus).toBe('paid');
    });

    it('should return subscription revenue grouped by plan and month', async () => {
      const res = await request(app)
        .get('/api/super-admin/reports/revenue')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revenueByPlan).toBeDefined();
      expect(res.body.data.revenueByMonth).toBeDefined();
    });
  });

  describe('8. Support Ticket Management', () => {
    it('should create a support ticket via POST /api/super-admin/tickets', async () => {
      const res = await request(app)
        .post('/api/super-admin/tickets')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tenantId: tenant1._id,
          tenantName: tenant1.businessName,
          subject: 'HSN 8-digit tax rate calculation query',
          description: 'Tenant needs guidance configuring 18% GST on electronic export items',
          priority: 'High',
          status: 'Open',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketNo).toMatch(/^SUP-/);
      expect(res.body.data.status).toBe('Open');
      createdTicket = res.body.data;
    });

    it('should list support tickets via GET /api/super-admin/tickets', async () => {
      const res = await request(app)
        .get('/api/super-admin/tickets')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tickets).toBeDefined();
      expect(res.body.data.tickets.some((t) => t.ticketNo === createdTicket.ticketNo)).toBe(true);
    });

    it('should update ticket status to Resolved via PATCH /api/super-admin/tickets/:id/status', async () => {
      const res = await request(app)
        .patch(`/api/super-admin/tickets/${createdTicket._id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'Resolved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('Resolved');
    });
  });

  describe('9. Platform Announcements Management', () => {
    it('should create and publish platform announcement via POST /api/super-admin/announcements', async () => {
      const res = await request(app)
        .post('/api/super-admin/announcements')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'FY 2026-27 New GST Return Scheme Activated',
          message: 'All businesses must reconcile GSTR-2B before 20th of the following month.',
          targetAudience: 'All Active Tenants',
          status: 'Published',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('FY 2026-27 New GST Return Scheme Activated');
      createdAnnouncement = res.body.data;
    });

    it('should list announcements via GET /api/super-admin/announcements', async () => {
      const res = await request(app)
        .get('/api/super-admin/announcements')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((a) => a._id.toString() === createdAnnouncement._id.toString())).toBe(true);
    });

    it('should update announcement status via PATCH /api/super-admin/announcements/:id/status', async () => {
      const res = await request(app)
        .patch(`/api/super-admin/announcements/${createdAnnouncement._id}/status`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'Archived' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('Archived');
    });
  });

  describe('10. Feature Flags Management', () => {
    it('should retrieve feature flags via GET /api/super-admin/features (with auto-seeding)', async () => {
      const res = await request(app)
        .get('/api/super-admin/features')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      createdFeatureFlag = res.body.data[0];
    });

    it('should toggle feature flag status via PATCH /api/super-admin/features/:id/toggle', async () => {
      const initialEnabled = createdFeatureFlag.enabled;
      const res = await request(app)
        .patch(`/api/super-admin/features/${createdFeatureFlag._id}/toggle`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ enabled: !initialEnabled });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(!initialEnabled);
    });
  });

  describe('11. Platform System Settings', () => {
    it('should retrieve platform settings via GET /api/super-admin/settings', async () => {
      const res = await request(app)
        .get('/api/super-admin/settings')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.defaultTrialDays).toBe(14);
      expect(res.body.data.sandboxMode).toBe(true);
    });

    it('should update platform settings via PUT /api/super-admin/settings', async () => {
      const res = await request(app)
        .put('/api/super-admin/settings')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          defaultTrialDays: 21,
          supportEmail: 'ops.superadmin@arthagst.platform',
          sandboxMode: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.defaultTrialDays).toBe(21);
      expect(res.body.data.supportEmail).toBe('ops.superadmin@arthagst.platform');
      expect(res.body.data.sandboxMode).toBe(false);
    });
  });

  describe('12. Platform Audit Trail & Lifecycle Automation', () => {
    it('should retrieve audit trail verifying all logged SuperAdmin actions', async () => {
      const res = await request(app)
        .get('/api/super-admin/audit-logs')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toBeDefined();
      expect(res.body.data.logs.length).toBeGreaterThanOrEqual(5);

      const actions = res.body.data.logs.map((l) => l.action);
      expect(actions).toContain('SUPER_ADMIN_LOGIN');
    });

    it('should trigger subscription lifecycle automated check via POST /api/super-admin/subscriptions/run-lifecycle', async () => {
      const res = await request(app)
        .post('/api/super-admin/subscriptions/run-lifecycle')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });
});
