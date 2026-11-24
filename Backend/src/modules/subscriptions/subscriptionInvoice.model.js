import mongoose from 'mongoose';

const subscriptionInvoiceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'Subscription ID is required'],
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    planName: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
    },
    planCode: {
      type: String,
      required: [true, 'Plan code is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    taxableAmount: {
      type: Number,
      required: [true, 'Taxable amount is required'],
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['pending', 'paid', 'failed', 'refunded'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'pending',
      index: true,
    },
    billingPeriod: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
    },
    paymentReference: {
      gateway: {
        type: String,
        default: 'mock_gateway',
      },
      transactionId: {
        type: String,
        default: null,
      },
      orderId: {
        type: String,
        default: null,
      },
      paymentMethod: {
        type: String,
        default: null,
      },
      paidAt: {
        type: Date,
        default: null,
      },
      gatewaySignature: {
        type: String,
        default: null,
      },
      failureReason: {
        type: String,
        default: null,
      },
      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
  },
  { timestamps: true }
);

subscriptionInvoiceSchema.index({ tenantId: 1, invoiceDate: -1 });
subscriptionInvoiceSchema.index({ paymentStatus: 1, dueDate: 1 });

const SubscriptionInvoice =
  mongoose.models.SubscriptionInvoice ||
  mongoose.model('SubscriptionInvoice', subscriptionInvoiceSchema);

export default SubscriptionInvoice;
export { SubscriptionInvoice };
