import mongoose from 'mongoose';
import Account from '../models/account.model.js';
import JournalEntry from '../models/journalEntry.model.js';
import FiscalYear from '../models/fiscalYear.model.js';
import { seedDefaultAccounts, STANDARD_ACCOUNTS } from './accounting.seed.js';
import {
  generateJournalNumber,
  validateDoubleEntryBalance,
} from './accounting.integration.js';
import { getFinancialYear, round2 } from './sales.calculator.js';

/**
 * Helper to compute start and end date for a financial year string (e.g., '2026-27')
 */
export const getFYDateRange = (fyString) => {
  if (!fyString || typeof fyString !== 'string' || !fyString.includes('-')) {
    const currentFY = getFinancialYear(new Date());
    const [startYearStr, endYearShort] = currentFY.split('-');
    const startYear = parseInt(startYearStr, 10);
    const endYear = startYear + 1;
    return {
      financialYear: currentFY,
      startDate: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0)), // April 1
      endDate: new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)), // March 31
    };
  }

  const [startYearStr, endYearShort] = fyString.split('-');
  const startYear = parseInt(startYearStr, 10);
  const endYear = startYear + 1;

  return {
    financialYear: fyString,
    startDate: new Date(Date.UTC(startYear, 3, 1, 0, 0, 0, 0)), // April 1
    endDate: new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)), // March 31
  };
};

/**
 * -------------------------------------------------------------
 * 1. CHART OF ACCOUNTS (COA) SERVICES
 * -------------------------------------------------------------
 */

/**
 * Seed default accounts for tenant
 */
export const seedAccounts = async (tenantId) => {
  return seedDefaultAccounts(tenantId);
};

/**
 * Create a new account
 */
export const createAccount = async (tenantId, data) => {
  await seedDefaultAccounts(tenantId);

  const existing = await Account.findOne({
    tenantId,
    accountCode: data.accountCode.trim().toUpperCase(),
    isDeleted: false,
  });

  if (existing) {
    const error = new Error(`Account code '${data.accountCode}' already exists for this tenant.`);
    error.statusCode = 400;
    throw error;
  }

  // Validate parent account if provided
  if (data.parentAccountId) {
    if (!mongoose.isValidObjectId(data.parentAccountId)) {
      const error = new Error('Invalid parent account ID format.');
      error.statusCode = 400;
      throw error;
    }

    const parent = await Account.findOne({
      _id: data.parentAccountId,
      tenantId,
      isDeleted: false,
    });

    if (!parent) {
      const error = new Error('Parent account not found or does not belong to this tenant.');
      error.statusCode = 404;
      throw error;
    }
  }

  const account = new Account({
    tenantId,
    accountName: data.accountName.trim(),
    accountCode: data.accountCode.trim().toUpperCase(),
    accountType: data.accountType,
    accountSubType: data.accountSubType || data.accountType,
    parentAccountId: data.parentAccountId || null,
    openingBalance: round2(data.openingBalance || 0),
    balanceType: data.balanceType || (['asset', 'expense'].includes(data.accountType) ? 'debit' : 'credit'),
    isSystemAccount: false,
    isActive: data.isActive !== undefined ? data.isActive : true,
    description: data.description || '',
  });

  await account.save();
  return account;
};

/**
 * Get accounts with filtering and search
 */
export const getAccounts = async (tenantId, query = {}) => {
  await seedDefaultAccounts(tenantId);

  const filter = { tenantId, isDeleted: false };

  if (query.accountType) {
    filter.accountType = query.accountType;
  }

  if (query.accountSubType) {
    filter.accountSubType = query.accountSubType;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  if (query.isSystemAccount !== undefined) {
    filter.isSystemAccount = query.isSystemAccount === 'true' || query.isSystemAccount === true;
  }

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ accountName: regex }, { accountCode: regex }, { accountSubType: regex }];
  }

  const accounts = await Account.find(filter)
    .populate('parentAccountId', 'accountName accountCode')
    .sort({ accountCode: 1 });

  return accounts;
};

/**
 * Get account by ID
 */
export const getAccountById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid account ID format.');
    error.statusCode = 400;
    throw error;
  }

  const account = await Account.findOne({
    _id: id,
    tenantId,
    isDeleted: false,
  }).populate('parentAccountId', 'accountName accountCode');

  if (!account) {
    const error = new Error('Account not found.');
    error.statusCode = 404;
    throw error;
  }

  return account;
};

/**
 * Update account
 */
