import { z } from 'zod';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const updateTenantProfileSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters').max(200, 'Business name cannot exceed 200 characters').trim().optional(),
  businessType: z.string().max(100).trim().optional(),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters').max(100, 'Owner name cannot exceed 100 characters').trim().optional(),
  email: z.string().email('Please provide a valid email address').trim().toLowerCase().optional(),
  phone: z
    .string()
    .trim()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Phone number must be a valid 10-digit mobile number',
    })
    .optional(),
  GSTIN: z.string().trim().toUpperCase().refine(val => !val || GSTIN_REGEX.test(val), {
    message: 'Invalid Indian GSTIN format (e.g. 27AAPFU0939F1ZV)',
  }).nullable().optional(),
  PAN: z.string().trim().toUpperCase().refine(val => !val || PAN_REGEX.test(val), {
    message: 'Invalid Indian PAN format (e.g. AAPFU0939F)',
  }).nullable().optional(),
  businessAddress: z.string().max(500).trim().optional(),
  city: z.string().max(100).trim().optional(),
  state: z.string().max(100).trim().optional(),
  stateCode: z.string().trim().refine(val => !val || /^[0-9]{2}$/.test(val), {
    message: 'State code must be 2 digits (e.g. 27, 08)',
  }).optional(),
  pincode: z.string().trim().refine(val => !val || /^[0-9]{6}$/.test(val), {
    message: 'Pincode must be 6 digits (e.g. 400001)',
  }).optional(),
  country: z.string().max(100).trim().optional(),
  financialYearStart: z.string().trim().regex(/^[0-9]{2}-[0-9]{2}$/, 'Financial year start must be in MM-DD format (e.g. 04-01)').optional(),
});
