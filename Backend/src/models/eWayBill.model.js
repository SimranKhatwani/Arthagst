import mongoose from 'mongoose';

const vehicleHistorySchema = new mongoose.Schema(
  {
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
    transporterId: { type: String, trim: true, uppercase: true, default: '' },
    transportMode: { type: String, default: '1: Road' },
    fromPlace: { type: String, default: '' },
    fromState: { type: String, default: '' },
    reasonCode: { type: String, default: '1: Due to Break Down' },
    reasonRemark: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const eWayBillSchema = new mongoose.Schema(
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
    eInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EInvoice',
      default: null,
      index: true,
    },
    eWayBillNumber: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    generatedDate: {
      type: Date,
      default: null,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    supplyType: {
      type: String,
      enum: ['O: Outward', 'I: Inward'],
      default: 'O: Outward',
    },
    subSupplyType: {
      type: String,
      default: '1: Supply',
    },
    docType: {
      type: String,
      enum: ['INV', 'BIL', 'BOE', 'CHL', 'OTH'],
      default: 'INV',
    },
    documentNumber: {
      type: String,
      required: true,
      trim: true,
    },
    documentDate: {
      type: Date,
      required: true,
    },
    fromPincode: {
      type: String,
      required: true,
      trim: true,
    },
    toPincode: {
      type: String,
      required: true,
      trim: true,
    },
    distance: {
      type: Number,
      required: true,
      min: [1, 'Distance must be at least 1 km'],
    },
    transporterId: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    transporterName: {
      type: String,
      trim: true,
      default: '',
    },
    transportMode: {
      type: String,
      enum: ['1: Road', '2: Rail', '3: Air', '4: Ship', 'road', 'rail', 'air', 'ship'],
      default: '1: Road',
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    vehicleType: {
      type: String,
      enum: ['R: Regular', 'O: Over Dimensional Cargo', 'regular', 'odc'],
      default: 'regular',
    },
    status: {
      type: String,
      enum: ['pending', 'generated', 'active', 'cancelled', 'expired', 'failed'],
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
    extensionReason: {
      type: String,
      trim: true,
      default: '',
    },
    vehicleHistory: {
      type: [vehicleHistorySchema],
      default: [],
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

eWayBillSchema.index({ tenantId: 1, eWayBillNumber: 1 });
eWayBillSchema.index({ tenantId: 1, salesInvoiceId: 1 });

const EWayBill = mongoose.model('EWayBill', eWayBillSchema);

export default EWayBill;