export const updateAccount = async (tenantId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid account ID format.');
    error.statusCode = 400;
    throw error;
  }

  const account = await Account.findOne({
    _id: id,
    tenantId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('Account not found.');
    error.statusCode = 404;
    throw error;
  }

  // System account protection
  if (account.isSystemAccount) {
    if (data.accountCode && data.accountCode.trim().toUpperCase() !== account.accountCode) {
      const error = new Error('Cannot change account code of a system-defined account.');
      error.statusCode = 400;
      throw error;
    }
    if (data.accountType && data.accountType !== account.accountType) {
      const error = new Error('Cannot change account type of a system-defined account.');
      error.statusCode = 400;
      throw error;
    }
  }

  // Check unique code if changing
  if (data.accountCode && data.accountCode.trim().toUpperCase() !== account.accountCode) {
    const duplicate = await Account.findOne({
      tenantId,
      accountCode: data.accountCode.trim().toUpperCase(),
      _id: { $ne: id },
      isDeleted: false,
    });
    if (duplicate) {
      const error = new Error(`Account code '${data.accountCode}' is already in use.`);
      error.statusCode = 400;
      throw error;
    }
    account.accountCode = data.accountCode.trim().toUpperCase();
  }

  // Circular reference and parent check
  if (data.parentAccountId !== undefined) {
    if (data.parentAccountId === null || data.parentAccountId === '') {
      account.parentAccountId = null;
    } else {
      if (!mongoose.isValidObjectId(data.parentAccountId)) {
        const error = new Error('Invalid parent account ID format.');
        error.statusCode = 400;
        throw error;
      }
      if (data.parentAccountId.toString() === id.toString()) {
        const error = new Error('An account cannot be its own parent.');
        error.statusCode = 400;
        throw error;
      }

      // Check circular hierarchy
      let currentParentId = data.parentAccountId;
      const visited = new Set([id.toString()]);

      while (currentParentId) {
        if (visited.has(currentParentId.toString())) {
          const error = new Error('Circular account hierarchy detected.');
          error.statusCode = 400;
          throw error;
        }
        visited.add(currentParentId.toString());

        const parentAcc = await Account.findOne({
          _id: currentParentId,
          tenantId,
          isDeleted: false,
        });

        if (!parentAcc) {
          const error = new Error('Parent account not found or does not belong to this tenant.');
          error.statusCode = 404;
          throw error;
        }

        currentParentId = parentAcc.parentAccountId;
      }

      account.parentAccountId = data.parentAccountId;
    }
  }

  if (data.accountName !== undefined) account.accountName = data.accountName.trim();
  if (data.accountType !== undefined && !account.isSystemAccount) account.accountType = data.accountType;
  if (data.accountSubType !== undefined) account.accountSubType = data.accountSubType;
  if (data.openingBalance !== undefined) account.openingBalance = round2(data.openingBalance);
  if (data.balanceType !== undefined) account.balanceType = data.balanceType;
  if (data.isActive !== undefined) account.isActive = data.isActive;
  if (data.description !== undefined) account.description = data.description;

  await account.save();
  return account;
};

/**
 * Delete account (soft delete with system and transaction safeguards)
 */
export const deleteAccount = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid account ID format.');
    error.statusCode = 400;
    throw error;
  }

  const account = await Account.findOne({
    _id: id,
    tenantId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('Account not found.');
    error.statusCode = 404;
    throw error;
  }

  if (account.isSystemAccount) {
    const error = new Error('System-defined accounts cannot be deleted.');
    error.statusCode = 400;
    throw error;
  }

  // Check if any child accounts reference this account
  const childCount = await Account.countDocuments({
    tenantId,
    parentAccountId: id,
    isDeleted: false,
  });

  if (childCount > 0) {
    const error = new Error(`Cannot delete account: ${childCount} child account(s) depend on it.`);
    error.statusCode = 400;
    throw error;
  }

  // Check if any active journal entries reference this account
  const transactionExists = await JournalEntry.findOne({
    tenantId,
    'lines.accountId': id,
    status: { $ne: 'reversed' },
  });

  if (transactionExists) {
    const error = new Error('Cannot delete account with existing transactions. Deactivate it instead.');
    error.statusCode = 400;
    throw error;
  }

  account.isDeleted = true;
  account.isActive = false;
  await account.save();

  return { message: 'Account deleted successfully' };
};

/**
 * -------------------------------------------------------------
 * 2. JOURNAL ENTRY SERVICES
 * -------------------------------------------------------------
 */

/**
 * Create a manual journal entry with strict double-entry validation
 */
export const createJournalEntry = async (tenantId, userId, data) => {
  await seedDefaultAccounts(tenantId);

  if (!data.lines || !Array.isArray(data.lines) || data.lines.length < 2) {
    const error = new Error('A journal entry must contain at least two line items.');
    error.statusCode = 400;
    throw error;
  }

  const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();
  const financialYear = data.financialYear || getFinancialYear(entryDate);

  // Validate fiscal year lock
  const closedFY = await FiscalYear.findOne({
    tenantId,
    financialYear,
    isClosed: true,
  });

  if (closedFY) {
    const error = new Error(`Financial year ${financialYear} is closed. No new entries can be posted.`);
    error.statusCode = 400;
    throw error;
  }

  // Resolve and validate accounts for all lines
  const enrichedLines = [];
  for (const line of data.lines) {
    if (!line.accountId || !mongoose.isValidObjectId(line.accountId)) {
      const error = new Error(`Invalid account ID format in journal line.`);
      error.statusCode = 400;
      throw error;
    }

    const acc = await Account.findOne({
      _id: line.accountId,
      tenantId,
      isDeleted: false,
    });

    if (!acc) {
      const error = new Error(`Account not found or does not belong to this tenant.`);
      error.statusCode = 404;
      throw error;
    }

    if (!acc.isActive) {
      const error = new Error(`Account '${acc.accountName}' (${acc.accountCode}) is deactivated.`);
      error.statusCode = 400;
      throw error;
    }

    const debit = round2(line.debit || 0);
    const credit = round2(line.credit || 0);

    enrichedLines.push({
      accountId: acc._id,
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      debit,
      credit,
      description: line.description || '',
      partyId: line.partyId && mongoose.isValidObjectId(line.partyId) ? line.partyId : null,
    });
  }

  // Strict double entry validation
  const { totalDebit, totalCredit } = validateDoubleEntryBalance(enrichedLines);

  // Generate sequence
  const { documentNumber } = await generateJournalNumber(tenantId, entryDate);

  const journalEntry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate,
    financialYear,
    narration: data.narration ? data.narration.trim() : 'Manual journal entry',
    sourceType: 'manual',
    sourceId: null,
    sourceDocumentNumber: '',
    status: 'posted',
    lines: enrichedLines,
    totalDebit,
    totalCredit,
    createdBy: userId,
  });

  await journalEntry.save();
  return journalEntry;
};

