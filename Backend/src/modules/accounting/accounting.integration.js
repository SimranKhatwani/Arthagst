import mongoose from 'mongoose';
import JournalEntry from './journalEntry.model.js';
import JournalSequence from './journalSequence.model.js';
import { seedDefaultAccounts } from './accounting.seed.js';
import { getFinancialYear, round2 } from '../sales/sales.calculator.js';

/**
 * Generate sequential journal entry number atomically
 */
export const generateJournalNumber = async (tenantId, date = new Date(), session = null) => {
  const financialYear = getFinancialYear(date);
  const query = { tenantId, financialYear };
  const update = { $inc: { sequence: 1 } };
  const options = { upsert: true, returnDocument: 'after' };
  if (session) options.session = session;

  const seq = await JournalSequence.findOneAndUpdate(query, update, options);
  const formattedNumber = `JRN/${financialYear}/${String(seq.sequence).padStart(4, '0')}`;

  return {
    documentNumber: formattedNumber,
    financialYear,
  };
};

/**
 * Validate that journal lines balance (Total Debit === Total Credit)
 */
export const validateDoubleEntryBalance = (lines) => {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    const dr = round2(line.debit || 0);
    const cr = round2(line.credit || 0);

    if (dr > 0 && cr > 0) {
      throw new Error(`Line for account ${line.accountCode} cannot have both debit and credit amounts.`);
    }
    if (dr === 0 && cr === 0) {
      throw new Error(`Line for account ${line.accountCode} must have either a debit or credit amount.`);
    }

    totalDebit = round2(totalDebit + dr);
    totalCredit = round2(totalCredit + cr);
  }

  const diff = Math.abs(round2(totalDebit - totalCredit));
  if (diff > 0.01) {
    throw new Error(
      `Double-entry imbalance: Total Debit (₹${totalDebit}) must equal Total Credit (₹${totalCredit}). Difference: ₹${diff}`
    );
  }

  return {
    totalDebit,
    totalCredit,
  };
};

/**
 * 1. Automatic Journal Entry for Posted Sales Invoice
 */
export const postSalesInvoiceJournal = async (tenantId, userId, invoice, session = null) => {
  // Prevent duplicate automatic entries
  const existing = await JournalEntry.findOne({
    tenantId,
    sourceType: 'sales_invoice',
    sourceId: invoice._id,
    status: 'posted',
  }).session(session);

  if (existing) return existing;

  const accounts = await seedDefaultAccounts(tenantId, session);

  const lines = [];

  // Line 1: Debit Accounts Receivable (Customer) for Grand Total
  lines.push({
    accountId: accounts['1100']._id,
    accountCode: accounts['1100'].accountCode,
    accountName: accounts['1100'].accountName,
    debit: round2(invoice.grandTotal),
    credit: 0,
    description: `Invoice ${invoice.invoiceNumber} - ${invoice.partyName}`,
    partyId: invoice.partyId,
  });

  // Line 2: Credit Sales Revenue for Taxable Amount
  lines.push({
    accountId: accounts['4010']._id,
    accountCode: accounts['4010'].accountCode,
    accountName: accounts['4010'].accountName,
    debit: 0,
    credit: round2(invoice.taxableAmount),
    description: `Taxable sales for ${invoice.invoiceNumber}`,
  });

  // Line 3: Credit Output CGST
  if (invoice.cgstTotal > 0) {
    lines.push({
      accountId: accounts['2110']._id,
      accountCode: accounts['2110'].accountCode,
      accountName: accounts['2110'].accountName,
      debit: 0,
      credit: round2(invoice.cgstTotal),
      description: `CGST Output on ${invoice.invoiceNumber}`,
    });
  }

  // Line 4: Credit Output SGST
  if (invoice.sgstTotal > 0) {
    lines.push({
      accountId: accounts['2120']._id,
      accountCode: accounts['2120'].accountCode,
      accountName: accounts['2120'].accountName,
      debit: 0,
      credit: round2(invoice.sgstTotal),
      description: `SGST Output on ${invoice.invoiceNumber}`,
    });
  }

  // Line 5: Credit Output IGST
  if (invoice.igstTotal > 0) {
    lines.push({
      accountId: accounts['2130']._id,
      accountCode: accounts['2130'].accountCode,
      accountName: accounts['2130'].accountName,
      debit: 0,
      credit: round2(invoice.igstTotal),
      description: `IGST Output on ${invoice.invoiceNumber}`,
    });
  }

  // Line 6: Credit Output Cess
  if (invoice.cessTotal > 0) {
    lines.push({
      accountId: accounts['2140']._id,
      accountCode: accounts['2140'].accountCode,
      accountName: accounts['2140'].accountName,
      debit: 0,
      credit: round2(invoice.cessTotal),
      description: `Cess Output on ${invoice.invoiceNumber}`,
    });
  }

  // Line 7: Round Off Differences
  const roundOff = round2(invoice.roundOff || 0);
  if (roundOff !== 0) {
    if (roundOff < 0) {
      // Rounded down: Debit Round Off expense
      lines.push({
        accountId: accounts['6990']._id,
        accountCode: accounts['6990'].accountCode,
        accountName: accounts['6990'].accountName,
        debit: Math.abs(roundOff),
        credit: 0,
        description: `Rounding difference on ${invoice.invoiceNumber}`,
      });
    } else {
      // Rounded up: Credit Round Off income
      lines.push({
        accountId: accounts['6990']._id,
        accountCode: accounts['6990'].accountCode,
        accountName: accounts['6990'].accountName,
        debit: 0,
        credit: roundOff,
        description: `Rounding difference on ${invoice.invoiceNumber}`,
      });
    }
  }

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(lines);
  const entryDate = invoice.invoiceDate || new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, entryDate, session);

  const entry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate,
    financialYear,
    narration: `Sales Invoice ${invoice.invoiceNumber} posted for ${invoice.partyName}`,
    sourceType: 'sales_invoice',
    sourceId: invoice._id,
    sourceDocumentNumber: invoice.invoiceNumber,
    status: 'posted',
    lines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await entry.save({ session });
  } else {
    await entry.save();
  }

  return entry;
};

