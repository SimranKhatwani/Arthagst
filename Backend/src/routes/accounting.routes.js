import { Router } from 'express';
import * as accountingController from '../controllers/accounting.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all accounting routes with tenant authentication
router.use(authenticate);

/**
 * -------------------------------------------------------------
 * Chart of Accounts (COA) Routes
 * -------------------------------------------------------------
 */
router.post('/accounts/seed', accountingController.seedAccounts);
router.post('/accounts', accountingController.createAccount);
router.get('/accounts', accountingController.getAccounts);
router.get('/accounts/:id', accountingController.getAccountById);
router.put('/accounts/:id', accountingController.updateAccount);
router.delete('/accounts/:id', accountingController.deleteAccount);

/**
 * -------------------------------------------------------------
 * Journal Entry Routes
 * -------------------------------------------------------------
 */
router.post('/journal-entries', accountingController.createJournalEntry);
router.get('/journal-entries', accountingController.getJournalEntries);
router.get('/journal-entries/:id', accountingController.getJournalEntryById);
router.post('/journal-entries/:id/reverse', accountingController.reverseJournalEntry);

/**
 * -------------------------------------------------------------
 * Financial Reports Routes
 * -------------------------------------------------------------
 */
router.get('/reports/general-ledger', accountingController.getGeneralLedger);
router.get('/reports/trial-balance', accountingController.getTrialBalance);
router.get('/reports/profit-and-loss', accountingController.getProfitAndLoss);
router.get('/reports/balance-sheet', accountingController.getBalanceSheet);
router.get('/reports/cash-flow', accountingController.getCashFlowStatement);

/**
 * -------------------------------------------------------------
 * Fiscal Year Closing Route
 * -------------------------------------------------------------
 */
router.post('/fiscal-year/close', accountingController.closeFinancialYear);

export default router;
