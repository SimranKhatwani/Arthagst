import { z } from 'zod';
import { GST_UQC_CODES } from './unit.model.js';

const validateUQC = (val) => {
  if (!val || val === '') return true;
  const upper = val.toUpperCase().trim();
  return GST_UQC_CODES.some(
    (code) => code === upper || code.startsWith(upper + '-')
  );
};

export const createUnitSchema = z.object({
  name: z
    .string({ required_error: 'Unit name is required' })
    .trim()
    .min(1, 'Unit name must be at least 1 character')
    .max(50, 'Unit name cannot exceed 50 characters'),
  shortName: z
    .string({ required_error: 'Short name is required' })
    .trim()
    .min(1, 'Short name must be at least 1 character')
    .max(20, 'Short name cannot exceed 20 characters'),
  unitType: z
    .enum(['quantity', 'weight', 'volume', 'length', 'area', 'other'], {
      errorMap: () => ({
        message: 'unitType must be one of: quantity, weight, volume, length, area, other',
      }),
    })
    .default('quantity'),
  gstUqcCode: z
    .string()
    .trim()
    .refine(validateUQC, {
      message: 'Invalid GST UQC code. Provide an official GST UQC (e.g. PCS-PIECES, KGS, BOX-BOXES)',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  allowDecimal: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
});

export const updateUnitSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  shortName: z.string().trim().min(1).max(20).optional(),
  unitType: z
    .enum(['quantity', 'weight', 'volume', 'length', 'area', 'other'])
    .optional(),
  gstUqcCode: z
    .string()
    .trim()
    .refine(validateUQC, {
      message: 'Invalid GST UQC code',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  allowDecimal: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const queryUnitsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  unitType: z
    .enum(['quantity', 'weight', 'volume', 'length', 'area', 'other'])
    .optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  sortBy: z.string().optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

export default {
  createUnitSchema,
  updateUnitSchema,
  queryUnitsSchema,
  updateStatusSchema,
};
