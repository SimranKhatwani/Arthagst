import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import Category from '../models/category.model.js';
import Unit from '../models/unit.model.js';
import * as auditLogService from './auditLog.service.js';

/**
 * Create a new product scoped to tenant
 */
export const createProduct = async (tenantId, data) => {
  const normalizedSKU = data.SKU.toUpperCase().trim();

  // 1. Check duplicate SKU within the same tenant
  const existingSKU = await Product.findOne({
    tenantId,
    SKU: normalizedSKU,
    isDeleted: false,
  });

  if (existingSKU) {
    const error = new Error(`SKU '${data.SKU}' is already in use in your organization.`);
    error.statusCode = 409;
    throw error;
  }

  // 2. Check duplicate barcode within the same tenant if provided
  if (data.barcode && data.barcode.trim()) {
    const normalizedBarcode = data.barcode.trim();
    const existingBarcode = await Product.findOne({
      tenantId,
      barcode: normalizedBarcode,
      isDeleted: false,
    });

    if (existingBarcode) {
      const error = new Error(`Barcode '${data.barcode}' is already assigned to another product in your organization.`);
      error.statusCode = 409;
      throw error;
    }
  }

  // 3. Validate Unit exists in tenant and is active
  if (!mongoose.isValidObjectId(data.unitId)) {
    const error = new Error('Invalid unit ID format');
    error.statusCode = 400;
    throw error;
  }

  const unit = await Unit.findOne({
    _id: data.unitId,
    tenantId,
    isDeleted: false,
  });

  if (!unit) {
    const error = new Error('Unit not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  if (!unit.isActive) {
    const error = new Error('Selected unit is inactive and cannot be assigned to new products');
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate Category if provided
  let categoryId = null;
  if (data.categoryId) {
    if (!mongoose.isValidObjectId(data.categoryId)) {
      const error = new Error('Invalid category ID format');
      error.statusCode = 400;
      throw error;
    }

    const category = await Category.findOne({
      _id: data.categoryId,
      tenantId,
      isDeleted: false,
    });

    if (!category) {
      const error = new Error('Category not found in your organization');
      error.statusCode = 404;
      throw error;
    }

    if (!category.isActive) {
      const error = new Error('Selected category is inactive and cannot be assigned to new products');
      error.statusCode = 400;
      throw error;
    }
    categoryId = category._id;
  }

  // 5. Enforce service restrictions
  const productPayload = {
    ...data,
    tenantId,
    SKU: normalizedSKU,
    categoryId,
  };

  if (productPayload.productType === 'service') {
    productPayload.openingStock = 0;
    productPayload.trackInventory = false;
  }

  const product = new Product(productPayload);
  await product.save();

  await product.populate([
    { path: 'categoryId', select: 'name' },
    { path: 'unitId', select: 'name shortName gstUqcCode allowDecimal' },
  ]);

  await auditLogService.logAuditAction({
    tenantId,
    action: 'PRODUCT_CREATED',
    module: 'products',
    entityType: 'Product',
    entityId: product._id,
    targetName: product.name,
    description: `Created product ${product.name} (SKU: ${product.SKU})`,
    changes: { name: product.name, SKU: product.SKU, sellingPrice: product.sellingPrice },
  });

  return product;
};

/**
 * List products with filters, search, sorting and pagination
 */
export const getProducts = async (tenantId, query) => {
  const filter = {
    tenantId,
    isDeleted: false,
  };

  if (query.productType) {
    filter.productType = query.productType;
  }

  if (query.categoryId !== undefined) {
    if (query.categoryId === 'null' || query.categoryId === 'none') {
      filter.categoryId = null;
    } else if (mongoose.isValidObjectId(query.categoryId)) {
      filter.categoryId = query.categoryId;
    }
  }

  if (query.gstRate !== undefined) {
    filter.gstRate = Number(query.gstRate);
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { SKU: searchRegex },
      { barcode: searchRegex },
      { description: searchRegex },
      { HSN: searchRegex },
      { SAC: searchRegex },
    ];
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const validSortFields = ['name', 'SKU', 'sellingPrice', 'purchasePrice', 'createdAt', 'openingStock'];
  const sortBy = validSortFields.includes(query.sortBy) ? query.sortBy : 'name';
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
  const sort = { [sortBy]: sortOrder };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('categoryId', 'name')
      .populate('unitId', 'name shortName gstUqcCode allowDecimal')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return {
    products,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get product details by ID
 */
export const getProductById = async (tenantId, productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    const error = new Error('Invalid product ID format');
    error.statusCode = 400;
    throw error;
  }

  const product = await Product.findOne({
    _id: productId,
    tenantId,
    isDeleted: false,
  })
    .populate('categoryId', 'name description')
    .populate('unitId', 'name shortName gstUqcCode allowDecimal');

  if (!product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  return product;
};

/**
 * Update an existing product
 */
export const updateProduct = async (tenantId, productId, data) => {
  if (!mongoose.isValidObjectId(productId)) {
    const error = new Error('Invalid product ID format');
    error.statusCode = 400;
    throw error;
  }

  const product = await Product.findOne({
    _id: productId,
    tenantId,
    isDeleted: false,
  });

  if (!product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  // Check duplicate SKU if changed
  if (data.SKU && data.SKU.trim().toUpperCase() !== product.SKU) {
    const normalizedSKU = data.SKU.trim().toUpperCase();
    const existingSKU = await Product.findOne({
      tenantId,
      _id: { $ne: productId },
      SKU: normalizedSKU,
      isDeleted: false,
    });

    if (existingSKU) {
      const error = new Error(`SKU '${data.SKU}' is already in use in your organization.`);
      error.statusCode = 409;
      throw error;
    }
    product.SKU = normalizedSKU;
  }

  // Check duplicate barcode if changed
  if (data.barcode && data.barcode.trim() !== product.barcode) {
    const normalizedBarcode = data.barcode.trim();
    const existingBarcode = await Product.findOne({
      tenantId,
      _id: { $ne: productId },
      barcode: normalizedBarcode,
      isDeleted: false,
    });

    if (existingBarcode) {
      const error = new Error(`Barcode '${data.barcode}' is already in use in your organization.`);
      error.statusCode = 409;
      throw error;
    }
    product.barcode = normalizedBarcode;
  }

  // Validate unitId if changed
  if (data.unitId && data.unitId.toString() !== product.unitId.toString()) {
    if (!mongoose.isValidObjectId(data.unitId)) {
      const error = new Error('Invalid unit ID format');
      error.statusCode = 400;
      throw error;
    }

    const unit = await Unit.findOne({
      _id: data.unitId,
      tenantId,
      isDeleted: false,
    });

    if (!unit) {
      const error = new Error('Unit not found in your organization');
      error.statusCode = 404;
      throw error;
    }

    if (!unit.isActive) {
      const error = new Error('Selected unit is inactive');
      error.statusCode = 400;
      throw error;
    }
    product.unitId = unit._id;
  }

  // Validate categoryId if changed
  if (data.categoryId !== undefined) {
    if (data.categoryId === null || data.categoryId === '') {
      product.categoryId = null;
    } else {
      if (!mongoose.isValidObjectId(data.categoryId)) {
        const error = new Error('Invalid category ID format');
        error.statusCode = 400;
        throw error;
      }

      const category = await Category.findOne({
        _id: data.categoryId,
        tenantId,
        isDeleted: false,
      });

      if (!category) {
        const error = new Error('Category not found in your organization');
        error.statusCode = 404;
        throw error;
      }

      if (!category.isActive) {
        const error = new Error('Selected category is inactive');
        error.statusCode = 400;
        throw error;
      }
      product.categoryId = category._id;
    }
  }

  // Update remaining fields
  const allowedUpdates = [
    'name',
    'productType',
    'description',
    'HSN',
    'SAC',
    'gstRate',
    'cessRate',
    'purchasePrice',
    'sellingPrice',
    'mrp',
    'openingStock',
    'lowStockAlert',
    'trackInventory',
    'images',
    'isActive',
  ];

  allowedUpdates.forEach((key) => {
    if (data[key] !== undefined) {
      product[key] = data[key];
    }
  });

  // Service restrictions
  if (product.productType === 'service') {
    product.openingStock = 0;
    product.trackInventory = false;
  }

  await product.save();

  await product.populate([
    { path: 'categoryId', select: 'name' },
    { path: 'unitId', select: 'name shortName gstUqcCode allowDecimal' },
  ]);

  await auditLogService.logAuditAction({
    tenantId,
    action: 'PRODUCT_UPDATED',
    module: 'products',
    entityType: 'Product',
    entityId: product._id,
    targetName: product.name,
    description: `Updated product ${product.name} (SKU: ${product.SKU})`,
    changes: data,
  });

  return product;
};

/**
 * Update product status
 */
export const updateProductStatus = async (tenantId, productId, isActive) => {
  if (!mongoose.isValidObjectId(productId)) {
    const error = new Error('Invalid product ID format');
    error.statusCode = 400;
    throw error;
  }

  const product = await Product.findOneAndUpdate(
    { _id: productId, tenantId, isDeleted: false },
    { isActive },
    { returnDocument: 'after' }
  )
    .populate('categoryId', 'name')
    .populate('unitId', 'name shortName');

  if (!product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  return product;
};

/**
 * Soft delete product (protects against deleting products referenced in transactions)
 */
export const deleteProduct = async (tenantId, productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    const error = new Error('Invalid product ID format');
    error.statusCode = 400;
    throw error;
  }

  const product = await Product.findOne({
    _id: productId,
    tenantId,
    isDeleted: false,
  });

  if (!product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  // Check if product is referenced in invoice/bill lines once those models exist
  if (mongoose.models.Invoice) {
    const inUse = await mongoose.model('Invoice').exists({
      'items.productId': productId,
      tenantId,
    });

    if (inUse) {
      const error = new Error('Cannot delete product because it is referenced in existing invoices');
      error.statusCode = 400;
      throw error;
    }
  }

  product.isDeleted = true;
  product.isActive = false;
  await product.save();

  return {
    id: product._id,
    name: product.name,
    message: 'Product successfully archived/deleted',
  };
};

export default {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  updateProductStatus,
  deleteProduct,
};