/**
 * Reversal of Sales Invoice Journal Entry
 */
export const reverseSalesInvoiceJournal = async (tenantId, userId, invoice, session = null) => {
  const original = await JournalEntry.findOne({
    tenantId,
    sourceType: 'sales_invoice',
    sourceId: invoice._id,
    status: 'posted',
  }).session(session);

  if (!original) return null;

  // Invert debits and credits
  const reversalLines = original.lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountName: l.accountName,
    debit: l.credit,
    credit: l.debit,
    description: `Reversal: ${l.description}`,
    partyId: l.partyId,
  }));

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(reversalLines);
  const reversalDate = new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, reversalDate, session);

  const reversalEntry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate: reversalDate,
    financialYear,
    narration: `Reversal of Sales Invoice ${invoice.invoiceNumber}`,
    sourceType: 'sales_invoice',
    sourceId: invoice._id,
    sourceDocumentNumber: invoice.invoiceNumber,
    status: 'posted',
    reversedFromEntryId: original._id,
    lines: reversalLines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await reversalEntry.save({ session });
  } else {
    await reversalEntry.save();
  }

  original.status = 'reversed';
  original.reversedAt = reversalDate;
  original.reversalEntryId = reversalEntry._id;
  if (session) {
    await original.save({ session });
  } else {
    await original.save();
  }

  return reversalEntry;
};

/**
 * 2. Automatic Journal Entry for Posted Sales Return / Credit Note
 */
