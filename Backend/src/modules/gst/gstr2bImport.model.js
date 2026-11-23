import mongoose from 'mongoose';

const gstr2bEntrySchema = new mongoose.Schema(
  {
    supplierGSTIN: {
      type: String,
      required: [true, 'Supplier GSTIN is required'],
      trim: true,
      uppercase: true,
    },
    supplierName: {
      type: String,
      trim: true,
      default: '',
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice / document number is required'],
      trim: true,
    },
    documentType: {
      type: String,
      enum: ['INV', 'CRN', 'DBN'],
      default: 'INV',
    },
    invoiceDate: {
      type: Date,
      required: [true, 'Invoice date is required'],
    },
    invoiceValue: {
      type: Number,
      default: 0,
    },
    placeOfSupply: {
      type: String,
      trim: true,
      default: '',
    },
    reverseCharge: {
      type: Boolean,
      default: false,
    },
    taxableValue: {
      type: Number,
      required: true,
      default: 0,
    },
    igst: {
      type: Number,
      default: 0,
    },
    cgst: {
      type: Number,
      default: 0,
    },
    sgst: {
      type: Number,
      default: 0,
    },
    cess: {
      type: Number,
      default: 0,
    },
    itcAvailability: {
      type: Boolean,
      default: true,
    },
    reconciliationStatus: {
      type: String,
      enum: ['unmatched', 'matched', 'mismatched', 'missing_in_books'],
      default: 'unmatched',
    },
    matchedBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseBill',
      default: null,
    },
    mismatchReasons: {
      type: [String],
      default: [],
    },
  },
  { _id: true }
);

const gstr2bImportSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    gstin: {
      type: String,
      required: [true, 'Recipient GSTIN is required'],
      trim: true,
      uppercase: true,
    },
    returnPeriod: {
      type: String,
      required: [true, 'Return period is required (e.g. 042026 or 2026-04)'],
      trim: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sourceFileName: {
      type: String,
      trim: true,
      default: 'gstr2b_import.json',
    },
    fileHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    recordCount: {
      type: Number,
      default: 0,
    },
    totalTaxableValue: {
      type: Number,
      default: 0,
    },
    totalTaxAmount: {
      type: Number,
      default: 0,
    },
    importedAt: {
      type: Date,
      default: Date.now,
    },
    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    entries: {
      type: [gstr2bEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Prevent duplicate imports for the exact same source content and return period per tenant
gstr2bImportSchema.index(
  { tenantId: 1, returnPeriod: 1, fileHash: 1 },
  { unique: true }
);

const GSTR2BImport = mongoose.model('GSTR2BImport', gstr2bImportSchema);

export default GSTR2BImport;
