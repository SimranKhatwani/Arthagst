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

    if (!decoded.userId || !decoded.tenantId) {
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

    // 2. Confirm user belongs to token's tenant
    if (!user.tenantId.equals(decoded.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. User does not belong to the specified tenant.',
      });
    }

    // 3. Confirm user is active
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
