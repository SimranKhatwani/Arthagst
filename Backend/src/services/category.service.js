import mongoose from 'mongoose';
import Category from '../models/category.model.js';

/**
 * Create a new category scoped to tenant
 */
export const createCategory = async (tenantId, data) => {
  // Check duplicate name within the same tenant
  const nameRegex = new RegExp(`^${data.name.trim()}$`, 'i');
  const existingName = await Category.findOne({
    tenantId,
    name: nameRegex,
    isDeleted: false,
  });

  if (existingName) {
    const error = new Error(`Category '${data.name}' already exists in your organization.`);
    error.statusCode = 409;
    throw error;
  }

  // Validate parentCategory if specified
  let parentId = null;
  if (data.parentCategory) {
    if (!mongoose.isValidObjectId(data.parentCategory)) {
      const error = new Error('Invalid parent category ID format');
      error.statusCode = 400;
      throw error;
    }

    const parent = await Category.findOne({
      _id: data.parentCategory,
      tenantId,
      isDeleted: false,
    });

    if (!parent) {
      const error = new Error('Parent category not found in your organization');
      error.statusCode = 404;
      throw error;
    }
    parentId = parent._id;
  }

  const category = new Category({
    ...data,
    parentCategory: parentId,
    tenantId,
  });

  await category.save();
  return category;
};

/**
 * List categories with pagination, search, parent filter, and active status
 */
export const getCategories = async (tenantId, query) => {
  const filter = {
    tenantId,
    isDeleted: false,
  };

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  if (query.parentCategory !== undefined) {
    if (query.parentCategory === 'null' || query.parentCategory === 'root') {
      filter.parentCategory = null;
    } else if (mongoose.isValidObjectId(query.parentCategory)) {
      filter.parentCategory = query.parentCategory;
    }
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const validSortFields = ['name', 'createdAt', 'updatedAt'];
  const sortBy = validSortFields.includes(query.sortBy) ? query.sortBy : 'name';
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
  const sort = { [sortBy]: sortOrder };

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .populate('parentCategory', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  return {
    categories,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get category details by ID
 */
export const getCategoryById = async (tenantId, categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    const error = new Error('Invalid category ID format');
    error.statusCode = 400;
    throw error;
  }

  const category = await Category.findOne({
    _id: categoryId,
    tenantId,
    isDeleted: false,
  }).populate('parentCategory', 'name');

  if (!category) {
    const error = new Error('Category not found');
    error.statusCode = 404;
    throw error;
  }

  return category;
};

/**
 * Update an existing category
 */
export const updateCategory = async (tenantId, categoryId, data) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    const error = new Error('Invalid category ID format');
    error.statusCode = 400;
    throw error;
  }

  const category = await Category.findOne({
    _id: categoryId,
    tenantId,
    isDeleted: false,
  });

  if (!category) {
    const error = new Error('Category not found');
    error.statusCode = 404;
    throw error;
  }

  // Check duplicate name if renamed
  if (data.name && data.name.trim().toLowerCase() !== category.name.toLowerCase()) {
    const nameRegex = new RegExp(`^${data.name.trim()}$`, 'i');
    const existingName = await Category.findOne({
      tenantId,
      _id: { $ne: categoryId },
      name: nameRegex,
      isDeleted: false,
    });

    if (existingName) {
      const error = new Error(`Category '${data.name}' already exists in your organization.`);
      error.statusCode = 409;
      throw error;
    }
  }

  // Validate parentCategory change
  if (data.parentCategory !== undefined) {
    if (data.parentCategory === null || data.parentCategory === '') {
      category.parentCategory = null;
    } else {
      if (!mongoose.isValidObjectId(data.parentCategory)) {
        const error = new Error('Invalid parent category ID format');
        error.statusCode = 400;
        throw error;
      }

      // Prevent a category from being its own parent
      if (data.parentCategory.toString() === categoryId.toString()) {
        const error = new Error('A category cannot be its own parent category');
        error.statusCode = 400;
        throw error;
      }

      // Check parent exists in same tenant
      const parent = await Category.findOne({
        _id: data.parentCategory,
        tenantId,
        isDeleted: false,
      });

      if (!parent) {
        const error = new Error('Parent category not found in your organization');
        error.statusCode = 404;
        throw error;
      }

      // Prevent circular parent-child relationships
      let currentParentId = data.parentCategory;
      const visited = new Set();
      while (currentParentId) {
        if (currentParentId.toString() === categoryId.toString()) {
          const error = new Error(
            'Circular category hierarchy detected: A category cannot have one of its descendants as its parent.'
          );
          error.statusCode = 400;
          throw error;
        }
        if (visited.has(currentParentId.toString())) break;
        visited.add(currentParentId.toString());

        const ancestor = await Category.findOne({
          _id: currentParentId,
          tenantId,
          isDeleted: false,
        }).select('parentCategory');

        currentParentId = ancestor?.parentCategory;
      }

      category.parentCategory = parent._id;
    }
  }

  if (data.name !== undefined) category.name = data.name;
  if (data.description !== undefined) category.description = data.description;
  if (data.isActive !== undefined) category.isActive = data.isActive;

  await category.save();
  return category;
};

/**
 * Update category active/inactive status
 */
export const updateCategoryStatus = async (tenantId, categoryId, isActive) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    const error = new Error('Invalid category ID format');
    error.statusCode = 400;
    throw error;
  }

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, tenantId, isDeleted: false },
    { isActive },
    { returnDocument: 'after' }
  );

  if (!category) {
    const error = new Error('Category not found');
    error.statusCode = 404;
    throw error;
  }

  return category;
};

/**
 * Soft delete category (prevents deletion if subcategories or products exist)
 */
export const deleteCategory = async (tenantId, categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    const error = new Error('Invalid category ID format');
    error.statusCode = 400;
    throw error;
  }

  const category = await Category.findOne({
    _id: categoryId,
    tenantId,
    isDeleted: false,
  });

  if (!category) {
    const error = new Error('Category not found');
    error.statusCode = 404;
    throw error;
  }

  // Prevent deletion if active child categories exist
  const hasChildren = await Category.exists({
    parentCategory: categoryId,
    tenantId,
    isDeleted: false,
  });

  if (hasChildren) {
    const error = new Error(
      'Cannot delete category because it has active subcategories. Please reassign or delete subcategories first.'
    );
    error.statusCode = 400;
    throw error;
  }

  // Prevent deletion if products are associated
  if (mongoose.models.Product) {
    const hasProducts = await mongoose.model('Product').exists({
      categoryId,
      tenantId,
      isDeleted: false,
    });

    if (hasProducts) {
      const error = new Error(
        'Cannot delete category because it is currently associated with products.'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  category.isDeleted = true;
  category.isActive = false;
  await category.save();

  return {
    id: category._id,
    name: category.name,
    message: 'Category successfully deleted/archived',
  };
};

export default {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
};
