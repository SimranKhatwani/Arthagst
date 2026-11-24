import mongoose from 'mongoose';

const validationErrorSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    documentNumber: { type: String, default: '' },
    field: { type: String, default: '' },
  },
  { _id: false }
);

const gstReturnPeriodSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    financialYear: {
      type: String,
      required: [true, 'Financial year is required (e.g. 2026-27)'],
      trim: true,
      index: true,
    },
    returnPeriod: {
      type: String,
      required: [true, 'Return period is required (e.g. 042026 or 2026-04)'],
      trim: true,
      index: true,
    },
    periodType: {
      type: String,
      enum: ['monthly', 'quarterly'],
      default: 'monthly',
    },
    returnType: {
      type: String,
      enum: ['GSTR-1', 'GSTR-3B', 'GSTR-2B', 'GSTR-9'],
      required: [true, 'Return type is required'],
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    preparationStatus: {
      type: String,
      enum: ['not_started', 'in_progress', 'ready_for_review', 'completed'],
      default: 'not_started',
      index: true,
    },
    validationStatus: {
      type: String,
      enum: ['not_validated', 'valid', 'has_errors', 'has_warnings'],
      default: 'not_validated',
      index: true,
    },
    validationErrors: {
      type: [validationErrorSchema],
      default: [],
    },
    filingStatus: {
      type: String,
      enum: ['not_filed', 'filed_offline', 'pending'],
      default: 'not_filed',
      index: true,
    },
    filingDate: {
      type: Date,
      default: null,
    },
    acknowledgementNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Acknowledgement number cannot exceed 100 characters'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    lastValidatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

gstReturnPeriodSchema.index(
  { tenantId: 1, financialYear: 1, returnPeriod: 1, returnType: 1 },
  { unique: true }
);

const GSTReturnPeriod = mongoose.model('GSTReturnPeriod', gstReturnPeriodSchema);

export default GSTReturnPeriod;
