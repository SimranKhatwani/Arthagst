import { z } from 'zod';

export const generateEInvoiceSchema = z.object({
  salesInvoiceId: z
    .string({ required_error: 'Sales Invoice ID is required' })
    .trim()
    .min(1, 'Sales Invoice ID cannot be empty'),
});

export const cancelEInvoiceSchema = z.object({
  cancellationReason: z.enum(['1', '2', '3', '4'], {
    required_error: 'Cancellation reason is required (1: Duplicate, 2: Data entry mistake, 3: Order cancelled, 4: Others)',
  }),
  cancellationRemarks: z
    .string({ required_error: 'Cancellation remarks are required' })
    .trim()
    .min(2, 'Cancellation remarks must be at least 2 characters')
    .max(100, 'Cancellation remarks cannot exceed 100 characters'),
});

export const queryEInvoiceSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['pending', 'generated', 'failed', 'cancelled']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export default {
  generateEInvoiceSchema,
  cancelEInvoiceSchema,
  queryEInvoiceSchema,
};