/**
 * Get journal entries with filtering & pagination
 */
export const getJournalEntries = async (tenantId, query = {}) => {
  const filter = { tenantId };

  if (query.financialYear) {
    filter.financialYear = query.financialYear;
  }

  if (query.sourceType) {
    filter.sourceType = query.sourceType;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.startDate || query.endDate) {
    filter.entryDate = {};
    if (query.startDate) filter.entryDate.$gte = new Date(query.startDate);
    if (query.endDate) filter.entryDate.$lte = new Date(query.endDate);
  }

  if (query.accountId && mongoose.isValidObjectId(query.accountId)) {
    filter['lines.accountId'] = query.accountId;
  }

  if (query.partyId && mongoose.isValidObjectId(query.partyId)) {
    filter['lines.partyId'] = query.partyId;
  }

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { entryNumber: regex },
      { narration: regex },
      { sourceDocumentNumber: regex },
    ];
  }

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    JournalEntry.find(filter)
      .populate('createdBy', 'name email')
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    JournalEntry.countDocuments(filter),
  ]);

  return {
    entries,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get journal entry by ID
 */
export const getJournalEntryById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid journal entry ID format.');
    error.statusCode = 400;
    throw error;
  }

  const entry = await JournalEntry.findOne({
    _id: id,
    tenantId,
  })
    .populate('lines.accountId', 'accountName accountCode accountType accountSubType')
    .populate('lines.partyId', 'businessName contactPerson email')
    .populate('createdBy', 'name email')
    .populate('reversalEntryId', 'entryNumber entryDate narration')
    .populate('reversedFromEntryId', 'entryNumber entryDate narration');

  if (!entry) {
    const error = new Error('Journal entry not found.');
    error.statusCode = 404;
    throw error;
  }

  return entry;
};

/**
 * Reverse a journal entry
 */
export const reverseJournalEntry = async (tenantId, userId, id, { reason = 'Manual reversal', reversalDate = new Date() } = {}) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid journal entry ID format.');
    error.statusCode = 400;
    throw error;
  }

  const original = await JournalEntry.findOne({
    _id: id,
    tenantId,
  });

  if (!original) {
    const error = new Error('Journal entry not found.');
    error.statusCode = 404;
    throw error;
  }

  if (original.status === 'reversed') {
    const error = new Error(`Journal entry ${original.entryNumber} is already reversed.`);
    error.statusCode = 400;
    throw error;
  }

  const date = reversalDate ? new Date(reversalDate) : new Date();
  const financialYear = getFinancialYear(date);

  // Check fiscal lock
  const closedFY = await FiscalYear.findOne({
    tenantId,
    financialYear,
    isClosed: true,
  });

  if (closedFY) {
    const error = new Error(`Financial year ${financialYear} is closed.`);
    error.statusCode = 400;
    throw error;
  }

  // Generate opposing lines
  const reversalLines = original.lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    accountName: l.accountName,
    debit: l.credit,
    credit: l.debit,
    description: `Reversal: ${l.description || original.entryNumber}`,
    partyId: l.partyId,
  }));

  const { totalDebit, totalCredit } = validateDoubleEntryBalance(reversalLines);
  const { documentNumber } = await generateJournalNumber(tenantId, date);

  const reversalEntry = new JournalEntry({
    tenantId,
    entryNumber: documentNumber,
    entryDate: date,
    financialYear,
    narration: `Reversal of ${original.entryNumber}: ${reason}`,
    sourceType: original.sourceType,
    sourceId: original.sourceId,
    sourceDocumentNumber: original.sourceDocumentNumber,
    status: 'posted',
    lines: reversalLines,
    totalDebit,
    totalCredit,
    reversedFromEntryId: original._id,
    createdBy: userId,
  });

  await reversalEntry.save();

  original.status = 'reversed';
  original.reversedAt = date;
  original.reversalEntryId = reversalEntry._id;
  await original.save();

  return {
    message: 'Journal entry reversed successfully',
    originalEntry: original,
    reversalEntry,
  };
};

/**
 * -------------------------------------------------------------
 * 3. FINANCIAL REPORTS SERVICES
 * -------------------------------------------------------------
 */

/**
 * 1. General Ledger
 */
