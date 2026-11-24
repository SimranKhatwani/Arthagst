import AuditLog from './auditLog.model.js';

/**
 * Record a security or administrative action in the Audit Log
 */
export const logAuditAction = async ({
  actor = null,
  action,
  targetType,
  targetId = '',
  targetName = '',
  details = {},
  req = null,
}) => {
  try {
    const ipAddress =
      req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
      req?.socket?.remoteAddress ||
      '';
    const userAgent = req?.headers?.['user-agent'] || '';

    const auditEntry = new AuditLog({
      actorId: actor?._id || actor?.id || null,
      actorEmail: actor?.email || '',
      actorRole: actor?.role || (actor?.isSuperAdmin ? 'super_admin' : 'unknown'),
      action,
      targetType,
      targetId: String(targetId || ''),
      targetName,
      details,
      ipAddress,
      userAgent,
    });

    await auditEntry.save();
    return auditEntry;
  } catch (err) {
    console.error('AuditLog Error:', err.message);
    // Never fail the primary operational request if audit logging encounters a transient error
    return null;
  }
};

/**
 * Retrieve audit logs with filtering and pagination
 */
export const getAuditLogs = async (query = {}) => {
  const filter = {};

  if (query.action) {
    filter.action = query.action;
  }
  if (query.targetType) {
    filter.targetType = query.targetType;
  }
  if (query.targetId) {
    filter.targetId = String(query.targetId);
  }
  if (query.actorEmail) {
    filter.actorEmail = new RegExp(query.actorEmail.trim(), 'i');
  }
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export default {
  logAuditAction,
  getAuditLogs,
};