export const postCreditNoteJournal = async (tenantId, userId, creditNote, session = null) => {
  const existing = await JournalEntry.findOne({
    tenantId,
    sourceType: 'credit_note',
    sourceId: creditNote._id,
    status: 'posted',
  }).session(session);

  if (existing) return existing;

  const accounts = await seedDefaultAccounts(tenantId, session);
  const lines = [];

  // Line 1: Debit Sales Returns & Allowances
  lines.push({
    accountId: accounts['4090']._id,
    accountCode: accounts['4090'].accountCode,
    accountName: accounts['4090'].accountName,
    debit: round2(creditNote.taxableAmount),
    credit: 0,
    description: `Sales return against invoice ${creditNote.invoiceNumber}`,
  });

  // Line 2: Debit Output CGST Reversal
  if (creditNote.cgstTotal > 0) {
    lines.push({
      accountId: accounts['2110']._id,
      accountCode: accounts['2110'].accountCode,
      accountName: accounts['2110'].accountName,
      debit: round2(creditNote.cgstTotal),
      credit: 0,
      description: `CGST Output reversal on ${creditNote.creditNoteNumber}`,
    });
  }

  // Line 3: Debit Output SGST Reversal
  if (creditNote.sgstTotal > 0) {
    lines.push({
      accountId: accounts['2120']._id,
      accountCode: accounts['2120'].accountCode,
      accountName: accounts['2120'].accountName,
      debit: round2(creditNote.sgstTotal),
      credit: 0,
      description: `SGST Output reversal on ${creditNote.creditNoteNumber}`,
    });
  }

  // Line 4: Debit Output IGST Reversal
  if (creditNote.igstTotal > 0) {
    lines.push({
      accountId: accounts['2130']._id,
      accountCode: accounts['2130'].accountCode,
      accountName: accounts['2130'].accountName,
      debit: round2(creditNote.igstTotal),
      credit: 0,
      description: `IGST Output reversal on ${creditNote.creditNoteNumber}`,
    });
  }

  // Line 5: Credit Accounts Receivable (Customer)
  lines.push({
    accountId: accounts['1100']._id,
    accountCode: accounts['1100'].accountCode,
    accountName: accounts['1100'].accountName,
    debit: 0,
    credit: round2(creditNote.grandTotal),
    description: `Credit Note ${creditNote.creditNoteNumber} for ${creditNote.partyName}`,
    partyId: creditNote.partyId,
  });

  // Round Off if applicable
  const roundOff = round2(creditNote.roundOff || 0);
  if (roundOff !== 0) {
    if (roundOff < 0) {
      lines.push({
        accountId: accounts['6990']._id,
        accountCode: accounts['6990'].accountCode,
        accountName: accounts['6990'].accountName,
        debit: Math.abs(roundOff),
        credit: 0,
        description: `Rounding difference on ${creditNote.creditNoteNumber}`,
      });
    } else {
      lines.push({
        accountId: accounts['6990']._id,
        accountCode: accounts['6990'].accountCode,
        accountName: accounts['6990'].accountName,
        debit: 0,
        credit: roundOff,
        description: `Rounding difference on ${creditNote.creditNoteNumber}`,
      });
    }
  }

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(lines);
  const entryDate = creditNote.creditNoteDate || new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, entryDate, session);

  const entry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate,
    financialYear,
    narration: `Credit Note ${creditNote.creditNoteNumber} issued against invoice ${creditNote.invoiceNumber}`,
    sourceType: 'credit_note',
    sourceId: creditNote._id,
    sourceDocumentNumber: creditNote.creditNoteNumber,
    status: 'posted',
    lines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await entry.save({ session });
  } else {
    await entry.save();
  }

  return entry;
};

/**
 * 3. Automatic Journal Entry for Posted Purchase Bill
 */
