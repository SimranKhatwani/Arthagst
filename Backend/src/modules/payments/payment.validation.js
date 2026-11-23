import { z } from 'zod';

export const allocationInputSchema = z
  .object({
    salesInvoiceId: z.string().trim().optional().nullable(),
    purchaseBillId: z.string().trim().optional().nullable(),
    allocatedAmount: z.coerce
      .number({ required_error: 'Allocated amount is required' })
      .positive('Allocated amount must be greater than zero'),
  })
  .refine(
    (data) => (data.salesInvoiceId && !data.purchaseBillId) || (!data.salesInvoiceId && data.purchaseBillId),
    {
      message: 'Each allocation must reference either a salesInvoiceId or a purchaseBillId, but not both',
      path: ['salesInvoiceId'],
    }
  );

export const createPaymentSchema = z.object({
  direction: z.enum(['in', 'out'], {
    errorMap: () => ({ message: "Direction must be 'in' (Receipt) or 'out' (Supplier Payment)" }),
  }),
  partyId: z.string().trim().optional().nullable(),
  paymentDate: z.string().optional(),
  amount: z.coerce
    .number({ required_error: 'Payment amount is required' })
    .positive('Payment amount must be greater than zero'),
  paymentMethod: z
    .enum(['cash', 'bank', 'UPI', 'cheque', 'card', 'other'])
    .optional()
    .default('bank'),
  bankAccountId: z.string().trim().optional().nullable(),
  referenceNumber: z.string().trim().max(100).optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
  allocations: z.array(allocationInputSchema).optional().default([]),
});

export const cancelPaymentSchema = z.object({
  cancellationReason: z
    .string({ required_error: 'Cancellation reason is required' })
    .trim()
    .min(2, 'Cancellation reason must be at least 2 characters')
    .max(500, 'Cancellation reason cannot exceed 500 characters'),
});

export const queryPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  direction: z.enum(['in', 'out']).optional(),
  partyId: z.string().trim().optional(),
  bankAccountId: z.string().trim().optional(),
  paymentMethod: z.enum(['cash', 'bank', 'UPI', 'cheque', 'card', 'other']).optional(),
  status: z.enum(['completed', 'cancelled']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default('paymentDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export default {
  allocationInputSchema,
  createPaymentSchema,
  cancelPaymentSchema,
  queryPaymentsSchema,
};
