import { z } from 'zod';

const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const invoicePreferencesSchema = z.object({
  invoicePrefix: z.string().max(10).trim().optional(),
  quotationPrefix: z.string().max(10).trim().optional(),
  orderPrefix: z.string().max(10).trim().optional(),
  challanPrefix: z.string().max(10).trim().optional(),
  creditNotePrefix: z.string().max(10).trim().optional(),
  defaultNotes: z.string().max(1000).trim().optional(),
  termsAndConditions: z.string().max(2000).trim().optional(),
  headerText: z.string().max(200).trim().optional(),
  footerText: z.string().max(200).trim().optional(),
  showTaxBreakup: z.boolean().optional(),
}).optional();

export const brandingSchema = z.object({
  logoUrl: z.string().max(1000).trim().optional(),
  signatureUrl: z.string().max(1000).trim().optional(),
  primaryColor: z.string().trim().refine(val => !val || HEX_COLOR_REGEX.test(val), {
    message: 'Primary color must be a valid hex color code (e.g. #4f46e5)',
  }).optional(),
  printDisplayPreferences: z.object({
    showLogo: z.boolean().optional(),
    showSignature: z.boolean().optional(),
    showNotes: z.boolean().optional(),
    showTerms: z.boolean().optional(),
    showBankDetails: z.boolean().optional(),
    showUpiQr: z.boolean().optional(),
  }).optional(),
}).optional();

export const paymentInformationSchema = z.object({
  upiId: z.string().trim().refine(val => !val || UPI_REGEX.test(val), {
    message: 'Invalid UPI ID format (e.g. business@okaxis or merchant@upi)',
  }).optional(),
  upiQrUrl: z.string().max(1000).trim().optional(),
  defaultPaymentInstructions: z.string().max(1000).trim().optional(),
  defaultBankAccountId: z.string().trim().nullable().optional(),
}).optional();

export const generalPreferencesSchema = z.object({
  currency: z.string().max(10).trim().optional(),
  currencySymbol: z.string().max(5).trim().optional(),
  dateFormat: z.enum(['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY']).optional(),
  timezone: z.string().max(50).trim().optional(),
  taxInclusivePricing: z.boolean().optional(),
  enableStockAlerts: z.boolean().optional(),
}).optional();

export const updateSettingsSchema = z.object({
  invoicePreferences: invoicePreferencesSchema,
  branding: brandingSchema,
  paymentInformation: paymentInformationSchema,
  generalPreferences: generalPreferencesSchema,
});
