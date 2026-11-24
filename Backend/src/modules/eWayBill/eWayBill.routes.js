import express from 'express';
import * as eWayBillController from './eWayBill.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireFeature } from '../subscriptions/subscriptionLimit.middleware.js';

const router = express.Router();

router.use(authenticate);

router.post('/generate', requireFeature('e_way_bill'), eWayBillController.generateEWayBill);
router.get('/', eWayBillController.getEWayBills);
router.get('/:id', eWayBillController.getEWayBillById);
router.patch('/:id/vehicle', eWayBillController.updateVehicle);
router.patch('/:id/transporter', eWayBillController.updateTransporter);
router.post('/:id/extend', eWayBillController.extendValidity);
router.post('/:id/cancel', eWayBillController.cancelEWayBill);
router.get('/invoice/:invoiceId', eWayBillController.getEWayBillByInvoiceId);

export default router;
