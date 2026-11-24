import { Router } from 'express';
import * as categoryController from '../controllers/category.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all category routes with tenant authentication
router.use(authenticate);

/**
 * @route   POST /api/categories
 * @desc    Create a category
 * @access  Private
 */
router.post('/', categoryController.create);

/**
 * @route   GET /api/categories
 * @desc    List categories with pagination, search, and hierarchy filter
 * @access  Private
 */
router.get('/', categoryController.getAll);

/**
 * @route   GET /api/categories/:id
 * @desc    Get category details by ID
 * @access  Private
 */
router.get('/:id', categoryController.getById);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update category (with circular hierarchy prevention)
 * @access  Private
 */
router.put('/:id', categoryController.update);

/**
 * @route   PATCH /api/categories/:id/status
 * @desc    Activate or deactivate category
 * @access  Private
 */
router.patch('/:id/status', categoryController.updateStatus);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Soft delete category (prevents deletion if subcategories or products exist)
 * @access  Private
 */
router.delete('/:id', categoryController.deleteCategory);

export default router;
