import { Router } from 'express';
import * as inventoryController from '../controllers/inventory.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all inventory routes with tenant-aware authentication
router.use(authenticate);

/**
 * @route   GET /api/inventory
 * @desc    List stock across products and warehouses
 * @access  Private
 */
router.get('/', inventoryController.getInventory);

/**
 * @route   GET /api/inventory/movements
 * @desc    Audit log of all stock movements
 * @access  Private
 */
router.get('/movements', inventoryController.getMovements);

/**
 * @route   GET /api/inventory/low-stock
 * @desc    Get low stock report
 * @access  Private
 */
router.get('/low-stock', inventoryController.getLowStockReport);

/**
 * @route   GET /api/inventory/product/:productId
 * @desc    Product-wise stock summary across warehouses
 * @access  Private
 */
router.get('/product/:productId', inventoryController.getProductStock);

/**
 * @route   GET /api/inventory/warehouse/:warehouseId
 * @desc    Warehouse-wise stock summary across products
 * @access  Private
 */
router.get('/warehouse/:warehouseId', inventoryController.getWarehouseStock);

/**
 * @route   POST /api/inventory/opening-stock
 * @desc    Initialize opening stock for a product in a warehouse
 * @access  Private
 */
router.post('/opening-stock', inventoryController.initializeOpeningStock);

/**
 * @route   POST /api/inventory/stock-in
 * @desc    Add stock (Stock In)
 * @access  Private
 */
router.post('/stock-in', inventoryController.stockIn);

/**
 * @route   POST /api/inventory/stock-out
 * @desc    Reduce stock (Stock Out)
 * @access  Private
 */
router.post('/stock-out', inventoryController.stockOut);

/**
 * @route   POST /api/inventory/adjustment
 * @desc    Reconcile / adjust stock
 * @access  Private
 */
router.post('/adjustment', inventoryController.adjustStock);

/**
 * @route   POST /api/inventory/transfer
 * @desc    Transfer stock between warehouses
 * @access  Private
 */
router.post('/transfer', inventoryController.transferStock);

export default router;
