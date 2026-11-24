import { z } from 'zod';

export const baseReportFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  financialYear: z.string().trim().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

export const paginatedReportQuerySchema = baseReportFilterSchema.extend({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().trim().optional(),
});

export const salesReportQuerySchema = paginatedReportQuerySchema.extend({
  partyId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
});

export const purchaseReportQuerySchema = paginatedReportQuerySchema.extend({
  supplierId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
});

export const inventoryReportQuerySchema = paginatedReportQuerySchema.extend({
  warehouseId: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  productId: z.string().trim().optional(),
});

export const partyReportQuerySchema = paginatedReportQuerySchema.extend({
  partyId: z.string().trim().optional(),
  partyType: z.enum(['customer', 'supplier', 'both']).optional(),
  overdueOnly: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
});

export const paymentReportQuerySchema = paginatedReportQuerySchema.extend({
  paymentMethod: z.enum(['cash', 'bank', 'UPI', 'cheque', 'card', 'other']).optional(),
  partyId: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
});

export const expenseReportQuerySchema = paginatedReportQuerySchema.extend({
  categoryId: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
});
