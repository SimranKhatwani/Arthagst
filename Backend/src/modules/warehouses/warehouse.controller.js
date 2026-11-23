import { ZodError } from 'zod';
import * as warehouseService from './warehouse.service.js';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  queryWarehousesSchema,
  updateStatusSchema,
} from './warehouse.validation.js';
import { sendResponse, formatZodErrors } from '../../utils/apiResponse.js';

/**
 * Create a new warehouse
 * POST /api/warehouses
 */
export const create = async (req, res, next) => {
  try {
    const validatedData = createWarehouseSchema.parse(req.body);
    const warehouse = await warehouseService.createWarehouse(req.tenantId, validatedData);

    return sendResponse(res, 201, true, 'Warehouse created successfully', warehouse);
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
 * List warehouses with pagination and search
 * GET /api/warehouses
 */
export const getAll = async (req, res, next) => {
  try {
    const validatedQuery = queryWarehousesSchema.parse(req.query);
    const result = await warehouseService.getWarehouses(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Warehouses retrieved successfully', result);
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
 * Get warehouse by ID
 * GET /api/warehouses/:id
 */
export const getById = async (req, res, next) => {
  try {
    const warehouse = await warehouseService.getWarehouseById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Warehouse details retrieved successfully', warehouse);
  } catch (error) {
    next(error);
  }
};

/**
 * Update warehouse details
 * PUT /api/warehouses/:id
 */
export const update = async (req, res, next) => {
  try {
    const validatedData = updateWarehouseSchema.parse(req.body);
    const warehouse = await warehouseService.updateWarehouse(
      req.tenantId,
      req.params.id,
      validatedData
    );

    return sendResponse(res, 200, true, 'Warehouse updated successfully', warehouse);
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
 * Activate or deactivate warehouse
 * PATCH /api/warehouses/:id/status
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { isActive } = updateStatusSchema.parse(req.body);
    const warehouse = await warehouseService.updateWarehouseStatus(
      req.tenantId,
      req.params.id,
      isActive
    );

    return sendResponse(
      res,
      200,
      true,
      `Warehouse ${isActive ? 'activated' : 'deactivated'} successfully`,
      warehouse
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
 * Delete warehouse
 * DELETE /api/warehouses/:id
 */
export const deleteWarehouse = async (req, res, next) => {
  try {
    const result = await warehouseService.deleteWarehouse(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, result.message, result);
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
  deleteWarehouse,
};
