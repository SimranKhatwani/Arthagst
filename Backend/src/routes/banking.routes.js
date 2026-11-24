import { Router } from 'express';
import * as bankingController from '../controllers/banking.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all banking routes with tenant-aware authentication
router.use(authenticate);

/**
 * @route   POST /api/banking/accounts
 * @desc    Create a new bank/cash account
 * @access  Private
 */
router.post('/accounts', bankingController.createAccount);

/**
 * @route   GET /api/banking/accounts
 * @desc    List bank/cash accounts with pagination & filters
 * @access  Private
 */
router.get('/accounts', bankingController.getAccounts);

/**
 * @route   GET /api/banking/accounts/:id
 * @desc    Get account details by ID
 * @access  Private
 */
router.get('/accounts/:id', bankingController.getAccountById);

/**
 * @route   PUT /api/banking/accounts/:id
 * @desc    Update bank account details
 * @access  Private
 */
router.put('/accounts/:id', bankingController.updateAccount);

/**
 * @route   PATCH /api/banking/accounts/:id/status
 * @desc    Activate or deactivate bank account
 * @access  Private
 */
router.patch('/accounts/:id/status', bankingController.updateAccountStatus);

/**
 * @route   DELETE /api/banking/accounts/:id
 * @desc    Soft delete bank account
 * @access  Private
 */
router.delete('/accounts/:id', bankingController.deleteAccount);

export default router;
