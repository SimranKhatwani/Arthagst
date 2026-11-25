import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z
    .string({ required_error: 'Category name is required' })
    .trim()
    .min(1, 'Category name cannot be empty')
    .max(100, 'Category name cannot exceed 100 characters'),
  description: z.string().trim().max(500).optional().default(''),
});

export const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name cannot be empty')
    .max(100, 'Category name cannot exceed 100 characters')
    .optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const createExpenseSchema = z.object({
  categoryId: z.string({ required_error: 'Expense category ID is required' }).trim(),
  expenseDate: z.string().optional(),
  amount: z.coerce
    .number({ required_error: 'Expense amount is required' })
    .positive('Expense amount must be greater than zero'),
  isGSTApplicable: z.boolean().optional().default(false),
  taxableAmount: z.coerce.number().min(0).optional(),
  gstRate: z.coerce.number().min(0).max(100).optional().default(0),
  isITCClaimable: z.boolean().optional().default(false),
  paymentMethod: z
    .enum(['cash', 'bank', 'UPI', 'cheque', 'card', 'other'])
    .optional()
    .default('cash'),
  bankAccountId: z.string().trim().optional().nullable(),
  partyId: z.string().trim().optional().nullable(),
  payeeName: z.string().trim().max(100).optional().default(''),
  referenceNumber: z.string().trim().max(100).optional().default(''),
  receiptUrl: z.string().trim().optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const updateExpenseSchema = z.object({
  categoryId: z.string().trim().optional(),
  expenseDate: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  isGSTApplicable: z.boolean().optional(),
  taxableAmount: z.coerce.number().min(0).optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  isITCClaimable: z.boolean().optional(),
  paymentMethod: z.enum(['cash', 'bank', 'UPI', 'cheque', 'card', 'other']).optional(),
  bankAccountId: z.string().trim().optional().nullable(),
  partyId: z.string().trim().optional().nullable(),
  payeeName: z.string().trim().max(100).optional(),
  referenceNumber: z.string().trim().max(100).optional(),
  receiptUrl: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const cancelExpenseSchema = z.object({
  cancellationReason: z
    .string({ required_error: 'Cancellation reason is required' })
    .trim()
    .min(2, 'Cancellation reason must be at least 2 characters')
    .max(500, 'Cancellation reason cannot exceed 500 characters'),
});

export const queryExpensesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
  partyId: z.string().trim().optional(),
  paymentMethod: z.enum(['cash', 'bank', 'UPI', 'cheque', 'card', 'other']).optional(),
  status: z.enum(['paid', 'cancelled']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default('expenseDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export default {
  createCategorySchema,
  updateCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
  cancelExpenseSchema,
  queryExpensesSchema,
};