export const getGeneralLedger = async (tenantId, options = {}) => {
  let { accountId, financialYear, startDate, endDate, partyId } = options;

  if (!accountId || !mongoose.isValidObjectId(accountId)) {
    const firstAcc = await Account.findOne({ tenantId, isDeleted: false }).sort({ accountCode: 1 });
    if (firstAcc) {
      accountId = firstAcc._id.toString();
    } else {
      await seedDefaultAccounts(tenantId);
      const seeded = await Account.findOne({ tenantId, isDeleted: false }).sort({ accountCode: 1 });
      if (seeded) accountId = seeded._id.toString();
    }
  }

  if (!accountId) {
    const error = new Error('No accounts found for General Ledger report.');
    error.statusCode = 404;
    throw error;
  }

  const account = await Account.findOne({
    _id: accountId,
    tenantId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('Account not found.');
    error.statusCode = 404;
    throw error;
  }

  const range = getFYDateRange(financialYear || getFinancialYear(new Date()));
  const periodStart = startDate ? new Date(startDate) : range.startDate;
  const periodEnd = endDate ? new Date(endDate) : range.endDate;

  // Ensure end of day for periodEnd
  periodEnd.setUTCHours(23, 59, 59, 999);

  const isDebitNormal = ['asset', 'expense'].includes(account.accountType);

  // Calculate opening balance before periodStart
  const priorEntries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $lt: periodStart },
    'lines.accountId': account._id,
    ...(partyId && mongoose.isValidObjectId(partyId) ? { 'lines.partyId': partyId } : {}),
  });

  let priorDebitTotal = 0;
  let priorCreditTotal = 0;

  for (const entry of priorEntries) {
    for (const line of entry.lines) {
      if (line.accountId.toString() === account._id.toString()) {
        if (!partyId || (line.partyId && line.partyId.toString() === partyId.toString())) {
          priorDebitTotal = round2(priorDebitTotal + (line.debit || 0));
          priorCreditTotal = round2(priorCreditTotal + (line.credit || 0));
        }
      }
    }
  }

  // Base opening balance from account model
  const baseOpening = account.balanceType === 'debit' ? account.openingBalance : -account.openingBalance;
  const netPriorMovement = isDebitNormal
    ? priorDebitTotal - priorCreditTotal
    : priorCreditTotal - priorDebitTotal;

  const openingBalance = round2(
    (isDebitNormal ? baseOpening : -baseOpening) + netPriorMovement
  );

  // Query entries in period
  const periodEntries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $gte: periodStart, $lte: periodEnd },
    'lines.accountId': account._id,
    ...(partyId && mongoose.isValidObjectId(partyId) ? { 'lines.partyId': partyId } : {}),
  }).sort({ entryDate: 1, createdAt: 1 });

  let runningBalance = openingBalance;
  let periodDebit = 0;
  let periodCredit = 0;
  const ledgerLines = [];

  for (const entry of periodEntries) {
    for (const line of entry.lines) {
      if (line.accountId.toString() === account._id.toString()) {
        if (!partyId || (line.partyId && line.partyId.toString() === partyId.toString())) {
          const dr = round2(line.debit || 0);
          const cr = round2(line.credit || 0);

          periodDebit = round2(periodDebit + dr);
          periodCredit = round2(periodCredit + cr);

          if (isDebitNormal) {
            runningBalance = round2(runningBalance + dr - cr);
          } else {
            runningBalance = round2(runningBalance + cr - dr);
          }

          ledgerLines.push({
            entryId: entry._id,
            entryNumber: entry.entryNumber,
            entryDate: entry.entryDate,
            financialYear: entry.financialYear,
            sourceType: entry.sourceType,
            sourceDocumentNumber: entry.sourceDocumentNumber,
            narration: entry.narration,
            lineDescription: line.description,
            partyId: line.partyId,
            debit: dr,
            credit: cr,
            runningBalance,
          });
        }
      }
    }
  }

  return {
    account: {
      _id: account._id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      accountSubType: account.accountSubType,
      balanceType: account.balanceType,
    },
    filter: {
      financialYear: financialYear || getFinancialYear(periodStart),
      startDate: periodStart,
      endDate: periodEnd,
      partyId: partyId || null,
    },
    openingBalance,
    periodDebit,
    periodCredit,
    closingBalance: runningBalance,
    entries: ledgerLines,
  };
};

/**
 * 2. Trial Balance
 */
export const getTrialBalance = async (tenantId, options = {}) => {
  await seedDefaultAccounts(tenantId);

  const { financialYear, startDate, endDate, asOnDate } = options;

  const range = getFYDateRange(financialYear || (asOnDate ? getFinancialYear(new Date(asOnDate)) : getFinancialYear(new Date())));
  const periodStart = startDate ? new Date(startDate) : range.startDate;
  const periodEnd = asOnDate ? new Date(asOnDate) : (endDate ? new Date(endDate) : range.endDate);
  periodEnd.setUTCHours(23, 59, 59, 999);

  const accounts = await Account.find({
    tenantId,
    isDeleted: false,
  }).sort({ accountCode: 1 });

  // Fetch all posted entries up to periodEnd
  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $lte: periodEnd },
  });

  const trialAccounts = [];
  let totalOpeningDebit = 0;
  let totalOpeningCredit = 0;
  let totalPeriodDebit = 0;
  let totalPeriodCredit = 0;
  let totalClosingDebit = 0;
  let totalClosingCredit = 0;

  for (const acc of accounts) {
    let priorDr = 0;
    let priorCr = 0;
    let periodDr = 0;
    let periodCr = 0;

    for (const entry of entries) {
      const eDate = new Date(entry.entryDate);
      for (const line of entry.lines) {
        if (line.accountId.toString() === acc._id.toString()) {
          const dr = line.debit || 0;
          const cr = line.credit || 0;
          if (eDate < periodStart) {
            priorDr += dr;
            priorCr += cr;
          } else {
            periodDr += dr;
            periodCr += cr;
          }
        }
      }
    }

    // Opening calculation
    const initialBaseDr = acc.balanceType === 'debit' ? acc.openingBalance : 0;
    const initialBaseCr = acc.balanceType === 'credit' ? acc.openingBalance : 0;

    const netPrior = round2((initialBaseDr + priorDr) - (initialBaseCr + priorCr));
    let openingDr = 0;
    let openingCr = 0;
    if (netPrior > 0) {
      openingDr = netPrior;
    } else if (netPrior < 0) {
      openingCr = Math.abs(netPrior);
    }

    periodDr = round2(periodDr);
    periodCr = round2(periodCr);

    // Closing calculation
    const netClosing = round2((openingDr + periodDr) - (openingCr + periodCr));
    let closingDr = 0;
    let closingCr = 0;
    if (netClosing > 0) {
      closingDr = netClosing;
    } else if (netClosing < 0) {
      closingCr = Math.abs(netClosing);
    }

    // Accumulate only if account has any movement or opening/closing balances
    if (openingDr || openingCr || periodDr || periodCr || closingDr || closingCr) {
      trialAccounts.push({
        accountId: acc._id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        accountSubType: acc.accountSubType,
        openingDebit: openingDr,
        openingCredit: openingCr,
        periodDebit: periodDr,
        periodCredit: periodCr,
        closingDebit: closingDr,
        closingCredit: closingCr,
      });

      totalOpeningDebit = round2(totalOpeningDebit + openingDr);
      totalOpeningCredit = round2(totalOpeningCredit + openingCr);
      totalPeriodDebit = round2(totalPeriodDebit + periodDr);
      totalPeriodCredit = round2(totalPeriodCredit + periodCr);
      totalClosingDebit = round2(totalClosingDebit + closingDr);
      totalClosingCredit = round2(totalClosingCredit + closingCr);
    }
  }

  const isBalanced = Math.abs(round2(totalClosingDebit - totalClosingCredit)) <= 0.05;

  return {
    filter: {
      financialYear: financialYear || getFinancialYear(periodStart),
      startDate: periodStart,
      endDate: periodEnd,
    },
    accounts: trialAccounts,
    totalOpeningDebit,
    totalOpeningCredit,
    totalPeriodDebit,
    totalPeriodCredit,
    totalClosingDebit,
    totalClosingCredit,
    isBalanced,
  };
};

