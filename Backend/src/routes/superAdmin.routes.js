import { Router } from 'express';
import * as superAdminController from '../controllers/superAdmin.controller.js';
import { requireSuperAdmin } from '../middleware/superAdminMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * Super Admin Login (Platform Login)
 * POST /api/super-admin/auth/login and POST /api/super-admin/login
 */
router.post('/auth/login', authLimiter, superAdminController.login);
router.post('/login', authLimiter, superAdminController.login);

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
router.post('/tenants', superAdminController.createTenant);
router.get('/tenants/:id', superAdminController.getTenantDetails);
router.put('/tenants/:id', superAdminController.updateTenant);
router.delete('/tenants/:id', superAdminController.deleteTenant);
router.post('/tenants/:id/activate', superAdminController.activateTenant);
router.post('/tenants/:id/suspend', superAdminController.suspendTenant);
router.post('/tenants/:id/subscription', superAdminController.assignSubscription);
router.post('/tenants/:id/reset-password', superAdminController.resetTenantPassword);

/**
 * Plan Management
 */
router.post('/plans', superAdminController.createPlan);
router.get('/plans', superAdminController.getPlans);
router.put('/plans/:id', superAdminController.updatePlan);
router.patch('/plans/:id/status', superAdminController.togglePlanStatus);

/**
 * Platform Users
 */
router.get('/users', superAdminController.getUsers);
router.patch('/users/:id/status', superAdminController.toggleUserStatus);

/**
 * Platform Subscriptions
 */
router.get('/subscriptions', superAdminController.getSubscriptions);

/**
 * Billing & Invoices
 */
router.get('/invoices', superAdminController.getInvoices);
router.put('/invoices/:id', superAdminController.updateInvoice);

/**
 * Support Tickets
 */
router.get('/tickets', superAdminController.getTickets);
router.post('/tickets', superAdminController.createTicket);
router.patch('/tickets/:id/status', superAdminController.updateTicketStatus);

/**
 * Platform Announcements
 */
router.get('/announcements', superAdminController.getAnnouncements);
router.post('/announcements', superAdminController.createAnnouncement);
router.patch('/announcements/:id/status', superAdminController.updateAnnouncementStatus);

/**
 * Feature Flags
 */
router.get('/features', superAdminController.getFeatureFlags);
router.patch('/features/:id/toggle', superAdminController.toggleFeatureFlag);

/**
 * Platform System Settings
 */
router.get('/settings', superAdminController.getPlatformSettings);
router.put('/settings', superAdminController.updatePlatformSettings);

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
