import mongoose from 'mongoose';
import Payment from './payment.model.js';
import PaymentSequence from './paymentSequence.model.js';
import SalesInvoice from '../sales/salesInvoice.model.js';
import PurchaseBill from '../purchases/purchaseBill.model.js';
import Party from '../parties/party.model.js';
import BankAccount from '../banking/bankAccount.model.js';
import { getFinancialYear, round2 } from '../sales/sales.calculator.js';
import {
  postPaymentJournal,
  reversePaymentJournal,
} from '../accounting/accounting.integration.js';
import * as notificationService from '../notifications/notification.service.js';
import * as auditLogService from '../auditLogs/auditLog.service.js';

/**
 * Transaction helper with retry on write conflicts
 */
const runTransaction = async (operation, maxRetries = 10) => {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        session.startTransaction();
        const result = await operation(session);
        await session.commitTransaction();
        return result;
      } catch (error) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        const isTransient =
          error.hasErrorLabel?.('TransientTransactionError') ||
          error.code === 112 ||
          error.codeName === 'WriteConflict';

        if (isTransient && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 40 * attempt + Math.random() * 40));
          continue;
        }
        throw error;
      }
    }
  } finally {
    session.endSession();
  }
};

/**
 * Generate unique sequential payment number atomically
 */
export const generatePaymentNumber = async (
  tenantId,
  direction = 'in',
  date = new Date(),
  session = null
) => {
  const financialYear = getFinancialYear(date);
  const prefix = direction === 'in' ? 'REC' : 'PAY';

  const query = { tenantId, direction, financialYear };
  const update = { $inc: { sequence: 1 } };
  const options = { upsert: true, returnDocument: 'after' };
  if (session) options.session = session;

  const seq = await PaymentSequence.findOneAndUpdate(query, update, options);
  const formattedNumber = `${prefix}/${financialYear}/${String(seq.sequence).padStart(4, '0')}`;

  return {
    documentNumber: formattedNumber,
    financialYear,
  };
};

/**
 * Record a payment (Receipt from Customer or Payment to Supplier)
 */
