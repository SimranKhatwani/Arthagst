import mongoose from 'mongoose';

const expenseSequenceSchema = new mongoose.Schema(
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
      index: true,
    },
    sequence: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

expenseSequenceSchema.index(
  { tenantId: 1, financialYear: 1 },
  { unique: true }
);

const ExpenseSequence = mongoose.model('ExpenseSequence', expenseSequenceSchema);

export default ExpenseSequence;
