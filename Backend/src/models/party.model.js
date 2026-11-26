import mongoose from 'mongoose';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const partySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    partyType: {
      type: String,
      enum: {
        values: ['customer', 'supplier', 'both'],
        message: '{VALUE} is not a valid party type (must be customer, supplier, or both)',
      },
      required: [true, 'Party type is required'],
      default: 'customer',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Party name is required'],
      trim: true,
      minlength: [2, 'Party name must be at least 2 characters'],
      maxlength: [200, 'Party name cannot exceed 200 characters'],
      index: true,
    },
    businessName: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[6-9]\d{9}$/.test(v);
        },
        message: 'Phone number must be a valid 10-digit mobile number',
      },
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[6-9]\d{9}$/.test(v);
        },
        message: 'Alternate phone must be a valid 10-digit mobile number',
      },
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional
          return EMAIL_REGEX.test(v);
        },
        message: 'Invalid email address format',
      },
    },
    GSTIN: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional
          return GSTIN_REGEX.test(v);
        },
        message: 'Invalid Indian GSTIN format (e.g. 27AAPFU0939F1ZV)',
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
    openingBalance: {
      type: Number,
      default: 0,
      min: [0, 'Opening balance cannot be negative'],
    },
    balanceType: {
      type: String,
      enum: {
        values: ['receivable', 'payable', 'none'],
        message: '{VALUE} is not a valid balance type',
      },
      default: 'none',
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: [0, 'Credit limit cannot be negative'],
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: 'Net 15',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
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

// Compound indexes for fast tenant-scoped queries
partySchema.index({ tenantId: 1, name: 1, isDeleted: 1 });
partySchema.index({ tenantId: 1, phone: 1, isDeleted: 1 });
partySchema.index({ tenantId: 1, GSTIN: 1, isDeleted: 1 });
partySchema.index({ tenantId: 1, partyType: 1, isDeleted: 1 });
partySchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });

// Pre-save normalization hook
partySchema.pre('save', function () {
  // Normalize string fields
  if (this.name) this.name = this.name.trim();
  if (this.businessName) this.businessName = this.businessName.trim();
  if (!this.businessName && this.name) this.businessName = this.name;
  if (this.email) this.email = this.email.toLowerCase().trim();
  if (this.phone) this.phone = this.phone.trim();
  if (this.alternatePhone) this.alternatePhone = this.alternatePhone.trim();
  if (!this.shippingAddress && this.billingAddress) {
    this.shippingAddress = this.billingAddress;
  }

  // Normalize GSTIN & derive PAN
  if (this.GSTIN) {
    this.GSTIN = this.GSTIN.toUpperCase().trim();
    if (!this.PAN && this.GSTIN.length === 15) {
      this.PAN = this.GSTIN.substring(2, 12);
    }
  }
  if (this.PAN) {
    this.PAN = this.PAN.toUpperCase().trim();
  }

  // Ensure balanceType is consistent with openingBalance
  if (this.openingBalance === 0) {
    this.balanceType = 'none';
  } else if (this.openingBalance > 0 && this.balanceType === 'none') {
    this.balanceType = this.partyType === 'supplier' ? 'payable' : 'receivable';
  }
});

const Party = mongoose.models.Party || mongoose.model('Party', partySchema);

export default Party;
export { Party };