export const createPayment = async (tenantId, userId, data) => {
  return runTransaction(async (session) => {
    const paymentAmount = round2(data.amount);
    if (paymentAmount <= 0) {
      const error = new Error('Payment amount must be greater than zero');
      error.statusCode = 400;
      throw error;
    }

    const direction = data.direction; // 'in' or 'out'
    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

    // 1. Validate Party if provided
    let resolvedParty = null;
    if (data.partyId) {
      if (!mongoose.isValidObjectId(data.partyId)) {
        const error = new Error('Invalid party ID format');
        error.statusCode = 400;
        throw error;
      }
      resolvedParty = await Party.findOne({
        _id: data.partyId,
        tenantId,
        isDeleted: false,
      }).session(session);

      if (!resolvedParty) {
        const error = new Error('Party not found in your organization');
        error.statusCode = 404;
        throw error;
      }

      if (!resolvedParty.isActive) {
        const error = new Error(`Party '${resolvedParty.name}' is inactive`);
        error.statusCode = 400;
        throw error;
      }
    }

    // 2. Validate Bank Account if provided
    let resolvedBankAccount = null;
    if (data.bankAccountId) {
      if (!mongoose.isValidObjectId(data.bankAccountId)) {
        const error = new Error('Invalid bank account ID format');
        error.statusCode = 400;
        throw error;
      }
      resolvedBankAccount = await BankAccount.findOne({
        _id: data.bankAccountId,
        tenantId,
        isDeleted: false,
      }).session(session);

      if (!resolvedBankAccount) {
        const error = new Error('Bank account not found in your organization');
        error.statusCode = 404;
        throw error;
      }

      if (!resolvedBankAccount.isActive) {
        const error = new Error(`Bank account '${resolvedBankAccount.accountName}' is inactive`);
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Process Allocations
    const allocationsInput = Array.isArray(data.allocations) ? data.allocations : [];
    const resolvedAllocations = [];
    let totalAllocated = 0;

    for (const alloc of allocationsInput) {
      const allocAmt = round2(alloc.allocatedAmount);
      if (allocAmt <= 0) {
        const error = new Error('Allocated amount must be greater than zero');
        error.statusCode = 400;
        throw error;
      }

      totalAllocated = round2(totalAllocated + allocAmt);

      if (direction === 'in') {
        // Customer Receipt: Must allocate to SalesInvoice
        if (!alloc.salesInvoiceId) {
          const error = new Error('Receipt allocation must specify salesInvoiceId');
          error.statusCode = 400;
          throw error;
        }

        if (!mongoose.isValidObjectId(alloc.salesInvoiceId)) {
          const error = new Error('Invalid salesInvoiceId format');
          error.statusCode = 400;
          throw error;
        }

        const invoice = await SalesInvoice.findOne({
          _id: alloc.salesInvoiceId,
          tenantId,
        }).session(session);

        if (!invoice) {
          const error = new Error(`Sales invoice ${alloc.salesInvoiceId} not found`);
          error.statusCode = 404;
          throw error;
        }

        if (invoice.invoiceStatus === 'cancelled') {
          const error = new Error(`Cannot allocate payment to cancelled invoice ${invoice.invoiceNumber}`);
          error.statusCode = 400;
          throw error;
        }

        // Validate party match
        if (resolvedParty) {
          if (invoice.partyId.toString() !== resolvedParty._id.toString()) {
            const error = new Error(
              `Invoice ${invoice.invoiceNumber} belongs to a different party (${invoice.partyName}) than the specified party (${resolvedParty.name})`
            );
            error.statusCode = 400;
            throw error;
          }
        } else {
          // Infer party from invoice
          resolvedParty = await Party.findOne({ _id: invoice.partyId, tenantId }).session(session);
        }

        if (allocAmt > round2(invoice.balanceAmount)) {
          const error = new Error(
            `Allocated amount (${allocAmt}) exceeds outstanding balance (${invoice.balanceAmount}) for invoice ${invoice.invoiceNumber}`
          );
          error.statusCode = 400;
          throw error;
        }

        // Update invoice balance and payment status
        const newPaid = round2(invoice.paidAmount + allocAmt);
        const newBalance = Math.max(0, round2(invoice.grandTotal - newPaid));
        const newPaymentStatus = newBalance === 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'unpaid';

        await SalesInvoice.findByIdAndUpdate(
          invoice._id,
          {
            paidAmount: newPaid,
            balanceAmount: newBalance,
            paymentStatus: newPaymentStatus,
          },
          { session }
        );

        resolvedAllocations.push({
          salesInvoiceId: invoice._id,
          purchaseBillId: null,
          documentNumber: invoice.invoiceNumber,
          allocatedAmount: allocAmt,
        });
      } else {
        // Supplier Payment: Must allocate to PurchaseBill
        if (!alloc.purchaseBillId) {
          const error = new Error('Supplier payment allocation must specify purchaseBillId');
          error.statusCode = 400;
          throw error;
        }

        if (!mongoose.isValidObjectId(alloc.purchaseBillId)) {
          const error = new Error('Invalid purchaseBillId format');
          error.statusCode = 400;
          throw error;
        }

        const bill = await PurchaseBill.findOne({
          _id: alloc.purchaseBillId,
          tenantId,
        }).session(session);

        if (!bill) {
          const error = new Error(`Purchase bill ${alloc.purchaseBillId} not found`);
          error.statusCode = 404;
          throw error;
        }

        if (bill.billStatus === 'cancelled') {
          const error = new Error(`Cannot allocate payment to cancelled bill ${bill.billNumber}`);
          error.statusCode = 400;
          throw error;
        }

        // Validate party match
        if (resolvedParty) {
          if (bill.supplierId.toString() !== resolvedParty._id.toString()) {
            const error = new Error(
              `Bill ${bill.billNumber} belongs to a different supplier than the specified party`
            );
            error.statusCode = 400;
            throw error;
          }
        } else {
          // Infer supplier from bill
          resolvedParty = await Party.findOne({ _id: bill.supplierId, tenantId }).session(session);
        }

        if (allocAmt > round2(bill.balanceAmount)) {
          const error = new Error(
            `Allocated amount (${allocAmt}) exceeds outstanding balance (${bill.balanceAmount}) for bill ${bill.billNumber}`
          );
          error.statusCode = 400;
          throw error;
        }

        // Update bill balance and payment status
        const newPaid = round2(bill.paidAmount + allocAmt);
        const newBalance = Math.max(0, round2(bill.grandTotal - newPaid));
        const newPaymentStatus = newBalance === 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'unpaid';

        await PurchaseBill.findByIdAndUpdate(
          bill._id,
          {
            paidAmount: newPaid,
            balanceAmount: newBalance,
            paymentStatus: newPaymentStatus,
          },
          { session }
        );

        resolvedAllocations.push({
          salesInvoiceId: null,
          purchaseBillId: bill._id,
          documentNumber: bill.billNumber,
          allocatedAmount: allocAmt,
        });
      }
    }

    if (totalAllocated > paymentAmount) {
      const error = new Error(
        `Total allocated amount (${totalAllocated}) cannot exceed the payment amount (${paymentAmount})`
      );
      error.statusCode = 400;
      throw error;
    }

    const unallocatedAmount = Math.max(0, round2(paymentAmount - totalAllocated));

    // 4. Update Bank Account Balance
    if (resolvedBankAccount) {
      const balanceDelta = direction === 'in' ? paymentAmount : -paymentAmount;
      await BankAccount.findByIdAndUpdate(
        resolvedBankAccount._id,
        {
          $inc: { currentBalance: balanceDelta },
        },
        { session }
      );
    }

    // 5. Generate Payment Document Number
    const { documentNumber, financialYear } = await generatePaymentNumber(
      tenantId,
      direction,
      paymentDate,
      session
    );

    // 6. Create and Save Payment Record
    const payment = new Payment({
      tenantId,
      paymentNumber: documentNumber,
      financialYear,
      direction,
      partyId: resolvedParty ? resolvedParty._id : null,
      partyName: resolvedParty ? resolvedParty.name : '',
      paymentDate,
      amount: paymentAmount,
      unallocatedAmount,
      paymentMethod: data.paymentMethod || 'bank',
      bankAccountId: resolvedBankAccount ? resolvedBankAccount._id : null,
      bankAccountName: resolvedBankAccount ? resolvedBankAccount.accountName : '',
      referenceNumber: data.referenceNumber || '',
      notes: data.notes || '',
      status: 'completed',
      allocations: resolvedAllocations,
      createdBy: userId,
    });

    await payment.save({ session });

    // Automatic Accounting Journal Posting
    await postPaymentJournal(tenantId, userId, payment, session);

    // Notification for recorded payment
    await notificationService.createNotification({
      tenantId,
      title: direction === 'in' ? 'Customer Payment Received' : 'Supplier Payment Recorded',
      message:
        direction === 'in'
          ? `Received customer payment ${payment.paymentNumber} of ₹${payment.amount} from ${payment.partyName || 'Customer'}.`
          : `Recorded supplier payment ${payment.paymentNumber} of ₹${payment.amount} to ${payment.partyName || 'Supplier'}.`,
      notificationType: direction === 'in' ? 'customer_payment' : 'supplier_payment',
      referenceType: 'Payment',
      referenceId: payment._id,
      session,
    });

    // Record Audit Log for payment creation
    await auditLogService.logAuditAction({
      tenantId,
      userId,
      action: 'PAYMENT_CREATED',
      module: 'payments',
      entityType: 'Payment',
      entityId: payment._id,
      targetName: payment.paymentNumber,
      description: `Recorded payment ${payment.paymentNumber} (${direction === 'in' ? 'Receipt' : 'Payment'}) of ₹${payment.amount}`,
      changes: {
        paymentNumber: payment.paymentNumber,
        direction,
        amount: payment.amount,
        partyName: payment.partyName,
      },
      session,
    });

    return payment;
  });
};

/**
 * Cancel a payment and reverse all invoice/bill allocations and bank balances atomically
 */
export const cancelPayment = async (tenantId, userId, paymentId, cancellationReason) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(paymentId)) {
      const error = new Error('Invalid payment ID format');
      error.statusCode = 400;
      throw error;
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      tenantId,
    }).session(session);

    if (!payment) {
      const error = new Error('Payment not found');
      error.statusCode = 404;
      throw error;
    }

    if (payment.status === 'cancelled') {
      const error = new Error('Payment has already been cancelled');
      error.statusCode = 400;
      throw error;
    }

    // 1. Reverse Allocations
    for (const alloc of payment.allocations) {
      if (alloc.salesInvoiceId) {
        const invoice = await SalesInvoice.findOne({
          _id: alloc.salesInvoiceId,
          tenantId,
        }).session(session);

        if (invoice) {
          const newPaid = Math.max(0, round2(invoice.paidAmount - alloc.allocatedAmount));
          const newBalance = Math.min(invoice.grandTotal, round2(invoice.balanceAmount + alloc.allocatedAmount));
          const newPaymentStatus = newBalance === 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'unpaid';

          await SalesInvoice.findByIdAndUpdate(
            invoice._id,
            {
              paidAmount: newPaid,
              balanceAmount: newBalance,
              paymentStatus: newPaymentStatus,
            },
            { session }
          );
        }
      } else if (alloc.purchaseBillId) {
        const bill = await PurchaseBill.findOne({
          _id: alloc.purchaseBillId,
          tenantId,
        }).session(session);

        if (bill) {
          const newPaid = Math.max(0, round2(bill.paidAmount - alloc.allocatedAmount));
          const newBalance = Math.min(bill.grandTotal, round2(bill.balanceAmount + alloc.allocatedAmount));
          const newPaymentStatus = newBalance === 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'unpaid';

          await PurchaseBill.findByIdAndUpdate(
            bill._id,
            {
              paidAmount: newPaid,
              balanceAmount: newBalance,
              paymentStatus: newPaymentStatus,
            },
            { session }
          );
        }
      }
    }

    // 2. Reverse Bank Account Balance
    if (payment.bankAccountId) {
      // Reversal: If direction was 'in', deduct amount; if 'out', add back amount
      const balanceDelta = payment.direction === 'in' ? -payment.amount : payment.amount;
      await BankAccount.findByIdAndUpdate(
        payment.bankAccountId,
        {
          $inc: { currentBalance: balanceDelta },
        },
        { session }
      );
    }

    // 3. Update payment status to cancelled
    payment.status = 'cancelled';
    payment.cancelledAt = new Date();
    payment.cancellationReason = cancellationReason;

    await payment.save({ session });

    // Automatic Accounting Journal Reversal
    await reversePaymentJournal(tenantId, userId, payment, session);

    // Record Audit Log for payment cancellation
    await auditLogService.logAuditAction({
      tenantId,
      userId,
      action: 'PAYMENT_CANCELLED',
      module: 'payments',
      entityType: 'Payment',
      entityId: payment._id,
      targetName: payment.paymentNumber,
      description: `Cancelled payment ${payment.paymentNumber}. Reason: ${cancellationReason}`,
      changes: { cancellationReason },
      session,
    });

    return payment;
  });
};

