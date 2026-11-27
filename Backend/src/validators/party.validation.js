import { z } from 'zod';
import { validateGSTIN } from '../utils/gstinValidator.js';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const gstinFieldSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(''))
  .superRefine((val, ctx) => {
    if (!val || String(val).trim() === '') return;
    const res = validateGSTIN(val);
    if (!res.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.error || 'Invalid Indian GSTIN format (e.g. 27AAPFU0939F1ZV)',
      });
    }
  })
  .transform((val) => (val && String(val).trim() !== '' ? String(val).trim().toUpperCase() : null));

export const createPartySchema = z
  .object({
    partyType: z
      .enum(['customer', 'supplier', 'both'], {
        errorMap: () => ({ message: 'Party type must be customer, supplier, or both' }),
      })
      .default('customer'),
    name: z
      .string({ required_error: 'Party name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(200, 'Name cannot exceed 200 characters'),
    businessName: z.string().trim().max(200).optional().default(''),
    phone: z
      .string()
      .trim()
      .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
        message: 'Phone number must be a valid 10-digit mobile number',
      })
      .optional()
      .default(''),
    alternatePhone: z
      .string()
      .trim()
      .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
        message: 'Alternate phone must be a valid 10-digit mobile number',
      })
      .optional()
      .default(''),
    email: z
      .string()
      .trim()
      .email('Please provide a valid email address')
      .optional()
      .nullable()
      .or(z.literal('')),
    GSTIN: gstinFieldSchema,
    PAN: z
      .string()
      .trim()
      .regex(PAN_REGEX, 'Invalid Indian PAN format (e.g. AAPFU0939F)')
      .optional()
      .nullable()
      .or(z.literal('')),
    billingAddress: z.string().trim().optional().default(''),
    shippingAddress: z.string().trim().optional().default(''),
    city: z.string().trim().optional().default(''),
    state: z.string().trim().optional().default(''),
    stateCode: z.string().trim().optional().default(''),
    pincode: z.string().trim().optional().default(''),
    country: z.string().trim().optional().default('India'),
    openingBalance: z.coerce
      .number({ invalid_type_error: 'Opening balance must be a number' })
      .min(0, 'Opening balance cannot be negative')
      .optional()
      .default(0),
    balanceType: z.enum(['receivable', 'payable', 'none']).optional().default('none'),
    creditLimit: z.coerce
      .number({ invalid_type_error: 'Credit limit must be a number' })
      .min(0, 'Credit limit cannot be negative')
      .optional()
      .default(0),
    paymentTerms: z.string().trim().optional().default('Net 15'),
    notes: z.string().trim().optional().default(''),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      // If opening balance > 0, balanceType cannot be 'none' if provided explicitly
      if (data.openingBalance > 0 && data.balanceType === 'none') {
        // Auto-assign default receivable or payable instead of throwing or let service handle
        return true;
      }
      return true;
    },
    { message: 'Opening balance requires a valid balanceType', path: ['balanceType'] }
  );

export const updatePartySchema = z.object({
  partyType: z.enum(['customer', 'supplier', 'both']).optional(),
  name: z.string().trim().min(2).max(200).optional(),
  businessName: z.string().trim().max(200).optional(),
  phone: z
    .string()
    .trim()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Phone number must be a valid 10-digit mobile number',
    })
    .optional(),
  alternatePhone: z
    .string()
    .trim()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Alternate phone must be a valid 10-digit mobile number',
    })
    .optional(),
  email: z.string().trim().email('Invalid email').optional().nullable().or(z.literal('')),
  GSTIN: gstinFieldSchema,
  PAN: z
    .string()
    .trim()
    .regex(PAN_REGEX, 'Invalid Indian PAN format')
    .optional()
    .nullable()
    .or(z.literal('')),
  billingAddress: z.string().trim().optional(),
  shippingAddress: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  stateCode: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  openingBalance: z.coerce.number().min(0, 'Opening balance cannot be negative').optional(),
  balanceType: z.enum(['receivable', 'payable', 'none']).optional(),
  creditLimit: z.coerce.number().min(0, 'Credit limit cannot be negative').optional(),
  paymentTerms: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const queryPartiesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  partyType: z.enum(['customer', 'supplier', 'both']).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

export default {
  createPartySchema,
  updatePartySchema,
  queryPartiesSchema,
  updateStatusSchema,
};
