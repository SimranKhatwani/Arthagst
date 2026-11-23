import { Router } from 'express';
import * as productController from './product.controller.js';
import { authenticate } from '../../middleware/authMiddleware.js';

const router = Router();

// Protect all product routes with tenant-aware authentication
router.use(authenticate);

/**
 * @route   POST /api/products
 * @desc    Create a new product (goods or service)
 * @access  Private
 */
router.post('/', productController.create);

/**
 * @route   GET /api/products
 * @desc    List products with pagination, search, and filters
 * @access  Private
 */
router.get('/', productController.getAll);

/**
 * @route   GET /api/products/:id
 * @desc    Get product details by ID
 * @access  Private
 */
router.get('/:id', productController.getById);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product details
 * @access  Private
 */
router.put('/:id', productController.update);

/**
 * @route   PATCH /api/products/:id/status
 * @desc    Activate or deactivate product
 * @access  Private
 */
router.patch('/:id/status', productController.updateStatus);

/**
 * @route   DELETE /api/products/:id
 * @desc    Soft delete or archive product
 * @access  Private
 */
router.delete('/:id', productController.deleteProduct);

export default router;
