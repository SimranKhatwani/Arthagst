import express from 'express';
import * as eInvoiceController from '../controllers/eInvoice.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireFeature } from '../middleware/subscriptionLimit.middleware.js';

const router = express.Router();

router.use(authenticate);

router.post('/generate', requireFeature('e_invoice'), eInvoiceController.generateEInvoice);
router.get('/', eInvoiceController.getEInvoices);
router.get('/:id', eInvoiceController.getEInvoiceById);
router.post('/:id/cancel', eInvoiceController.cancelEInvoice);
router.get('/invoice/:invoiceId', eInvoiceController.getEInvoiceByInvoiceId);
router.get('/invoice/:invoiceId/eligibility', eInvoiceController.checkEligibility);

export default router;
