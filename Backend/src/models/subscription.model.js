import mongoose from 'mongoose';

const subscriptionEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'trial_started',
        'activated',
        'upgraded',
        'downgraded',
        'renewed',
        'cancelled',
        'expired',
        'suspended',
        'past_due',
        'plan_changed',
        'reactivated',
      ],
      required: true,
    },
    fromPlanCode: {
      type: String,
      default: '',
    },
    toPlanCode: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: true }
);

const subscriptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      unique: true, // Guarantees exactly one active current subscription record per tenant
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: [true, 'Plan ID is required'],
      index: true,
    },
    planSnapshot: {
      name: { type: String, required: true },
      code: { type: String, required: true },
      price: { type: Number, required: true },
      billingCycle: { type: String, required: true },
      limits: {
        maxUsers: { type: Number, default: 2 },
        maxProducts: { type: Number, default: 100 },
        maxInvoices: { type: Number, default: 50 },
        maxWarehouses: { type: Number, default: 1 },
        storageLimit: { type: Number, default: 1024 },
      },
      features: {
        type: [String],
        default: [],
      },
    },
    startDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    trialStartDate: {
      type: Date,
      default: null,
    },
    trialEndDate: {
      type: Date,
      default: null,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly',
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: {
        values: ['trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired'],
        message: '{VALUE} is not a valid subscription status',
      },
      default: 'trial',
      index: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    cancellationDate: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    gracePeriodEndDate: {
      type: Date,
      default: null,
    },
    history: {
      type: [subscriptionEventSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Indexes
subscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionSchema.index({ status: 1, trialEndDate: 1 });
subscriptionSchema.index({ status: 1, gracePeriodEndDate: 1 });

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
export { Subscription };
