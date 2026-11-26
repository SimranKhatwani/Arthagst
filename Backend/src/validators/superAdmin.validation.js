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

export const createTenantSchema = z.object({
  tenantCode: z
    .string({ required_error: 'Tenant code is required' })
    .trim()
    .min(3, 'Tenant code must be at least 3 characters')
    .max(20, 'Tenant code cannot exceed 20 characters'),
  businessName: z
    .string({ required_error: 'Business name is required' })
    .trim()
    .min(2, 'Business name must be at least 2 characters')
    .max(200, 'Business name cannot exceed 200 characters'),
  ownerName: z
    .string({ required_error: 'Owner name is required' })
    .trim()
    .min(2, 'Owner name must be at least 2 characters'),
  email: z
    .string({ required_error: 'Admin email is required' })
    .email('Please provide a valid email address')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(5, 'Phone number must be at least 5 digits'),
  city: z.string().trim().optional().default(''),
  state: z.string().trim().optional().default(''),
  businessAddress: z.string().trim().optional().default(''),
  GSTIN: z.string().trim().nullable().optional(),
  PAN: z.string().trim().nullable().optional(),
  planName: z.string().trim().optional().default('Growth'),
});

export const updateTenantSchema = z.object({
  businessName: z.string().trim().min(2).optional(),
  ownerName: z.string().trim().min(2).optional(),
  email: z.string().email().trim().toLowerCase().optional(),
  phone: z.string().trim().min(5).optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  businessAddress: z.string().trim().optional(),
  GSTIN: z.string().trim().nullable().optional(),
  PAN: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired']).optional(),
});

export const resetTenantPasswordSchema = z.object({
  newPassword: z
    .string({ required_error: 'New password is required' })
    .min(6, 'Password must be at least 6 characters long'),
});

export const queryTenantsSchema = z.object({
  search: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  isActive: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
