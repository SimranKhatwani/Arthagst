import { Router } from 'express';
import { authenticate } from '../../middleware/authMiddleware.js';
import * as auditLogController from './auditLog.controller.js';

const router = Router();

// Protect all tenant audit log routes with authentication (Read-Only)
router.use(authenticate);

/**
 * GET /api/audit-logs
 * List tenant audit logs with pagination and filters
 */
router.get('/', auditLogController.getTenantAuditLogs);

/**
 * GET /api/audit-logs/:id
 * Get single audit log record details
 */
router.get('/:id', auditLogController.getAuditLogById);

export default router;
