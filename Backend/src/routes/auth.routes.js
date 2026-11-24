import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new business (tenant) and its initial owner account
 * @access  Public
 */
router.post('/register', authLimiter, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user under a specific tenant and return JWT
 * @access  Public
 */
router.post('/login', authLimiter, authController.login);

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user profile and tenant details
 * @access  Private (JWT Bearer Token required)
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (stateless JWT client-side clearance)
 * @access  Public
 */
router.post('/logout', authController.logout);

export default router;
