import { z } from 'zod';

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const createBankAccountSchema = z.object({
  accountName: z
    .string({ required_error: 'Account name is required' })
    .trim()
    .min(2, 'Account name must be at least 2 characters')
    .max(100, 'Account name cannot exceed 100 characters'),
  accountType: z
    .enum(['cash', 'bank', 'UPI', 'credit_card', 'other'], {
      errorMap: () => ({ message: 'accountType must be cash, bank, UPI, credit_card, or other' }),
    })
    .default('bank'),
  bankName: z.string().trim().max(100).optional().default(''),
  accountHolderName: z.string().trim().max(100).optional().default(''),
  accountNumber: z.string().trim().max(50).optional().default(''),
  IFSC: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IFSC_REGEX, 'Invalid Indian IFSC code format (e.g. HDFC0001234)')
    .optional()
    .nullable()
    .or(z.literal('')),
  openingBalance: z.coerce.number().optional().default(0),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updateBankAccountSchema = z.object({
  accountName: z.string().trim().min(2).max(100).optional(),
  accountType: z.enum(['cash', 'bank', 'UPI', 'credit_card', 'other']).optional(),
  bankName: z.string().trim().max(100).optional(),
  accountHolderName: z.string().trim().max(100).optional(),
  accountNumber: z.string().trim().max(50).optional(),
  IFSC: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IFSC_REGEX, 'Invalid Indian IFSC code format (e.g. HDFC0001234)')
    .optional()
    .nullable()
    .or(z.literal('')),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const queryBankAccountsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  accountType: z.enum(['cash', 'bank', 'UPI', 'credit_card', 'other']).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  isDefault: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  sortBy: z.string().optional().default('accountName'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status is required' }),
});

export const transferFundsSchema = z.object({
  fromAccountId: z.string({ required_error: 'Source account ID is required' }).trim(),
  toAccountId: z.string({ required_error: 'Destination account ID is required' }).trim(),
  amount: z.coerce
    .number({ required_error: 'Transfer amount is required' })
    .positive('Transfer amount must be greater than zero'),
  date: z.string().optional(),
  referenceNumber: z.string().trim().max(100).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
});

export const createTransactionSchema = z.object({
  bankAccountId: z.string({ required_error: 'Bank account ID is required' }).trim(),
  transactionType: z.enum(['deposit', 'withdrawal'], {
    required_error: "Transaction type must be 'deposit' or 'withdrawal'",
  }),
  amount: z.coerce
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be greater than zero'),
  date: z.string().optional(),
  referenceNumber: z.string().trim().max(100).optional().default(''),
  description: z.string().trim().max(500).optional().default(''),
});

export const queryTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  bankAccountId: z.string().trim().optional(),
  transactionType: z.enum(['deposit', 'withdrawal', 'transfer_in', 'transfer_out']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default('transactionDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export default {
  createBankAccountSchema,
  updateBankAccountSchema,
  queryBankAccountsSchema,
  updateStatusSchema,
  transferFundsSchema,
  createTransactionSchema,
  queryTransactionsSchema,
};
