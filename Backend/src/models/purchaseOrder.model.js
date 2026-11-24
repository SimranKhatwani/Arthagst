import mongoose from 'mongoose';

export const purchaseItemSchema = new mongoose.Schema(
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
    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
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

const purchaseOrderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    purchaseOrderNumber: {
      type: String,
      required: [true, 'Purchase order number is required'],
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
      required: [true, 'Party (Supplier) reference is required'],
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
    orderDate: {
      type: Date,
      required: [true, 'Order date is required'],
      default: Date.now,
      index: true,
    },
    expectedDeliveryDate: {
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
    items: {
      type: [purchaseItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A purchase order must have at least one line item',
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
    status: {
      type: String,
      enum: ['draft', 'approved', 'partially_received', 'received', 'cancelled'],
      default: 'draft',
      index: true,
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

purchaseOrderSchema.index(
  { tenantId: 1, financialYear: 1, purchaseOrderNumber: 1 },
  { unique: true }
);

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export default PurchaseOrder;
