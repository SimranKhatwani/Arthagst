import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

// Gated behind tenant authentication and owner/admin authorization
router.use(authenticate);
router.use(authorizeRoles('owner', 'admin'));

/**
 * @route   GET /api/users
 * @desc    List tenant staff accounts with filters and pagination
 * @access  Private (Owner / Admin)
 */
router.get('/', userController.getAll);

/**
 * @route   POST /api/users
 * @desc    Create a new staff account
 * @access  Private (Owner / Admin)
 */
router.post('/', userController.create);

/**
 * @route   GET /api/users/:id
 * @desc    Get staff details by ID
 * @access  Private (Owner / Admin)
 */
router.get('/:id', userController.getById);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update staff profile details and role
 * @access  Private (Owner / Admin)
 */
router.patch('/:id', userController.update);

/**
 * @route   PATCH /api/users/:id/status
 * @desc    Activate or deactivate staff member
 * @access  Private (Owner / Admin)
 */
router.patch('/:id/status', userController.updateStatus);

/**
 * @route   DELETE /api/users/:id
 * @desc    Remove or delete staff account
 * @access  Private (Owner / Admin)
 */
router.delete('/:id', userController.remove);

export default router;