export const postPurchaseBillJournal = async (tenantId, userId, bill, session = null) => {
  const existing = await JournalEntry.findOne({
    tenantId,
    sourceType: 'purchase_bill',
    sourceId: bill._id,
    status: 'posted',
  }).session(session);

  if (existing) return existing;

  const accounts = await seedDefaultAccounts(tenantId, session);
  const lines = [];

  // Line 1: Debit Purchase Account
  lines.push({
    accountId: accounts['5010']._id,
    accountCode: accounts['5010'].accountCode,
    accountName: accounts['5010'].accountName,
    debit: round2(bill.taxableAmount),
    credit: 0,
    description: `Purchase Bill ${bill.billNumber} from ${bill.supplierName}`,
  });

  // Line 2: Debit Input CGST
  if (bill.cgstTotal > 0) {
    lines.push({
      accountId: accounts['1310']._id,
      accountCode: accounts['1310'].accountCode,
      accountName: accounts['1310'].accountName,
      debit: round2(bill.cgstTotal),
      credit: 0,
      description: `CGST Input Credit on ${bill.billNumber}`,
    });
  }

  // Line 3: Debit Input SGST
  if (bill.sgstTotal > 0) {
    lines.push({
      accountId: accounts['1320']._id,
      accountCode: accounts['1320'].accountCode,
      accountName: accounts['1320'].accountName,
      debit: round2(bill.sgstTotal),
      credit: 0,
      description: `SGST Input Credit on ${bill.billNumber}`,
    });
  }

  // Line 4: Debit Input IGST
  if (bill.igstTotal > 0) {
    lines.push({
      accountId: accounts['1330']._id,
      accountCode: accounts['1330'].accountCode,
      accountName: accounts['1330'].accountName,
      debit: round2(bill.igstTotal),
      credit: 0,
      description: `IGST Input Credit on ${bill.billNumber}`,
    });
  }

  // Line 5: Debit Input Cess
  if (bill.cessTotal > 0) {
    lines.push({
      accountId: accounts['1340']._id,
      accountCode: accounts['1340'].accountCode,
      accountName: accounts['1340'].accountName,
      debit: round2(bill.cessTotal),
      credit: 0,
      description: `Cess Input Credit on ${bill.billNumber}`,
    });
  }

  // Line 6: Credit Accounts Payable (Creditor)
  lines.push({
    accountId: accounts['2010']._id,
    accountCode: accounts['2010'].accountCode,
    accountName: accounts['2010'].accountName,
    debit: 0,
    credit: round2(bill.grandTotal),
    description: `Supplier bill payable to ${bill.supplierName}`,
    partyId: bill.supplierId,
  });

  // Round Off if applicable
  const roundOff = round2(bill.roundOff || 0);
  if (roundOff !== 0) {
    if (roundOff < 0) {
      lines.push({
        accountId: accounts['6990']._id,
        accountCode: accounts['6990'].accountCode,
        accountName: accounts['6990'].accountName,
        debit: Math.abs(roundOff),
        credit: 0,
        description: `Rounding difference on ${bill.billNumber}`,
      });
    } else {
      lines.push({
        accountId: accounts['6990']._id,
        accountCode: accounts['6990'].accountCode,
        accountName: accounts['6990'].accountName,
        debit: 0,
        credit: roundOff,
        description: `Rounding difference on ${bill.billNumber}`,
      });
    }
  }

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(lines);
  const entryDate = bill.billDate || new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, entryDate, session);

  const entry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate,
    financialYear,
    narration: `Purchase Bill ${bill.billNumber} posted from ${bill.supplierName}`,
    sourceType: 'purchase_bill',
    sourceId: bill._id,
    sourceDocumentNumber: bill.billNumber,
    status: 'posted',
    lines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await entry.save({ session });
  } else {
    await entry.save();
  }

  return entry;
};

/**
 * Reversal of Purchase Bill Journal Entry
 */
export const reversePurchaseBillJournal = async (tenantId, userId, bill, session = null) => {
  const original = await JournalEntry.findOne({
    tenantId,
    sourceType: 'purchase_bill',
    sourceId: bill._id,
    status: 'posted',
  }).session(session);

  if (!original) return null;

  const reversalLines = original.lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountName: l.accountName,
    debit: l.credit,
    credit: l.debit,
    description: `Reversal: ${l.description}`,
    partyId: l.partyId,
  }));

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(reversalLines);
  const reversalDate = new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, reversalDate, session);

  const reversalEntry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate: reversalDate,
    financialYear,
    narration: `Reversal of Purchase Bill ${bill.billNumber}`,
    sourceType: 'purchase_bill',
    sourceId: bill._id,
    sourceDocumentNumber: bill.billNumber,
    status: 'posted',
    reversedFromEntryId: original._id,
    lines: reversalLines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await reversalEntry.save({ session });
  } else {
    await reversalEntry.save();
  }

  original.status = 'reversed';
  original.reversedAt = reversalDate;
  original.reversalEntryId = reversalEntry._id;
  if (session) {
    await original.save({ session });
  } else {
    await original.save();
  }

  return reversalEntry;
};

/**
 * 4. Automatic Journal Entry for Posted Purchase Return / Debit Note
 */
