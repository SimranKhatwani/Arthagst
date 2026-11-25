import { z } from 'zod';

/**
 * Chart of Accounts (COA) Validations
 */
export const createAccountSchema = z.object({
  accountName: z
    .string({ required_error: 'Account name is required' })
    .trim()
    .min(2, 'Account name must be at least 2 characters')
    .max(100, 'Account name cannot exceed 100 characters'),
  accountCode: z
    .string({ required_error: 'Account code is required' })
    .trim()
    .min(1, 'Account code cannot be empty')
    .max(20, 'Account code cannot exceed 20 characters'),
  accountType: z.enum(['asset', 'liability', 'equity', 'income', 'expense'], {
    errorMap: () => ({ message: 'accountType must be asset, liability, equity, income, or expense' }),
  }),
  accountSubType: z.string().trim().min(1, 'Account subtype is required'),
  parentAccountId: z.string().trim().nullable().optional(),
  openingBalance: z.coerce.number().optional().default(0),
  balanceType: z.enum(['debit', 'credit']).optional(),
  isActive: z.boolean().optional().default(true),
  description: z.string().trim().max(500).optional().default(''),
});

export const updateAccountSchema = z.object({
  accountName: z.string().trim().min(2).max(100).optional(),
  accountCode: z.string().trim().min(1).max(20).optional(),
  accountType: z.enum(['asset', 'liability', 'equity', 'income', 'expense']).optional(),
  accountSubType: z.string().trim().min(1).optional(),
  parentAccountId: z.string().trim().nullable().optional(),
  openingBalance: z.coerce.number().optional(),
  balanceType: z.enum(['debit', 'credit']).optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(500).optional(),
});

export const queryAccountsSchema = z.object({
  accountType: z.enum(['asset', 'liability', 'equity', 'income', 'expense']).optional(),
  accountSubType: z.string().optional(),
  isActive: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  isSystemAccount: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  search: z.string().optional(),
});

/**
 * Journal Entry Validations
 */
const journalLineItemSchema = z.object({
  accountId: z.string({ required_error: 'accountId is required' }).trim(),
  debit: z.coerce.number().min(0, 'Debit cannot be negative').optional().default(0),
  credit: z.coerce.number().min(0, 'Credit cannot be negative').optional().default(0),
  description: z.string().trim().optional().default(''),
  partyId: z.string().trim().nullable().optional(),
});

export const createJournalEntrySchema = z.object({
  entryDate: z.string().or(z.date()).optional(),
  financialYear: z.string().trim().optional(),
  narration: z
    .string({ required_error: 'Narration is required' })
    .trim()
    .min(3, 'Narration must be at least 3 characters')
    .max(1000, 'Narration cannot exceed 1000 characters'),
  lines: z
    .array(journalLineItemSchema)
    .min(2, 'Journal entry must have at least 2 line items'),
});

export const reverseJournalEntrySchema = z.object({
  reason: z.string().trim().min(3, 'Reversal reason must be at least 3 characters').optional().default('Manual reversal'),
  reversalDate: z.string().or(z.date()).optional(),
});

export const queryJournalEntriesSchema = z.object({
  financialYear: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sourceType: z.string().optional(),
  status: z.enum(['draft', 'posted', 'reversed']).optional(),
  accountId: z.string().optional(),
  partyId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

/**
 * Report Query Validations
 */
export const generalLedgerQuerySchema = z.object({
  accountId: z.string().trim().optional(),
  financialYear: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  partyId: z.string().optional(),
});

export const trialBalanceQuerySchema = z.object({
  financialYear: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  asOnDate: z.string().optional(),
});

export const financialReportQuerySchema = z.object({
  financialYear: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  asOnDate: z.string().optional(),
});

export const closeFinancialYearSchema = z.object({
  financialYear: z
    .string({ required_error: 'financialYear is required (e.g. 2026-27)' })
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Financial year must match YYYY-YY format (e.g. 2026-27)'),
});
