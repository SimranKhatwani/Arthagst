import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string({ required_error: 'Plan name is required' }).trim().min(2).max(100),
  code: z.string({ required_error: 'Plan code is required' }).trim().min(2).max(20),
  description: z.string().trim().max(500).optional().default(''),
  price: z.coerce.number().min(0, 'Price cannot be negative').default(0),
  billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  trialDays: z.coerce.number().min(0).default(0),
  limits: z
    .object({
      maxUsers: z.coerce.number().default(2),
      maxProducts: z.coerce.number().default(100),
      maxInvoices: z.coerce.number().default(50),
      maxWarehouses: z.coerce.number().default(1),
      storageLimit: z.coerce.number().default(1024),
    })
    .optional(),
  features: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
  isPublic: z.boolean().optional().default(true),
  isTrial: z.boolean().optional().default(false),
});

export const updatePlanSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  price: z.coerce.number().min(0).optional(),
  billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  trialDays: z.coerce.number().min(0).optional(),
  limits: z
    .object({
      maxUsers: z.coerce.number().optional(),
      maxProducts: z.coerce.number().optional(),
      maxInvoices: z.coerce.number().optional(),
      maxWarehouses: z.coerce.number().optional(),
      storageLimit: z.coerce.number().optional(),
    })
    .optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const upgradePlanSchema = z.object({
  planId: z.string({ required_error: 'planId is required' }).trim(),
  billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  autoRenew: z.boolean().optional().default(true),
});

export const cancelSubscriptionSchema = z.object({
  cancellationReason: z.string().trim().max(500).optional().default('User requested cancellation'),
});

export const paymentConfirmationSchema = z.object({
  invoiceId: z.string({ required_error: 'invoiceId is required' }).trim(),
  transactionId: z.string({ required_error: 'transactionId is required' }).trim(),
  orderId: z.string().optional().default(''),
  gateway: z.string().optional().default('mock_gateway'),
  paymentMethod: z.string().optional().default('card'),
  signature: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
});
