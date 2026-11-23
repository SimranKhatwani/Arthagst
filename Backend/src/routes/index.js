import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';

const router = Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ArthaGST API is running'
  });
});

/**
 * Authentication & Tenant routes
 * /api/auth
 */
router.use('/auth', authRoutes);

export default router;
