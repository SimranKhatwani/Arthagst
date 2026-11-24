import { ZodError } from 'zod';
import * as superAdminService from './superAdmin.service.js';
import * as subscriptionService from '../subscriptions/subscription.service.js';
import * as billingService from '../subscriptions/subscriptionBilling.service.js';
import * as lifecycleService from '../subscriptions/subscriptionLifecycle.service.js';
import * as auditService from '../auditLogs/auditLog.service.js';
import User from '../users/user.model.js';
import { generateToken } from '../../utils/token.js';
import {
  superAdminLoginSchema,
  tenantActionSchema,
  assignSubscriptionSchema,
  queryTenantsSchema,
} from './superAdmin.validation.js';
import {
  createPlanSchema,
  updatePlanSchema,
} from '../subscriptions/subscription.validation.js';
import { sendResponse, formatZodErrors } from '../../utils/apiResponse.js';

/**
 * Super Admin Authentication (Platform Login)
 */
export const login = async (req, res, next) => {
  try {
    const validatedData = superAdminLoginSchema.parse(req.body);

    const user = await User.findOne({
      email: validatedData.email,
      $or: [{ isSuperAdmin: true }, { role: 'super_admin' }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Super administrator account is inactive',
      });
    }

    const isMatch = await user.comparePassword(validatedData.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken({
      userId: user._id,
      role: 'super_admin',
      isSuperAdmin: true,
      tenantId: null,
    });

    user.lastLogin = new Date();
    await user.save();

    await auditService.logAuditAction({
      actor: user,
      action: 'SUPER_ADMIN_LOGIN',
      targetType: 'auth',
      targetId: user._id,
      targetName: user.email,
      req,
    });

    return sendResponse(res, 200, true, 'Super Admin login successful', {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'super_admin',
        isSuperAdmin: true,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getDashboard = async (req, res, next) => {
  try {
    const data = await superAdminService.getPlatformDashboard();
    return sendResponse(res, 200, true, 'Platform dashboard statistics retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getTenants = async (req, res, next) => {
  try {
    const validatedQuery = queryTenantsSchema.parse(req.query);
    const result = await superAdminService.getTenants(validatedQuery);
    return sendResponse(res, 200, true, 'Tenants list retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getTenantDetails = async (req, res, next) => {
  try {
    const data = await superAdminService.getTenantDetails(req.params.id);
    return sendResponse(res, 200, true, 'Tenant details retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const activateTenant = async (req, res, next) => {
  try {
    const validatedData = tenantActionSchema.parse(req.body || {});
    const result = await superAdminService.activateTenant(req.user, req.params.id, validatedData.reason);
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const suspendTenant = async (req, res, next) => {
  try {
    const validatedData = tenantActionSchema.parse(req.body || {});
    const result = await superAdminService.suspendTenant(req.user, req.params.id, validatedData.reason);
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const assignSubscription = async (req, res, next) => {
  try {
    const validatedData = assignSubscriptionSchema.parse(req.body);
    const result = await superAdminService.assignSubscription(req.user, req.params.id, validatedData);
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const createPlan = async (req, res, next) => {
  try {
    const validatedData = createPlanSchema.parse(req.body);
    const plan = await subscriptionService.createPlan(validatedData);
    await auditService.logAuditAction({
      actor: req.user,
      action: 'PLAN_CREATED',
      targetType: 'plan',
      targetId: plan._id,
      targetName: plan.name,
      details: validatedData,
      req,
    });
    return sendResponse(res, 201, true, 'Subscription plan created successfully', plan);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const updatePlan = async (req, res, next) => {
  try {
    const validatedData = updatePlanSchema.parse(req.body);
    const plan = await subscriptionService.updatePlan(req.params.id, validatedData);
    await auditService.logAuditAction({
      actor: req.user,
      action: 'PLAN_UPDATED',
      targetType: 'plan',
      targetId: plan._id,
      targetName: plan.name,
      details: validatedData,
      req,
    });
    return sendResponse(res, 200, true, 'Subscription plan updated successfully', plan);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const togglePlanStatus = async (req, res, next) => {
  try {
    const isActive = req.body.isActive === true || req.body.isActive === 'true';
    const plan = await subscriptionService.togglePlanStatus(req.params.id, isActive);
    await auditService.logAuditAction({
      actor: req.user,
      action: isActive ? 'PLAN_ACTIVATED' : 'PLAN_DEACTIVATED',
      targetType: 'plan',
      targetId: plan._id,
      targetName: plan.name,
      req,
    });
    return sendResponse(res, 200, true, `Plan ${isActive ? 'activated' : 'deactivated'} successfully`, plan);
  } catch (error) {
    next(error);
  }
};

export const getPlans = async (req, res, next) => {
  try {
    const plans = await subscriptionService.getPlans(req.query, true);
    return sendResponse(res, 200, true, 'All plans retrieved successfully', plans);
  } catch (error) {
    next(error);
  }
};

export const getInvoices = async (req, res, next) => {
  try {
    const result = await billingService.getAllInvoices(req.query);
    return sendResponse(res, 200, true, 'Platform subscription invoices retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getRevenueReport = async (req, res, next) => {
  try {
    const report = await superAdminService.getSubscriptionRevenueReport(req.query);
    return sendResponse(res, 200, true, 'Revenue report retrieved successfully', report);
  } catch (error) {
    next(error);
  }
};

export const getUsageStatistics = async (req, res, next) => {
  try {
    const stats = await superAdminService.getPlatformUsageStatistics();
    return sendResponse(res, 200, true, 'Platform usage statistics retrieved successfully', stats);
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await auditService.getAuditLogs(req.query);
    return sendResponse(res, 200, true, 'Audit logs retrieved successfully', logs);
  } catch (error) {
    next(error);
  }
};

export const runLifecycle = async (req, res, next) => {
  try {
    const summary = await lifecycleService.runSubscriptionLifecycleCheck();
    await auditService.logAuditAction({
      actor: req.user,
      action: 'LIFECYCLE_RUN_MANUAL',
      targetType: 'system',
      targetId: 'lifecycle',
      targetName: 'Subscription Lifecycle',
      details: summary,
      req,
    });
    return sendResponse(res, 200, true, 'Subscription lifecycle check completed successfully', summary);
  } catch (error) {
    next(error);
  }
};
