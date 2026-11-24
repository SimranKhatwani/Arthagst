import { z } from 'zod';

export const superAdminLoginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please provide a valid email address')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
});

export const tenantActionSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
});

export const assignSubscriptionSchema = z.object({
  planId: z.string({ required_error: 'planId is required' }).trim(),
  billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  trialDays: z.coerce.number().min(0).default(0),
  overrideAmount: z.coerce.number().min(0).nullable().optional(),
  autoRenew: z.boolean().default(true),
  notes: z.string().trim().max(500).optional().default(''),
});

export const queryTenantsSchema = z.object({
  search: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  isActive: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