/**
 * Get paginated list of payments with filtering and search
 */
export const getPayments = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    direction,
    partyId,
    bankAccountId,
    paymentMethod,
    status,
    startDate,
    endDate,
    sortBy = 'paymentDate',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (direction) query.direction = direction;
  if (status) query.status = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (partyId && mongoose.isValidObjectId(partyId)) query.partyId = partyId;
  if (bankAccountId && mongoose.isValidObjectId(bankAccountId)) query.bankAccountId = bankAccountId;

  if (startDate || endDate) {
    query.paymentDate = {};
    if (startDate) query.paymentDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.paymentDate.$lte = end;
    }
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { paymentNumber: searchRegex },
      { partyName: searchRegex },
      { referenceNumber: searchRegex },
      { notes: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('partyId', 'name email phone GSTIN')
      .populate('bankAccountId', 'accountName accountType bankName accountNumber')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(query),
  ]);

  return {
    payments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get payment by ID
 */
export const getPaymentById = async (tenantId, paymentId) => {
  if (!mongoose.isValidObjectId(paymentId)) {
    const error = new Error('Invalid payment ID format');
    error.statusCode = 400;
    throw error;
  }

  const payment = await Payment.findOne({
    _id: paymentId,
    tenantId,
  })
    .populate('partyId', 'name email phone GSTIN PAN')
    .populate('bankAccountId', 'accountName accountType bankName accountNumber IFSC')
    .populate('createdBy', 'name email')
    .lean();

  if (!payment) {
    const error = new Error('Payment not found');
    error.statusCode = 404;
    throw error;
  }

  return payment;
};

export default {
  generatePaymentNumber,
  createPayment,
  cancelPayment,
  getPayments,
  getPaymentById,
};
