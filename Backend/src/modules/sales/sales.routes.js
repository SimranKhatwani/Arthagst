import { Router } from 'express';
import * as salesController from './sales.controller.js';
import { authenticate } from '../../middleware/authMiddleware.js';

const router = Router();

// Protect all sales routes with tenant-aware authentication
router.use(authenticate);

/**
 * ==========================================
 * Sales Invoices Routes
 * ==========================================
 */

/**
 * @route   POST /api/sales/invoices
 * @desc    Create a new draft sales invoice
 * @access  Private
 */
router.post('/invoices', salesController.createInvoice);

/**
 * @route   GET /api/sales/invoices
 * @desc    List sales invoices with filters & pagination
 * @access  Private
 */
router.get('/invoices', salesController.getInvoices);

/**
 * @route   GET /api/sales/invoices/:id/pdf
 * @desc    Generate Tax Invoice PDF
 * @access  Private
 */
router.get('/invoices/:id/pdf', salesController.getInvoicePDF);

/**
 * @route   GET /api/sales/invoices/:id
 * @desc    Get sales invoice by ID
 * @access  Private
 */
router.get('/invoices/:id', salesController.getInvoiceById);

/**
 * @route   PUT /api/sales/invoices/:id
 * @desc    Update draft sales invoice
 * @access  Private
 */
router.put('/invoices/:id', salesController.updateInvoice);

/**
 * @route   POST /api/sales/invoices/:id/post
 * @desc    Finalize and post invoice (atomically reduces warehouse stock)
 * @access  Private
 */
router.post('/invoices/:id/post', salesController.postInvoice);

/**
 * @route   POST /api/sales/invoices/:id/cancel
 * @desc    Cancel invoice (atomically reverses stock)
 * @access  Private
 */
router.post('/invoices/:id/cancel', salesController.cancelInvoice);

/**
 * @route   POST /api/sales/invoices/:id/returns
 * @desc    Create sales return / credit note against a posted invoice
 * @access  Private
 */
router.post('/invoices/:id/returns', salesController.createSalesReturn);

/**
 * ==========================================
 * Quotations / Estimates Routes
 * ==========================================
 */
router.post('/quotations', salesController.createQuotation);
router.post('/quotations/:id/convert-to-order', salesController.convertQuotationToOrder);
router.post('/quotations/:id/convert-to-invoice', salesController.convertQuotationToInvoice);

/**
 * ==========================================
 * Sales Orders Routes
 * ==========================================
 */
router.post('/orders', salesController.createSalesOrder);
router.post('/orders/:id/convert-to-invoice', salesController.convertOrderToInvoice);

/**
 * ==========================================
 * Delivery Challans Routes
 * ==========================================
 */
router.post('/challans', salesController.createDeliveryChallan);
router.post('/challans/:id/convert-to-invoice', salesController.convertChallanToInvoice);

/**
 * ==========================================
 * Credit Notes Routes
 * ==========================================
 */
router.get('/credit-notes', salesController.getCreditNotes);
router.get('/credit-notes/:id', salesController.getCreditNoteById);
router.post('/credit-notes/:id/post', salesController.postCreditNote);

export default router;
