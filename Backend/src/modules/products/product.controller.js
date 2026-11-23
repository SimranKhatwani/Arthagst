import { ZodError } from 'zod';
import * as productService from './product.service.js';
import {
  createProductSchema,
  updateProductSchema,
  queryProductsSchema,
  updateStatusSchema,
} from './product.validation.js';
import { sendResponse, formatZodErrors } from '../../utils/apiResponse.js';

/**
 * Create a new product
 * POST /api/products
 */
export const create = async (req, res, next) => {
  try {
    const validatedData = createProductSchema.parse(req.body);
    const product = await productService.createProduct(req.tenantId, validatedData);

    return sendResponse(res, 201, true, 'Product created successfully', product);
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
 * List products with pagination, search, and filters
 * GET /api/products
 */
export const getAll = async (req, res, next) => {
  try {
    const validatedQuery = queryProductsSchema.parse(req.query);
    const result = await productService.getProducts(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Products retrieved successfully', result);
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
 * Get product details by ID
 * GET /api/products/:id
 */
export const getById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Product details retrieved successfully', product);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing product
 * PUT /api/products/:id
 */
export const update = async (req, res, next) => {
  try {
    const validatedData = updateProductSchema.parse(req.body);
    const product = await productService.updateProduct(
      req.tenantId,
      req.params.id,
      validatedData
    );

    return sendResponse(res, 200, true, 'Product updated successfully', product);
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
 * Activate or deactivate product
 * PATCH /api/products/:id/status
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { isActive } = updateStatusSchema.parse(req.body);
    const product = await productService.updateProductStatus(
      req.tenantId,
      req.params.id,
      isActive
    );

    return sendResponse(
      res,
      200,
      true,
      `Product ${isActive ? 'activated' : 'deactivated'} successfully`,
      product
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
 * Soft delete product
 * DELETE /api/products/:id
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const result = await productService.deleteProduct(req.tenantId, req.params.id);
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
  deleteProduct,
};
