import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import partyRoutes from '../modules/parties/party.routes.js';
import categoryRoutes from '../modules/categories/category.routes.js';
import unitRoutes from '../modules/units/unit.routes.js';
import productRoutes from '../modules/products/product.routes.js';
import warehouseRoutes from '../modules/warehouses/warehouse.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import salesRoutes from '../modules/sales/sales.routes.js';
import purchasesRoutes from '../modules/purchases/purchases.routes.js';
import bankingRoutes from '../modules/banking/banking.routes.js';
import paymentRoutes from '../modules/payments/payment.routes.js';
import expenseRoutes from '../modules/expenses/expense.routes.js';

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

/**
 * Warehouses routes
 * /api/warehouses
 */
router.use('/warehouses', warehouseRoutes);

/**
 * Inventory & Stock Movements routes
 * /api/inventory
 */
router.use('/inventory', inventoryRoutes);

/**
 * Sales & Invoicing routes
 * /api/sales
 */
router.use('/sales', salesRoutes);

/**
 * Purchases & Procurement routes
 * /api/purchases
 */
router.use('/purchases', purchasesRoutes);

/**
 * Banking & Bank Accounts routes
 * /api/banking
 */
router.use('/banking', bankingRoutes);

/**
 * Payments & Allocations routes
 * /api/payments
 */
router.use('/payments', paymentRoutes);

/**
 * Expenses & Categories routes
 * /api/expenses
 */
router.use('/expenses', expenseRoutes);

export default router;
