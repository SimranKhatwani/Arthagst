import Tenant from '../models/tenant.model.js';
import { logAuditAction } from './auditLog.service.js';

/**
 * Get tenant business profile
 */
export const getTenantProfile = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) {
    const error = new Error('Tenant organization profile not found');
    error.statusCode = 404;
    throw error;
  }
  return tenant;
};

/**
 * Update tenant business profile
 */
export const updateTenantProfile = async (tenantId, actorUser, data) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const error = new Error('Tenant organization profile not found');
    error.statusCode = 404;
    throw error;
  }

  const changes = {};

  // List of permitted fields
  const permittedFields = [
    'businessName',
    'businessType',
    'ownerName',
    'email',
    'phone',
    'GSTIN',
    'PAN',
    'businessAddress',
    'city',
    'state',
    'stateCode',
    'pincode',
    'country',
    'financialYearStart',
  ];

  // GSTIN & PAN Auto-derivation
  if (data.GSTIN) {
    const gstin = data.GSTIN.trim().toUpperCase();
    if (!data.PAN && gstin.length === 15) {
      data.PAN = gstin.substring(2, 12);
    }
    if (!data.stateCode && gstin.length >= 2) {
      data.stateCode = gstin.substring(0, 2);
    }
  }

  for (const field of permittedFields) {
    if (data[field] !== undefined && data[field] !== null) {
      const newVal = typeof data[field] === 'string' ? data[field].trim() : data[field];
      if (tenant[field] !== newVal) {
        changes[field] = { from: tenant[field], to: newVal };
        tenant[field] = newVal;
      }
    }
  }

  await tenant.save();

  // Audit log
  logAuditAction({
    tenantId,
    actor: actorUser,
    user: actorUser,
    action: 'UPDATE',
    module: 'TENANTS',
    entityType: 'Tenant',
    entityId: tenant._id,
    description: `Updated business profile for '${tenant.businessName}'`,
    changes,
  }).catch(() => {});

  return tenant.toObject();
};
