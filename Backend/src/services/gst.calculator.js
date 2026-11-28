import { getFinancialYear, round2, INDIAN_STATES, resolveStateCode } from './sales.calculator.js';
import {
  GST_STATE_CODES,
  calculateGSTINChecksum,
  validateGSTIN,
  isValidGSTIN as validateGSTINBool,
} from '../utils/gstinValidator.js';

export {
  getFinancialYear,
  round2,
  INDIAN_STATES,
  resolveStateCode,
  GST_STATE_CODES,
  calculateGSTINChecksum,
  validateGSTIN,
};

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validate GSTIN format with strict state code, structure, and Mod-36 checksum
 */
export const isValidGSTIN = (gstin, options = { required: true }) => {
  if (!gstin || !String(gstin).trim()) return false;
  return validateGSTINBool(gstin, options);
};

/**
 * Normalize invoice or document number for matching
 * Strips whitespace, special characters (hyphens, slashes) and converts to uppercase
 */
export const normalizeDocNumber = (docNumber) => {
  if (!docNumber || typeof docNumber !== 'string') return '';
  return docNumber.replace(/[\s\-_/\\.]/g, '').toUpperCase();
};

/**
 * Resolve return period string ('042026', '2026-04', 'Q1-2026-27'), financial year, or explicit date range
 */
export const resolvePeriodDateRange = ({
  returnPeriod,
  financialYear,
  startDate,
  endDate,
}) => {
  let start = null;
  let end = null;
  let resolvedFY = financialYear || '';
  let resolvedPeriod = returnPeriod || '';

  // 1. If explicit startDate and endDate provided
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    if (!resolvedFY) resolvedFY = getFinancialYear(start);
    if (!resolvedPeriod) {
      const m = String(start.getMonth() + 1).padStart(2, '0');
      const y = start.getFullYear();
      resolvedPeriod = `${m}${y}`;
    }
    return { startDate: start, endDate: end, financialYear: resolvedFY, returnPeriod: resolvedPeriod };
  }

  // 2. Parse returnPeriod (MMYYYY or YYYY-MM or Q1-YYYY-YY)
  if (resolvedPeriod) {
    // Check 'MMYYYY' format e.g. '042026'
    if (/^\d{2}\d{4}$/.test(resolvedPeriod)) {
      const month = parseInt(resolvedPeriod.substring(0, 2), 10);
      const year = parseInt(resolvedPeriod.substring(2, 6), 10);
      start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      end = new Date(year, month, 0, 23, 59, 59, 999);
      if (!resolvedFY) resolvedFY = getFinancialYear(start);
      return { startDate: start, endDate: end, financialYear: resolvedFY, returnPeriod: resolvedPeriod };
    }

    // Check 'YYYY-MM' format e.g. '2026-04'
    if (/^\d{4}-\d{2}$/.test(resolvedPeriod)) {
      const [yearStr, monthStr] = resolvedPeriod.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      end = new Date(year, month, 0, 23, 59, 59, 999);
      if (!resolvedFY) resolvedFY = getFinancialYear(start);
      resolvedPeriod = `${monthStr}${yearStr}`;
      return { startDate: start, endDate: end, financialYear: resolvedFY, returnPeriod: resolvedPeriod };
    }

    // Check Quarterly format e.g. 'Q1-2026-27'
    const qMatch = resolvedPeriod.match(/^(Q[1-4])-(\d{4})-(\d{2})$/i);
    if (qMatch) {
      const quarter = qMatch[1].toUpperCase();
      const startYear = parseInt(qMatch[2], 10);
      resolvedFY = `${qMatch[2]}-${qMatch[3]}`;

      if (quarter === 'Q1') {
        start = new Date(startYear, 3, 1, 0, 0, 0, 0); // April 1
        end = new Date(startYear, 6, 0, 23, 59, 59, 999); // June 30
      } else if (quarter === 'Q2') {
        start = new Date(startYear, 6, 1, 0, 0, 0, 0); // July 1
        end = new Date(startYear, 9, 0, 23, 59, 59, 999); // Sept 30
      } else if (quarter === 'Q3') {
        start = new Date(startYear, 9, 1, 0, 0, 0, 0); // Oct 1
        end = new Date(startYear, 12, 0, 23, 59, 59, 999); // Dec 31
      } else if (quarter === 'Q4') {
        start = new Date(startYear + 1, 0, 1, 0, 0, 0, 0); // Jan 1
        end = new Date(startYear + 1, 3, 0, 23, 59, 59, 999); // March 31
      }
      return { startDate: start, endDate: end, financialYear: resolvedFY, returnPeriod: resolvedPeriod };
    }
  }

  // 3. Fallback to financialYear (e.g. '2026-27')
  if (resolvedFY && /^\d{4}-\d{2}$/.test(resolvedFY)) {
    const startYear = parseInt(resolvedFY.substring(0, 4), 10);
    start = new Date(startYear, 3, 1, 0, 0, 0, 0); // April 1
    end = new Date(startYear + 1, 2, 31, 23, 59, 59, 999); // March 31
    if (!resolvedPeriod) resolvedPeriod = `ALL-${resolvedFY}`;
    return { startDate: start, endDate: end, financialYear: resolvedFY, returnPeriod: resolvedPeriod };
  }

  // 4. Default: Current Month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  start = new Date(year, month, 1, 0, 0, 0, 0);
  end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  resolvedFY = getFinancialYear(now);
  const mStr = String(month + 1).padStart(2, '0');
  resolvedPeriod = `${mStr}${year}`;

  return { startDate: start, endDate: end, financialYear: resolvedFY, returnPeriod: resolvedPeriod };
};

