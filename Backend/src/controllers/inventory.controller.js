import { ZodError } from 'zod';
import * as inventoryService from '../services/inventory.service.js';
import {
  openingStockSchema,
  stockInSchema,
  stockOutSchema,
  stockAdjustmentSchema,
  stockTransferSchema,
  queryInventorySchema,
  queryMovementsSchema,
  queryLowStockSchema,
} from '../validators/inventory.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * List inventory records
 * GET /api/inventory
 */
export const getInventory = async (req, res, next) => {
  try {
    const validatedQuery = queryInventorySchema.parse(req.query);
    const result = await inventoryService.getInventory(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Inventory retrieved successfully', result);
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
 * Product-wise stock summary
 * GET /api/inventory/product/:productId
 */
export const getProductStock = async (req, res, next) => {
  try {
    const summary = await inventoryService.getProductStockSummary(req.tenantId, req.params.productId);
    return sendResponse(res, 200, true, 'Product stock summary retrieved successfully', summary);
  } catch (error) {
    next(error);
  }
};

/**
 * Warehouse-wise stock summary
 * GET /api/inventory/warehouse/:warehouseId
 */
export const getWarehouseStock = async (req, res, next) => {
  try {
    const validatedQuery = queryInventorySchema.parse(req.query);
    const summary = await inventoryService.getWarehouseStockSummary(
      req.tenantId,
      req.params.warehouseId,
      validatedQuery
    );

    return sendResponse(res, 200, true, 'Warehouse stock summary retrieved successfully', summary);
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
 * Initialize opening stock
 * POST /api/inventory/opening-stock
 */
export const initializeOpeningStock = async (req, res, next) => {
  try {
    const validatedData = openingStockSchema.parse(req.body);
    const result = await inventoryService.initializeOpeningStock(
      req.tenantId,
      req.user?._id,
      validatedData
    );

    return sendResponse(res, 201, true, 'Opening stock initialized successfully', result);
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
 * Add stock (Stock In)
 * POST /api/inventory/stock-in
 */
export const stockIn = async (req, res, next) => {
  try {
    const validatedData = stockInSchema.parse(req.body);
    const result = await inventoryService.stockIn(
      req.tenantId,
      req.user?._id,
      validatedData
    );

    return sendResponse(res, 200, true, 'Stock added successfully', result);
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
 * Reduce stock (Stock Out)
 * POST /api/inventory/stock-out
 */
export const stockOut = async (req, res, next) => {
  try {
    const validatedData = stockOutSchema.parse(req.body);
    const result = await inventoryService.stockOut(
      req.tenantId,
      req.user?._id,
      validatedData
    );

    return sendResponse(res, 200, true, 'Stock reduced successfully', result);
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
 * Adjust stock
 * POST /api/inventory/adjustment
 */
export const adjustStock = async (req, res, next) => {
  try {
    const validatedData = stockAdjustmentSchema.parse(req.body);
    const result = await inventoryService.adjustStock(
      req.tenantId,
      req.user?._id,
      validatedData
    );

    return sendResponse(res, 200, true, 'Stock adjusted successfully', result);
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
 * Transfer stock between warehouses
 * POST /api/inventory/transfer
 */
export const transferStock = async (req, res, next) => {
  try {
    const validatedData = stockTransferSchema.parse(req.body);
    const result = await inventoryService.transferStock(
      req.tenantId,
      req.user?._id,
      validatedData
    );

    return sendResponse(res, 200, true, 'Stock transferred successfully', result);
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
 * Get movement history
 * GET /api/inventory/movements
 */
export const getMovements = async (req, res, next) => {
  try {
    const validatedQuery = queryMovementsSchema.parse(req.query);
    const result = await inventoryService.getMovements(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Stock movements retrieved successfully', result);
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
 * Get low stock report
 * GET /api/inventory/low-stock
 */
export const getLowStockReport = async (req, res, next) => {
  try {
    const validatedQuery = queryLowStockSchema.parse(req.query);
    const result = await inventoryService.getLowStockReport(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Low stock report generated successfully', result);
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

export default {
  getInventory,
  getProductStock,
  getWarehouseStock,
  initializeOpeningStock,
  stockIn,
  stockOut,
  adjustStock,
  transferStock,
  getMovements,
  getLowStockReport,
};
