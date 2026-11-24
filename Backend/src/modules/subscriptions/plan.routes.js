import { Router } from 'express';
import * as subscriptionController from './subscription.controller.js';

const router = Router();

/**
 * Publicly viewable active subscription plans
 * GET /api/plans
 */
router.get('/', subscriptionController.getPublicPlans);

/**
 * View specific plan details
 * GET /api/plans/:id
 */
router.get('/:id', subscriptionController.getPlanDetails);

export default router;
