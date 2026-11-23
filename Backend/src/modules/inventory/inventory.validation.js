import { z } from 'zod';
import { MOVEMENT_TYPES } from './stockMovement.model.js';

export const openingStockSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .trim()
    .min(1, 'Product ID is required'),
  warehouseId: z
    .string({ required_error: 'Warehouse ID is required' })
    .trim()
    .min(1, 'Warehouse ID is required'),
  quantity: z.coerce
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .min(0, 'Opening stock quantity cannot be negative'),
  remarks: z.string().trim().max(500).optional().default('Initial opening stock'),
});

export const stockInSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .trim()
    .min(1, 'Product ID is required'),
  warehouseId: z
    .string({ required_error: 'Warehouse ID is required' })
    .trim()
    .min(1, 'Warehouse ID is required'),
  quantity: z.coerce
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .positive('Stock in quantity must be greater than zero'),
  referenceType: z.string().trim().optional().default('manual'),
  referenceId: z.string().trim().optional().nullable(),
  remarks: z.string().trim().max(500).optional().default(''),
});

export const stockOutSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .trim()
    .min(1, 'Product ID is required'),
  warehouseId: z
    .string({ required_error: 'Warehouse ID is required' })
    .trim()
    .min(1, 'Warehouse ID is required'),
  quantity: z.coerce
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .positive('Stock out quantity must be greater than zero'),
  referenceType: z.string().trim().optional().default('manual'),
  referenceId: z.string().trim().optional().nullable(),
  remarks: z.string().trim().max(500).optional().default(''),
});

export const stockAdjustmentSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .trim()
    .min(1, 'Product ID is required'),
  warehouseId: z
    .string({ required_error: 'Warehouse ID is required' })
    .trim()
    .min(1, 'Warehouse ID is required'),
  mode: z
    .enum(['set', 'add', 'reduce'], {
      errorMap: () => ({ message: "Mode must be one of 'set', 'add', or 'reduce'" }),
    })
    .default('set'),
  quantity: z.coerce
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .min(0, 'Quantity cannot be negative'),
  remarks: z
    .string({ required_error: 'Remarks are mandatory for stock adjustments' })
    .trim()
    .min(2, 'Please provide a reason or remarks for stock adjustment')
    .max(500, 'Remarks cannot exceed 500 characters'),
  referenceId: z.string().trim().optional().nullable(),
});

export const stockTransferSchema = z
  .object({
    productId: z
      .string({ required_error: 'Product ID is required' })
      .trim()
      .min(1, 'Product ID is required'),
    fromWarehouseId: z
      .string({ required_error: 'Source warehouse ID (fromWarehouseId) is required' })
      .trim()
      .min(1, 'Source warehouse ID is required'),
    toWarehouseId: z
      .string({ required_error: 'Destination warehouse ID (toWarehouseId) is required' })
      .trim()
      .min(1, 'Destination warehouse ID is required'),
    quantity: z.coerce
      .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
      .positive('Transfer quantity must be greater than zero'),
    remarks: z.string().trim().max(500).optional().default('Warehouse transfer'),
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: 'Source and destination warehouses cannot be the same',
    path: ['toWarehouseId'],
  });

export const queryInventorySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  sortBy: z.string().optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const queryMovementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  movementType: z.enum(MOVEMENT_TYPES).optional(),
  startDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const queryLowStockSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
});

export default {
  openingStockSchema,
  stockInSchema,
  stockOutSchema,
  stockAdjustmentSchema,
  stockTransferSchema,
  queryInventorySchema,
  queryMovementsSchema,
  queryLowStockSchema,
};