/**
 * 3. Profit & Loss Statement
 */
export const getProfitAndLoss = async (tenantId, options = {}) => {
  await seedDefaultAccounts(tenantId);

  const { financialYear, startDate, endDate } = options;

  const range = getFYDateRange(financialYear || getFinancialYear(new Date()));
  const periodStart = startDate ? new Date(startDate) : range.startDate;
  const periodEnd = endDate ? new Date(endDate) : range.endDate;
  periodEnd.setUTCHours(23, 59, 59, 999);

  // Fetch all posted entries in period
  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $gte: periodStart, $lte: periodEnd },
  });

  const accounts = await Account.find({
    tenantId,
    accountType: { $in: ['income', 'expense'] },
    isDeleted: false,
  });

  // Calculate net balances for income & expense accounts
  const accountBalances = {};
  for (const acc of accounts) {
    accountBalances[acc.accountCode] = {
      accountId: acc._id,
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      accountType: acc.accountType,
      accountSubType: acc.accountSubType,
      debit: 0,
      credit: 0,
      netAmount: 0,
    };
  }

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (accountBalances[line.accountCode]) {
        accountBalances[line.accountCode].debit += line.debit || 0;
        accountBalances[line.accountCode].credit += line.credit || 0;
      }
    }
  }

  // Calculate net balances:
  // For Income: Credit - Debit (positive means income)
  // For Expense: Debit - Credit (positive means expense)
  for (const code in accountBalances) {
    const b = accountBalances[code];
    if (b.accountType === 'income') {
      b.netAmount = round2(b.credit - b.debit);
    } else {
      b.netAmount = round2(b.debit - b.credit);
    }
  }

  // Revenue breakdown
  const salesAcc = accountBalances['4010']?.netAmount || 0;
  const serviceAcc = accountBalances['4020']?.netAmount || 0;
  // 4090 is Sales Returns (contra-revenue with natural debit balance)
  const salesReturnsDebit = round2(
    (accountBalances['4090']?.debit || 0) - (accountBalances['4090']?.credit || 0)
  );
  const netSalesRevenue = round2(salesAcc + serviceAcc - salesReturnsDebit);

  const otherIncomeAcc = accountBalances['4200']?.netAmount || 0;
  const totalRevenue = round2(netSalesRevenue + otherIncomeAcc);

  // COGS breakdown
  const purchasesAcc = accountBalances['5010']?.netAmount || 0;
  const freightAcc = accountBalances['5100']?.netAmount || 0;
  // 5090 is Purchase Returns (contra-COGS with natural credit balance)
  const purchaseReturnsCredit = round2(
    (accountBalances['5090']?.credit || 0) - (accountBalances['5090']?.debit || 0)
  );
  const totalCOGS = round2(purchasesAcc + freightAcc - purchaseReturnsCredit);

  // Gross Profit
  const grossProfit = round2(netSalesRevenue - totalCOGS);

  // Operating Expenses breakdown (codes 6000-6999)
  const operatingExpenses = [];
  let totalOperatingExpenses = 0;

  for (const code in accountBalances) {
    const b = accountBalances[code];
    if (b.accountType === 'expense' && code.startsWith('6')) {
      if (b.netAmount !== 0) {
        operatingExpenses.push({
          accountId: b.accountId,
          accountCode: b.accountCode,
          accountName: b.accountName,
          accountSubType: b.accountSubType,
          amount: b.netAmount,
        });
      }
      totalOperatingExpenses = round2(totalOperatingExpenses + b.netAmount);
    }
  }

  // Operating Profit
  const operatingProfit = round2(grossProfit - totalOperatingExpenses);

  // Net Profit / (Loss)
  const netProfitOrLoss = round2(operatingProfit + otherIncomeAcc);

  return {
    filter: {
      financialYear: financialYear || getFinancialYear(periodStart),
      startDate: periodStart,
      endDate: periodEnd,
    },
    revenue: {
      grossSales: round2(salesAcc + serviceAcc),
      salesReturns: salesReturnsDebit,
      netSalesRevenue,
      otherIncome: otherIncomeAcc,
      totalRevenue,
    },
    costOfGoodsSold: {
      purchases: purchasesAcc,
      directExpenses: freightAcc,
      purchaseReturns: purchaseReturnsCredit,
      totalCOGS,
    },
    grossProfit,
    operatingExpenses: {
      items: operatingExpenses,
      totalOperatingExpenses,
    },
    operatingProfit,
    netProfitOrLoss,
  };
};

