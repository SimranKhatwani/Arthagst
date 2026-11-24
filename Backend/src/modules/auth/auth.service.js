import mongoose from 'mongoose';
import Tenant from '../tenants/tenant.model.js';
import User from '../users/user.model.js';
import { generateToken } from '../../utils/token.js';
import { startTrial } from '../subscriptions/subscription.service.js';

/**
 * Register a new business (Tenant) and its first Owner user atomically
 */
export const registerBusiness = async (data) => {
  const normalizedEmail = data.email.toLowerCase().trim();

  // Determine or validate tenantCode
  let tenantCode;
  if (data.tenantCode) {
    tenantCode = data.tenantCode.toUpperCase().trim();
    const existingTenant = await Tenant.findOne({ tenantCode });
    if (existingTenant) {
      const error = new Error(`Tenant code '${tenantCode}' is already registered`);
      error.statusCode = 409;
      throw error;
    }
  } else {
    tenantCode = await Tenant.generateUniqueTenantCode();
  }

  // Transaction with retry on transient write conflicts / catalog changes
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let session = null;
    let useTransaction = true;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (err) {
      useTransaction = false;
      session = null;
    }

    try {
      const tenantPayload = {
        tenantCode,
        businessName: data.businessName,
        businessType: data.businessType || 'Wholesale & Retail',
        ownerName: data.ownerName,
        email: normalizedEmail,
        phone: data.phone,
        GSTIN: data.GSTIN || null,
        PAN: data.PAN || null,
        businessAddress: data.businessAddress || '',
        city: data.city || '',
        state: data.state || '',
        stateCode: data.stateCode || '',
        pincode: data.pincode || '',
        country: data.country || 'India',
        subscriptionStatus: 'trial',
        isActive: true,
      };

      let tenant;
      let user;

      if (useTransaction && session) {
        const [createdTenant] = await Tenant.create([tenantPayload], { session });
        tenant = createdTenant;

        const userPayload = {
          tenantId: tenant._id,
          name: data.ownerName,
          email: normalizedEmail,
          phone: data.phone,
          password: data.password, // Pre-save hook hashes password
          role: 'owner', // The first user is always assigned 'owner' role
          permissions: ['all'],
          isActive: true,
        };

        const [createdUser] = await User.create([userPayload], { session });
        user = createdUser;

        // Initialize default trial subscription atomically
        await startTrial(tenant._id, { trialDays: 14, planCode: 'TRIAL', session });

        await session.commitTransaction();
      } else {
        // Non-transactional fallback with manual rollback
        tenant = await Tenant.create(tenantPayload);
        try {
          user = await User.create({
            tenantId: tenant._id,
            name: data.ownerName,
            email: normalizedEmail,
            phone: data.phone,
            password: data.password,
            role: 'owner',
            permissions: ['all'],
            isActive: true,
          });

          // Initialize default trial subscription
          await startTrial(tenant._id, { trialDays: 14, planCode: 'TRIAL' });
        } catch (userErr) {
          // Rollback tenant creation
          await Tenant.findByIdAndDelete(tenant._id);
          throw userErr;
        }
      }

      const token = generateToken({
        userId: user._id,
        tenantId: tenant._id,
        role: user.role,
      });

      return {
        token,
        tenant: {
          id: tenant._id,
          tenantCode: tenant.tenantCode,
          businessName: tenant.businessName,
          ownerName: tenant.ownerName,
          email: tenant.email,
          subscriptionStatus: tenant.subscriptionStatus,
          isActive: tenant.isActive,
        },
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      if (useTransaction && session) {
        try {
          await session.abortTransaction();
        } catch (abortErr) {
          // Ignore
        }
      }

      const isTransient =
        error.hasErrorLabel?.('TransientTransactionError') ||
        error.code === 112 ||
        error.codeName === 'WriteConflict';

      if (isTransient && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }

      // Handle duplicate key error nicely
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0] || 'Field';
        const customErr = new Error(`Registration failed: ${field} already exists.`);
        customErr.statusCode = 409;
        throw customErr;
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }
};

/**
 * Authenticate tenant user with tenantCode, email, and password
 */
