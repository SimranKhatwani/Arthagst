import mongoose from 'mongoose';

export const GST_UQC_CODES = [
  'BAG-BAGS',
  'BAL-BALE',
  'BDL-BUNDLES',
  'BKL-BUCKLES',
  'BOU-BILLION OF UNITS',
  'BOX-BOXES',
  'BTL-BOTTLES',
  'BUN-BUNCHES',
  'CAN-CANS',
  'CBM-CUBIC METERS',
  'CCM-CUBIC CENTIMETERS',
  'CMS-CENTIMETERS',
  'CTN-CARTONS',
  'DOZ-DOZENS',
  'DRM-DRUMS',
  'GGK-GREAT GROSS',
  'GMS-GRAMS',
  'GRS-GROSS',
  'GYD-GROSS YARDS',
  'KGS-KILOGRAMS',
  'KLR-KILOLITRE',
  'KME-KILOMETRE',
  'MLT-MILLILITRE',
  'MTR-METERS',
  'MTS-METRIC TON',
  'NOS-NUMBERS',
  'PAC-PACKETS',
  'PCS-PIECES',
  'PRS-PAIRS',
  'QTL-QUINTAL',
  'ROL-ROLLS',
  'SET-SETS',
  'SQF-SQUARE FEET',
  'SQM-SQUARE METERS',
  'SQY-SQUARE YARDS',
  'TBS-TABLETS',
  'TGM-TEN GROSS',
  'THD-THOUSANDS',
  'TON-TONNES',
  'TUB-TUBES',
  'UGS-US GALLONS',
  'UNT-UNITS',
  'YDS-YARDS',
  'OTH-OTHERS',
];

const unitSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Unit name is required'],
      trim: true,
      minlength: [1, 'Unit name must be at least 1 character'],
      maxlength: [50, 'Unit name cannot exceed 50 characters'],
      index: true,
    },
    shortName: {
      type: String,
      required: [true, 'Short name is required'],
      uppercase: true,
      trim: true,
      minlength: [1, 'Short name must be at least 1 character'],
      maxlength: [20, 'Short name cannot exceed 20 characters'],
      index: true,
    },
    unitType: {
      type: String,
      enum: {
        values: ['quantity', 'weight', 'volume', 'length', 'area', 'other'],
        message: '{VALUE} is not a valid unit type',
      },
      default: 'quantity',
      index: true,
    },
    gstUqcCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional
          return GST_UQC_CODES.some(
            (code) => code.toUpperCase() === v.toUpperCase() || code.startsWith(v.toUpperCase() + '-')
          );
        },
        message: 'Invalid GST UQC code. Must match official Indian GST UQC (e.g. PCS-PIECES, KGS-KILOGRAMS)',
      },
    },
    allowDecimal: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
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

// Compound indexes
unitSchema.index({ tenantId: 1, name: 1, isDeleted: 1 });
unitSchema.index({ tenantId: 1, shortName: 1, isDeleted: 1 });

unitSchema.pre('save', function () {
  if (this.name) this.name = this.name.trim();
  if (this.shortName) this.shortName = this.shortName.toUpperCase().trim();
  if (this.gstUqcCode) {
    this.gstUqcCode = this.gstUqcCode.toUpperCase().trim();
    // Normalize 3-letter to full UQC if exact prefix match
    const fullMatch = GST_UQC_CODES.find(
      (code) => code === this.gstUqcCode || code.startsWith(this.gstUqcCode + '-')
    );
    if (fullMatch) {
      this.gstUqcCode = fullMatch;
    }
  }
});

const Unit = mongoose.models.Unit || mongoose.model('Unit', unitSchema);

export default Unit;
export { Unit };
