import { Router } from 'express';
import * as partyController from '../controllers/party.controller.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all party routes with tenant-aware authentication
router.use(authenticate);

/**
 * @route   POST /api/parties
 * @desc    Create a new party (customer, supplier, or both)
 * @access  Private
 */
router.post('/', partyController.create);

/**
 * @route   GET /api/parties
 * @desc    List parties with pagination, search, and filters
 * @access  Private
 */
router.get('/', partyController.getAll);

/**
 * @route   GET /api/parties/:id
 * @desc    Get party details by ID
 * @access  Private
 */
router.get('/:id', partyController.getById);

/**
 * @route   PUT /api/parties/:id
 * @desc    Update party details
 * @access  Private
 */
router.put('/:id', partyController.update);

/**
 * @route   PATCH /api/parties/:id/status
 * @desc    Activate or deactivate party
 * @access  Private
 */
router.patch('/:id/status', partyController.updateStatus);

/**
 * @route   DELETE /api/parties/:id
 * @desc    Soft delete or archive party
 * @access  Private
 */
router.delete('/:id', partyController.deleteParty);

export default router;
