import { ZodError } from 'zod';
import * as tenantService from '../services/tenant.service.js';
import { updateTenantProfileSchema } from '../validators/tenant.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * Get current authenticated tenant organization profile
 * GET /api/tenants/me
 */
export const getProfile = async (req, res, next) => {
  try {
    const profile = await tenantService.getTenantProfile(req.tenantId);
    return sendResponse(res, 200, true, 'Tenant profile retrieved successfully', profile);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Update tenant organization profile
 * PUT /api/tenants/me
 */
export const updateProfile = async (req, res, next) => {
  try {
    const validatedData = updateTenantProfileSchema.parse(req.body);
    const updated = await tenantService.updateTenantProfile(req.tenantId, req.user, validatedData);

    return sendResponse(res, 200, true, 'Tenant profile updated successfully', updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};
