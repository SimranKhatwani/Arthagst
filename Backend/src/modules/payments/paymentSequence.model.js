import mongoose from 'mongoose';

const paymentSequenceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    direction: {
      type: String,
      required: true,
      enum: ['in', 'out'],
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

paymentSequenceSchema.index(
  { tenantId: 1, direction: 1, financialYear: 1 },
  { unique: true }
);

const PaymentSequence = mongoose.model('PaymentSequence', paymentSequenceSchema);

export default PaymentSequence;