export const postDebitNoteJournal = async (tenantId, userId, debitNote, session = null) => {
  const existing = await JournalEntry.findOne({
    tenantId,
    sourceType: 'debit_note',
    sourceId: debitNote._id,
    status: 'posted',
  }).session(session);

  if (existing) return existing;

  const accounts = await seedDefaultAccounts(tenantId, session);
  const lines = [];

  // Line 1: Debit Accounts Payable (Supplier)
  lines.push({
    accountId: accounts['2010']._id,
    accountCode: accounts['2010'].accountCode,
    accountName: accounts['2010'].accountName,
    debit: round2(debitNote.grandTotal),
    credit: 0,
    description: `Debit Note ${debitNote.debitNoteNumber} to ${debitNote.supplierName}`,
    partyId: debitNote.supplierId,
  });

  // Line 2: Credit Purchase Returns
  lines.push({
    accountId: accounts['5090']._id,
    accountCode: accounts['5090'].accountCode,
    accountName: accounts['5090'].accountName,
    debit: 0,
    credit: round2(debitNote.taxableAmount),
    description: `Purchase return against bill ${debitNote.billNumber}`,
  });

  // Line 3: Credit Input CGST Reversal
  if (debitNote.cgstTotal > 0) {
    lines.push({
      accountId: accounts['1310']._id,
      accountCode: accounts['1310'].accountCode,
      accountName: accounts['1310'].accountName,
      debit: 0,
      credit: round2(debitNote.cgstTotal),
      description: `CGST Input reversal on ${debitNote.debitNoteNumber}`,
    });
  }

  // Line 4: Credit Input SGST Reversal
  if (debitNote.sgstTotal > 0) {
    lines.push({
      accountId: accounts['1320']._id,
      accountCode: accounts['1320'].accountCode,
      accountName: accounts['1320'].accountName,
      debit: 0,
      credit: round2(debitNote.sgstTotal),
      description: `SGST Input reversal on ${debitNote.debitNoteNumber}`,
    });
  }

  // Line 5: Credit Input IGST Reversal
  if (debitNote.igstTotal > 0) {
    lines.push({
      accountId: accounts['1330']._id,
      accountCode: accounts['1330'].accountCode,
      accountName: accounts['1330'].accountName,
      debit: 0,
      credit: round2(debitNote.igstTotal),
      description: `IGST Input reversal on ${debitNote.debitNoteNumber}`,
    });
  }

  // Round Off if applicable
  const roundOff = round2(debitNote.roundOff || 0);
  if (roundOff !== 0) {
    if (roundOff < 0) {
      lines.push({
        accountId: accounts['6990']._id,
        accountCode: accounts['6990'].accountCode,
        accountName: accounts['6990'].accountName,
        debit: Math.abs(roundOff),
        credit: 0,
        description: `Rounding difference on ${debitNote.debitNoteNumber}`,
      });
    } else {
      lines.push({
        accountId: accounts['6990']._id,
        accountCode: accounts['6990'].accountCode,
        accountName: accounts['6990'].accountName,
        debit: 0,
        credit: roundOff,
        description: `Rounding difference on ${debitNote.debitNoteNumber}`,
      });
    }
  }

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(lines);
  const entryDate = debitNote.debitNoteDate || new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, entryDate, session);

  const entry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate,
    financialYear,
    narration: `Debit Note ${debitNote.debitNoteNumber} issued to ${debitNote.supplierName}`,
    sourceType: 'debit_note',
    sourceId: debitNote._id,
    sourceDocumentNumber: debitNote.debitNoteNumber,
    status: 'posted',
    lines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await entry.save({ session });
  } else {
    await entry.save();
  }

  return entry;
};

/**
 * 5. Automatic Journal Entry for Customer Receipt or Supplier Payment
 */
