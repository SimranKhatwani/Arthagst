import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import * as reportsController from '../controllers/reports.controller.js';

const router = Router();

// Protect all reports with tenant-aware authentication
router.use(authenticate);

/**
 * ==========================================
 * A. Sales Reports Routes
 * ==========================================
 */
router.get('/sales/summary', reportsController.getSalesSummary);
router.get('/sales/register', reportsController.getSalesRegister);
router.get('/sales/by-customer', reportsController.getSalesByCustomer);
router.get('/sales/by-product', reportsController.getSalesByProduct);
router.get('/sales/by-status', reportsController.getSalesByStatus);
router.get('/sales/returns', reportsController.getSalesReturnSummary);

/**
 * ==========================================
 * B. Purchase Reports Routes
 * ==========================================
 */
router.get('/purchases/summary', reportsController.getPurchaseSummary);
router.get('/purchases/register', reportsController.getPurchaseRegister);
router.get('/purchases/by-supplier', reportsController.getPurchaseBySupplier);
router.get('/purchases/by-product', reportsController.getPurchaseByProduct);
router.get('/purchases/returns', reportsController.getPurchaseReturnSummary);

/**
 * ==========================================
 * C. Inventory Reports Routes
 * ==========================================
 */
router.get('/inventory/current-stock', reportsController.getCurrentStockReport);
router.get('/inventory/low-stock', reportsController.getLowStockReport);
router.get('/inventory/out-of-stock', reportsController.getOutOfStockReport);
router.get('/inventory/valuation', reportsController.getStockValuationReport);
router.get('/inventory/movements', reportsController.getStockMovementReport);
router.get('/inventory/by-warehouse', reportsController.getWarehouseWiseStockReport);
router.get('/inventory/by-product', reportsController.getProductWiseStockReport);

/**
 * ==========================================
 * D. Party Reports Routes
 * ==========================================
 */
router.get('/parties/customer-outstanding', reportsController.getCustomerOutstandingReport);
router.get('/parties/supplier-outstanding', reportsController.getSupplierOutstandingReport);
router.get('/parties/customer-ledger/:partyId', reportsController.getCustomerLedger);
router.get('/parties/supplier-ledger/:partyId', reportsController.getSupplierLedger);
router.get('/parties/history/:partyId', reportsController.getPartyTransactionHistory);

/**
 * ==========================================
 * E. Payment Reports Routes
 * ==========================================
 */
router.get('/payments/money-in', reportsController.getMoneyInReport);
router.get('/payments/money-out', reportsController.getMoneyOutReport);
router.get('/payments/by-mode', reportsController.getPaymentModeSummary);
router.get('/payments/unallocated', reportsController.getUnallocatedPaymentsReport);
router.get('/payments/receivables-payables', reportsController.getReceivablesAndPayablesSummary);

/**
 * ==========================================
 * F. Expense Reports Routes
 * ==========================================
 */
router.get('/expenses/summary', reportsController.getExpenseSummary);
router.get('/expenses/by-category', reportsController.getCategoryWiseExpenseReport);
router.get('/expenses/monthly', reportsController.getMonthlyExpenseReport);

export default router;
