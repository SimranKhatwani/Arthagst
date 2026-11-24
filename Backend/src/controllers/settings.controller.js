import { ZodError } from 'zod';
import * as settingsService from '../services/settings.service.js';
import { updateSettingsSchema } from '../validators/settings.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * Get organization settings
 * GET /api/settings
 */
export const getSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings(req.tenantId);
    return sendResponse(res, 200, true, 'Organization settings retrieved successfully', settings);
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
 * Update organization settings (full replace or update)
 * PUT /api/settings
 */
export const updateSettings = async (req, res, next) => {
  try {
    const validatedData = updateSettingsSchema.parse(req.body);
    const updated = await settingsService.updateSettings(req.tenantId, req.user, validatedData);

    return sendResponse(res, 200, true, 'Organization settings updated successfully', updated);
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

/**
 * Partial update organization settings
 * PATCH /api/settings
 */
export const patchSettings = async (req, res, next) => {
  return updateSettings(req, res, next);
};
