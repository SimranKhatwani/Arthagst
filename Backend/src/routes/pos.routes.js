import { Router } from 'express';
import * as posController from '../controllers/pos.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireLimit } from '../middleware/subscriptionLimit.middleware.js';

const router = Router();

// Protect all POS routes with tenant-aware authentication
router.use(authenticate);

/**
 * POS Lookup & Catalog Routes
 */
router.get('/products', posController.getProducts);
router.get('/customers', posController.getCustomers);
router.get('/daily-summary', posController.getDailySummary);
router.get('/cashier-summary', posController.getCashierSummary);

/**
 * POS Bill Management Routes
 */
router.post('/bills', requireLimit('invoices'), posController.createBill);
router.get('/bills', posController.getBills);
router.get('/bills/:id', posController.getBillById);
router.patch('/bills/:id', posController.updateDraftBill);
router.post('/bills/:id/finalize', posController.finalizeBill);
router.post('/bills/:id/cancel', posController.cancelBill);
router.get('/bills/:id/receipt', posController.getReceipt);

export default router;
