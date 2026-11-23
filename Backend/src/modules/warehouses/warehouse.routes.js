import { Router } from 'express';
import * as warehouseController from './warehouse.controller.js';
import { authenticate } from '../../middleware/authMiddleware.js';

const router = Router();

// Protect all warehouse routes with tenant-aware authentication
router.use(authenticate);

/**
 * @route   POST /api/warehouses
 * @desc    Create a new warehouse
 * @access  Private
 */
router.post('/', warehouseController.create);

/**
 * @route   GET /api/warehouses
 * @desc    List warehouses with pagination, search, and filters
 * @access  Private
 */
router.get('/', warehouseController.getAll);

/**
 * @route   GET /api/warehouses/:id
 * @desc    Get warehouse details by ID
 * @access  Private
 */
router.get('/:id', warehouseController.getById);

/**
 * @route   PUT /api/warehouses/:id
 * @desc    Update warehouse details
 * @access  Private
 */
router.put('/:id', warehouseController.update);

/**
 * @route   PATCH /api/warehouses/:id/status
 * @desc    Activate or deactivate warehouse
 * @access  Private
 */
router.patch('/:id/status', warehouseController.updateStatus);

/**
 * @route   DELETE /api/warehouses/:id
 * @desc    Delete (soft-delete) warehouse
 * @access  Private
 */
router.delete('/:id', warehouseController.deleteWarehouse);

export default router;
