import mongoose from 'mongoose';
import Unit from './unit.model.js';

/**
 * Create a new measurement unit for tenant
 */
export const createUnit = async (tenantId, data) => {
  const normalizedName = data.name.trim();
  const normalizedShort = data.shortName.toUpperCase().trim();

  // Check duplicate unit name in tenant
  const existingName = await Unit.findOne({
    tenantId,
    name: new RegExp(`^${normalizedName}$`, 'i'),
    isDeleted: false,
  });

  if (existingName) {
    const error = new Error(`Unit with name '${data.name}' already exists in your organization.`);
    error.statusCode = 409;
    throw error;
  }

  // Check duplicate shortName in tenant
  const existingShort = await Unit.findOne({
    tenantId,
    shortName: normalizedShort,
    isDeleted: false,
  });

  if (existingShort) {
    const error = new Error(`Unit with short name '${data.shortName}' already exists in your organization.`);
    error.statusCode = 409;
    throw error;
  }

  const unit = new Unit({
    ...data,
    tenantId,
  });

  await unit.save();
  return unit;
};

/**
 * List units with pagination, search, and type filter
 */
export const getUnits = async (tenantId, query) => {
  const filter = {
    tenantId,
    isDeleted: false,
  };

  if (query.unitType) {
    filter.unitType = query.unitType;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { shortName: searchRegex },
      { gstUqcCode: searchRegex },
    ];
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const validSortFields = ['name', 'shortName', 'unitType', 'createdAt'];
  const sortBy = validSortFields.includes(query.sortBy) ? query.sortBy : 'name';
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
  const sort = { [sortBy]: sortOrder };

  const [units, total] = await Promise.all([
    Unit.find(filter).sort(sort).skip(skip).limit(limit),
    Unit.countDocuments(filter),
  ]);

  return {
    units,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get unit details by ID
 */
export const getUnitById = async (tenantId, unitId) => {
  if (!mongoose.isValidObjectId(unitId)) {
    const error = new Error('Invalid unit ID format');
    error.statusCode = 400;
    throw error;
  }

  const unit = await Unit.findOne({
    _id: unitId,
    tenantId,
    isDeleted: false,
  });

  if (!unit) {
    const error = new Error('Unit not found');
    error.statusCode = 404;
    throw error;
  }

  return unit;
};

/**
 * Update an existing unit
 */
export const updateUnit = async (tenantId, unitId, data) => {
  if (!mongoose.isValidObjectId(unitId)) {
    const error = new Error('Invalid unit ID format');
    error.statusCode = 400;
    throw error;
  }

  const unit = await Unit.findOne({
    _id: unitId,
    tenantId,
    isDeleted: false,
  });

  if (!unit) {
    const error = new Error('Unit not found');
    error.statusCode = 404;
    throw error;
  }

  // Prevent duplicate name on rename
  if (data.name && data.name.trim().toLowerCase() !== unit.name.toLowerCase()) {
    const existingName = await Unit.findOne({
      tenantId,
      _id: { $ne: unitId },
      name: new RegExp(`^${data.name.trim()}$`, 'i'),
      isDeleted: false,
    });

    if (existingName) {
      const error = new Error(`Unit with name '${data.name}' already exists in your organization.`);
      error.statusCode = 409;
      throw error;
    }
  }

  // Prevent duplicate shortName on update
  if (data.shortName && data.shortName.trim().toUpperCase() !== unit.shortName) {
    const existingShort = await Unit.findOne({
      tenantId,
      _id: { $ne: unitId },
      shortName: data.shortName.trim().toUpperCase(),
      isDeleted: false,
    });

    if (existingShort) {
      const error = new Error(`Unit with short name '${data.shortName}' already exists in your organization.`);
      error.statusCode = 409;
      throw error;
    }
  }

  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      unit[key] = data[key];
    }
  });

  await unit.save();
  return unit;
};

/**
 * Update unit active/inactive status
 */
export const updateUnitStatus = async (tenantId, unitId, isActive) => {
  if (!mongoose.isValidObjectId(unitId)) {
    const error = new Error('Invalid unit ID format');
    error.statusCode = 400;
    throw error;
  }

  const unit = await Unit.findOneAndUpdate(
    { _id: unitId, tenantId, isDeleted: false },
    { isActive },
    { returnDocument: 'after' }
  );

  if (!unit) {
    const error = new Error('Unit not found');
    error.statusCode = 404;
    throw error;
  }

  return unit;
};

/**
 * Soft delete unit (prevents deletion if unit is used in products or transactions)
 */
export const deleteUnit = async (tenantId, unitId) => {
  if (!mongoose.isValidObjectId(unitId)) {
    const error = new Error('Invalid unit ID format');
    error.statusCode = 400;
    throw error;
  }

  const unit = await Unit.findOne({
    _id: unitId,
    tenantId,
    isDeleted: false,
  });

  if (!unit) {
    const error = new Error('Unit not found');
    error.statusCode = 404;
    throw error;
  }

  // Prevent deletion if products use this unit
  if (mongoose.models.Product) {
    const inUse = await mongoose.model('Product').exists({
      unitId,
      tenantId,
      isDeleted: false,
    });

    if (inUse) {
      const error = new Error(
        'Cannot delete unit because it is currently in use by products.'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  unit.isDeleted = true;
  unit.isActive = false;
  await unit.save();

  return {
    id: unit._id,
    name: unit.name,
    message: 'Unit successfully deleted/archived',
  };
};

export default {
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  updateUnitStatus,
  deleteUnit,
};
