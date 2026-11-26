import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import Tenant from '../models/tenant.model.js';

/**
 * JWT Authentication & Multi-Tenant Authorization Middleware
 * Verifies Bearer token, fetches actual User and Tenant from DB,
 * validates activity and subscription status, and binds context to req.
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Malformed authorization token.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token payload.',
      });
    }

    // 1. Fetch and validate actual user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or has been removed.',
      });
    }

    // 2. Check if this is a Platform Super Administrator
    if (user.isSuperAdmin || user.role === 'super_admin' || decoded.isSuperAdmin || decoded.role === 'super_admin') {
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Super administrator account is inactive.',
        });
      }
      req.user = user;
      req.tenant = null;
      req.tenantId = null;
      req.isSuperAdmin = true;

      // Resolve tenant context if provided in header, query, or body
      const explicitTenantId = req.headers['x-tenant-id'] || req.query?.tenantId || req.body?.tenantId;
      if (explicitTenantId) {
        try {
          const tenant = await Tenant.findById(explicitTenantId);
          if (tenant) {
            req.tenant = tenant;
            req.tenantId = tenant._id;
          }
        } catch {
          // invalid format, will fallback below
        }
      }

      // If no explicit tenant context, default to primary/first tenant so Super Admin operations on tenant entities succeed seamlessly
      if (!req.tenantId) {
        const defaultTenant = (await Tenant.findOne({ tenantCode: 'ARTHA' })) || (await Tenant.findOne({ isActive: true }));
        if (defaultTenant) {
          req.tenant = defaultTenant;
          req.tenantId = defaultTenant._id;
        }
      }

      return next();
    }

    // 3. For standard tenant users, validate tenant context
    if (!decoded.tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token payload. Tenant context required.',
      });
    }

    // 4. Confirm user belongs to token's tenant
    if (!user.tenantId || !user.tenantId.equals(decoded.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. User does not belong to the specified tenant.',
      });
    }

    // 5. Confirm user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive. Please contact your organization administrator.',
      });
    }

    // 4. Fetch and validate actual tenant
    const tenant = await Tenant.findById(decoded.tenantId);
    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: 'Tenant not found or has been removed.',
      });
    }

    // 5. Confirm tenant is active
    if (!tenant.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tenant account is inactive. Access restricted.',
      });
    }

    // 6. Confirm tenant subscription status
    if (['suspended', 'cancelled', 'expired'].includes(tenant.subscriptionStatus)) {
      return res.status(403).json({
        success: false,
        message: `Tenant subscription is ${tenant.subscriptionStatus}. Access restricted.`,
      });
    }

    // Attach verified user and tenant context to request
    req.user = user;
    req.tenant = tenant;
    req.tenantId = tenant._id;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or malformed authentication token.',
    });
  }
};

/**
 * Optional Role-based authorization middleware
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user?.role}' does not have access to this resource.`,
      });
    }
    next();
  };
};

export default authenticate;
