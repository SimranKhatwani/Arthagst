import { ZodError } from 'zod';
import * as categoryService from './category.service.js';
import {
  createCategorySchema,
  updateCategorySchema,
  queryCategoriesSchema,
  updateStatusSchema,
} from './category.validation.js';
import { sendResponse, formatZodErrors } from '../../utils/apiResponse.js';

/**
 * Create a new category
 * POST /api/categories
 */
export const create = async (req, res, next) => {
  try {
    const validatedData = createCategorySchema.parse(req.body);
    const category = await categoryService.createCategory(req.tenantId, validatedData);

    return sendResponse(res, 201, true, 'Category created successfully', category);
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
 * List categories with pagination and filters
 * GET /api/categories
 */
export const getAll = async (req, res, next) => {
  try {
    const validatedQuery = queryCategoriesSchema.parse(req.query);
    const result = await categoryService.getCategories(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Categories retrieved successfully', result);
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
 * Get category by ID
 * GET /api/categories/:id
 */
export const getById = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Category details retrieved successfully', category);
  } catch (error) {
    next(error);
  }
};

/**
 * Update category
 * PUT /api/categories/:id
 */
export const update = async (req, res, next) => {
  try {
    const validatedData = updateCategorySchema.parse(req.body);
    const category = await categoryService.updateCategory(
      req.tenantId,
      req.params.id,
      validatedData
    );

    return sendResponse(res, 200, true, 'Category updated successfully', category);
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
 * Activate or deactivate category
 * PATCH /api/categories/:id/status
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { isActive } = updateStatusSchema.parse(req.body);
    const category = await categoryService.updateCategoryStatus(
      req.tenantId,
      req.params.id,
      isActive
    );

    return sendResponse(
      res,
      200,
      true,
      `Category ${isActive ? 'activated' : 'deactivated'} successfully`,
      category
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
 * Soft delete category
 * DELETE /api/categories/:id
 */
export const deleteCategory = async (req, res, next) => {
  try {
    const result = await categoryService.deleteCategory(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Category archived successfully', result);
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
  deleteCategory,
};
