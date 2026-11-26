import { z } from 'zod';

export const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters').trim(),
  email: z.string().email('Please provide a valid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  phone: z
    .string()
    .trim()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Phone number must be a valid 10-digit mobile number',
    })
    .optional()
    .default(''),
  role: z.enum(['admin', 'accountant', 'sales', 'inventory'], {
    errorMap: () => ({ message: "Role must be one of: 'admin', 'accountant', 'sales', 'inventory'" })
  }).default('sales'),
  permissions: z.array(z.string()).optional().default([]),
});

export const updateStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters').trim().optional(),
  phone: z
    .string()
    .trim()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Phone number must be a valid 10-digit mobile number',
    })
    .optional(),
  role: z.enum(['admin', 'accountant', 'sales', 'inventory'], {
    errorMap: () => ({ message: "Role must be one of: 'admin', 'accountant', 'sales', 'inventory'" })
  }).optional(),
  permissions: z.array(z.string()).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters long').optional(),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean flag is required' }),
});

export const queryStaffSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  role: z.string().optional(),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});
