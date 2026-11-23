import mongoose from 'mongoose';
import Party from './party.model.js';

/**
 * Create a new party for the authenticated tenant
 */
export const createParty = async (tenantId, data) => {
  // Check for duplicate party name within the same tenant
  const nameRegex = new RegExp(`^${data.name.trim()}$`, 'i');
  const existingName = await Party.findOne({
    tenantId,
    name: nameRegex,
    isDeleted: false,
  });

  if (existingName) {
    const error = new Error(`A party named '${data.name}' already exists in your organization.`);
    error.statusCode = 409;
    throw error;
  }

  // Check for duplicate GSTIN within the same tenant if provided
  if (data.GSTIN && data.GSTIN.trim()) {
    const normalizedGSTIN = data.GSTIN.toUpperCase().trim();
    const existingGSTIN = await Party.findOne({
      tenantId,
      GSTIN: normalizedGSTIN,
      isDeleted: false,
    });

    if (existingGSTIN) {
      const error = new Error(`A party with GSTIN '${normalizedGSTIN}' already exists in your organization.`);
      error.statusCode = 409;
      throw error;
    }
  }

  const party = new Party({
    ...data,
    tenantId,
  });

  await party.save();
  return party;
};

/**
 * List parties with tenant isolation, pagination, search, and filters
 */
export const getParties = async (tenantId, query) => {
  const filter = {
    tenantId,
    isDeleted: false,
  };

  // Filter by partyType (customer includes 'both', supplier includes 'both')
  if (query.partyType) {
    if (query.partyType === 'both') {
      filter.partyType = 'both';
    } else {
      filter.partyType = { $in: [query.partyType, 'both'] };
    }
  }

  // Filter by active status
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  // Search across multiple fields
  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { businessName: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
      { GSTIN: searchRegex },
      { city: searchRegex },
    ];
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 10));
  const skip = (page - 1) * limit;

  const validSortFields = ['name', 'createdAt', 'openingBalance', 'creditLimit', 'updatedAt'];
  const sortBy = validSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  const [parties, total] = await Promise.all([
    Party.find(filter).sort(sort).skip(skip).limit(limit),
    Party.countDocuments(filter),
  ]);

  return {
    parties,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get single party by ID scoped to tenant
 */
export const getPartyById = async (tenantId, partyId) => {
  if (!mongoose.isValidObjectId(partyId)) {
    const error = new Error('Invalid party ID format');
    error.statusCode = 400;
    throw error;
  }

  const party = await Party.findOne({
    _id: partyId,
    tenantId,
    isDeleted: false,
  });

  if (!party) {
    const error = new Error('Party not found');
    error.statusCode = 404;
    throw error;
  }

  return party;
};

/**
 * Update an existing party scoped to tenant
 */
export const updateParty = async (tenantId, partyId, data) => {
  if (!mongoose.isValidObjectId(partyId)) {
    const error = new Error('Invalid party ID format');
    error.statusCode = 400;
    throw error;
  }

  const party = await Party.findOne({
    _id: partyId,
    tenantId,
    isDeleted: false,
  });

  if (!party) {
    const error = new Error('Party not found');
    error.statusCode = 404;
    throw error;
  }

  // Prevent duplicate name on rename
  if (data.name && data.name.trim().toLowerCase() !== party.name.toLowerCase()) {
    const nameRegex = new RegExp(`^${data.name.trim()}$`, 'i');
    const existingName = await Party.findOne({
      tenantId,
      _id: { $ne: partyId },
      name: nameRegex,
      isDeleted: false,
    });

    if (existingName) {
      const error = new Error(`A party named '${data.name}' already exists in your organization.`);
      error.statusCode = 409;
      throw error;
    }
  }

  // Prevent duplicate GSTIN on update
  if (data.GSTIN && data.GSTIN.trim()) {
    const normalizedGSTIN = data.GSTIN.toUpperCase().trim();
    if (normalizedGSTIN !== party.GSTIN) {
      const existingGSTIN = await Party.findOne({
        tenantId,
        _id: { $ne: partyId },
        GSTIN: normalizedGSTIN,
        isDeleted: false,
      });

      if (existingGSTIN) {
        const error = new Error(`A party with GSTIN '${normalizedGSTIN}' already exists in your organization.`);
        error.statusCode = 409;
        throw error;
      }
    }
  }

  // Apply updates
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      party[key] = data[key];
    }
  });

  await party.save();
  return party;
};

/**
 * Activate or deactivate party
 */
export const updatePartyStatus = async (tenantId, partyId, isActive) => {
  if (!mongoose.isValidObjectId(partyId)) {
    const error = new Error('Invalid party ID format');
    error.statusCode = 400;
    throw error;
  }

  const party = await Party.findOneAndUpdate(
    {
      _id: partyId,
      tenantId,
      isDeleted: false,
    },
    { isActive },
    { returnDocument: 'after' }
  );

  if (!party) {
    const error = new Error('Party not found');
    error.statusCode = 404;
    throw error;
  }

  return party;
};

/**
 * Soft delete / archive party to preserve transaction audit history
 */
export const deleteParty = async (tenantId, partyId) => {
  if (!mongoose.isValidObjectId(partyId)) {
    const error = new Error('Invalid party ID format');
    error.statusCode = 400;
    throw error;
  }

  const party = await Party.findOne({
    _id: partyId,
    tenantId,
    isDeleted: false,
  });

  if (!party) {
    const error = new Error('Party not found');
    error.statusCode = 404;
    throw error;
  }

  // Soft delete preserves integrity for invoices, purchases, payments
  party.isDeleted = true;
  party.isActive = false;
  await party.save();

  return {
    id: party._id,
    name: party.name,
    message: 'Party successfully archived/soft-deleted',
  };
};

export default {
  createParty,
  getParties,
  getPartyById,
  updateParty,
  updatePartyStatus,
  deleteParty,
};
