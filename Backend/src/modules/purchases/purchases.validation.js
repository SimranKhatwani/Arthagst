import { z } from 'zod';

export const purchaseItemInputSchema = z.object({
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

export const createPurchaseOrderSchema = z.object({
  partyId: z.string({ required_error: 'Supplier party ID is required' }).trim().min(1),
  warehouseId: z.string({ required_error: 'Warehouse ID is required' }).trim().min(1),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional().nullable(),
  placeOfSupply: z.string().trim().optional(),
  items: z.array(purchaseItemInputSchema).min(1, 'At least one line item is required'),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const updatePurchaseOrderSchema = z.object({
  partyId: z.string().trim().min(1).optional(),
  warehouseId: z.string().trim().min(1).optional(),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional().nullable(),
  placeOfSupply: z.string().trim().optional(),
  items: z.array(purchaseItemInputSchema).min(1).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const grnItemInputSchema = z.object({
  productId: z.string({ required_error: 'Product ID is required' }).trim().min(1),
  receivedQuantity: z.coerce.number().positive('Received quantity must be greater than zero'),
  acceptedQuantity: z.coerce.number().min(0, 'Accepted quantity cannot be negative'),
  rejectedQuantity: z.coerce.number().min(0).optional().default(0),
  remarks: z.string().trim().max(500).optional().default(''),
});

export const createGRNSchema = z.object({
  purchaseOrderId: z.string().trim().optional().nullable(),
  supplierId: z.string({ required_error: 'Supplier ID is required' }).trim().min(1),
  warehouseId: z.string({ required_error: 'Warehouse ID is required' }).trim().min(1),
  receiptDate: z.string().optional(),
  supplierChallanNumber: z.string().trim().optional().default(''),
  receivedBy: z.string().trim().optional().default(''),
  remarks: z.string().trim().max(1000).optional().default(''),
  items: z.array(grnItemInputSchema).min(1, 'At least one received item is required'),
});

export const createPurchaseBillSchema = z.object({
  supplierId: z.string({ required_error: 'Supplier ID is required' }).trim().min(1),
  supplierInvoiceNumber: z
    .string({ required_error: 'Supplier invoice/bill number is required' })
    .trim()
    .min(1, 'Supplier invoice number is required'),
  purchaseOrderId: z.string().trim().optional().nullable(),
  grnIds: z.array(z.string().trim()).optional().default([]),
  warehouseId: z.string({ required_error: 'Warehouse ID is required' }).trim().min(1),
  billDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  placeOfSupply: z.string().trim().optional(),
  isReverseCharge: z.boolean().optional().default(false),
  items: z.array(purchaseItemInputSchema).min(1, 'At least one line item is required'),
  paidAmount: z.coerce.number().min(0).optional().default(0),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const updatePurchaseBillSchema = z.object({
  supplierId: z.string().trim().min(1).optional(),
  supplierInvoiceNumber: z.string().trim().min(1).optional(),
  warehouseId: z.string().trim().min(1).optional(),
  billDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  placeOfSupply: z.string().trim().optional(),
  isReverseCharge: z.boolean().optional(),
  items: z.array(purchaseItemInputSchema).min(1).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const returnItemInputSchema = z.object({
  billItemId: z.string({ required_error: 'Bill item ID is required' }).trim().min(1),
  returnedQuantity: z.coerce.number().positive('Returned quantity must be greater than zero'),
});

export const createPurchaseReturnSchema = z.object({
  billId: z.string({ required_error: 'Bill ID is required' }).trim().min(1),
  reason: z
    .enum(['purchase_return', 'deficiency_in_goods', 'rate_difference', 'discount_after_sale', 'other'])
    .default('purchase_return'),
  items: z.array(returnItemInputSchema).min(1, 'At least one return item must be specified'),
  remarks: z.string().trim().max(500).optional().default('Purchase return / Debit note'),
});

export const queryPurchasesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  paymentStatus: z.enum(['unpaid', 'partially_paid', 'paid']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export default {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  createGRNSchema,
  createPurchaseBillSchema,
  updatePurchaseBillSchema,
  createPurchaseReturnSchema,
  queryPurchasesSchema,
};
