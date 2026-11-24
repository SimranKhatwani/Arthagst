import { ZodError } from 'zod';
import * as gstService from '../services/gst.service.js';
import {
  periodQuerySchema,
  gstr1QuerySchema,
  exportQuerySchema,
  importGSTR2BSchema,
  reconcileGSTR2BSchema,
  updateReturnPeriodStatusSchema,
  validatePeriodSchema,
  reportQuerySchema,
} from '../validators/gst.validation.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

export const getDashboard = async (req, res, next) => {
  try {
    const validatedQuery = periodQuerySchema.parse(req.query);
    const data = await gstService.getGSTDashboard(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'GST Dashboard summary retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getGSTR1 = async (req, res, next) => {
  try {
    const validatedQuery = gstr1QuerySchema.parse(req.query);
    const data = await gstService.getGSTR1Data(req.tenantId, validatedQuery);

    if (validatedQuery.section && validatedQuery.section !== 'all') {
      const secData = data.sections[validatedQuery.section] || [];
      return sendResponse(res, 200, true, `GSTR-1 ${validatedQuery.section.toUpperCase()} section retrieved successfully`, {
        meta: data.meta,
        summary: data.summary[validatedQuery.section],
        data: secData,
      });
    }

    return sendResponse(res, 200, true, 'GSTR-1 return preparation data retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const exportGSTR1 = async (req, res, next) => {
  try {
    const validatedQuery = exportQuerySchema.parse(req.query);
    const result = await gstService.exportGSTR1(req.tenantId, validatedQuery, validatedQuery.format);

    if (validatedQuery.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(200).send(result.data);
    }

    return sendResponse(res, 200, true, 'GSTR-1 JSON export generated successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getGSTR3B = async (req, res, next) => {
  try {
    const validatedQuery = periodQuerySchema.parse(req.query);
    const data = await gstService.getGSTR3BData(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'GSTR-3B return summary retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const importGSTR2B = async (req, res, next) => {
  try {
    const validatedData = importGSTR2BSchema.parse(req.body);
    const data = await gstService.importGSTR2B(req.tenantId, req.user._id, validatedData);
    return sendResponse(res, 201, true, 'GSTR-2B data imported successfully', data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const reconcileGSTR2B = async (req, res, next) => {
  try {
    const validatedData = reconcileGSTR2BSchema.parse(req.body);
    const data = await gstService.reconcileGSTR2B(
      req.tenantId,
      validatedData.importId,
      validatedData.tolerance
    );
    return sendResponse(res, 200, true, 'GSTR-2B reconciliation completed successfully', data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getFilingCalendar = async (req, res, next) => {
  try {
    const data = await gstService.getFilingCalendar(req.tenantId, req.query.financialYear);
    return sendResponse(res, 200, true, 'GST filing calendar retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const updateReturnPeriodStatus = async (req, res, next) => {
  try {
    const validatedData = updateReturnPeriodStatusSchema.parse(req.body);
    const data = await gstService.updateReturnPeriodStatus(req.tenantId, validatedData);
    return sendResponse(res, 200, true, 'Return period status updated successfully', data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const validateReturnPeriod = async (req, res, next) => {
  try {
    const validatedData = validatePeriodSchema.parse(req.body);
    const data = await gstService.validateReturnPeriod(req.tenantId, validatedData);
    return sendResponse(res, 200, true, 'Return period validation completed', data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getReports = async (req, res, next) => {
  try {
    const validatedQuery = reportQuerySchema.parse(req.query);
    const data = await gstService.getGSTReports(
      req.tenantId,
      validatedQuery.reportType,
      validatedQuery
    );
    return sendResponse(res, 200, true, `GST ${validatedQuery.reportType} report generated`, data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export default {
  getDashboard,
  getGSTR1,
  exportGSTR1,
  getGSTR3B,
  importGSTR2B,
  reconcileGSTR2B,
  getFilingCalendar,
  updateReturnPeriodStatus,
  validateReturnPeriod,
  getReports,
};
