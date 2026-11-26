import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    warehouseName: {
      type: String,
      required: [true, 'Warehouse name is required'],
      trim: true,
      minlength: [2, 'Warehouse name must be at least 2 characters'],
      maxlength: [100, 'Warehouse name cannot exceed 100 characters'],
      index: true,
    },
    warehouseCode: {
      type: String,
      required: [true, 'Warehouse code is required'],
      uppercase: true,
      trim: true,
      minlength: [1, 'Warehouse code must be at least 1 character'],
      maxlength: [50, 'Warehouse code cannot exceed 50 characters'],
      index: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },
    city: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    state: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'State cannot exceed 100 characters'],
    },
    pincode: {
      type: String,
      trim: true,
      default: '',
      maxlength: [10, 'Pincode cannot exceed 10 characters'],
    },
    manager: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Manager name cannot exceed 100 characters'],
    },
    capacity: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Capacity cannot exceed 100 characters'],
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
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
  }
);

// Compound index to guarantee warehouse code uniqueness within tenant for active records
warehouseSchema.index(
  { tenantId: 1, warehouseCode: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Compound index for querying tenant warehouses
warehouseSchema.index({ tenantId: 1, isDeleted: 1, isActive: 1 });

const Warehouse = mongoose.model('Warehouse', warehouseSchema);

export default Warehouse;
