import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    accountName: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      minlength: [2, 'Account name must be at least 2 characters'],
      maxlength: [100, 'Account name cannot exceed 100 characters'],
    },
    accountType: {
      type: String,
      enum: {
        values: ['cash', 'bank', 'UPI', 'credit_card', 'other'],
        message: '{VALUE} is not a valid account type',
      },
      default: 'bank',
      required: [true, 'Account type is required'],
      index: true,
    },
    bankName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Bank name cannot exceed 100 characters'],
    },
    accountHolderName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Account holder name cannot exceed 100 characters'],
    },
    accountNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: [50, 'Account number cannot exceed 50 characters'],
    },
    IFSC: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$|^$/, 'Invalid Indian IFSC code format (e.g. HDFC0001234)'],
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    currentBalance: {
      type: Number,
      default: 0,
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
    toJSON: {
      transform: (doc, ret) => {
        // Mask account number for security: show only the last 4 digits (e.g. "********1234")
        if (ret.accountNumber && ret.accountNumber.length > 4) {
          const visible = ret.accountNumber.slice(-4);
          ret.accountNumber = '*'.repeat(Math.max(4, ret.accountNumber.length - 4)) + visible;
        }
        return ret;
      },
    },
  }
);

// Compound index for querying accounts per tenant
bankAccountSchema.index({ tenantId: 1, isDeleted: 1, isActive: 1 });

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

export default BankAccount;
