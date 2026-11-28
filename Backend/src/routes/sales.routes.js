import { Router } from 'express';
import * as salesController from '../controllers/sales.controller.js';
import { authenticate, authorizePermission } from '../middleware/authMiddleware.js';
import { requireLimit } from '../middleware/subscriptionLimit.middleware.js';

const router = Router();

// Protect all sales routes with tenant-aware authentication
router.use(authenticate);

/**
 * ==========================================
 * Sales Invoices Routes
 * ==========================================
 */
router.post('/invoices', authorizePermission('sales', 'edit'), requireLimit('invoices'), salesController.createInvoice);
router.get('/invoices', authorizePermission('sales', 'read'), salesController.getInvoices);
router.get('/invoices/:id/pdf', authorizePermission('sales', 'read'), salesController.getInvoicePDF);
router.get('/invoices/:id', authorizePermission('sales', 'read'), salesController.getInvoiceById);
router.put('/invoices/:id', authorizePermission('sales', 'edit'), salesController.updateInvoice);
router.post('/invoices/:id/post', authorizePermission('sales', 'edit'), salesController.postInvoice);
router.post('/invoices/:id/cancel', authorizePermission('sales', 'edit'), salesController.cancelInvoice);
router.post('/invoices/:id/returns', authorizePermission('sales', 'edit'), salesController.createSalesReturn);

/**
 * ==========================================
 * Quotations / Estimates Routes
 * ==========================================
 */
router.post('/quotations', authorizePermission('sales', 'edit'), salesController.createQuotation);
router.get('/quotations', authorizePermission('sales', 'read'), salesController.getQuotations);
router.get('/quotations/:id', authorizePermission('sales', 'read'), salesController.getQuotationById);
router.put('/quotations/:id', authorizePermission('sales', 'edit'), salesController.updateQuotation);
router.delete('/quotations/:id', authorizePermission('sales', 'edit'), salesController.deleteQuotation);
router.post('/quotations/:id/convert-to-order', authorizePermission('sales', 'edit'), salesController.convertQuotationToOrder);
router.post('/quotations/:id/convert-to-invoice', authorizePermission('sales', 'edit'), salesController.convertQuotationToInvoice);

/**
 * ==========================================
 * Sales Orders Routes
 * ==========================================
 */
router.post('/orders', authorizePermission('sales', 'edit'), salesController.createSalesOrder);
router.get('/orders', authorizePermission('sales', 'read'), salesController.getSalesOrders);
router.get('/orders/:id', authorizePermission('sales', 'read'), salesController.getSalesOrderById);
router.put('/orders/:id', authorizePermission('sales', 'edit'), salesController.updateSalesOrder);
router.post('/orders/:id/cancel', authorizePermission('sales', 'edit'), salesController.cancelSalesOrder);
router.post('/orders/:id/convert-to-invoice', authorizePermission('sales', 'edit'), salesController.convertOrderToInvoice);

/**
 * ==========================================
 * Delivery Challans Routes
 * ==========================================
 */
router.post('/challans', authorizePermission('sales', 'edit'), salesController.createDeliveryChallan);
router.get('/challans', authorizePermission('sales', 'read'), salesController.getDeliveryChallans);
router.get('/challans/:id', authorizePermission('sales', 'read'), salesController.getDeliveryChallanById);
router.put('/challans/:id', authorizePermission('sales', 'edit'), salesController.updateDeliveryChallan);
router.post('/challans/:id/convert-to-invoice', authorizePermission('sales', 'edit'), salesController.convertChallanToInvoice);

/**
 * ==========================================
 * Credit Notes Routes
 * ==========================================
 */
router.post('/credit-notes', authorizePermission('sales', 'edit'), salesController.createCreditNote);
router.get('/credit-notes', authorizePermission('sales', 'read'), salesController.getCreditNotes);
router.get('/credit-notes/:id', authorizePermission('sales', 'read'), salesController.getCreditNoteById);
router.post('/credit-notes/:id/post', authorizePermission('sales', 'edit'), salesController.postCreditNote);

export default router;
