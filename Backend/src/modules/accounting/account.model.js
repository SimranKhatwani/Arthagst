import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
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
      maxlength: [100, 'Account name cannot exceed 100 characters'],
    },
    accountCode: {
      type: String,
      required: [true, 'Account code is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    accountType: {
      type: String,
      enum: {
        values: ['asset', 'liability', 'equity', 'income', 'expense'],
        message: '{VALUE} is not a valid account type',
      },
      required: [true, 'Account type is required'],
      index: true,
    },
    accountSubType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    parentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    balanceType: {
      type: String,
      enum: ['debit', 'credit'],
      required: [true, 'Balance type (debit/credit) is required'],
    },
    isSystemAccount: {
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
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
  },
  { timestamps: true }
);

// Unique index for accountCode per tenant among non-deleted accounts
accountSchema.index(
  { tenantId: 1, accountCode: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

accountSchema.index({ tenantId: 1, accountType: 1 });

const Account = mongoose.model('Account', accountSchema);

export default Account;
