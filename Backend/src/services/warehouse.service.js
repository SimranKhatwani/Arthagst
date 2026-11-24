import mongoose from 'mongoose';
import Warehouse from '../models/warehouse.model.js';

/**
 * Create a new warehouse for tenant
 */
export const createWarehouse = async (tenantId, data) => {
  const normalizedCode = data.warehouseCode.toUpperCase().trim();

  // 1. Check duplicate warehouseCode within tenant
  const existingCode = await Warehouse.findOne({
    tenantId,
    warehouseCode: normalizedCode,
    isDeleted: false,
  });

  if (existingCode) {
    const error = new Error(`Warehouse code '${data.warehouseCode}' is already in use.`);
    error.statusCode = 409;
    throw error;
  }

  // 2. Check if this is the first warehouse for the tenant
  const activeCount = await Warehouse.countDocuments({
    tenantId,
    isDeleted: false,
  });

  let shouldBeDefault = data.isDefault;
  if (activeCount === 0) {
    // First warehouse is default automatically
    shouldBeDefault = true;
  }

  // 3. If setting as default, unset any existing default warehouse
  if (shouldBeDefault) {
    await Warehouse.updateMany(
      { tenantId, isDefault: true },
      { isDefault: false }
    );
  }

  const warehouse = new Warehouse({
    ...data,
    tenantId,
    warehouseCode: normalizedCode,
    isDefault: shouldBeDefault,
  });

  await warehouse.save();
  return warehouse;
};

/**
 * List warehouses with pagination, search, and filters
 */
export const getWarehouses = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    isActive,
    isDefault,
    sortBy = 'warehouseName',
    sortOrder = 'asc',
  } = options;

  const query = {
    tenantId,
    isDeleted: false,
  };

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  if (isDefault !== undefined) {
    query.isDefault = isDefault;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { warehouseName: searchRegex },
      { warehouseCode: searchRegex },
      { city: searchRegex },
      { state: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortBy]: sortDirection };

  const [warehouses, total] = await Promise.all([
    Warehouse.find(query).sort(sortOptions).skip(skip).limit(limit),
    Warehouse.countDocuments(query),
  ]);

  return {
    warehouses,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get warehouse by ID
 */
export const getWarehouseById = async (tenantId, warehouseId) => {
  if (!mongoose.isValidObjectId(warehouseId)) {
    const error = new Error('Invalid warehouse ID format');
    error.statusCode = 400;
    throw error;
  }

  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenantId,
    isDeleted: false,
  });

  if (!warehouse) {
    const error = new Error('Warehouse not found');
    error.statusCode = 404;
    throw error;
  }

  return warehouse;
};

/**
 * Update warehouse details
 */
export const updateWarehouse = async (tenantId, warehouseId, data) => {
  if (!mongoose.isValidObjectId(warehouseId)) {
    const error = new Error('Invalid warehouse ID format');
    error.statusCode = 400;
    throw error;
  }

  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenantId,
    isDeleted: false,
  });

  if (!warehouse) {
    const error = new Error('Warehouse not found');
    error.statusCode = 404;
    throw error;
  }

  // Check duplicate warehouseCode if changing
  if (data.warehouseCode && data.warehouseCode.trim().toUpperCase() !== warehouse.warehouseCode) {
    const normalizedCode = data.warehouseCode.trim().toUpperCase();
    const existing = await Warehouse.findOne({
      tenantId,
      _id: { $ne: warehouseId },
      warehouseCode: normalizedCode,
      isDeleted: false,
    });

    if (existing) {
      const error = new Error(`Warehouse code '${data.warehouseCode}' is already in use.`);
      error.statusCode = 409;
      throw error;
    }
    warehouse.warehouseCode = normalizedCode;
  }

  // Handle isDefault logic
  if (data.isDefault === true && !warehouse.isDefault) {
    // Unset other default warehouses
    await Warehouse.updateMany(
      { tenantId, _id: { $ne: warehouseId }, isDefault: true },
      { isDefault: false }
    );
    warehouse.isDefault = true;
  } else if (data.isDefault === false && warehouse.isDefault) {
    // Check if other active warehouses exist
    const otherWarehouse = await Warehouse.findOne({
      tenantId,
      _id: { $ne: warehouseId },
      isActive: true,
      isDeleted: false,
    });

    if (otherWarehouse) {
      otherWarehouse.isDefault = true;
      await otherWarehouse.save();
      warehouse.isDefault = false;
    } else {
      const error = new Error('Cannot unset the only active warehouse as non-default.');
      error.statusCode = 400;
      throw error;
    }
  }

  const allowedFields = ['warehouseName', 'address', 'city', 'state', 'pincode', 'isActive'];
  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      warehouse[field] = data[field];
    }
  });

  await warehouse.save();
  return warehouse;
};

/**
 * Update warehouse active status
 */
export const updateWarehouseStatus = async (tenantId, warehouseId, isActive) => {
  if (!mongoose.isValidObjectId(warehouseId)) {
    const error = new Error('Invalid warehouse ID format');
    error.statusCode = 400;
    throw error;
  }

  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenantId,
    isDeleted: false,
  });

  if (!warehouse) {
    const error = new Error('Warehouse not found');
    error.statusCode = 404;
    throw error;
  }

  if (warehouse.isDefault && !isActive) {
    const error = new Error('Cannot deactivate the default warehouse. Designate another warehouse as default first.');
    error.statusCode = 400;
    throw error;
  }

  warehouse.isActive = isActive;
  await warehouse.save();
  return warehouse;
};

/**
 * Delete warehouse (soft delete) with safety checks
 */
export const deleteWarehouse = async (tenantId, warehouseId) => {
  if (!mongoose.isValidObjectId(warehouseId)) {
    const error = new Error('Invalid warehouse ID format');
    error.statusCode = 400;
    throw error;
  }

  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenantId,
    isDeleted: false,
  });

  if (!warehouse) {
    const error = new Error('Warehouse not found');
    error.statusCode = 404;
    throw error;
  }

  // 1. Check if warehouse holds active stock
  if (mongoose.models.Inventory) {
    const hasStock = await mongoose.model('Inventory').exists({
      warehouseId,
      tenantId,
      quantity: { $gt: 0 },
    });

    if (hasStock) {
      const error = new Error('Cannot delete warehouse containing stock. Please transfer or adjust stock first.');
      error.statusCode = 400;
      throw error;
    }
  }

  // 2. If it was the default warehouse, try to assign another default if available
  if (warehouse.isDefault) {
    const nextWarehouse = await Warehouse.findOne({
      tenantId,
      _id: { $ne: warehouseId },
      isActive: true,
      isDeleted: false,
    });

    if (nextWarehouse) {
      nextWarehouse.isDefault = true;
      await nextWarehouse.save();
    }
  }

  warehouse.isDeleted = true;
  warehouse.isActive = false;
  warehouse.isDefault = false;
  await warehouse.save();

  return {
    id: warehouse._id,
    warehouseName: warehouse.warehouseName,
    message: 'Warehouse deleted successfully',
  };
};

export default {
  createWarehouse,
  getWarehouses,
  getWarehouseById,
  updateWarehouse,
  updateWarehouseStatus,
  deleteWarehouse,
};
