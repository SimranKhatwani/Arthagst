import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import partyRoutes from './party.routes.js';
import categoryRoutes from './category.routes.js';
import unitRoutes from './unit.routes.js';
import productRoutes from './product.routes.js';
import warehouseRoutes from './warehouse.routes.js';
import inventoryRoutes from './inventory.routes.js';
import salesRoutes from './sales.routes.js';
import purchasesRoutes from './purchases.routes.js';
import bankingRoutes from './banking.routes.js';
import paymentRoutes from './payment.routes.js';
import expenseRoutes from './expense.routes.js';
import gstRoutes from './gst.routes.js';
import eInvoiceRoutes from './eInvoice.routes.js';
import eWayBillRoutes from './eWayBill.routes.js';
import accountingRoutes from './accounting.routes.js';
import planRoutes from './plan.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import superAdminRoutes from './superAdmin.routes.js';
import notificationRoutes from './notification.routes.js';
import auditLogRoutes from './auditLog.routes.js';
import userRoutes from './user.routes.js';
import tenantRoutes from './tenant.routes.js';
import settingsRoutes from './settings.routes.js';
import reportsRoutes from './reports.routes.js';
import posRoutes from './pos.routes.js';

const router = Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/health', (req, res) => {
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const dbState = mongoose.connection.readyState;
  const isHealthy = dbState === 1 || process.env.NODE_ENV === 'test';

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy ? 'ArthaGST API is running' : 'Database service unavailable',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: dbStatusMap[dbState] || 'unknown',
      host: mongoose.connection.host || null,
    },
  });
});

/**
 * Authentication & Tenant routes
 * /api/auth
 */
router.use('/auth', authRoutes);

/**
 * Parties routes (Customers & Suppliers)
 * /api/parties
 */
router.use('/parties', partyRoutes);

/**
 * Categories routes
 * /api/categories
 */
router.use('/categories', categoryRoutes);

/**
 * Units routes
 * /api/units
 */
router.use('/units', unitRoutes);

/**
 * Products routes
 * /api/products
 */
router.use('/products', productRoutes);

/**
 * Warehouses routes
 * /api/warehouses
 */
router.use('/warehouses', warehouseRoutes);

/**
 * Inventory & Stock Movements routes
 * /api/inventory
 */
router.use('/inventory', inventoryRoutes);

/**
 * Sales & Invoicing routes
 * /api/sales
 */
router.use('/sales', salesRoutes);

/**
 * Purchases & Procurement routes
 * /api/purchases
 */
router.use('/purchases', purchasesRoutes);

/**
 * Banking & Bank Accounts routes
 * /api/banking
 */
router.use('/banking', bankingRoutes);

/**
 * Payments & Allocations routes
 * /api/payments
 */
router.use('/payments', paymentRoutes);

/**
 * Expenses & Categories routes
 * /api/expenses
 */
router.use('/expenses', expenseRoutes);

/**
 * GST Management & Return Preparation routes
 * /api/gst
 */
router.use('/gst', gstRoutes);

/**
 * E-Invoice (IRN) routes
 * /api/e-invoices
 */
router.use('/e-invoices', eInvoiceRoutes);

/**
 * E-Way Bill routes
 * /api/e-way-bills
 */
router.use('/e-way-bills', eWayBillRoutes);

/**
 * Accounting & Financial Reports routes
 * /api/accounting
 */
router.use('/accounting', accountingRoutes);

/**
 * Public Subscription Plans
 * /api/plans
 */
router.use('/plans', planRoutes);

/**
 * Tenant Subscription & Billing
 * /api/subscription
 */
router.use('/subscription', subscriptionRoutes);

/**
 * Super Admin Management
 * /api/super-admin
 */
router.use('/super-admin', superAdminRoutes);

/**
 * Notifications Management
 * /api/notifications
 */
router.use('/notifications', notificationRoutes);

/**
 * Audit Logs (Read-Only)
 * /api/audit-logs
 */
router.use('/audit-logs', auditLogRoutes);

/**
 * Tenant Staff & User Management
 * /api/users
 */
router.use('/users', userRoutes);

/**
 * Tenant Organization Profile
 * /api/tenants
 */
router.use('/tenants', tenantRoutes);

/**
 * Organization Settings & Preferences
 * /api/settings
 */
router.use('/settings', settingsRoutes);

/**
 * Operational Reports Module
 * /api/reports
 */
router.use('/reports', reportsRoutes);

/**
 * Point of Sale (POS) Module
 * /api/pos
 */
router.use('/pos', posRoutes);

export default router;
