import { Router } from 'express';
import * as tenantController from '../controllers/tenant.controller.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/tenants/me
 * @desc    Get current tenant organization profile
 * @access  Private (All tenant members)
 */
router.get('/me', tenantController.getProfile);

/**
 * @route   PUT /api/tenants/me
 * @desc    Update tenant organization profile
 * @access  Private (Owner / Admin)
 */
router.put('/me', authorizeRoles('owner', 'admin'), tenantController.updateProfile);

export default router;
