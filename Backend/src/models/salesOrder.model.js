import mongoose from 'mongoose';
import { invoiceItemSchema } from './salesInvoice.model.js';

const salesOrderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
      default: null,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
      index: true,
    },
    partyName: { type: String, required: true },
    partyGSTIN: { type: String, default: null },
    partyPAN: { type: String, default: null },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    warehouseName: { type: String, required: true },
    orderDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date, default: null },
    placeOfSupply: { type: String, required: true },
    placeOfSupplyCode: { type: String, required: true },
    supplierStateCode: { type: String, required: true },
    isInterState: { type: Boolean, default: false },
    billingAddress: { type: String, default: '' },
    shippingAddress: { type: String, default: '' },
    items: [invoiceItemSchema],
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    cessTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'partially_invoiced', 'converted_to_invoice', 'cancelled'],
      default: 'draft',
      index: true,
    },
    convertedToInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesInvoice',
      default: null,
    },
    notes: { type: String, default: '' },
    termsAndConditions: { type: String, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

salesOrderSchema.index(
  { tenantId: 1, financialYear: 1, orderNumber: 1 },
  { unique: true }
);

const SalesOrder = mongoose.model('SalesOrder', salesOrderSchema);

export default SalesOrder;
