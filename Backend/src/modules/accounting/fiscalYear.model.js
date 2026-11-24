import mongoose from 'mongoose';

const fiscalYearSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isClosed: {
      type: Boolean,
      default: false,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    closingEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry',
      default: null,
    },
    netProfitOrLoss: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

fiscalYearSchema.index(
  { tenantId: 1, financialYear: 1 },
  { unique: true }
);

const FiscalYear = mongoose.model('FiscalYear', fiscalYearSchema);

export default FiscalYear;
