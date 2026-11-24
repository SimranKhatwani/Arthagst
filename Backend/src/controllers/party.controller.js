import { ZodError } from 'zod';
import * as partyService from '../services/party.service.js';
import {
  createPartySchema,
  updatePartySchema,
  queryPartiesSchema,
  updateStatusSchema,
} from '../validators/party.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * Create a new party
 * POST /api/parties
 */
export const create = async (req, res, next) => {
  try {
    const validatedData = createPartySchema.parse(req.body);
    const party = await partyService.createParty(req.tenantId, validatedData);

    return sendResponse(res, 201, true, 'Party created successfully', party);
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
 * List parties with filters and pagination
 * GET /api/parties
 */
export const getAll = async (req, res, next) => {
  try {
    const validatedQuery = queryPartiesSchema.parse(req.query);
    const result = await partyService.getParties(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Parties retrieved successfully', result);
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
 * Get party details by ID
 * GET /api/parties/:id
 */
export const getById = async (req, res, next) => {
  try {
    const party = await partyService.getPartyById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Party details retrieved successfully', party);
  } catch (error) {
    next(error);
  }
};

/**
 * Update party details
 * PUT /api/parties/:id
 */
export const update = async (req, res, next) => {
  try {
    const validatedData = updatePartySchema.parse(req.body);
    const party = await partyService.updateParty(req.tenantId, req.params.id, validatedData);

    return sendResponse(res, 200, true, 'Party updated successfully', party);
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
 * Update party active/inactive status
 * PATCH /api/parties/:id/status
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { isActive } = updateStatusSchema.parse(req.body);
    const party = await partyService.updatePartyStatus(req.tenantId, req.params.id, isActive);

    return sendResponse(
      res,
      200,
      true,
      `Party ${isActive ? 'activated' : 'deactivated'} successfully`,
      party
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
 * Soft delete party
 * DELETE /api/parties/:id
 */
export const deleteParty = async (req, res, next) => {
  try {
    const result = await partyService.deleteParty(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Party archived successfully', result);
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
  deleteParty,
};
