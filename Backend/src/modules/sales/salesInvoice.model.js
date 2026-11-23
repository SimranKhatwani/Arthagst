import mongoose from 'mongoose';

export const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    HSN: {
      type: String,
      trim: true,
      default: '',
    },
    SAC: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.0001, 'Quantity must be greater than zero'],
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
    },
    unitName: {
      type: String,
      default: 'PCS',
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    taxableValue: {
      type: Number,
      required: true,
      min: [0, 'Taxable value cannot be negative'],
    },
    gstRate: {
      type: Number,
      required: true,
      min: [0, 'GST rate cannot be negative'],
      default: 18,
    },
    cgst: {
      type: Number,
      default: 0,
      min: 0,
    },
    sgst: {
      type: Number,
      default: 0,
      min: 0,
    },
    igst: {
      type: Number,
      default: 0,
      min: 0,
    },
    cess: {
      type: Number,
      default: 0,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: [0, 'Line total cannot be negative'],
    },
    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: true }
);

const salesInvoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      trim: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: [true, 'Financial year is required'],
      trim: true,
      index: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: [true, 'Party (Customer) reference is required'],
      index: true,
    },
    partyName: {
      type: String,
      required: true,
      trim: true,
    },
    partyGSTIN: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
    },
    partyPAN: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
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
    invoiceDate: {
      type: Date,
      required: [true, 'Invoice date is required'],
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    placeOfSupply: {
      type: String,
      required: [true, 'Place of supply is required'],
      trim: true,
    },
    placeOfSupplyCode: {
      type: String,
      required: [true, 'Place of supply state code is required'],
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
    isExport: {
      type: Boolean,
      default: false,
      index: true,
    },
    exportType: {
      type: String,
      enum: ['WPAY', 'WOPAY', null],
      default: null,
    },
    billingAddress: {
      type: String,
      trim: true,
      default: '',
    },
    shippingAddress: {
      type: String,
      trim: true,
      default: '',
    },
    items: {
      type: [invoiceItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'An invoice must have at least one line item',
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
    invoiceStatus: {
      type: String,
      enum: ['draft', 'posted', 'cancelled'],
      default: 'draft',
      index: true,
    },
    stockDeducted: {
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
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    termsAndConditions: {
      type: String,
      trim: true,
      default: '',
    },
    salesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesOrder',
      default: null,
    },
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
      default: null,
    },
    deliveryChallanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryChallan',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index for invoice number within tenant and financial year
salesInvoiceSchema.index(
  { tenantId: 1, financialYear: 1, invoiceNumber: 1 },
  { unique: true }
);

// Query indexes
salesInvoiceSchema.index({ tenantId: 1, invoiceStatus: 1, invoiceDate: -1 });
salesInvoiceSchema.index({ tenantId: 1, partyId: 1, invoiceDate: -1 });
salesInvoiceSchema.index({ tenantId: 1, warehouseId: 1 });

const SalesInvoice = mongoose.model('SalesInvoice', salesInvoiceSchema);

export default SalesInvoice;
