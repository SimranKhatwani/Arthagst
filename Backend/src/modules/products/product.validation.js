import { z } from 'zod';

const HSN_REGEX = /^[0-9]{2,8}$/;
const SAC_REGEX = /^[0-9]{4,6}$/;

export const createProductSchema = z
  .object({
    name: z
      .string({ required_error: 'Product name is required' })
      .trim()
      .min(2, 'Product name must be at least 2 characters')
      .max(200, 'Product name cannot exceed 200 characters'),
    productType: z
      .enum(['goods', 'service'], {
        errorMap: () => ({ message: 'productType must be either goods or service' }),
      })
      .default('goods'),
    categoryId: z.string().trim().nullable().optional().default(null),
    unitId: z.string({ required_error: 'Unit ID is required' }).trim().min(1, 'Unit ID is required'),
    SKU: z
      .string({ required_error: 'SKU is required' })
      .trim()
      .min(1, 'SKU must be at least 1 character')
      .max(50, 'SKU cannot exceed 50 characters'),
    barcode: z.string().trim().max(50).optional().nullable().or(z.literal('')),
    description: z.string().trim().max(1000).optional().default(''),
    HSN: z
      .string()
      .trim()
      .regex(HSN_REGEX, 'HSN code must be 2 to 8 numeric digits')
      .optional()
      .nullable()
      .or(z.literal('')),
    SAC: z
      .string()
      .trim()
      .regex(SAC_REGEX, 'SAC code must be 4 to 6 numeric digits')
      .optional()
      .nullable()
      .or(z.literal('')),
    gstRate: z.coerce
      .number({ invalid_type_error: 'GST rate must be a number' })
      .min(0, 'GST rate cannot be negative')
      .max(100, 'GST rate cannot exceed 100%')
      .default(18),
    cessRate: z.coerce
      .number({ invalid_type_error: 'Cess rate must be a number' })
      .min(0, 'Cess rate cannot be negative')
      .max(100, 'Cess rate cannot exceed 100%')
      .optional()
      .default(0),
    purchasePrice: z.coerce
      .number({ invalid_type_error: 'Purchase price must be a number' })
      .min(0, 'Purchase price cannot be negative')
      .optional()
      .default(0),
    sellingPrice: z.coerce
      .number({ required_error: 'Selling price is required', invalid_type_error: 'Selling price must be a number' })
      .min(0, 'Selling price cannot be negative'),
    mrp: z.coerce
      .number({ invalid_type_error: 'MRP must be a number' })
      .min(0, 'MRP cannot be negative')
      .optional()
      .default(0),
    openingStock: z.coerce
      .number({ invalid_type_error: 'Opening stock must be a number' })
      .min(0, 'Opening stock cannot be negative')
      .optional()
      .default(0),
    lowStockAlert: z.coerce
      .number({ invalid_type_error: 'Low stock alert threshold must be a number' })
      .min(0, 'Low stock alert cannot be negative')
      .optional()
      .default(0),
    trackInventory: z.boolean().optional().default(true),
    images: z.array(z.string().trim()).optional().default([]),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      // Services cannot have inventory or opening stock
      if (data.productType === 'service' && data.openingStock > 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Services cannot have opening stock or inventory records',
      path: ['openingStock'],
    }
  )
  .refine(
    (data) => {
      // Selling price cannot exceed MRP when MRP is specified
      if (data.mrp && data.mrp > 0 && data.sellingPrice > data.mrp) {
        return false;
      }
      return true;
    },
    {
      message: 'Selling price cannot exceed MRP',
      path: ['sellingPrice'],
    }
  );

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    productType: z.enum(['goods', 'service']).optional(),
    categoryId: z.string().trim().nullable().optional(),
    unitId: z.string().trim().min(1).optional(),
    SKU: z.string().trim().min(1).max(50).optional(),
    barcode: z.string().trim().max(50).optional().nullable().or(z.literal('')),
    description: z.string().trim().max(1000).optional(),
    HSN: z.string().trim().regex(HSN_REGEX, 'HSN code must be 2 to 8 numeric digits').optional().nullable().or(z.literal('')),
    SAC: z.string().trim().regex(SAC_REGEX, 'SAC code must be 4 to 6 numeric digits').optional().nullable().or(z.literal('')),
    gstRate: z.coerce.number().min(0).max(100).optional(),
    cessRate: z.coerce.number().min(0).max(100).optional(),
    purchasePrice: z.coerce.number().min(0).optional(),
    sellingPrice: z.coerce.number().min(0).optional(),
    mrp: z.coerce.number().min(0).optional(),
    openingStock: z.coerce.number().min(0).optional(),
    lowStockAlert: z.coerce.number().min(0).optional(),
    trackInventory: z.boolean().optional(),
    images: z.array(z.string().trim()).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.mrp && data.mrp > 0 && data.sellingPrice && data.sellingPrice > data.mrp) {
        return false;
      }
      return true;
    },
    {
      message: 'Selling price cannot exceed MRP',
      path: ['sellingPrice'],
    }
  );

export const queryProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  productType: z.enum(['goods', 'service']).optional(),
  gstRate: z.coerce.number().optional(),
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
  createProductSchema,
  updateProductSchema,
  queryProductsSchema,
  updateStatusSchema,
};
