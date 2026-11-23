import mongoose from 'mongoose';

const purchaseSequenceSchema = new mongoose.Schema(
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
      enum: ['purchase_order', 'grn', 'bill', 'debit_note'],
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

purchaseSequenceSchema.index(
  { tenantId: 1, documentType: 1, financialYear: 1 },
  { unique: true }
);

const PurchaseSequence = mongoose.model('PurchaseSequence', purchaseSequenceSchema);

export default PurchaseSequence;
