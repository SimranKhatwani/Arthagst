import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    expenseNumber: {
      type: String,
      required: [true, 'Expense number is required'],
      trim: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: [true, 'Financial year is required'],
      trim: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: [true, 'Expense category is required'],
      index: true,
    },
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },
    expenseDate: {
      type: Date,
      required: [true, 'Expense date is required'],
      default: Date.now,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [0.01, 'Expense amount must be greater than zero'],
    },
    taxableAmount: {
      type: Number,
      default: 0,
      min: [0, 'Taxable amount cannot be negative'],
    },
    gstRate: {
      type: Number,
      default: 0,
      min: [0, 'GST rate cannot be negative'],
    },
    cgst: {
      type: Number,
      default: 0,
      min: [0, 'CGST cannot be negative'],
    },
    sgst: {
      type: Number,
      default: 0,
      min: [0, 'SGST cannot be negative'],
    },
    igst: {
      type: Number,
      default: 0,
      min: [0, 'IGST cannot be negative'],
    },
    cess: {
      type: Number,
      default: 0,
      min: [0, 'Cess cannot be negative'],
    },
    isGSTApplicable: {
      type: Boolean,
      default: false,
    },
    isITCClaimable: {
      type: Boolean,
      default: false,
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['cash', 'bank', 'UPI', 'cheque', 'card', 'other'],
        message: '{VALUE} is not a valid payment method',
      },
      default: 'cash',
      index: true,
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null,
      index: true,
    },
    bankAccountName: {
      type: String,
      trim: true,
      default: '',
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
      index: true,
    },
    payeeName: {
      type: String,
      trim: true,
      default: '',
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Reference number cannot exceed 100 characters'],
    },
    receiptUrl: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: ['paid', 'cancelled'],
      default: 'paid',
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index for expense sequence
expenseSchema.index(
  { tenantId: 1, financialYear: 1, expenseNumber: 1 },
  { unique: true }
);

expenseSchema.index({ tenantId: 1, categoryId: 1, expenseDate: -1 });
expenseSchema.index({ tenantId: 1, expenseDate: -1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
