import mongoose from 'mongoose';
import { invoiceItemSchema } from './salesInvoice.model.js';

const deliveryChallanSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    challanNumber: {
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
    salesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesOrder',
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
    challanDate: { type: Date, default: Date.now },
    challanType: {
      type: String,
      enum: ['supply_on_approval', 'job_work', 'for_reasons_other_than_supply', 'others'],
      default: 'supply_on_approval',
    },
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
      enum: ['draft', 'dispatched', 'delivered', 'converted_to_invoice', 'cancelled'],
      default: 'draft',
      index: true,
    },
    convertedToInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesInvoice',
      default: null,
    },
    vehicleNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

deliveryChallanSchema.index(
  { tenantId: 1, financialYear: 1, challanNumber: 1 },
  { unique: true }
);

const DeliveryChallan = mongoose.model('DeliveryChallan', deliveryChallanSchema);

export default DeliveryChallan;
