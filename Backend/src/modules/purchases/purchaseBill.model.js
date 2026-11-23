import mongoose from 'mongoose';
import { purchaseItemSchema } from './purchaseOrder.model.js';

const purchaseBillSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    billNumber: {
      type: String,
      required: [true, 'Bill number is required'],
      trim: true,
      index: true,
    },
    supplierInvoiceNumber: {
      type: String,
      required: [true, 'Supplier invoice/bill number is required'],
      trim: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: [true, 'Financial year is required'],
      trim: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: [true, 'Supplier party is required'],
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    supplierGSTIN: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },
    supplierPAN: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
    },
    grnIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'GRN',
        },
      ],
      default: [],
    },
    billDate: {
      type: Date,
      required: [true, 'Bill date is required'],
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    placeOfSupply: {
      type: String,
      required: true,
      trim: true,
    },
    placeOfSupplyCode: {
      type: String,
      required: true,
      trim: true,
    },
    supplierStateCode: {
      type: String,
      required: true,
      trim: true,
    },
    isInterState: {
      type: Boolean,
      required: true,
      default: false,
    },
    isReverseCharge: {
      type: Boolean,
      default: false,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse reference is required'],
      index: true,
    },
    warehouseName: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [purchaseItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A purchase bill must have at least one line item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discountTotal: {
      type: Number,
      default: 0,
    },
    taxableAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    cgstTotal: {
      type: Number,
      default: 0,
    },
    sgstTotal: {
      type: Number,
      default: 0,
    },
    igstTotal: {
      type: Number,
      default: 0,
    },
    cessTotal: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },
    balanceAmount: {
      type: Number,
      default: 0,
      min: [0, 'Balance amount cannot be negative'],
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid'],
      default: 'unpaid',
      index: true,
    },
    billStatus: {
      type: String,
      enum: ['draft', 'posted', 'cancelled'],
      default: 'draft',
      index: true,
    },
    stockAdded: {
      type: Boolean,
      default: false,
    },
    postedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

purchaseBillSchema.index(
  { tenantId: 1, financialYear: 1, billNumber: 1 },
  { unique: true }
);

purchaseBillSchema.index({ tenantId: 1, supplierId: 1 });
purchaseBillSchema.index({ tenantId: 1, billStatus: 1 });

const PurchaseBill = mongoose.model('PurchaseBill', purchaseBillSchema);

export default PurchaseBill;
