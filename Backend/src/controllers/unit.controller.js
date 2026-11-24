import { ZodError } from 'zod';
import * as unitService from '../services/unit.service.js';
import {
  createUnitSchema,
  updateUnitSchema,
  queryUnitsSchema,
  updateStatusSchema,
} from '../validators/unit.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * Create a new unit
 * POST /api/units
 */
export const create = async (req, res, next) => {
  try {
    const validatedData = createUnitSchema.parse(req.body);
    const unit = await unitService.createUnit(req.tenantId, validatedData);

    return sendResponse(res, 201, true, 'Unit created successfully', unit);
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
 * List units with pagination and filters
 * GET /api/units
 */
export const getAll = async (req, res, next) => {
  try {
    const validatedQuery = queryUnitsSchema.parse(req.query);
    const result = await unitService.getUnits(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Units retrieved successfully', result);
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
 * Get unit details by ID
 * GET /api/units/:id
 */
export const getById = async (req, res, next) => {
  try {
    const unit = await unitService.getUnitById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Unit details retrieved successfully', unit);
  } catch (error) {
    next(error);
  }
};

/**
 * Update unit details
 * PUT /api/units/:id
 */
export const update = async (req, res, next) => {
  try {
    const validatedData = updateUnitSchema.parse(req.body);
    const unit = await unitService.updateUnit(req.tenantId, req.params.id, validatedData);

    return sendResponse(res, 200, true, 'Unit updated successfully', unit);
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
 * Update unit active/inactive status
 * PATCH /api/units/:id/status
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { isActive } = updateStatusSchema.parse(req.body);
    const unit = await unitService.updateUnitStatus(req.tenantId, req.params.id, isActive);

    return sendResponse(
      res,
      200,
      true,
      `Unit ${isActive ? 'activated' : 'deactivated'} successfully`,
      unit
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
 * Soft delete unit
 * DELETE /api/units/:id
 */
export const deleteUnit = async (req, res, next) => {
  try {
    const result = await unitService.deleteUnit(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Unit archived successfully', result);
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getById,
  update,
  updateStatus,
  deleteUnit,
};
