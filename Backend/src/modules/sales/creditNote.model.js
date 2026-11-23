import mongoose from 'mongoose';

const creditNoteItemSchema = new mongoose.Schema(
  {
    invoiceItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: { type: String, required: true },
    HSN: { type: String, default: '' },
    SAC: { type: String, default: '' },
    returnedQuantity: {
      type: Number,
      required: true,
      min: [0.0001, 'Returned quantity must be greater than zero'],
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
    },
    unitName: { type: String, default: 'PCS' },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxableValue: { type: Number, required: true },
    gstRate: { type: Number, required: true },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cess: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: true }
);

const creditNoteSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    creditNoteNumber: {
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
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesInvoice',
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
      index: true,
    },
    partyName: { type: String, required: true },
    partyGSTIN: { type: String, default: null },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    warehouseName: { type: String, required: true },
    creditNoteDate: { type: Date, default: Date.now },
    reason: {
      type: String,
      enum: ['sales_return', 'post_sale_discount', 'deficiency_in_services', 'correction_in_invoice', 'other'],
      default: 'sales_return',
      required: true,
    },
    placeOfSupply: { type: String, required: true },
    placeOfSupplyCode: { type: String, required: true },
    supplierStateCode: { type: String, required: true },
    isInterState: { type: Boolean, default: false },
    items: [creditNoteItemSchema],
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
      enum: ['draft', 'posted', 'cancelled'],
      default: 'draft',
      index: true,
    },
    stockRestored: {
      type: Boolean,
      default: false,
    },
    postedAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

creditNoteSchema.index(
  { tenantId: 1, financialYear: 1, creditNoteNumber: 1 },
  { unique: true }
);

creditNoteSchema.index({ tenantId: 1, invoiceId: 1 });

const CreditNote = mongoose.model('CreditNote', creditNoteSchema);

export default CreditNote;
