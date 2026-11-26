import { ZodError } from 'zod';
import * as superAdminService from '../services/superAdmin.service.js';
import * as subscriptionService from '../services/subscription.service.js';
import * as billingService from '../services/subscriptionBilling.service.js';
import * as lifecycleService from '../services/subscriptionLifecycle.service.js';
import * as auditService from '../services/auditLog.service.js';
import User from '../models/user.model.js';
import { generateToken } from '../utils/token.js';
import {
  superAdminLoginSchema,
  tenantActionSchema,
  assignSubscriptionSchema,
  queryTenantsSchema,
  createTenantSchema,
  updateTenantSchema,
  resetTenantPasswordSchema,
} from '../validators/superAdmin.validation.js';
import {
  createPlanSchema,
  updatePlanSchema,
} from '../validators/subscription.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * Super Admin Authentication (Platform Login)
 */
export const login = async (req, res, next) => {
  try {
    const validatedData = superAdminLoginSchema.parse(req.body);

    const envSuperEmail = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
    const envSuperPassword = process.env.SUPERADMIN_PASSWORD;

    // Auto-sync with .env credentials if matching
    if (
      envSuperEmail &&
      validatedData.email.toLowerCase().trim() === envSuperEmail &&
      envSuperPassword &&
      validatedData.password === envSuperPassword
    ) {
      let saUser = await User.findOne({ email: envSuperEmail }).select('+password');
      if (!saUser) {
        saUser = await User.create({
          name: process.env.SUPERADMIN_NAME || 'Platform Super Administrator',
          email: envSuperEmail,
          password: envSuperPassword,
          role: 'super_admin',
          isSuperAdmin: true,
          isActive: true,
        });
      } else {
        const isMatch = await saUser.comparePassword(envSuperPassword);
        if (!isMatch || !saUser.isSuperAdmin || !saUser.isActive) {
          saUser.password = envSuperPassword;
          saUser.role = 'super_admin';
          saUser.isSuperAdmin = true;
          saUser.isActive = true;
          await saUser.save();
        }
      }
    }

    const user = await User.findOne({
      email: validatedData.email.toLowerCase().trim(),
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

export const createTenant = async (req, res, next) => {
  try {
    const validatedData = createTenantSchema.parse(req.body);
    const result = await superAdminService.createTenant(req.user, validatedData);
    return sendResponse(res, 201, true, `Tenant '${result.tenant.businessName}' provisioned successfully`, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const updateTenant = async (req, res, next) => {
  try {
    const validatedData = updateTenantSchema.parse(req.body);
    const result = await superAdminService.updateTenant(req.user, req.params.id, validatedData);
    return sendResponse(res, 200, true, `Tenant '${result.businessName}' updated successfully`, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const deleteTenant = async (req, res, next) => {
  try {
    const result = await superAdminService.deleteTenant(req.user, req.params.id);
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    next(error);
  }
};

export const resetTenantPassword = async (req, res, next) => {
  try {
    const validatedData = resetTenantPasswordSchema.parse(req.body);
    const result = await superAdminService.resetTenantOwnerPassword(req.user, req.params.id, validatedData.newPassword);
    return sendResponse(res, 200, true, result.message, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
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

export const updateInvoice = async (req, res, next) => {
  try {
    const result = await billingService.updateSubscriptionInvoice(req.params.id, req.body);
    return sendResponse(res, 200, true, 'Platform subscription payment updated successfully', result);
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

export const getUsers = async (req, res, next) => {
  try {
    const result = await superAdminService.getPlatformUsers(req.query);
    return sendResponse(res, 200, true, 'Platform users retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

export const toggleUserStatus = async (req, res, next) => {
  try {
    const isActive = req.body.isActive === true || req.body.isActive === 'true';
    const result = await superAdminService.toggleUserStatus(req.user, req.params.id, isActive);
    return sendResponse(res, 200, true, result.message, result.user);
  } catch (error) {
    next(error);
  }
};

export const getSubscriptions = async (req, res, next) => {
  try {
    const result = await superAdminService.getPlatformSubscriptions(req.query);
    return sendResponse(res, 200, true, 'Platform subscriptions retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getTickets = async (req, res, next) => {
  try {
    const result = await superAdminService.getTickets(req.query);
    return sendResponse(res, 200, true, 'Support tickets retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

export const createTicket = async (req, res, next) => {
  try {
    const ticket = await superAdminService.createTicket(req.user, req.body);
    return sendResponse(res, 201, true, 'Support ticket created successfully', ticket);
  } catch (error) {
    next(error);
  }
};

export const updateTicketStatus = async (req, res, next) => {
  try {
    const status = req.body.status || 'Resolved';
    const ticket = await superAdminService.updateTicketStatus(req.user, req.params.id, status);
    return sendResponse(res, 200, true, `Support ticket status updated to ${status}`, ticket);
  } catch (error) {
    next(error);
  }
};

export const getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await superAdminService.getAnnouncements(req.query);
    return sendResponse(res, 200, true, 'Announcements retrieved successfully', announcements);
  } catch (error) {
    next(error);
  }
};

export const createAnnouncement = async (req, res, next) => {
  try {
    const announcement = await superAdminService.createAnnouncement(req.user, req.body);
    return sendResponse(res, 201, true, 'Announcement created successfully', announcement);
  } catch (error) {
    next(error);
  }
};

export const updateAnnouncementStatus = async (req, res, next) => {
  try {
    const status = req.body.status || 'Published';
    const announcement = await superAdminService.updateAnnouncementStatus(req.user, req.params.id, status);
    return sendResponse(res, 200, true, 'Announcement status updated successfully', announcement);
  } catch (error) {
    next(error);
  }
};

export const getFeatureFlags = async (req, res, next) => {
  try {
    const flags = await superAdminService.getFeatureFlags();
    return sendResponse(res, 200, true, 'Feature flags retrieved successfully', flags);
  } catch (error) {
    next(error);
  }
};

export const toggleFeatureFlag = async (req, res, next) => {
  try {
    const flag = await superAdminService.toggleFeatureFlag(req.user, req.params.id, req.body.enabled);
    return sendResponse(res, 200, true, `Feature flag '${flag.name}' updated successfully`, flag);
  } catch (error) {
    next(error);
  }
};

export const getPlatformSettings = async (req, res, next) => {
  try {
    const settings = await superAdminService.getPlatformSettings();
    return sendResponse(res, 200, true, 'Platform system settings retrieved successfully', settings);
  } catch (error) {
    next(error);
  }
};

export const updatePlatformSettings = async (req, res, next) => {
  try {
    const settings = await superAdminService.updatePlatformSettings(req.user, req.body);
    return sendResponse(res, 200, true, 'Platform system settings updated successfully', settings);
  } catch (error) {
    next(error);
  }
};