export const loginUser = async ({ tenantCode, email, password }) => {
  const normalizedCode = (tenantCode || '').toUpperCase().trim();
  const normalizedEmail = (email || '').toLowerCase().trim();

  // If tenant code is omitted or admin code passed, allow super_admin direct login
  if (!normalizedCode || normalizedCode === 'ADMIN' || normalizedCode === 'SUPERADMIN') {
    const adminUser = await User.findOne({
      email: normalizedEmail,
      $or: [{ isSuperAdmin: true }, { role: 'super_admin' }],
    }).select('+password');

    if (adminUser) {
      if (!adminUser.isActive) {
        const error = new Error('Admin account is inactive. Please contact system administrator.');
        error.statusCode = 403;
        throw error;
      }

      const isMatch = await adminUser.comparePassword(password);
      if (!isMatch) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      await User.updateOne({ _id: adminUser._id }, { $set: { lastLogin: new Date() } });

      let tenant = null;
      if (adminUser.tenantId) {
        tenant = await Tenant.findById(adminUser.tenantId);
      }

      const token = generateToken({
        userId: adminUser._id,
        tenantId: tenant ? tenant._id : null,
        role: 'super_admin',
        isSuperAdmin: true,
      });

      return {
        token,
        tenant: tenant
          ? {
              id: tenant._id,
              tenantCode: tenant.tenantCode,
              businessName: tenant.businessName,
              ownerName: tenant.ownerName,
              email: tenant.email,
              subscriptionStatus: tenant.subscriptionStatus,
              isActive: tenant.isActive,
            }
          : {
              id: null,
              tenantCode: 'PLATFORM',
              businessName: 'Platform Administration',
              ownerName: adminUser.name,
              email: adminUser.email,
              subscriptionStatus: 'active',
              isActive: true,
            },
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: 'super_admin',
          isSuperAdmin: true,
          isActive: adminUser.isActive,
        },
      };
    }
  }

  // 1. Verify Tenant exists
  const tenant = await Tenant.findOne({ tenantCode: normalizedCode });
  if (!tenant) {
    const error = new Error('Invalid tenant code, email, or password');
    error.statusCode = 401;
    throw error;
  }

  // 2. Verify Tenant is active
  if (!tenant.isActive) {
    const error = new Error('Tenant account is inactive. Please contact support.');
    error.statusCode = 403;
    throw error;
  }

  // 3. Verify Tenant subscription status permits access
  if (['suspended', 'cancelled', 'expired'].includes(tenant.subscriptionStatus)) {
    const error = new Error(
      `Tenant access is restricted (Subscription status: ${tenant.subscriptionStatus}). Please renew your plan.`
    );
    error.statusCode = 403;
    throw error;
  }

  // 4. Verify User exists under this tenant
  const user = await User.findOne({
    tenantId: tenant._id,
    email: normalizedEmail,
  }).select('+password');

  if (!user) {
    const error = new Error('Invalid tenant code, email, or password');
    error.statusCode = 401;
    throw error;
  }

  // 5. Verify User is active
  if (!user.isActive) {
    const error = new Error('User account is inactive. Please contact your organization administrator.');
    error.statusCode = 403;
    throw error;
  }

  // 6. Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const error = new Error('Invalid tenant code, email, or password');
    error.statusCode = 401;
    throw error;
  }

  // Update lastLogin timestamp without triggering full validation
  await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

  // 7. Generate JWT
  const token = generateToken({
    userId: user._id,
    tenantId: tenant._id,
    role: user.role,
  });

  return {
    token,
    tenant: {
      id: tenant._id,
      tenantCode: tenant.tenantCode,
      businessName: tenant.businessName,
      ownerName: tenant.ownerName,
      email: tenant.email,
      subscriptionStatus: tenant.subscriptionStatus,
      isActive: tenant.isActive,
    },
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLogin: new Date(),
    },
  };
};

/**
 * Get profile of currently authenticated user and associated tenant
 */
export const getAuthenticatedProfile = async (userId, tenantId) => {
  const user = await User.findOne({ _id: userId, tenantId });
  if (!user) {
    const error = new Error('User profile not found');
    error.statusCode = 404;
    throw error;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    const error = new Error('Tenant profile not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    user,
    tenant,
  };
};

export default {
  registerBusiness,
  loginUser,
  getAuthenticatedProfile,
};
