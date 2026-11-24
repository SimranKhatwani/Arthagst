import { ZodError } from 'zod';
import * as userService from '../services/user.service.js';
import {
  createStaffSchema,
  updateStaffSchema,
  updateStatusSchema,
  queryStaffSchema,
} from '../validators/user.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * List tenant staff members
 * GET /api/users
 */
export const getAll = async (req, res, next) => {
  try {
    const validatedQuery = queryStaffSchema.parse(req.query);
    const result = await userService.listStaff(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Staff members retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Create a new staff account
 * POST /api/users
 */
export const create = async (req, res, next) => {
  try {
    const validatedData = createStaffSchema.parse(req.body);
    const staff = await userService.createStaff(req.tenantId, req.user, validatedData);

    return sendResponse(res, 201, true, 'Staff member created successfully', staff);
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
        code: error.code || undefined,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Get staff details by ID
 * GET /api/users/:id
 */
export const getById = async (req, res, next) => {
  try {
    const staff = await userService.getStaffById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Staff details retrieved successfully', staff);
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
 * Update permitted profile fields and role
 * PATCH /api/users/:id
 */
export const update = async (req, res, next) => {
  try {
    const validatedData = updateStaffSchema.parse(req.body);
    const updated = await userService.updateStaff(req.tenantId, req.user, req.params.id, validatedData);

    return sendResponse(res, 200, true, 'Staff member updated successfully', updated);
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
 * Activate or deactivate staff
 * PATCH /api/users/:id/status
 */
export const updateStatus = async (req, res, next) => {
  try {
    const validatedData = updateStatusSchema.parse(req.body);
    const updated = await userService.updateStaffStatus(
      req.tenantId,
      req.user,
      req.params.id,
      validatedData.isActive
    );

    const actionText = validatedData.isActive ? 'activated' : 'deactivated';
    return sendResponse(res, 200, true, `Staff member ${actionText} successfully`, updated);
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
 * Remove / delete a staff account
 * DELETE /api/users/:id
 */
export const remove = async (req, res, next) => {
  try {
    const result = await userService.deleteStaff(req.tenantId, req.user, req.params.id);
    return sendResponse(res, 200, true, result.message);
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