export const postPaymentJournal = async (tenantId, userId, payment, session = null) => {
  const existing = await JournalEntry.findOne({
    tenantId,
    sourceType: payment.direction === 'in' ? 'payment_receipt' : 'supplier_payment',
    sourceId: payment._id,
    status: 'posted',
  }).session(session);

  if (existing) return existing;

  const accounts = await seedDefaultAccounts(tenantId, session);
  const bankOrCashAccount = payment.paymentMethod === 'cash' ? accounts['1010'] : accounts['1020'];

  const lines = [];
  const amount = round2(payment.amount);

  if (payment.direction === 'in') {
    // Customer Receipt (Money In):
    // Debit Bank/Cash, Credit Accounts Receivable (Customer)
    lines.push({
      accountId: bankOrCashAccount._id,
      accountCode: bankOrCashAccount.accountCode,
      accountName: bankOrCashAccount.accountName,
      debit: amount,
      credit: 0,
      description: `Payment received: ${payment.paymentNumber} via ${payment.paymentMethod}`,
    });

    lines.push({
      accountId: accounts['1100']._id,
      accountCode: accounts['1100'].accountCode,
      accountName: accounts['1100'].accountName,
      debit: 0,
      credit: amount,
      description: `Settlement from ${payment.partyName || 'Customer'}`,
      partyId: payment.partyId,
    });
  } else {
    // Supplier Payment (Money Out):
    // Debit Accounts Payable (Supplier), Credit Bank/Cash
    lines.push({
      accountId: accounts['2010']._id,
      accountCode: accounts['2010'].accountCode,
      accountName: accounts['2010'].accountName,
      debit: amount,
      credit: 0,
      description: `Payment made to ${payment.partyName || 'Supplier'}`,
      partyId: payment.partyId,
    });

    lines.push({
      accountId: bankOrCashAccount._id,
      accountCode: bankOrCashAccount.accountCode,
      accountName: bankOrCashAccount.accountName,
      debit: 0,
      credit: amount,
      description: `Payment issued: ${payment.paymentNumber} via ${payment.paymentMethod}`,
    });
  }

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(lines);
  const entryDate = payment.paymentDate || new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, entryDate, session);

  const entry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate,
    financialYear,
    narration:
      payment.direction === 'in'
        ? `Receipt ${payment.paymentNumber} from ${payment.partyName || 'Customer'}`
        : `Payment ${payment.paymentNumber} to ${payment.partyName || 'Supplier'}`,
    sourceType: payment.direction === 'in' ? 'payment_receipt' : 'supplier_payment',
    sourceId: payment._id,
    sourceDocumentNumber: payment.paymentNumber,
    status: 'posted',
    lines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await entry.save({ session });
  } else {
    await entry.save();
  }

  return entry;
};

/**
 * Reversal of Payment Journal Entry
 */
export const reversePaymentJournal = async (tenantId, userId, payment, session = null) => {
  const sourceType = payment.direction === 'in' ? 'payment_receipt' : 'supplier_payment';
  const original = await JournalEntry.findOne({
    tenantId,
    sourceType,
    sourceId: payment._id,
    status: 'posted',
  }).session(session);

  if (!original) return null;

  const reversalLines = original.lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountName: l.accountName,
    debit: l.credit,
    credit: l.debit,
    description: `Reversal: ${l.description}`,
    partyId: l.partyId,
  }));

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(reversalLines);
  const reversalDate = new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, reversalDate, session);

  const reversalEntry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate: reversalDate,
    financialYear,
    narration: `Reversal of Payment ${payment.paymentNumber}`,
    sourceType,
    sourceId: payment._id,
    sourceDocumentNumber: payment.paymentNumber,
    status: 'posted',
    reversedFromEntryId: original._id,
    lines: reversalLines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await reversalEntry.save({ session });
  } else {
    await reversalEntry.save();
  }

  original.status = 'reversed';
  original.reversedAt = reversalDate;
  original.reversalEntryId = reversalEntry._id;
  if (session) {
    await original.save({ session });
  } else {
    await original.save();
  }

  return reversalEntry;
};

/**
 * 6. Automatic Journal Entry for Expense
 */
