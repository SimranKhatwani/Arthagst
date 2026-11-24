import mongoose from 'mongoose';

export const MOVEMENT_TYPES = [
  'opening_stock',
  'stock_in',
  'stock_out',
  'adjustment',
  'transfer_in',
  'transfer_out',
  'sales',
  'purchase',
  'sales_return',
  'purchase_return',
];

const stockMovementSchema = new mongoose.Schema(
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
      required: [true, 'Product ID is required'],
      index: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse ID is required'],
      index: true,
    },
    movementType: {
      type: String,
      required: [true, 'Movement type is required'],
      enum: {
        values: MOVEMENT_TYPES,
        message: '{VALUE} is not a valid movement type',
      },
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
    },
    referenceType: {
      type: String,
      default: 'manual',
      trim: true,
      index: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    previousStock: {
      type: Number,
      required: [true, 'Previous stock is required'],
    },
    newStock: {
      type: Number,
      required: [true, 'New stock is required'],
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Remarks cannot exceed 500 characters'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only movement history
  }
);

// Query indexes for auditing and history
stockMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, warehouseId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, movementType: 1, createdAt: -1 });

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);

export default StockMovement;
