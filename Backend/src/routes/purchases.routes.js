import { Router } from 'express';
import * as purchasesController from '../controllers/purchases.controller.js';
import { authenticate, authorizePermission } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all purchases routes with tenant-aware authentication
router.use(authenticate);

/**
 * ==========================================
 * Purchase Orders Routes
 * ==========================================
 */
router.post('/orders', authorizePermission('purchases', 'edit'), purchasesController.createPurchaseOrder);
router.get('/orders', authorizePermission('purchases', 'read'), purchasesController.getPurchaseOrders);
router.get('/orders/:id', authorizePermission('purchases', 'read'), purchasesController.getPurchaseOrderById);
router.put('/orders/:id', authorizePermission('purchases', 'edit'), purchasesController.updatePurchaseOrder);
router.post('/orders/:id/approve', authorizePermission('purchases', 'edit'), purchasesController.approvePurchaseOrder);
router.post('/orders/:id/cancel', authorizePermission('purchases', 'edit'), purchasesController.cancelPurchaseOrder);

/**
 * ==========================================
 * Goods Receipt Notes (GRN) Routes
 * ==========================================
 */
router.post('/grn', authorizePermission('purchases', 'edit'), purchasesController.createGRN);
router.get('/grn', authorizePermission('purchases', 'read'), purchasesController.getGRNs);
router.get('/grn/:id', authorizePermission('purchases', 'read'), purchasesController.getGRNById);
router.post('/grn/:id/post', authorizePermission('purchases', 'edit'), purchasesController.postGRN);
router.post('/grn/:id/cancel', authorizePermission('purchases', 'edit'), purchasesController.cancelGRN);

/**
 * ==========================================
 * Purchase Bills Routes
 * ==========================================
 */
router.post('/bills', authorizePermission('purchases', 'edit'), purchasesController.createPurchaseBill);
router.get('/bills', authorizePermission('purchases', 'read'), purchasesController.getPurchaseBills);
router.get('/bills/:id', authorizePermission('purchases', 'read'), purchasesController.getPurchaseBillById);
router.put('/bills/:id', authorizePermission('purchases', 'edit'), purchasesController.updatePurchaseBill);
router.post('/bills/:id/post', authorizePermission('purchases', 'edit'), purchasesController.postPurchaseBill);
router.post('/bills/:id/cancel', authorizePermission('purchases', 'edit'), purchasesController.cancelPurchaseBill);

/**
 * ==========================================
 * Purchase Returns & Debit Notes Routes
 * ==========================================
 */
router.post('/returns', authorizePermission('purchases', 'edit'), purchasesController.createPurchaseReturn);
router.get('/returns', authorizePermission('purchases', 'read'), purchasesController.getDebitNotes);
router.get('/returns/:id', authorizePermission('purchases', 'read'), purchasesController.getDebitNoteById);
router.post('/returns/:id/post', authorizePermission('purchases', 'edit'), purchasesController.postDebitNote);

export default router;
