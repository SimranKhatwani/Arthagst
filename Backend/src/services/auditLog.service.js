import mongoose from 'mongoose';
import AuditLog from '../models/auditLog.model.js';

/**
 * List of sensitive key substrings to redact from audit logs
 */
const SENSITIVE_KEYS = [
  'password',
  'confirmpassword',
  'token',
  'jwt',
  'secret',
  'apikey',
  'apisecret',
  'creditcard',
  'cardnumber',
  'cvv',
  'authorization',
  'authheader',
  'bearer',
];

/**
 * Recursively sanitize audit details and changes to prevent storing sensitive data
 */
export const sanitizeAuditData = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item));
  }

  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
      lowerKey.includes(sensitive)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      sanitized[key] = sanitizeAuditData(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
};

/**
 * Record an audit log entry safely (non-blocking)
 */
export const logAuditAction = async ({
  tenantId = null,
  actor = null,
  user = null,
  userId = null,
  userEmail = '',
  userRole = '',
  action,
  module = 'general',
  entityType = '',
  entityId = '',
  targetType = '',
  targetId = '',
  targetName = '',
  description = '',
  changes = {},
  details = {},
  req = null,
  session = null,
}) => {
  try {
    const effectiveUser = user || actor;
    const resolvedTenantId =
      tenantId || effectiveUser?.tenantId || req?.tenantId || null;
    const resolvedUserId =
      userId || effectiveUser?._id || effectiveUser?.id || null;
    const resolvedUserEmail =
      userEmail || effectiveUser?.email || '';
    const resolvedUserRole =
      userRole ||
      effectiveUser?.role ||
      (effectiveUser?.isSuperAdmin ? 'super_admin' : 'user');

    const resolvedEntityType = entityType || targetType || '';
    const resolvedEntityId = String(entityId || targetId || '');

    const ipAddress =
      req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
      req?.socket?.remoteAddress ||
      '';
    const userAgent = req?.headers?.['user-agent'] || '';

    // Sanitize both changes and details
    const sanitizedChanges = sanitizeAuditData(
      Object.keys(changes).length > 0 ? changes : details
    );
    const sanitizedDetails = sanitizedChanges;

    const auditEntry = new AuditLog({
      tenantId: resolvedTenantId,
      userId: resolvedUserId,
      userEmail: resolvedUserEmail,
      userRole: resolvedUserRole,
      actorId: resolvedUserId,
      actorEmail: resolvedUserEmail,
      actorRole: resolvedUserRole,
      action,
      module,
      entityType: resolvedEntityType,
      entityId: resolvedEntityId,
      targetType: resolvedEntityType,
      targetId: resolvedEntityId,
      targetName: targetName || '',
      description: description || `${action} on ${resolvedEntityType || 'resource'}`,
      changes: sanitizedChanges,
      details: sanitizedDetails,
      ipAddress,
      userAgent,
    });

    if (session) {
      await auditEntry.save({ session });
    } else {
      await auditEntry.save();
    }

    return auditEntry;
  } catch (err) {
    console.error('AuditLog Error:', err.message);
    // Never fail primary operational workflow if audit logging encounters a transient error
    return null;
  }
};

/**
 * Alias for logAuditAction
 */
export const logActivity = logAuditAction;

/**
 * Retrieve audit logs specifically for a tenant with filters and pagination
 */
export const getTenantAuditLogs = async (tenantId, query = {}) => {
  const {
    page = 1,
    limit = 20,
    module,
    action,
    userId,
    entityType,
    startDate,
    endDate,
    search,
  } = query;

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  // Strict tenant scoping
  const filter = { tenantId };

  if (module && module.trim()) {
    filter.module = module.trim();
  }

  if (action && action.trim()) {
    filter.action = action.trim();
  }

  if (userId && mongoose.isValidObjectId(userId)) {
    filter.userId = userId;
  }

  if (entityType && entityType.trim()) {
    filter.entityType = entityType.trim();
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { description: searchRegex },
      { action: searchRegex },
      { userEmail: searchRegex },
      { entityId: searchRegex },
    ];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
};

/**
 * Get a single audit log entry by ID for a tenant
 */
export const getAuditLogById = async (tenantId, logId) => {
  if (!mongoose.isValidObjectId(logId)) {
    const error = new Error('Invalid audit log ID format');
    error.statusCode = 400;
    throw error;
  }

  const log = await AuditLog.findOne({
    _id: logId,
    tenantId,
  }).lean();

  if (!log) {
    const error = new Error('Audit log record not found');
    error.statusCode = 404;
    throw error;
  }

  return log;
};

/**
 * Retrieve platform/super-admin audit logs with filtering and pagination
 */
export const getAuditLogs = async (query = {}) => {
  const filter = {};

  if (query.tenantId && mongoose.isValidObjectId(query.tenantId)) {
    filter.tenantId = query.tenantId;
  }
  if (query.action) {
    filter.action = query.action;
  }
  if (query.targetType || query.entityType) {
    filter.entityType = query.entityType || query.targetType;
  }
  if (query.targetId || query.entityId) {
    filter.entityId = String(query.entityId || query.targetId);
  }
  if (query.actorEmail || query.userEmail) {
    filter.userEmail = new RegExp((query.userEmail || query.actorEmail).trim(), 'i');
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
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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
  sanitizeAuditData,
  logAuditAction,
  logActivity,
  getTenantAuditLogs,
  getAuditLogById,
  getAuditLogs,
};
