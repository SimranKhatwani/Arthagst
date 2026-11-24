import Subscription from './subscription.model.js';
import SubscriptionInvoice from './subscriptionInvoice.model.js';
import Tenant from '../tenants/tenant.model.js';
import { createSubscriptionInvoice } from './subscriptionBilling.service.js';
import { calculatePeriodEnd } from './subscription.service.js';
import { logAuditAction } from '../auditLogs/auditLog.service.js';

/**
 * Execute automated subscription lifecycle check
 * Idempotent, safe, and prevents duplicate processing or duplicate invoices.
 */
export const runSubscriptionLifecycleCheck = async () => {
  const now = new Date();
  const summary = {
    trialsExpired: 0,
    periodRenewalsInitiated: 0,
    pastDueSuspensions: 0,
    cancellationsExpired: 0,
    timestamp: now,
  };

  // 1. Process Ended Trials
  const endedTrials = await Subscription.find({
    status: 'trial',
    trialEndDate: { $lt: now },
  });

  for (const sub of endedTrials) {
    if (!sub.autoRenew) {
      sub.status = 'expired';
      sub.history.push({
        action: 'expired',
        fromPlanCode: sub.planSnapshot.code,
        toPlanCode: sub.planSnapshot.code,
        amount: 0,
        date: now,
        notes: 'Free trial ended without auto-renewal.',
      });
      await sub.save();
      await Tenant.findByIdAndUpdate(sub.tenantId, { subscriptionStatus: 'expired' });
      summary.trialsExpired++;
    } else {
      // Check if renewal invoice already generated
      const existingInvoice = await SubscriptionInvoice.findOne({
        subscriptionId: sub._id,
        'billingPeriod.startDate': { $gte: sub.trialEndDate },
        paymentStatus: { $in: ['pending', 'paid'] },
      });

      if (!existingInvoice) {
        const nextPeriodEnd = calculatePeriodEnd(now, sub.billingCycle || 'monthly');
        await createSubscriptionInvoice({
          tenantId: sub.tenantId,
          subscriptionId: sub._id,
          plan: sub.planSnapshot,
          billingPeriod: { startDate: now, endDate: nextPeriodEnd },
          dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7-day grace
        });
      }

      sub.status = 'past_due';
      if (!sub.gracePeriodEndDate) {
        sub.gracePeriodEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      sub.history.push({
        action: 'past_due',
        fromPlanCode: sub.planSnapshot.code,
        toPlanCode: sub.planSnapshot.code,
        amount: sub.planSnapshot.price || 0,
        date: now,
        notes: 'Trial ended. Awaiting payment during grace period.',
      });
      await sub.save();
      await Tenant.findByIdAndUpdate(sub.tenantId, { subscriptionStatus: 'past_due' });
      summary.trialsExpired++;
    }
  }

  // 2. Process Active Subscriptions Whose Period Ended
  const expiredActive = await Subscription.find({
    status: 'active',
    currentPeriodEnd: { $lt: now },
  });

  for (const sub of expiredActive) {
    if (sub.autoRenew) {
      // Check if next renewal invoice already exists
      const existingInvoice = await SubscriptionInvoice.findOne({
        subscriptionId: sub._id,
        'billingPeriod.startDate': { $gte: sub.currentPeriodEnd },
        paymentStatus: { $in: ['pending', 'paid'] },
      });

      if (!existingInvoice) {
        const nextPeriodEnd = calculatePeriodEnd(now, sub.billingCycle || 'monthly');
        await createSubscriptionInvoice({
          tenantId: sub.tenantId,
          subscriptionId: sub._id,
          plan: sub.planSnapshot,
          billingPeriod: { startDate: now, endDate: nextPeriodEnd },
          dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        });
      }

      sub.status = 'past_due';
      if (!sub.gracePeriodEndDate) {
        sub.gracePeriodEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      sub.history.push({
        action: 'past_due',
        fromPlanCode: sub.planSnapshot.code,
        toPlanCode: sub.planSnapshot.code,
        amount: sub.planSnapshot.price || 0,
        date: now,
        notes: 'Current period expired. In grace period for renewal payment.',
      });
      await sub.save();
      await Tenant.findByIdAndUpdate(sub.tenantId, { subscriptionStatus: 'past_due' });
      summary.periodRenewalsInitiated++;
    } else {
      sub.status = 'expired';
      sub.history.push({
        action: 'expired',
        fromPlanCode: sub.planSnapshot.code,
        toPlanCode: sub.planSnapshot.code,
        amount: 0,
        date: now,
        notes: 'Subscription period concluded without auto-renewal.',
      });
      await sub.save();
      await Tenant.findByIdAndUpdate(sub.tenantId, { subscriptionStatus: 'expired' });
      summary.periodRenewalsInitiated++;
    }
  }

  // 3. Process Grace Period Exceeded -> Suspend Tenant
  const pastDueExpired = await Subscription.find({
    status: 'past_due',
    gracePeriodEndDate: { $lt: now },
  });

  for (const sub of pastDueExpired) {
    sub.status = 'suspended';
    sub.history.push({
      action: 'suspended',
      fromPlanCode: sub.planSnapshot.code,
      toPlanCode: sub.planSnapshot.code,
      amount: 0,
      date: now,
      notes: 'Grace period elapsed without successful payment. Organization suspended.',
    });
    await sub.save();

    await Tenant.findByIdAndUpdate(sub.tenantId, {
      isActive: false,
      subscriptionStatus: 'suspended',
    });

    await logAuditAction({
      action: 'TENANT_AUTO_SUSPENDED_LIFECYCLE',
      targetType: 'tenant',
      targetId: sub.tenantId,
      details: { reason: 'Grace period elapsed without payment' },
    });

    summary.pastDueSuspensions++;
  }

  // 4. Conclude Cancelled Subscriptions Whose Paid Period Has Passed
  const cancelledPastPeriod = await Subscription.find({
    status: 'cancelled',
    currentPeriodEnd: { $lt: now },
  });

  for (const sub of cancelledPastPeriod) {
    sub.status = 'expired';
    sub.history.push({
      action: 'expired',
      fromPlanCode: sub.planSnapshot.code,
      toPlanCode: sub.planSnapshot.code,
      amount: 0,
      date: now,
      notes: 'Cancelled subscription reached end of paid period.',
    });
    await sub.save();
    await Tenant.findByIdAndUpdate(sub.tenantId, { subscriptionStatus: 'expired' });
    summary.cancellationsExpired++;
  }

  return summary;
};

export default {
  runSubscriptionLifecycleCheck,
};
