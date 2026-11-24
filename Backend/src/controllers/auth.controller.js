import { ZodError } from 'zod';
import { registerSchema, loginSchema } from '../validators/auth.validation.js';
import * as authService from '../services/auth.service.js';
import * as auditLogService from '../services/auditLog.service.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * Handle business and owner registration
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const result = await authService.registerBusiness(validatedData);

    return sendResponse(
      res,
      201,
      true,
      'Business and owner registered successfully',
      result
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Handle user and tenant login
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.loginUser(validatedData);

    // Record audit log for successful login
    await auditLogService.logAuditAction({
      tenantId: result.tenant.id,
      userId: result.user.id,
      userEmail: result.user.email,
      userRole: result.user.role,
      action: 'USER_LOGIN',
      module: 'auth',
      entityType: 'User',
      entityId: result.user.id,
      description: `User ${result.user.email} logged in successfully`,
      req,
    });

    return sendResponse(
      res,
      200,
      true,
      'Login successful',
      result
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Get authenticated user profile and tenant details
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    return sendResponse(
      res,
      200,
      true,
      'Authenticated user profile retrieved successfully',
      {
        user: req.user,
        tenant: req.tenant,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Logout authenticated user
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    return sendResponse(
      res,
      200,
      true,
      'Logged out successfully. Please remove authentication token on client side.'
    );
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  getMe,
  logout,
};
