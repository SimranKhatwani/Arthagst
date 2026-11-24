import { z } from 'zod';

export const salesItemInputSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .trim()
    .min(1, 'Product ID is required'),
  quantity: z.coerce
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity must be greater than zero'),
  unitPrice: z.coerce
    .number({ invalid_type_error: 'Unit price must be a number' })
    .min(0, 'Unit price cannot be negative')
    .optional(),
  discount: z.coerce
    .number({ invalid_type_error: 'Discount must be a number' })
    .min(0, 'Discount cannot be negative')
    .optional()
    .default(0),
  description: z.string().trim().max(1000).optional().default(''),
});

export const createSalesInvoiceSchema = z.object({
  partyId: z
    .string({ required_error: 'Party ID (Customer) is required' })
    .trim()
    .min(1, 'Party ID is required'),
  warehouseId: z
    .string({ required_error: 'Warehouse ID is required' })
    .trim()
    .min(1, 'Warehouse ID is required'),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  placeOfSupply: z.string().trim().optional(),
  isExport: z.boolean().optional().default(false),
  exportType: z.enum(['WPAY', 'WOPAY']).optional().nullable(),
  billingAddress: z.string().trim().optional(),
  shippingAddress: z.string().trim().optional(),
  items: z
    .array(salesItemInputSchema)
    .min(1, 'At least one line item is required for an invoice'),
  paidAmount: z.coerce.number().min(0).optional().default(0),
  notes: z.string().trim().max(1000).optional().default(''),
  termsAndConditions: z.string().trim().max(2000).optional().default(''),
});

export const updateSalesInvoiceSchema = z.object({
  partyId: z.string().trim().min(1).optional(),
  warehouseId: z.string().trim().min(1).optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  placeOfSupply: z.string().trim().optional(),
  isExport: z.boolean().optional().default(false),
  exportType: z.enum(['WPAY', 'WOPAY']).optional().nullable(),
  billingAddress: z.string().trim().optional(),
  shippingAddress: z.string().trim().optional(),
  items: z.array(salesItemInputSchema).min(1).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
  termsAndConditions: z.string().trim().max(2000).optional(),
});

export const cancelInvoiceSchema = z.object({
  cancellationReason: z
    .string({ required_error: 'Cancellation reason is required' })
    .trim()
    .min(2, 'Please provide a valid cancellation reason')
    .max(500, 'Cancellation reason cannot exceed 500 characters'),
});

export const createQuotationSchema = z.object({
  partyId: z.string({ required_error: 'Party ID is required' }).trim().min(1),
  warehouseId: z.string({ required_error: 'Warehouse ID is required' }).trim().min(1),
  quotationDate: z.string().optional(),
  validUntil: z.string().optional().nullable(),
  placeOfSupply: z.string().trim().optional(),
  isExport: z.boolean().optional().default(false),
  exportType: z.enum(['WPAY', 'WOPAY']).optional().nullable(),
  billingAddress: z.string().trim().optional(),
  shippingAddress: z.string().trim().optional(),
  items: z.array(salesItemInputSchema).min(1),
  notes: z.string().trim().max(1000).optional().default(''),
  termsAndConditions: z.string().trim().max(2000).optional().default(''),
});

export const createSalesOrderSchema = z.object({
  partyId: z.string({ required_error: 'Party ID is required' }).trim().min(1),
  warehouseId: z.string({ required_error: 'Warehouse ID is required' }).trim().min(1),
  quotationId: z.string().trim().optional().nullable(),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional().nullable(),
  placeOfSupply: z.string().trim().optional(),
  isExport: z.boolean().optional().default(false),
  exportType: z.enum(['WPAY', 'WOPAY']).optional().nullable(),
  billingAddress: z.string().trim().optional(),
  shippingAddress: z.string().trim().optional(),
  items: z.array(salesItemInputSchema).min(1),
  notes: z.string().trim().max(1000).optional().default(''),
  termsAndConditions: z.string().trim().max(2000).optional().default(''),
});

export const createDeliveryChallanSchema = z.object({
  partyId: z.string({ required_error: 'Party ID is required' }).trim().min(1),
  warehouseId: z.string({ required_error: 'Warehouse ID is required' }).trim().min(1),
  salesOrderId: z.string().trim().optional().nullable(),
  challanDate: z.string().optional(),
  challanType: z
    .enum(['supply_on_approval', 'job_work', 'for_reasons_other_than_supply', 'others'])
    .optional()
    .default('supply_on_approval'),
  vehicleNumber: z.string().trim().optional().default(''),
  placeOfSupply: z.string().trim().optional(),
  isExport: z.boolean().optional().default(false),
  exportType: z.enum(['WPAY', 'WOPAY']).optional().nullable(),
  billingAddress: z.string().trim().optional(),
  shippingAddress: z.string().trim().optional(),
  items: z.array(salesItemInputSchema).min(1),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const returnItemInputSchema = z.object({
  invoiceItemId: z.string({ required_error: 'Invoice item ID is required' }).trim().min(1),
  returnedQuantity: z.coerce.number().positive('Returned quantity must be greater than zero'),
});

export const createSalesReturnSchema = z.object({
  reason: z
    .enum(['sales_return', 'post_sale_discount', 'deficiency_in_services', 'correction_in_invoice', 'other'])
    .default('sales_return'),
  items: z.array(returnItemInputSchema).min(1, 'At least one return item must be specified'),
  remarks: z.string().trim().max(500).optional().default('Sales return'),
});

export const querySalesDocumentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  partyId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  paymentStatus: z.enum(['unpaid', 'partially_paid', 'paid']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export default {
  createSalesInvoiceSchema,
  updateSalesInvoiceSchema,
  cancelInvoiceSchema,
  createQuotationSchema,
  createSalesOrderSchema,
  createDeliveryChallanSchema,
  createSalesReturnSchema,
  querySalesDocumentsSchema,
};
