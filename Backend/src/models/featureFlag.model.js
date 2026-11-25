import mongoose from 'mongoose';

const featureFlagSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    planTiers: {
      type: [String],
      default: ['Starter', 'Growth', 'Enterprise'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.FeatureFlag || mongoose.model('FeatureFlag', featureFlagSchema);
