import mongoose from 'mongoose';

const platformSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global_platform_settings',
      index: true,
    },
    defaultTrialDays: {
      type: Number,
      default: 14,
    },
    supportEmail: {
      type: String,
      default: 'support@arthagst.demo',
      trim: true,
    },
    sandboxMode: {
      type: Boolean,
      default: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.PlatformSetting || mongoose.model('PlatformSetting', platformSettingSchema);
