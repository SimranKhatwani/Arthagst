import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    // Invoice Preferences
    invoicePreferences: {
      invoicePrefix: { type: String, trim: true, default: 'INV' },
      quotationPrefix: { type: String, trim: true, default: 'QTN' },
      orderPrefix: { type: String, trim: true, default: 'SO' },
      challanPrefix: { type: String, trim: true, default: 'DC' },
      creditNotePrefix: { type: String, trim: true, default: 'CN' },
      defaultNotes: {
        type: String,
        trim: true,
        default: 'Thank you for your business.',
      },
      termsAndConditions: {
        type: String,
        trim: true,
        default: '1. Goods once sold will not be taken back.\n2. Payment due within 15 days of invoice date.',
      },
      headerText: { type: String, trim: true, default: '' },
      footerText: { type: String, trim: true, default: 'Subject to local jurisdiction.' },
      showTaxBreakup: { type: Boolean, default: true },
    },
    // Business Branding
    branding: {
      logoUrl: { type: String, trim: true, default: '' },
      signatureUrl: { type: String, trim: true, default: '' },
      primaryColor: { type: String, trim: true, default: '#4f46e5' },
      printDisplayPreferences: {
        showLogo: { type: Boolean, default: true },
        showSignature: { type: Boolean, default: true },
        showNotes: { type: Boolean, default: true },
        showTerms: { type: Boolean, default: true },
        showBankDetails: { type: Boolean, default: true },
        showUpiQr: { type: Boolean, default: true },
      },
    },
    // Payment Information
    paymentInformation: {
      upiId: { type: String, trim: true, default: '' },
      upiQrUrl: { type: String, trim: true, default: '' },
      defaultPaymentInstructions: {
        type: String,
        trim: true,
        default: 'Please make payment via UPI or direct bank transfer using the account details below.',
      },
      defaultBankAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankAccount',
        default: null,
      },
    },
    // General Preferences
    generalPreferences: {
      currency: { type: String, trim: true, default: 'INR' },
      currencySymbol: { type: String, trim: true, default: '₹' },
      dateFormat: {
        type: String,
        trim: true,
        enum: ['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'],
        default: 'DD/MM/YYYY',
      },
      timezone: { type: String, trim: true, default: 'Asia/Kolkata' },
      taxInclusivePricing: { type: Boolean, default: false },
      enableStockAlerts: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Helper static method: Get or create default settings for tenant
settingsSchema.statics.getOrCreateDefault = async function (tenantId) {
  let settings = await this.findOne({ tenantId });
  if (!settings) {
    settings = await this.create({ tenantId });
  }
  return settings;
};

const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

export default Settings;
export { Settings };
