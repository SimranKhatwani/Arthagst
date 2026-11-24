import mongoose from 'mongoose';

const subscriptionSequenceSchema = new mongoose.Schema(
  {
    financialYear: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sequence: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const SubscriptionSequence =
  mongoose.models.SubscriptionSequence ||
  mongoose.model('SubscriptionSequence', subscriptionSequenceSchema);

export default SubscriptionSequence;
