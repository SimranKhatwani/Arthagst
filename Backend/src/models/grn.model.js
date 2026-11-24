import mongoose from 'mongoose';

const grnItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: { type: String, required: true },
    orderedQuantity: { type: Number, default: 0 },
    receivedQuantity: {
      type: Number,
      required: true,
      min: [0.0001, 'Received quantity must be greater than zero'],
    },
    acceptedQuantity: {
      type: Number,
      required: true,
      min: [0, 'Accepted quantity cannot be negative'],
    },
    rejectedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Rejected quantity cannot be negative'],
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
    },
    unitName: { type: String, default: 'PCS' },
    unitPrice: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
  },
  { _id: true }
);

const grnSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    grnNumber: {
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
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
      index: true,
    },
    supplierName: { type: String, required: true },
    supplierGSTIN: { type: String, default: null },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    warehouseName: { type: String, required: true },
    receiptDate: { type: Date, default: Date.now },
    supplierChallanNumber: { type: String, default: '' },
    items: [grnItemSchema],
    receivedBy: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'posted', 'cancelled'],
      default: 'draft',
      index: true,
    },
    stockUpdated: {
      type: Boolean,
      default: false,
    },
    postedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

grnSchema.index(
  { tenantId: 1, financialYear: 1, grnNumber: 1 },
  { unique: true }
);

const GRN = mongoose.model('GRN', grnSchema);

export default GRN;
