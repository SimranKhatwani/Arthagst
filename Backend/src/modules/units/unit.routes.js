import { Router } from 'express';
import * as unitController from './unit.controller.js';
import { authenticate } from '../../middleware/authMiddleware.js';

const router = Router();

// Protect all unit routes with tenant authentication
router.use(authenticate);

/**
 * @route   POST /api/units
 * @desc    Create a unit of measurement
 * @access  Private
 */
router.post('/', unitController.create);

/**
 * @route   GET /api/units
 * @desc    List units with pagination, search, and type filter
 * @access  Private
 */
router.get('/', unitController.getAll);

/**
 * @route   GET /api/units/:id
 * @desc    Get unit details by ID
 * @access  Private
 */
router.get('/:id', unitController.getById);

/**
 * @route   PUT /api/units/:id
 * @desc    Update unit details
 * @access  Private
 */
router.put('/:id', unitController.update);

/**
 * @route   PATCH /api/units/:id/status
 * @desc    Activate or deactivate unit
 * @access  Private
 */
router.patch('/:id/status', unitController.updateStatus);

/**
 * @route   DELETE /api/units/:id
 * @desc    Soft delete unit (prevents deletion if used by products)
 * @access  Private
 */
router.delete('/:id', unitController.deleteUnit);

export default router;
