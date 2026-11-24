import express from 'express';
import * as gstController from '../controllers/gst.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

// Dashboard
router.get('/dashboard', gstController.getDashboard);

// GSTR-1
router.get('/gstr1', gstController.getGSTR1);
router.get('/gstr1/export', gstController.exportGSTR1);

// GSTR-3B
router.get('/gstr3b', gstController.getGSTR3B);

// GSTR-2B Import & Reconciliation
router.post('/gstr2b/import', gstController.importGSTR2B);
router.post('/gstr2b/reconcile', gstController.reconcileGSTR2B);

// Filing Calendar & Return Period Tracking
router.get('/calendar', gstController.getFilingCalendar);
router.post('/calendar/status', gstController.updateReturnPeriodStatus);
router.post('/calendar/validate', gstController.validateReturnPeriod);

// GST Reports
router.get('/reports', gstController.getReports);

export default router;
