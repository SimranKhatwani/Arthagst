import { Router } from 'express';
import * as purchasesController from './purchases.controller.js';
import { authenticate } from '../../middleware/authMiddleware.js';

const router = Router();

// Protect all purchases routes with tenant-aware authentication
router.use(authenticate);

/**
 * ==========================================
 * Purchase Orders Routes
 * ==========================================
 */
router.post('/orders', purchasesController.createPurchaseOrder);
router.get('/orders', purchasesController.getPurchaseOrders);
router.get('/orders/:id', purchasesController.getPurchaseOrderById);
router.put('/orders/:id', purchasesController.updatePurchaseOrder);
router.post('/orders/:id/approve', purchasesController.approvePurchaseOrder);
router.post('/orders/:id/cancel', purchasesController.cancelPurchaseOrder);

/**
 * ==========================================
 * Goods Receipt Notes (GRN) Routes
 * ==========================================
 */
router.post('/grn', purchasesController.createGRN);
router.get('/grn', purchasesController.getGRNs);
router.get('/grn/:id', purchasesController.getGRNById);
router.post('/grn/:id/post', purchasesController.postGRN);
router.post('/grn/:id/cancel', purchasesController.cancelGRN);

/**
 * ==========================================
 * Purchase Bills Routes
 * ==========================================
 */
router.post('/bills', purchasesController.createPurchaseBill);
router.get('/bills', purchasesController.getPurchaseBills);
router.get('/bills/:id', purchasesController.getPurchaseBillById);
router.put('/bills/:id', purchasesController.updatePurchaseBill);
router.post('/bills/:id/post', purchasesController.postPurchaseBill);
router.post('/bills/:id/cancel', purchasesController.cancelPurchaseBill);

/**
 * ==========================================
 * Purchase Returns & Debit Notes Routes
 * ==========================================
 */
router.post('/returns', purchasesController.createPurchaseReturn);
router.get('/returns', purchasesController.getDebitNotes);
router.get('/returns/:id', purchasesController.getDebitNoteById);
router.post('/returns/:id/post', purchasesController.postDebitNote);

export default router;
