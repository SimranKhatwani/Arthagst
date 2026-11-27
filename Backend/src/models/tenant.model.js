import crypto from 'crypto';
import mongoose from 'mongoose';
import { validateGSTIN } from '../utils/gstinValidator.js';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const tenantSchema = new mongoose.Schema(
  {
    tenantCode: {
      type: String,
      required: [true, 'Tenant code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Tenant code must be at least 3 characters'],
      maxlength: [20, 'Tenant code cannot exceed 20 characters'],
      index: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      minlength: [2, 'Business name must be at least 2 characters'],
      maxlength: [200, 'Business name cannot exceed 200 characters'],
    },
    businessType: {
      type: String,
      trim: true,
      default: 'Wholesale & Retail',
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
      minlength: [2, 'Owner name must be at least 2 characters'],
      maxlength: [100, 'Owner name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Business email is required'],
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return false;
          return /^[6-9]\d{9}$/.test(v);
        },
        message: 'Phone number must be a valid 10-digit mobile number',
      },
    },
    GSTIN: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional for businesses not registered for GST
          return validateGSTIN(v).isValid;
        },
        message: function (props) {
          const res = validateGSTIN(props.value);
          return res.error || 'Invalid Indian GSTIN format (e.g. 27AAPFU0939F1ZV)';
        },
      },
    },
    PAN: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional
          return PAN_REGEX.test(v);
        },
        message: 'Invalid Indian PAN format (e.g. AAPFU0939F)',
      },
    },
    businessAddress: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    stateCode: {
      type: String,
      trim: true,
      default: '',
      match: [/^[0-9]{2}$|^$/, 'State code must be 2 digits (e.g. 27, 08)'],
    },
    pincode: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    financialYearStart: {
      type: String,
      trim: true,
      default: '04-01',
    },
    subscriptionStatus: {
      type: String,
      enum: {
        values: ['trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired'],
        message: '{VALUE} is not a valid subscription status',
      },
      default: 'trial',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Indexes
tenantSchema.index({ GSTIN: 1 }, { sparse: true });
tenantSchema.index({ PAN: 1 }, { sparse: true });
tenantSchema.index({ businessName: 1 });

// Static method to generate unique tenantCode
tenantSchema.statics.generateUniqueTenantCode = async function (prefix = 'AGST') {
  let code;
  let exists = true;
  while (exists) {
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    code = `${prefix}-${randomPart}`;
    exists = await this.exists({ tenantCode: code });
  }
  return code;
};

// Pre-save normalization: derive PAN from GSTIN if PAN not provided, trim and format
tenantSchema.pre('save', function () {
  if (this.tenantCode) {
    this.tenantCode = this.tenantCode.toUpperCase().trim();
  }
  if (this.GSTIN) {
    this.GSTIN = this.GSTIN.toUpperCase().trim();
    if (!this.PAN && this.GSTIN.length === 15) {
      this.PAN = this.GSTIN.substring(2, 12);
    }
  }
  if (this.PAN) {
    this.PAN = this.PAN.toUpperCase().trim();
  }
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
});

const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);

export default Tenant;
export { Tenant };
