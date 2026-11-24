import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/settings
 * @desc    Get tenant organization settings & preferences
 * @access  Private (All tenant members)
 */
router.get('/', settingsController.getSettings);

/**
 * @route   PUT /api/settings
 * @desc    Update or replace organization settings
 * @access  Private (Owner / Admin)
 */
router.put('/', authorizeRoles('owner', 'admin'), settingsController.updateSettings);

/**
 * @route   PATCH /api/settings
 * @desc    Partial update organization settings
 * @access  Private (Owner / Admin)
 */
router.patch('/', authorizeRoles('owner', 'admin'), settingsController.patchSettings);

export default router;
