import { z } from 'zod';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const registerSchema = z.object({
  businessName: z
    .string({ required_error: 'Business name is required' })
    .trim()
    .min(2, 'Business name must be at least 2 characters')
    .max(200, 'Business name cannot exceed 200 characters'),
  businessType: z.string().trim().optional().default('Wholesale & Retail'),
  ownerName: z
    .string({ required_error: 'Owner name is required' })
    .trim()
    .min(2, 'Owner name must be at least 2 characters')
    .max(100, 'Owner name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address'),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(7, 'Phone number must be at least 7 digits')
    .max(15, 'Phone number cannot exceed 15 digits'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters long'),
  tenantCode: z
    .string()
    .trim()
    .min(3, 'Tenant code must be at least 3 characters')
    .max(20, 'Tenant code cannot exceed 20 characters')
    .optional(),
  GSTIN: z
    .string()
    .trim()
    .regex(GSTIN_REGEX, 'Invalid Indian GSTIN format (e.g. 27AAPFU0939F1ZV)')
    .optional()
    .nullable()
    .or(z.literal('')),
  PAN: z
    .string()
    .trim()
    .regex(PAN_REGEX, 'Invalid Indian PAN format (e.g. AAPFU0939F)')
    .optional()
    .nullable()
    .or(z.literal('')),
  businessAddress: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  state: z.string().trim().optional().default(''),
  stateCode: z.string().trim().optional().default(''),
  pincode: z.string().trim().optional().default(''),
  country: z.string().trim().optional().default('India'),
});

export const loginSchema = z.object({
  tenantCode: z.string().trim().optional().default(''),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

export default {
  registerSchema,
  loginSchema,
};
