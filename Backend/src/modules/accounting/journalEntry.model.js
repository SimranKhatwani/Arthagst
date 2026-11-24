import mongoose from 'mongoose';

export const journalLineSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account ID is required'],
      index: true,
    },
    accountCode: {
      type: String,
      required: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    debit: {
      type: Number,
      default: 0,
      min: [0, 'Debit cannot be negative'],
    },
    credit: {
      type: Number,
      default: 0,
      min: [0, 'Credit cannot be negative'],
    },
    description: {
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
  },
  { _id: true }
);

const journalEntrySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    entryNumber: {
      type: String,
      required: [true, 'Entry number is required'],
      trim: true,
      index: true,
    },
    entryDate: {
      type: Date,
      required: [true, 'Entry date is required'],
      default: Date.now,
      index: true,
    },
    financialYear: {
      type: String,
      required: [true, 'Financial year is required'],
      trim: true,
      index: true,
    },
    narration: {
      type: String,
      required: [true, 'Narration is required'],
      trim: true,
      maxlength: [1000, 'Narration cannot exceed 1000 characters'],
    },
    sourceType: {
      type: String,
      enum: [
        'manual',
        'sales_invoice',
        'purchase_bill',
        'payment_receipt',
        'supplier_payment',
        'expense',
        'credit_note',
        'debit_note',
        'year_end_close',
      ],
      default: 'manual',
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    sourceDocumentNumber: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'posted', 'reversed'],
      default: 'posted',
      index: true,
    },
    lines: {
      type: [journalLineSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 2,
        message: 'A journal entry must contain at least two line items',
      },
    },
    totalDebit: {
      type: Number,
      required: true,
      min: [0.01, 'Total debit must be greater than zero'],
    },
    totalCredit: {
      type: Number,
      required: true,
      min: [0.01, 'Total credit must be greater than zero'],
    },
    reversedAt: {
      type: Date,
      default: null,
    },
    reversalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry',
      default: null,
    },
    reversedFromEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index for entryNumber per tenant & financial year
journalEntrySchema.index(
  { tenantId: 1, financialYear: 1, entryNumber: 1 },
  { unique: true }
);

// Unique index preventing duplicate automatic entries for the same source document
journalEntrySchema.index(
  { tenantId: 1, sourceType: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceId: { $ne: null },
      status: { $ne: 'reversed' },
      sourceType: { $ne: 'manual' },
    },
  }
);

journalEntrySchema.index({ tenantId: 1, entryDate: -1 });

const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);

export default JournalEntry;
