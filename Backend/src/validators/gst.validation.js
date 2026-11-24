import { z } from 'zod';

export const periodQuerySchema = z.object({
  financialYear: z.string().trim().optional(),
  returnPeriod: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const gstr1QuerySchema = periodQuerySchema.extend({
  section: z
    .enum(['all', 'b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp', 'hsn', 'docs'])
    .optional()
    .default('all'),
});

export const exportQuerySchema = periodQuerySchema.extend({
  format: z.enum(['json', 'csv']).optional().default('json'),
});

export const gstr2bEntryInputSchema = z.object({
  supplierGSTIN: z.string().trim().min(1, 'Supplier GSTIN is required'),
  supplierName: z.string().trim().optional().default(''),
  invoiceNumber: z.string().trim().min(1, 'Invoice / document number is required'),
  documentType: z.enum(['INV', 'CRN', 'DBN']).optional().default('INV'),
  invoiceDate: z.string({ required_error: 'Invoice date is required' }),
  invoiceValue: z.coerce.number().optional().default(0),
  placeOfSupply: z.string().trim().optional().default(''),
  reverseCharge: z.boolean().optional().default(false),
  taxableValue: z.coerce.number({ required_error: 'Taxable value is required' }),
  igst: z.coerce.number().optional().default(0),
  cgst: z.coerce.number().optional().default(0),
  sgst: z.coerce.number().optional().default(0),
  cess: z.coerce.number().optional().default(0),
  itcAvailability: z.boolean().optional().default(true),
});

export const importGSTR2BSchema = z.object({
  gstin: z.string().trim().optional(),
  returnPeriod: z.string({ required_error: 'Return period is required (e.g. 042026 or 2026-04)' }).trim(),
  financialYear: z.string().trim().optional(),
  sourceFileName: z.string().trim().optional().default('gstr2b_data.json'),
  entries: z.array(gstr2bEntryInputSchema).optional(),
  rawPayload: z.any().optional(), // In case an official GSTR-2B raw JSON is posted
});

export const reconcileGSTR2BSchema = z.object({
  importId: z.string({ required_error: 'GSTR-2B Import ID is required' }).trim(),
  tolerance: z.coerce.number().min(0).max(100).optional().default(1),
});

export const updateReturnPeriodStatusSchema = z.object({
  returnPeriod: z.string({ required_error: 'Return period is required' }).trim(),
  financialYear: z.string({ required_error: 'Financial year is required' }).trim(),
  returnType: z.enum(['GSTR-1', 'GSTR-3B', 'GSTR-2B', 'GSTR-9'], {
    required_error: 'Return type is required',
  }),
  preparationStatus: z
    .enum(['not_started', 'in_progress', 'ready_for_review', 'completed'])
    .optional(),
  filingStatus: z.enum(['not_filed', 'filed_offline', 'pending']).optional(),
  filingDate: z.string().optional().nullable(),
  acknowledgementNumber: z.string().trim().max(100).optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const validatePeriodSchema = z.object({
  returnPeriod: z.string({ required_error: 'Return period is required' }).trim(),
  financialYear: z.string({ required_error: 'Financial year is required' }).trim(),
  returnType: z.enum(['GSTR-1', 'GSTR-3B'], {
    required_error: 'Return type is required',
  }),
});

export const reportQuerySchema = periodQuerySchema.extend({
  reportType: z.enum(
    [
      'sales_gst',
      'purchase_gst',
      'itc',
      'output_tax',
      'hsn',
      'rate_wise',
      'reconciliation',
    ],
    { required_error: 'Report type is required' }
  ),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

export default {
  periodQuerySchema,
  gstr1QuerySchema,
  exportQuerySchema,
  gstr2bEntryInputSchema,
  importGSTR2BSchema,
  reconcileGSTR2BSchema,
  updateReturnPeriodStatusSchema,
  validatePeriodSchema,
  reportQuerySchema,
};
