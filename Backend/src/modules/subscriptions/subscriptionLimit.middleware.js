import { checkFeatureAccess, checkUsageLimit } from './subscriptionLimit.service.js';

/**
 * Middleware: Require subscription feature flag
 */
export const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    // If super admin is accessing, bypass tenant feature limits
    if (req.user?.isSuperAdmin || req.user?.role === 'super_admin') {
      return next();
    }

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Tenant context required for feature verification.',
      });
    }

    const access = await checkFeatureAccess(tenantId, featureKey);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_NOT_PERMITTED',
        message: access.reason,
        planName: access.planName,
        feature: featureKey,
      });
    }

    next();
  };
};

/**
 * Middleware: Require plan limit not exceeded before creation
 */
export const requireLimit = (limitType, increment = 1) => {
  return async (req, res, next) => {
    // Super admin bypasses limit
    if (req.user?.isSuperAdmin || req.user?.role === 'super_admin') {
      return next();
    }

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Tenant context required for limit verification.',
      });
    }

    const limitCheck = await checkUsageLimit(tenantId, limitType, increment);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_LIMIT_REACHED',
        message: limitCheck.reason,
        current: limitCheck.current,
        limit: limitCheck.limit,
        limitType,
      });
    }

    next();
  };
};

export default {
  requireFeature,
  requireLimit,
};
