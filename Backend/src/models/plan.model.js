import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      maxlength: [100, 'Plan name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Plan code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    billingCycle: {
      type: String,
      enum: {
        values: ['monthly', 'quarterly', 'yearly'],
        message: '{VALUE} is not a valid billing cycle',
      },
      default: 'monthly',
      required: true,
    },
    trialDays: {
      type: Number,
      default: 14,
      min: [0, 'Trial days cannot be negative'],
    },
    limits: {
      maxUsers: {
        type: Number,
        default: 2, // -1 means unlimited
      },
      maxProducts: {
        type: Number,
        default: 100, // -1 means unlimited
      },
      maxInvoices: {
        type: Number,
        default: 50, // per billing cycle, -1 means unlimited
      },
      maxWarehouses: {
        type: Number,
        default: 1, // -1 means unlimited
      },
      storageLimit: {
        type: Number,
        default: 1024, // in Megabytes, -1 means unlimited
      },
    },
    features: {
      type: [String],
      default: ['inventory', 'gst_returns', 'reports', 'banking', 'expenses'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },
    isTrial: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);

export default Plan;
export { Plan };
