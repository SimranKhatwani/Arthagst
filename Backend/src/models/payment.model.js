import mongoose from 'mongoose';

export const paymentAllocationSchema = new mongoose.Schema(
  {
    salesInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesInvoice',
      default: null,
    },
    purchaseBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseBill',
      default: null,
    },
    documentNumber: {
      type: String,
      required: true,
      trim: true,
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: [0.01, 'Allocated amount must be at least 0.01'],
    },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    paymentNumber: {
      type: String,
      required: [true, 'Payment number is required'],
      trim: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: [true, 'Financial year is required'],
      trim: true,
      index: true,
    },
    direction: {
      type: String,
      enum: {
        values: ['in', 'out'],
        message: "Direction must be either 'in' (Receipt) or 'out' (Payment)",
      },
      required: [true, 'Payment direction is required'],
      index: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
      index: true,
    },
    partyName: {
      type: String,
      trim: true,
      default: '',
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Payment amount must be greater than zero'],
    },
    unallocatedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Unallocated amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['cash', 'bank', 'UPI', 'cheque', 'card', 'other'],
        message: '{VALUE} is not a valid payment method',
      },
      default: 'bank',
      required: [true, 'Payment method is required'],
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
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Reference number cannot exceed 100 characters'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: ['completed', 'cancelled'],
      default: 'completed',
      index: true,
    },
    allocations: {
      type: [paymentAllocationSchema],
      default: [],
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

// Unique index for payment number per tenant and financial year
paymentSchema.index(
  { tenantId: 1, financialYear: 1, paymentNumber: 1 },
  { unique: true }
);

paymentSchema.index({ tenantId: 1, direction: 1, paymentDate: -1 });
paymentSchema.index({ tenantId: 1, partyId: 1, paymentDate: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
