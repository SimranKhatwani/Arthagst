import mongoose from 'mongoose';
import User from '../models/user.model.js';
import { checkUsageLimit } from './subscriptionLimit.service.js';
import { logAuditAction } from './auditLog.service.js';
import { createNotification } from './notification.service.js';

/**
 * List tenant staff members with pagination and filters
 */
export const listStaff = async (tenantId, query = {}) => {
  const { page = 1, limit = 20, role, search, isActive } = query;

  const filter = { tenantId };

  if (role) {
    filter.role = role;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive;
  }

  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { phone: { $regex: s, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Create a new staff account for a tenant
 */
export const createStaff = async (tenantId, actorUser, data) => {
  const normalizedEmail = data.email.toLowerCase().trim();

  // 1. Check duplicate email within the same tenant
  const existing = await User.findOne({ tenantId, email: normalizedEmail });
  if (existing) {
    const error = new Error(`A user with email '${normalizedEmail}' already exists in your organization.`);
    error.statusCode = 409;
    throw error;
  }

  // 2. Check subscription user limits
  const limitCheck = await checkUsageLimit(tenantId, 'users', 1);
  if (!limitCheck.allowed) {
    const error = new Error(limitCheck.reason || 'Staff user limit reached for your current subscription plan.');
    error.statusCode = 403;
    error.code = 'PLAN_LIMIT_REACHED';
    throw error;
  }

  // 3. Prevent assigning forbidden roles
  if (data.role === 'owner' || data.role === 'super_admin') {
    const error = new Error("Cannot assign 'owner' or 'super_admin' role to staff accounts.");
    error.statusCode = 403;
    throw error;
  }

  // 4. Create and persist the user (pre-save hook hashes password)
  const user = new User({
    tenantId,
    name: data.name.trim(),
    email: normalizedEmail,
    password: data.password,
    phone: data.phone ? data.phone.trim() : '',
    role: data.role || 'sales',
    permissions: data.permissions || [],
    isActive: true,
    isSuperAdmin: false,
  });

  await user.save();

  // 5. Audit log
  logAuditAction({
    tenantId,
    actor: actorUser,
    user: actorUser,
    action: 'CREATE',
    module: 'USERS',
    entityType: 'User',
    entityId: user._id,
    description: `Created staff member '${user.name}' (${user.email}) with role '${user.role}'`,
    changes: {
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    },
  }).catch(() => {});

  // 6. Notification
  createNotification({
    tenantId,
    title: 'New Staff Member Added',
    message: `${user.name} (${user.role}) has been added to the team by ${actorUser?.name || 'Administrator'}.`,
    notificationType: 'SYSTEM_EVENT',
    referenceType: 'User',
    referenceId: user._id,
  }).catch(() => {});

  const result = user.toObject();
  delete result.password;
  return result;
};

/**
 * Get staff details by ID
 */
export const getStaffById = async (tenantId, userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ _id: userId, tenantId }).select('-password').lean();
  if (!user) {
    const error = new Error('Staff member not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  return user;
};

/**
 * Update permitted profile fields and role of a staff member
 */
export const updateStaff = async (tenantId, actorUser, userId, data) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ _id: userId, tenantId });
  if (!user) {
    const error = new Error('Staff member not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  // Protection: Tenant Owner role cannot be changed through staff API
  if (user.role === 'owner' && data.role && data.role !== 'owner') {
    const error = new Error('The primary owner role cannot be changed or transferred via staff APIs.');
    error.statusCode = 400;
    throw error;
  }

  // Protection: Cannot promote to owner or super_admin
  if (data.role && (data.role === 'owner' || data.role === 'super_admin')) {
    const error = new Error("Assigning 'owner' or 'super_admin' roles is not permitted.");
    error.statusCode = 403;
    throw error;
  }

  const changes = {};

  if (data.name && data.name.trim() !== user.name) {
    changes.name = { from: user.name, to: data.name.trim() };
    user.name = data.name.trim();
  }

  if (data.phone !== undefined && data.phone.trim() !== user.phone) {
    changes.phone = { from: user.phone, to: data.phone.trim() };
    user.phone = data.phone.trim();
  }

  if (data.role && data.role !== user.role && user.role !== 'owner') {
    changes.role = { from: user.role, to: data.role };
    user.role = data.role;
  }

  if (data.permissions) {
    changes.permissions = { from: user.permissions, to: data.permissions };
    user.permissions = data.permissions;
  }

  if (data.password) {
    user.password = data.password; // pre-save will re-hash
    changes.password = '[MODIFIED]';
  }

  await user.save();

  // Audit log
  logAuditAction({
    tenantId,
    actor: actorUser,
    user: actorUser,
    action: 'UPDATE',
    module: 'USERS',
    entityType: 'User',
    entityId: user._id,
    description: `Updated staff profile for '${user.name}'`,
    changes,
  }).catch(() => {});

  const result = user.toObject();
  delete result.password;
  return result;
};

/**
 * Activate or deactivate a staff member
 */
export const updateStaffStatus = async (tenantId, actorUser, userId, isActive) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ _id: userId, tenantId });
  if (!user) {
    const error = new Error('Staff member not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  // Protection: Owner account cannot be deactivated
  if (user.role === 'owner') {
    const error = new Error('The primary organization owner account cannot be deactivated.');
    error.statusCode = 400;
    throw error;
  }

  // Protection: Cannot deactivate own account
  if (user._id.equals(actorUser._id)) {
    const error = new Error('You cannot deactivate your own user account.');
    error.statusCode = 400;
    throw error;
  }

  const previousStatus = user.isActive;
  user.isActive = isActive;
  await user.save();

  // Audit log
  logAuditAction({
    tenantId,
    actor: actorUser,
    user: actorUser,
    action: isActive ? 'ACTIVATE' : 'SUSPEND',
    module: 'USERS',
    entityType: 'User',
    entityId: user._id,
    description: `${isActive ? 'Activated' : 'Deactivated'} staff member '${user.name}'`,
    changes: { isActive: { from: previousStatus, to: isActive } },
  }).catch(() => {});

  const result = user.toObject();
  delete result.password;
  return result;
};

/**
 * Remove or delete a staff member
 */
export const deleteStaff = async (tenantId, actorUser, userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ _id: userId, tenantId });
  if (!user) {
    const error = new Error('Staff member not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  // Protection: Owner account cannot be deleted
  if (user.role === 'owner') {
    const error = new Error('The primary organization owner account cannot be deleted.');
    error.statusCode = 400;
    throw error;
  }

  // Protection: Cannot delete own account
  if (user._id.equals(actorUser._id)) {
    const error = new Error('You cannot delete your own user account.');
    error.statusCode = 400;
    throw error;
  }

  await User.deleteOne({ _id: userId, tenantId });

  // Audit log
  logAuditAction({
    tenantId,
    actor: actorUser,
    user: actorUser,
    action: 'DELETE',
    module: 'USERS',
    entityType: 'User',
    entityId: userId,
    description: `Deleted staff member '${user.name}' (${user.email})`,
  }).catch(() => {});

  return { message: `Staff member '${user.name}' removed successfully.` };
};
