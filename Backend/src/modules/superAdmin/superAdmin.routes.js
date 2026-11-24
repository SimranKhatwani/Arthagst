import { Router } from 'express';
import * as superAdminController from './superAdmin.controller.js';
import { requireSuperAdmin } from '../../middleware/superAdminMiddleware.js';

const router = Router();

/**
 * Super Admin Login (Platform Login)
 * POST /api/super-admin/auth/login
 */
router.post('/auth/login', superAdminController.login);

// Guard all subsequent routes strictly for Super Admins
router.use(requireSuperAdmin);

/**
 * Platform Dashboard Statistics
 * GET /api/super-admin/dashboard
 */
router.get('/dashboard', superAdminController.getDashboard);

/**
 * Tenant Management
 */
router.get('/tenants', superAdminController.getTenants);
router.get('/tenants/:id', superAdminController.getTenantDetails);
router.post('/tenants/:id/activate', superAdminController.activateTenant);
router.post('/tenants/:id/suspend', superAdminController.suspendTenant);
router.post('/tenants/:id/subscription', superAdminController.assignSubscription);

/**
 * Plan Management
 */
router.post('/plans', superAdminController.createPlan);
router.get('/plans', superAdminController.getPlans);
router.put('/plans/:id', superAdminController.updatePlan);
router.patch('/plans/:id/status', superAdminController.togglePlanStatus);

/**
 * Billing & Invoices
 */
router.get('/invoices', superAdminController.getInvoices);

/**
 * Reports
 */
router.get('/reports/revenue', superAdminController.getRevenueReport);
router.get('/reports/usage', superAdminController.getUsageStatistics);

/**
 * Audit Logs
 */
router.get('/audit-logs', superAdminController.getAuditLogs);

/**
 * Lifecycle Automation
 */
router.post('/subscriptions/run-lifecycle', superAdminController.runLifecycle);

export default router;
