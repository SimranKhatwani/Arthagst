import { Router } from 'express';
import * as subscriptionController from './subscription.controller.js';
import { authenticate } from '../../middleware/authMiddleware.js';

const router = Router();

// Protect all tenant subscription endpoints
router.use(authenticate);

/**
 * View current tenant subscription and resource usage
 * GET /api/subscription
 */
router.get('/', subscriptionController.getCurrentSubscription);

/**
 * View live resource usage against plan limits
 * GET /api/subscription/usage
 */
router.get('/usage', subscriptionController.getSubscriptionUsage);

/**
 * View tenant subscription event history
 * GET /api/subscription/history
 */
router.get('/history', subscriptionController.getSubscriptionHistory);

/**
 * Upgrade or downgrade subscription plan
 * POST /api/subscription/upgrade
 */
router.post('/upgrade', subscriptionController.upgradeOrDowngrade);

/**
 * Renew current subscription
 * POST /api/subscription/renew
 */
router.post('/renew', subscriptionController.renewSubscription);

/**
 * Cancel subscription
 * POST /api/subscription/cancel
 */
router.post('/cancel', subscriptionController.cancelSubscription);

/**
 * List tenant subscription invoices
 * GET /api/subscription/invoices
 */
router.get('/invoices', subscriptionController.getInvoices);

/**
 * Confirm payment gateway response for subscription invoice
 * POST /api/subscription/payment-confirm
 */
router.post('/payment-confirm', subscriptionController.confirmPayment);

export default router;
