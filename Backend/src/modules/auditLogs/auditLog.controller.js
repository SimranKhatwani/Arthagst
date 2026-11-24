import * as auditLogService from './auditLog.service.js';
import { sendResponse } from '../../utils/apiResponse.js';

/**
 * GET /api/audit-logs
 * Retrieve paginated audit logs for the authenticated tenant
 */
export const getTenantAuditLogs = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const result = await auditLogService.getTenantAuditLogs(tenantId, req.query);

    return sendResponse(
      res,
      200,
      true,
      'Audit logs retrieved successfully',
      result
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/audit-logs/:id
 * Retrieve a specific audit log record
 */
export const getAuditLogById = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const log = await auditLogService.getAuditLogById(tenantId, id);

    return sendResponse(
      res,
      200,
      true,
      'Audit log record retrieved successfully',
      log
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getTenantAuditLogs,
  getAuditLogById,
};
