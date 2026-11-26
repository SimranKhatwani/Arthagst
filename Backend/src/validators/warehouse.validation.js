import { z } from 'zod';

export const createWarehouseSchema = z.object({
  warehouseName: z
    .string({ required_error: 'Warehouse name is required' })
    .trim()
    .min(2, 'Warehouse name must be at least 2 characters')
    .max(100, 'Warehouse name cannot exceed 100 characters'),
  warehouseCode: z
    .string({ required_error: 'Warehouse code is required' })
    .trim()
    .min(1, 'Warehouse code must be at least 1 character')
    .max(50, 'Warehouse code cannot exceed 50 characters'),
  address: z.string().trim().max(500).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  state: z.string().trim().max(100).optional().default(''),
  pincode: z.string().trim().max(10).optional().default(''),
  manager: z.string().trim().max(100).optional().default(''),
  capacity: z.string().trim().max(100).optional().default(''),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updateWarehouseSchema = z.object({
  warehouseName: z.string().trim().min(2).max(100).optional(),
  warehouseCode: z.string().trim().min(1).max(50).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(10).optional(),
  manager: z.string().trim().max(100).optional(),
  capacity: z.string().trim().max(100).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const queryWarehousesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  isDefault: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  sortBy: z.string().optional().default('warehouseName'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

export default {
  createWarehouseSchema,
  updateWarehouseSchema,
  queryWarehousesSchema,
  updateStatusSchema,
};