/**
 * Standard GST ITC Utilization Algorithm (Section 49 & Rule 88A)
 * Set-off rules:
 * - IGST ITC set off against: IGST liability, then CGST liability, then SGST liability.
 * - CGST ITC set off against: CGST liability, then IGST liability (never SGST).
 * - SGST ITC set off against: SGST liability, then IGST liability (never CGST).
 * - Cess ITC set off against: Cess liability only.
 */
export const calculateTaxUtilization = ({ outputTax, eligibleITC }) => {
  let remainingLiabIGST = round2(outputTax.igst || 0);
  let remainingLiabCGST = round2(outputTax.cgst || 0);
  let remainingLiabSGST = round2(outputTax.sgst || 0);
  let remainingLiabCess = round2(outputTax.cess || 0);

  let availITCIGST = round2(eligibleITC.igst || 0);
  let availITCCGST = round2(eligibleITC.cgst || 0);
  let availITCSGST = round2(eligibleITC.sgst || 0);
  let availITCCess = round2(eligibleITC.cess || 0);

  const utilization = {
    igst: { fromIGST: 0, fromCGST: 0, fromSGST: 0, total: 0 },
    cgst: { fromIGST: 0, fromCGST: 0, total: 0 },
    sgst: { fromIGST: 0, fromSGST: 0, total: 0 },
    cess: { fromCess: 0, total: 0 },
    totalITCUtilized: 0,
  };

  // STEP 1: Utilize IGST ITC
  // 1a. Against IGST liability
  const igstToIgst = Math.min(remainingLiabIGST, availITCIGST);
  utilization.igst.fromIGST = round2(igstToIgst);
  remainingLiabIGST = round2(remainingLiabIGST - igstToIgst);
  availITCIGST = round2(availITCIGST - igstToIgst);

  // 1b. Remaining IGST ITC against CGST liability
  if (availITCIGST > 0 && remainingLiabCGST > 0) {
    const igstToCgst = Math.min(remainingLiabCGST, availITCIGST);
    utilization.cgst.fromIGST = round2(igstToCgst);
    remainingLiabCGST = round2(remainingLiabCGST - igstToCgst);
    availITCIGST = round2(availITCIGST - igstToCgst);
  }

  // 1c. Remaining IGST ITC against SGST liability
  if (availITCIGST > 0 && remainingLiabSGST > 0) {
    const igstToSgst = Math.min(remainingLiabSGST, availITCIGST);
    utilization.sgst.fromIGST = round2(igstToSgst);
    remainingLiabSGST = round2(remainingLiabSGST - igstToSgst);
    availITCIGST = round2(availITCIGST - igstToSgst);
  }

  // STEP 2: Utilize CGST ITC
  // 2a. Against CGST liability
  const cgstToCgst = Math.min(remainingLiabCGST, availITCCGST);
  utilization.cgst.fromCGST = round2(cgstToCgst);
  remainingLiabCGST = round2(remainingLiabCGST - cgstToCgst);
  availITCCGST = round2(availITCCGST - cgstToCgst);

  // 2b. Remaining CGST ITC against IGST liability (if any remaining)
  if (availITCCGST > 0 && remainingLiabIGST > 0) {
    const cgstToIgst = Math.min(remainingLiabIGST, availITCCGST);
    utilization.igst.fromCGST = round2(cgstToIgst);
    remainingLiabIGST = round2(remainingLiabIGST - cgstToIgst);
    availITCCGST = round2(availITCCGST - cgstToIgst);
  }

  // STEP 3: Utilize SGST ITC
  // 3a. Against SGST liability
  const sgstToSgst = Math.min(remainingLiabSGST, availITCSGST);
  utilization.sgst.fromSGST = round2(sgstToSgst);
  remainingLiabSGST = round2(remainingLiabSGST - sgstToSgst);
  availITCSGST = round2(availITCSGST - sgstToSgst);

  // 3b. Remaining SGST ITC against IGST liability (if any remaining)
  if (availITCSGST > 0 && remainingLiabIGST > 0) {
    const sgstToIgst = Math.min(remainingLiabIGST, availITCSGST);
    utilization.igst.fromSGST = round2(sgstToIgst);
    remainingLiabIGST = round2(remainingLiabIGST - sgstToIgst);
    availITCSGST = round2(availITCSGST - sgstToIgst);
  }

  // STEP 4: Utilize Cess ITC
  const cessToCess = Math.min(remainingLiabCess, availITCCess);
  utilization.cess.fromCess = round2(cessToCess);
  remainingLiabCess = round2(remainingLiabCess - cessToCess);
  availITCCess = round2(availITCCess - cessToCess);

  utilization.igst.total = round2(utilization.igst.fromIGST + utilization.igst.fromCGST + utilization.igst.fromSGST);
  utilization.cgst.total = round2(utilization.cgst.fromIGST + utilization.cgst.fromCGST);
  utilization.sgst.total = round2(utilization.sgst.fromIGST + utilization.sgst.fromSGST);
  utilization.cess.total = round2(utilization.cess.fromCess);
  utilization.totalITCUtilized = round2(
    utilization.igst.total + utilization.cgst.total + utilization.sgst.total + utilization.cess.total
  );

  const taxPayableCash = {
    igst: remainingLiabIGST,
    cgst: remainingLiabCGST,
    sgst: remainingLiabSGST,
    cess: remainingLiabCess,
    total: round2(remainingLiabIGST + remainingLiabCGST + remainingLiabSGST + remainingLiabCess),
  };

  const itcBalanceCarriedForward = {
    igst: availITCIGST,
    cgst: availITCCGST,
    sgst: availITCSGST,
    cess: availITCCess,
    total: round2(availITCIGST + availITCCGST + availITCSGST + availITCCess),
  };

  return {
    utilization,
    taxPayableCash,
    itcBalanceCarriedForward,
  };
};

export default {
  GSTIN_REGEX,
  isValidGSTIN,
  normalizeDocNumber,
  resolvePeriodDateRange,
  calculateTaxUtilization,
  round2,
  getFinancialYear,
  resolveStateCode,
};