/**
 * 4. Balance Sheet
 */
export const getBalanceSheet = async (tenantId, options = {}) => {
  await seedDefaultAccounts(tenantId);

  const { financialYear, asOnDate } = options;

  let cutoffDate;
  if (asOnDate) {
    cutoffDate = new Date(asOnDate);
  } else if (financialYear) {
    cutoffDate = getFYDateRange(financialYear).endDate;
  } else {
    cutoffDate = new Date();
  }
  cutoffDate.setUTCHours(23, 59, 59, 999);

  // All non-deleted accounts
  const accounts = await Account.find({
    tenantId,
    isDeleted: false,
  });

  // Fetch all posted entries up to cutoffDate
  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $lte: cutoffDate },
  });

  const accountTotals = {};
  for (const acc of accounts) {
    accountTotals[acc.accountCode] = {
      accountId: acc._id,
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      accountType: acc.accountType,
      accountSubType: acc.accountSubType,
      balanceType: acc.balanceType,
      openingBalance: acc.openingBalance,
      debit: 0,
      credit: 0,
    };
  }

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (accountTotals[line.accountCode]) {
        accountTotals[line.accountCode].debit += line.debit || 0;
        accountTotals[line.accountCode].credit += line.credit || 0;
      }
    }
  }

  // Assets
  const currentAssets = [];
  let totalCurrentAssets = 0;
  const fixedAssets = [];
  let totalFixedAssets = 0;

  // Liabilities
  const currentLiabilities = [];
  let totalCurrentLiabilities = 0;
  const nonCurrentLiabilities = [];
  let totalNonCurrentLiabilities = 0;

  // Equity
  let ownersCapital = 0;
  let retainedEarnings = 0;

  for (const code in accountTotals) {
    const item = accountTotals[code];
    const initialDr = item.balanceType === 'debit' ? item.openingBalance : 0;
    const initialCr = item.balanceType === 'credit' ? item.openingBalance : 0;

    const netDr = (initialDr + item.debit) - (initialCr + item.credit);
    const netCr = (initialCr + item.credit) - (initialDr + item.debit);

    if (item.accountType === 'asset') {
      const balance = round2(netDr);
      if (balance !== 0 || item.openingBalance !== 0) {
        const record = {
          accountId: item.accountId,
          accountCode: item.accountCode,
          accountName: item.accountName,
          accountSubType: item.accountSubType,
          amount: balance,
        };

        if (item.accountSubType === 'fixed_asset' || code.startsWith('15')) {
          fixedAssets.push(record);
          totalFixedAssets = round2(totalFixedAssets + balance);
        } else {
          currentAssets.push(record);
          totalCurrentAssets = round2(totalCurrentAssets + balance);
        }
      }
    } else if (item.accountType === 'liability') {
      const balance = round2(netCr);
      if (balance !== 0 || item.openingBalance !== 0) {
        const record = {
          accountId: item.accountId,
          accountCode: item.accountCode,
          accountName: item.accountName,
          accountSubType: item.accountSubType,
          amount: balance,
        };

        if (item.accountSubType === 'long_term_liability' || code.startsWith('25')) {
          nonCurrentLiabilities.push(record);
          totalNonCurrentLiabilities = round2(totalNonCurrentLiabilities + balance);
        } else {
          currentLiabilities.push(record);
          totalCurrentLiabilities = round2(totalCurrentLiabilities + balance);
        }
      }
    } else if (item.accountType === 'equity') {
      const balance = round2(netCr);
      if (code === '3010') {
        ownersCapital = round2(ownersCapital + balance);
      } else if (code === '3020') {
        retainedEarnings = round2(retainedEarnings + balance);
      }
    }
  }

  const totalAssets = round2(totalCurrentAssets + totalFixedAssets);
  const totalLiabilities = round2(totalCurrentLiabilities + totalNonCurrentLiabilities);

  // Current period profit/loss calculation up to cutoffDate
  const fyRange = getFYDateRange(financialYear || getFinancialYear(cutoffDate));
  const pnl = await getProfitAndLoss(tenantId, {
    startDate: fyRange.startDate,
    endDate: cutoffDate,
  });

  const currentPeriodProfit = pnl.netProfitOrLoss;
  const totalEquity = round2(ownersCapital + retainedEarnings + currentPeriodProfit);
  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);

  const isBalanced = Math.abs(round2(totalAssets - totalLiabilitiesAndEquity)) <= 0.05;

  return {
    asOnDate: cutoffDate,
    financialYear: financialYear || getFinancialYear(cutoffDate),
    assets: {
      currentAssets,
      totalCurrentAssets,
      fixedAssets,
      totalFixedAssets,
      totalAssets,
    },
    liabilities: {
      currentLiabilities,
      totalCurrentLiabilities,
      nonCurrentLiabilities,
      totalNonCurrentLiabilities,
      totalLiabilities,
    },
    equity: {
      ownersCapital,
      retainedEarnings,
      currentPeriodProfit,
      totalEquity,
    },
    totalLiabilitiesAndEquity,
    isBalanced,
  };
};

