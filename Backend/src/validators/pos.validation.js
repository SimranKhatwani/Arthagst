import { z } from 'zod';
import { validateGSTIN } from '../utils/gstinValidator.js';

export const posItemInputSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .trim()
    .min(1, 'Product ID is required'),
  quantity: z.coerce
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity must be greater than zero'),
  unitPrice: z.coerce
    .number({ invalid_type_error: 'Unit price must be a number' })
    .min(0, 'Unit price cannot be negative')
    .optional(),
  discount: z.coerce
    .number({ invalid_type_error: 'Discount must be a number' })
    .min(0, 'Discount cannot be negative')
    .optional()
    .default(0),
  description: z.string().trim().max(1000).optional().default(''),
});

export const posPaymentInputSchema = z.object({
  paymentMethod: z.enum(['cash', 'upi', 'card', 'bank', 'other'], {
    required_error: 'Payment method is required (cash, upi, card, bank, other)',
  }),
  amount: z.coerce
    .number({ required_error: 'Payment amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Payment amount must be greater than zero'),
  bankAccountId: z.string().trim().optional().nullable(),
  referenceNumber: z.string().trim().max(100).optional().default(''),
});

export const createPosBillSchema = z.object({
  warehouseId: z
    .string({ required_error: 'Warehouse ID is required' })
    .trim()
    .min(1, 'Warehouse ID is required'),
  partyId: z.string().trim().optional().nullable(),
  isWalkIn: z.boolean().optional().default(false),
  customerName: z.string().trim().max(200).optional().default(''),
  customerPhone: z
    .string()
    .trim()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Customer phone must be a valid 10-digit mobile number',
    })
    .optional()
    .default(''),
  customerGSTIN: z
    .string()
    .trim()
    .optional()
    .default('')
    .superRefine((val, ctx) => {
      if (!val || String(val).trim() === '') return;
      const res = validateGSTIN(val);
      if (!res.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: res.error || 'Invalid customer GSTIN',
        });
      }
    })
    .transform((val) => (val && String(val).trim() !== '' ? String(val).trim().toUpperCase() : '')),
  placeOfSupply: z.string().trim().optional(),
  billDate: z.string().optional(),
  items: z
    .array(posItemInputSchema)
    .min(1, 'At least one line item is required in a POS bill'),
  billDiscount: z.coerce
    .number({ invalid_type_error: 'Bill discount must be a number' })
    .min(0, 'Bill discount cannot be negative')
    .optional()
    .default(0),
  notes: z.string().trim().max(1000).optional().default(''),
  finalize: z.boolean().optional().default(false),
  payments: z.array(posPaymentInputSchema).optional().default([]),
});

export const updatePosBillSchema = z.object({
  warehouseId: z.string().trim().optional(),
  partyId: z.string().trim().optional().nullable(),
  isWalkIn: z.boolean().optional(),
  customerName: z.string().trim().max(200).optional(),
  customerPhone: z
    .string()
    .trim()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Customer phone must be a valid 10-digit mobile number',
    })
    .optional(),
  placeOfSupply: z.string().trim().optional(),
  items: z.array(posItemInputSchema).min(1, 'At least one line item is required').optional(),
  billDiscount: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const finalizePosBillSchema = z.object({
  payments: z.array(posPaymentInputSchema).optional().default([]),
  notes: z.string().trim().max(1000).optional(),
});

export const cancelPosBillSchema = z.object({
  cancellationReason: z
    .string({ required_error: 'Cancellation reason is required' })
    .trim()
    .min(3, 'Cancellation reason must be at least 3 characters')
    .max(500, 'Cancellation reason cannot exceed 500 characters'),
});

export const queryPosBillsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['draft', 'posted', 'cancelled', 'all']).optional(),
  paymentStatus: z.enum(['unpaid', 'partially_paid', 'paid']).optional(),
  cashierId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  partyId: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const queryPosProductsSchema = z.object({
  warehouseId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  SKU: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const queryPosDailySummarySchema = z.object({
  date: z.string().optional(),
  warehouseId: z.string().trim().optional(),
});

export default {
  posItemInputSchema,
  posPaymentInputSchema,
  createPosBillSchema,
  updatePosBillSchema,
  finalizePosBillSchema,
  cancelPosBillSchema,
  queryPosBillsSchema,
  queryPosProductsSchema,
  queryPosDailySummarySchema,
};
