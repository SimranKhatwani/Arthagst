import mongoose from 'mongoose';

export const TRANSACTION_TYPES = [
  'deposit',
  'withdrawal',
  'transfer_in',
  'transfer_out',
];

const bankTransactionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      required: [true, 'Bank Account ID is required'],
      index: true,
    },
    transactionType: {
      type: String,
      enum: {
        values: TRANSACTION_TYPES,
        message: '{VALUE} is not a valid transaction type',
      },
      required: [true, 'Transaction type is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after transaction is required'],
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      required: [true, 'Transaction date is required'],
      index: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    fromAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null,
    },
    toAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

bankTransactionSchema.index({ tenantId: 1, bankAccountId: 1, transactionDate: -1 });

const BankTransaction = mongoose.model('BankTransaction', bankTransactionSchema);

export default BankTransaction;
