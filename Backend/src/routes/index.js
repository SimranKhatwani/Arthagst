import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import partyRoutes from '../modules/parties/party.routes.js';
import categoryRoutes from '../modules/categories/category.routes.js';
import unitRoutes from '../modules/units/unit.routes.js';
import productRoutes from '../modules/products/product.routes.js';

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

/**
 * Parties routes (Customers & Suppliers)
 * /api/parties
 */
router.use('/parties', partyRoutes);

/**
 * Categories routes
 * /api/categories
 */
router.use('/categories', categoryRoutes);

/**
 * Units routes
 * /api/units
 */
router.use('/units', unitRoutes);

/**
 * Products routes
 * /api/products
 */
router.use('/products', productRoutes);

export default router;
