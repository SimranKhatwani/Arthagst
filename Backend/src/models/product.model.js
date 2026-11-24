import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [200, 'Product name cannot exceed 200 characters'],
      index: true,
    },
    productType: {
      type: String,
      enum: {
        values: ['goods', 'service'],
        message: '{VALUE} is not a valid product type (must be goods or service)',
      },
      default: 'goods',
      required: [true, 'Product type is required'],
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit reference is required'],
      index: true,
    },
    SKU: {
      type: String,
      required: [true, 'SKU is required'],
      uppercase: true,
      trim: true,
      minlength: [1, 'SKU must be at least 1 character'],
      maxlength: [50, 'SKU cannot exceed 50 characters'],
      index: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: null,
      maxlength: [50, 'Barcode cannot exceed 50 characters'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    HSN: {
      type: String,
      trim: true,
      default: null,
    },
    SAC: {
      type: String,
      trim: true,
      default: null,
    },
    gstRate: {
      type: Number,
      required: [true, 'GST rate is required'],
      default: 18,
      min: [0, 'GST rate cannot be negative'],
      max: [100, 'GST rate cannot exceed 100%'],
    },
    cessRate: {
      type: Number,
      default: 0,
      min: [0, 'Cess rate cannot be negative'],
      max: [100, 'Cess rate cannot exceed 100%'],
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: [0, 'Purchase price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      default: 0,
      min: [0, 'Selling price cannot be negative'],
    },
    mrp: {
      type: Number,
      default: 0,
      min: [0, 'MRP cannot be negative'],
    },
    openingStock: {
      type: Number,
      default: 0,
      min: [0, 'Opening stock cannot be negative'],
    },
    lowStockAlert: {
      type: Number,
      default: 0,
      min: [0, 'Low stock alert threshold cannot be negative'],
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },
    images: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for tenant-scoped operations
productSchema.index({ tenantId: 1, SKU: 1, isDeleted: 1 });
productSchema.index({ tenantId: 1, barcode: 1, isDeleted: 1 });
productSchema.index({ tenantId: 1, name: 1, isDeleted: 1 });
productSchema.index({ tenantId: 1, categoryId: 1, isDeleted: 1 });
productSchema.index({ tenantId: 1, productType: 1, isDeleted: 1 });
productSchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });

// Pre-save normalization and business rules hook
productSchema.pre('save', function () {
  // Normalize string fields
  if (this.SKU) this.SKU = this.SKU.toUpperCase().trim();
  if (this.barcode) this.barcode = this.barcode.trim();
  if (this.HSN) this.HSN = this.HSN.trim();
  if (this.SAC) this.SAC = this.SAC.trim();

  // Store monetary & tax values consistently with 2 decimal precision
  this.purchasePrice = Number(Number(this.purchasePrice || 0).toFixed(2));
  this.sellingPrice = Number(Number(this.sellingPrice || 0).toFixed(2));
  this.mrp = Number(Number(this.mrp || 0).toFixed(2));
  this.gstRate = Number(Number(this.gstRate || 0).toFixed(2));
  this.cessRate = Number(Number(this.cessRate || 0).toFixed(2));
  this.openingStock = Number(Number(this.openingStock || 0).toFixed(2));
  this.lowStockAlert = Number(Number(this.lowStockAlert || 0).toFixed(2));

  // Services cannot have stock or inventory tracking
  if (this.productType === 'service') {
    this.openingStock = 0;
    this.trackInventory = false;
  }
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
export { Product };