/**
 * 5. Cash Flow Statement
 */
export const getCashFlowStatement = async (tenantId, options = {}) => {
  await seedDefaultAccounts(tenantId);

  const { financialYear, startDate, endDate } = options;

  const range = getFYDateRange(financialYear || getFinancialYear(new Date()));
  const periodStart = startDate ? new Date(startDate) : range.startDate;
  const periodEnd = endDate ? new Date(endDate) : range.endDate;
  periodEnd.setUTCHours(23, 59, 59, 999);

  // Cash and Bank accounts (1010, 1020)
  const cashAccounts = await Account.find({
    tenantId,
    accountCode: { $in: ['1010', '1020'] },
    isDeleted: false,
  });

  const cashAccountIds = cashAccounts.map((a) => a._id.toString());

  // Calculate opening cash & bank balance before periodStart
  const priorEntries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $lt: periodStart },
    'lines.accountId': { $in: cashAccountIds },
  });

  let openingCash = 0;
  for (const acc of cashAccounts) {
    openingCash += acc.openingBalance || 0;
  }

  for (const entry of priorEntries) {
    for (const line of entry.lines) {
      if (cashAccountIds.includes(line.accountId.toString())) {
        openingCash += (line.debit || 0) - (line.credit || 0);
      }
    }
  }
  openingCash = round2(openingCash);

  // Period entries involving cash/bank
  const periodEntries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $gte: periodStart, $lte: periodEnd },
    'lines.accountId': { $in: cashAccountIds },
  });

  let cashFromCustomers = 0;
  let cashPaidToSuppliers = 0;
  let cashPaidForExpenses = 0;
  let otherOperatingCash = 0;

  let cashFromFixedAssets = 0;
  let cashPaidForFixedAssets = 0;

  let cashFromCapitalAndFinancing = 0;
  let cashPaidForFinancing = 0;

  for (const entry of periodEntries) {
    // Determine net cash movement in this entry
    let netCashMovement = 0;
    for (const line of entry.lines) {
      if (cashAccountIds.includes(line.accountId.toString())) {
        netCashMovement += (line.debit || 0) - (line.credit || 0);
      }
    }

    if (round2(netCashMovement) === 0) continue;

    // Check non-cash lines in this entry to classify
    const nonCashLines = entry.lines.filter((l) => !cashAccountIds.includes(l.accountId.toString()));

    for (const line of nonCashLines) {
      const code = line.accountCode;

      if (entry.sourceType === 'payment_receipt' || code === '1100' || code.startsWith('4')) {
        // Customer receipt or direct revenue
        cashFromCustomers = round2(cashFromCustomers + (line.credit || 0) - (line.debit || 0));
      } else if (entry.sourceType === 'supplier_payment' || code === '2010' || code.startsWith('5')) {
        // Supplier payment or purchases
        cashPaidToSuppliers = round2(cashPaidToSuppliers + (line.debit || 0) - (line.credit || 0));
      } else if (entry.sourceType === 'expense' || code.startsWith('6')) {
        // Operating expense payment
        cashPaidForExpenses = round2(cashPaidForExpenses + (line.debit || 0) - (line.credit || 0));
      } else if (code.startsWith('15')) {
        // Fixed asset investment
        if (line.debit > 0) cashPaidForFixedAssets = round2(cashPaidForFixedAssets + line.debit);
        if (line.credit > 0) cashFromFixedAssets = round2(cashFromFixedAssets + line.credit);
      } else if (code === '3010' || code.startsWith('25')) {
        // Capital / Loan financing
        if (line.credit > 0) cashFromCapitalAndFinancing = round2(cashFromCapitalAndFinancing + line.credit);
        if (line.debit > 0) cashPaidForFinancing = round2(cashPaidForFinancing + line.debit);
      } else {
        // Other operating
        if (netCashMovement > 0) otherOperatingCash = round2(otherOperatingCash + netCashMovement);
        else otherOperatingCash = round2(otherOperatingCash + netCashMovement);
      }
    }
  }

  // Operating Activities
  const netCashFromOperating = round2(
    cashFromCustomers - cashPaidToSuppliers - cashPaidForExpenses + otherOperatingCash
  );

  // Investing Activities
  const netCashFromInvesting = round2(cashFromFixedAssets - cashPaidForFixedAssets);

  // Financing Activities
  const netCashFromFinancing = round2(cashFromCapitalAndFinancing - cashPaidForFinancing);

  // Total Net Cash Flow
  const netChangeInCash = round2(netCashFromOperating + netCashFromInvesting + netCashFromFinancing);
  const closingCash = round2(openingCash + netChangeInCash);

  return {
    filter: {
      financialYear: financialYear || getFinancialYear(periodStart),
      startDate: periodStart,
      endDate: periodEnd,
    },
    operatingActivities: {
      cashFromCustomers,
      cashPaidToSuppliers: -cashPaidToSuppliers,
      cashPaidForExpenses: -cashPaidForExpenses,
      otherOperatingCash,
      netCashFromOperating,
    },
    investingActivities: {
      cashFromFixedAssets,
      cashPaidForFixedAssets: -cashPaidForFixedAssets,
      netCashFromInvesting,
    },
    financingActivities: {
      cashFromCapitalAndFinancing,
      cashPaidForFinancing: -cashPaidForFinancing,
      netCashFromFinancing,
    },
    netChangeInCash,
    openingCashAndBank: openingCash,
    closingCashAndBank: closingCash,
  };
};

