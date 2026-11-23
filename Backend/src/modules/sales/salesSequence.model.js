import mongoose from 'mongoose';

/**
 * Atomic document numbering sequence model per tenant, financial year, and document type
 */
const salesSequenceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      enum: ['invoice', 'quotation', 'order', 'challan', 'credit_note'],
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

salesSequenceSchema.index(
  { tenantId: 1, documentType: 1, financialYear: 1 },
  { unique: true }
);

const SalesSequence = mongoose.model('SalesSequence', salesSequenceSchema);

export default SalesSequence;
