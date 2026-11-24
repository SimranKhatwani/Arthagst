import mongoose from 'mongoose';

const journalSequenceSchema = new mongoose.Schema(
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

journalSequenceSchema.index(
  { tenantId: 1, financialYear: 1 },
  { unique: true }
);

const JournalSequence = mongoose.model('JournalSequence', journalSequenceSchema);

export default JournalSequence;