/**
 * 6. Financial Year Close Workflow
 */
export const closeFinancialYear = async (tenantId, userId, { financialYear }) => {
  await seedDefaultAccounts(tenantId);

  if (!financialYear) {
    const error = new Error('Financial year string (e.g. "2026-27") is required.');
    error.statusCode = 400;
    throw error;
  }

  // Check if already closed
  const existingClosure = await FiscalYear.findOne({
    tenantId,
    financialYear,
    isClosed: true,
  });

  if (existingClosure) {
    const error = new Error(`Financial year ${financialYear} has already been closed.`);
    error.statusCode = 400;
    throw error;
  }

  const { startDate, endDate } = getFYDateRange(financialYear);

  // Get P&L for the full financial year
  const pnl = await getProfitAndLoss(tenantId, {
    financialYear,
    startDate,
    endDate,
  });

  const netProfitOrLoss = pnl.netProfitOrLoss;

  // Retrieve all income and expense accounts
  const accounts = await Account.find({
    tenantId,
    accountType: { $in: ['income', 'expense'] },
    isDeleted: false,
  });

  const entries = await JournalEntry.find({
    tenantId,
    status: 'posted',
    entryDate: { $gte: startDate, $lte: endDate },
  });

  const closingLines = [];

  for (const acc of accounts) {
    let dr = 0;
    let cr = 0;

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.accountId.toString() === acc._id.toString()) {
          dr += line.debit || 0;
          cr += line.credit || 0;
        }
      }
    }

    dr = round2(dr);
    cr = round2(cr);

    if (acc.accountType === 'income') {
      const netCr = round2(cr - dr);
      if (netCr > 0) {
        // Zero out income by debiting
        closingLines.push({
          accountId: acc._id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          debit: netCr,
          credit: 0,
          description: `Year-end close FY ${financialYear}`,
        });
      } else if (netCr < 0) {
        closingLines.push({
          accountId: acc._id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          debit: 0,
          credit: Math.abs(netCr),
          description: `Year-end close FY ${financialYear}`,
        });
      }
    } else if (acc.accountType === 'expense') {
      const netDr = round2(dr - cr);
      if (netDr > 0) {
        // Zero out expense by crediting
        closingLines.push({
          accountId: acc._id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          debit: 0,
          credit: netDr,
          description: `Year-end close FY ${financialYear}`,
        });
      } else if (netDr < 0) {
        closingLines.push({
          accountId: acc._id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          debit: Math.abs(netDr),
          credit: 0,
          description: `Year-end close FY ${financialYear}`,
        });
      }
    }
  }

  // Balancing line transferred to Retained Earnings (3020)
  const retainedEarningsAcc = await Account.findOne({
    tenantId,
    accountCode: '3020',
    isDeleted: false,
  });

  if (!retainedEarningsAcc) {
    const error = new Error('Retained Earnings account (3020) not found.');
    error.statusCode = 500;
    throw error;
  }

  if (netProfitOrLoss > 0) {
    closingLines.push({
      accountId: retainedEarningsAcc._id,
      accountCode: retainedEarningsAcc.accountCode,
      accountName: retainedEarningsAcc.accountName,
      debit: 0,
      credit: round2(netProfitOrLoss),
      description: `Net Profit transferred to Retained Earnings for FY ${financialYear}`,
    });
  } else if (netProfitOrLoss < 0) {
    closingLines.push({
      accountId: retainedEarningsAcc._id,
      accountCode: retainedEarningsAcc.accountCode,
      accountName: retainedEarningsAcc.accountName,
      debit: round2(Math.abs(netProfitOrLoss)),
      credit: 0,
      description: `Net Loss transferred to Retained Earnings for FY ${financialYear}`,
    });
  }

  let closingEntry = null;

  if (closingLines.length >= 2) {
    const { totalDebit, totalCredit } = validateDoubleEntryBalance(closingLines);
    const { documentNumber } = await generateJournalNumber(tenantId, endDate);

    closingEntry = new JournalEntry({
      tenantId,
      entryNumber: documentNumber,
      entryDate: endDate,
      financialYear,
      narration: `Year-end closing entry for FY ${financialYear}`,
      sourceType: 'year_end_close',
      sourceId: null,
      sourceDocumentNumber: financialYear,
      status: 'posted',
      lines: closingLines,
      totalDebit,
      totalCredit,
      createdBy: userId,
    });

    await closingEntry.save();
  }

  // Create or update FiscalYear
  const fiscalYearRecord = await FiscalYear.findOneAndUpdate(
    { tenantId, financialYear },
    {
      startDate,
      endDate,
      isClosed: true,
      closedAt: new Date(),
      closedBy: userId,
      closingEntryId: closingEntry ? closingEntry._id : null,
      netProfitOrLoss,
    },
    { upsert: true, returnDocument: 'after' }
  );

  return {
    message: `Financial Year ${financialYear} closed successfully.`,
    fiscalYear: fiscalYearRecord,
    closingEntry,
    netProfitOrLoss,
  };
};

export default {
  seedAccounts,
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  createJournalEntry,
  getJournalEntries,
  getJournalEntryById,
  reverseJournalEntry,
  getGeneralLedger,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlowStatement,
  closeFinancialYear,
};