export const postExpenseJournal = async (tenantId, userId, expense, session = null) => {
  const existing = await JournalEntry.findOne({
    tenantId,
    sourceType: 'expense',
    sourceId: expense._id,
    status: 'posted',
  }).session(session);

  if (existing) return existing;

  const accounts = await seedDefaultAccounts(tenantId, session);
  const bankOrCashAccount = expense.paymentMethod === 'cash' ? accounts['1010'] : accounts['1020'];

  const lines = [];

  // Line 1: Debit Operating Expense (General & Admin Expense 6050)
  lines.push({
    accountId: accounts['6050']._id,
    accountCode: accounts['6050'].accountCode,
    accountName: accounts['6050'].accountName,
    debit: round2(expense.taxableAmount || expense.amount),
    credit: 0,
    description: `Expense: ${expense.categoryName || 'Operating expense'} (${expense.expenseNumber})`,
  });

  // Line 2: Debit Input Taxes if GST applicable
  if (expense.isGSTApplicable) {
    if (expense.cgst > 0) {
      lines.push({
        accountId: accounts['1310']._id,
        accountCode: accounts['1310'].accountCode,
        accountName: accounts['1310'].accountName,
        debit: round2(expense.cgst),
        credit: 0,
        description: `Input CGST on expense ${expense.expenseNumber}`,
      });
    }
    if (expense.sgst > 0) {
      lines.push({
        accountId: accounts['1320']._id,
        accountCode: accounts['1320'].accountCode,
        accountName: accounts['1320'].accountName,
        debit: round2(expense.sgst),
        credit: 0,
        description: `Input SGST on expense ${expense.expenseNumber}`,
      });
    }
    if (expense.igst > 0) {
      lines.push({
        accountId: accounts['1330']._id,
        accountCode: accounts['1330'].accountCode,
        accountName: accounts['1330'].accountName,
        debit: round2(expense.igst),
        credit: 0,
        description: `Input IGST on expense ${expense.expenseNumber}`,
      });
    }
  }

  // Line 3: Credit Bank / Cash Account for Total Paid
  lines.push({
    accountId: bankOrCashAccount._id,
    accountCode: bankOrCashAccount.accountCode,
    accountName: bankOrCashAccount.accountName,
    debit: 0,
    credit: round2(expense.amount),
    description: `Paid via ${expense.paymentMethod} for ${expense.categoryName}`,
  });

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(lines);
  const entryDate = expense.expenseDate || new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, entryDate, session);

  const entry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate,
    financialYear,
    narration: `Expense ${expense.expenseNumber} paid for ${expense.categoryName}`,
    sourceType: 'expense',
    sourceId: expense._id,
    sourceDocumentNumber: expense.expenseNumber,
    status: 'posted',
    lines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await entry.save({ session });
  } else {
    await entry.save();
  }

  return entry;
};

/**
 * Reversal of Expense Journal Entry
 */
export const reverseExpenseJournal = async (tenantId, userId, expense, session = null) => {
  const original = await JournalEntry.findOne({
    tenantId,
    sourceType: 'expense',
    sourceId: expense._id,
    status: 'posted',
  }).session(session);

  if (!original) return null;

  const reversalLines = original.lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountName: l.accountName,
    debit: l.credit,
    credit: l.debit,
    description: `Reversal: ${l.description}`,
    partyId: l.partyId,
  }));

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(reversalLines);
  const reversalDate = new Date();
  const { documentNumber, financialYear } = await generateJournalNumber(tenantId, reversalDate, session);

  const reversalEntry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate: reversalDate,
    financialYear,
    narration: `Reversal of Expense ${expense.expenseNumber}`,
    sourceType: 'expense',
    sourceId: expense._id,
    sourceDocumentNumber: expense.expenseNumber,
    status: 'posted',
    reversedFromEntryId: original._id,
    lines: reversalLines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  if (session) {
    await reversalEntry.save({ session });
  } else {
    await reversalEntry.save();
  }

  original.status = 'reversed';
  original.reversedAt = reversalDate;
  original.reversalEntryId = reversalEntry._id;
  if (session) {
    await original.save({ session });
  } else {
    await original.save();
  }

  return reversalEntry;
};

export default {
  generateJournalNumber,
  validateDoubleEntryBalance,
  postSalesInvoiceJournal,
  reverseSalesInvoiceJournal,
  postCreditNoteJournal,
  postPurchaseBillJournal,
  reversePurchaseBillJournal,
  postDebitNoteJournal,
  postPaymentJournal,
  reversePaymentJournal,
  postExpenseJournal,
  reverseExpenseJournal,
};
