import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      index: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse reference is required'],
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      default: 0,
      min: [0, 'Stock quantity cannot be negative'],
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative'],
    },
    availableQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Available quantity cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: exact stock record per tenant + product + warehouse
inventorySchema.index(
  { tenantId: 1, productId: 1, warehouseId: 1 },
  { unique: true }
);

// Query indexes
inventorySchema.index({ tenantId: 1, warehouseId: 1 });
inventorySchema.index({ tenantId: 1, productId: 1 });

// Ensure availableQuantity is always synchronized before saving
inventorySchema.pre('save', function () {
  this.quantity = Math.round((this.quantity || 0) * 10000) / 10000;
  this.reservedQuantity = Math.round((this.reservedQuantity || 0) * 10000) / 10000;
  this.availableQuantity = Math.round((this.quantity - this.reservedQuantity) * 10000) / 10000;

  if (this.quantity < 0) {
    throw new Error('Stock quantity cannot be negative');
  }
  if (this.availableQuantity < 0) {
    throw new Error('Available stock quantity cannot be negative');
  }
});

const Inventory = mongoose.model('Inventory', inventorySchema);

export default Inventory;
