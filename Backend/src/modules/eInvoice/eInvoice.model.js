import mongoose from 'mongoose';

const eInvoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    salesInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesInvoice',
      required: [true, 'Sales Invoice ID is required'],
      index: true,
    },
    GSTIN: {
      type: String,
      required: [true, 'Supplier GSTIN is required'],
      trim: true,
      uppercase: true,
    },
    recipientGSTIN: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'URP',
    },
    documentNumber: {
      type: String,
      required: [true, 'Document number is required'],
      trim: true,
    },
    documentDate: {
      type: Date,
      required: [true, 'Document date is required'],
    },
    documentType: {
      type: String,
      enum: ['INV', 'CRN', 'DBN'],
      default: 'INV',
    },
    IRN: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    acknowledgementNumber: {
      type: String,
      trim: true,
      default: null,
    },
    acknowledgementDate: {
      type: Date,
      default: null,
    },
    signedQRCode: {
      type: String,
      trim: true,
      default: null,
    },
    signedInvoice: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'generated', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    cancellationReason: {
      type: String,
      enum: ['1', '2', '3', '4', null],
      default: null,
    },
    cancellationRemarks: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Cancellation remarks cannot exceed 100 characters'],
    },
    cancellationDate: {
      type: Date,
      default: null,
    },
    provider: {
      type: String,
      default: 'nic',
    },
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    requestPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
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

// Indexes
eInvoiceSchema.index(
  { tenantId: 1, salesInvoiceId: 1 },
  { unique: true }
);

eInvoiceSchema.index({ tenantId: 1, IRN: 1 });
eInvoiceSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

const EInvoice = mongoose.model('EInvoice', eInvoiceSchema);

export default EInvoice;
