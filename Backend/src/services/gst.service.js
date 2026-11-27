import crypto from 'crypto';
import mongoose from 'mongoose';
import SalesInvoice from '../models/salesInvoice.model.js';
import CreditNote from '../models/creditNote.model.js';
import PurchaseBill from '../models/purchaseBill.model.js';
import DebitNote from '../models/debitNote.model.js';
import Expense from '../models/expense.model.js';
import Tenant from '../models/tenant.model.js';
import GSTReturnPeriod from '../models/gstReturnPeriod.model.js';
import GSTR2BImport from '../models/gstr2bImport.model.js';
import {
  resolvePeriodDateRange,
  calculateTaxUtilization,
  isValidGSTIN,
  normalizeDocNumber,
  round2,
  getFinancialYear,
  resolveStateCode,
  INDIAN_STATES,
} from './gst.calculator.js';

/**
 * ========================================================
 * 1. GST DASHBOARD SUMMARY
 * ========================================================
 */
export const getGSTDashboard = async (tenantId, options = {}) => {
  const { startDate, endDate, financialYear, returnPeriod } = resolvePeriodDateRange(options);

  // 1. Fetch posted sales invoices and credit notes in period
  const [salesInvoices, creditNotes, purchaseBills, debitNotes, expenses] = await Promise.all([
    SalesInvoice.find({
      tenantId,
      invoiceStatus: 'posted',
      invoiceDate: { $gte: startDate, $lte: endDate },
    }).lean(),
    CreditNote.find({
      tenantId,
      status: 'posted',
      creditNoteDate: { $gte: startDate, $lte: endDate },
    }).lean(),
    PurchaseBill.find({
      tenantId,
      billStatus: 'posted',
      billDate: { $gte: startDate, $lte: endDate },
    }).lean(),
    DebitNote.find({
      tenantId,
      status: 'posted',
      debitNoteDate: { $gte: startDate, $lte: endDate },
    }).lean(),
    Expense.find({
      tenantId,
      status: 'paid',
      isGSTApplicable: true,
      expenseDate: { $gte: startDate, $lte: endDate },
    }).lean(),
  ]);

  // A. Outward Supplies (Sales)
  let grossSalesTaxable = 0;
  let grossSalesCGST = 0;
  let grossSalesSGST = 0;
  let grossSalesIGST = 0;
  let grossSalesCess = 0;

  for (const inv of salesInvoices) {
    grossSalesTaxable += inv.taxableAmount || 0;
    grossSalesCGST += inv.cgstTotal || 0;
    grossSalesSGST += inv.sgstTotal || 0;
    grossSalesIGST += inv.igstTotal || 0;
    grossSalesCess += inv.cessTotal || 0;
  }

  // B. Sales Returns (Credit Notes)
  let cnTaxable = 0;
  let cnCGST = 0;
  let cnSGST = 0;
  let cnIGST = 0;
  let cnCess = 0;

  for (const cn of creditNotes) {
    cnTaxable += cn.taxableAmount || 0;
    cnCGST += cn.cgstTotal || 0;
    cnSGST += cn.sgstTotal || 0;
    cnIGST += cn.igstTotal || 0;
    cnCess += cn.cessTotal || 0;
  }

  const netSalesTaxable = round2(grossSalesTaxable - cnTaxable);
  const outputCGST = round2(grossSalesCGST - cnCGST);
  const outputSGST = round2(grossSalesSGST - cnSGST);
  const outputIGST = round2(grossSalesIGST - cnIGST);
  const outputCess = round2(grossSalesCess - cnCess);
  const totalOutputTax = round2(outputCGST + outputSGST + outputIGST + outputCess);

  // C. Inward Supplies (Purchases)
  let grossPurchasesTaxable = 0;
  let grossPurchasesCGST = 0;
  let grossPurchasesSGST = 0;
  let grossPurchasesIGST = 0;
  let grossPurchasesCess = 0;

  let eligiblePurchasesCGST = 0;
  let eligiblePurchasesSGST = 0;
  let eligiblePurchasesIGST = 0;
  let eligiblePurchasesCess = 0;

  let ineligiblePurchasesCGST = 0;
  let ineligiblePurchasesSGST = 0;
  let ineligiblePurchasesIGST = 0;
  let ineligiblePurchasesCess = 0;

  for (const bill of purchaseBills) {
    grossPurchasesTaxable += bill.taxableAmount || 0;
    grossPurchasesCGST += bill.cgstTotal || 0;
    grossPurchasesSGST += bill.sgstTotal || 0;
    grossPurchasesIGST += bill.igstTotal || 0;
    grossPurchasesCess += bill.cessTotal || 0;

    if (bill.isITCClaimable !== false) {
      eligiblePurchasesCGST += bill.cgstTotal || 0;
      eligiblePurchasesSGST += bill.sgstTotal || 0;
      eligiblePurchasesIGST += bill.igstTotal || 0;
      eligiblePurchasesCess += bill.cessTotal || 0;
    } else {
      ineligiblePurchasesCGST += bill.cgstTotal || 0;
      ineligiblePurchasesSGST += bill.sgstTotal || 0;
      ineligiblePurchasesIGST += bill.igstTotal || 0;
      ineligiblePurchasesCess += bill.cessTotal || 0;
    }
  }

  // D. Purchase Returns (Debit Notes)
  let dnTaxable = 0;
  let dnCGST = 0;
  let dnSGST = 0;
  let dnIGST = 0;
  let dnCess = 0;

  for (const dn of debitNotes) {
    dnTaxable += dn.taxableAmount || 0;
    dnCGST += dn.cgstTotal || 0;
    dnSGST += dn.sgstTotal || 0;
    dnIGST += dn.igstTotal || 0;
    dnCess += dn.cessTotal || 0;
  }

  // E. Eligible & Ineligible Expenses ITC
  let expenseTaxable = 0;
  let eligibleExpenseCGST = 0;
  let eligibleExpenseSGST = 0;
  let eligibleExpenseIGST = 0;
  let eligibleExpenseCess = 0;

  let ineligibleExpenseCGST = 0;
  let ineligibleExpenseSGST = 0;
  let ineligibleExpenseIGST = 0;
  let ineligibleExpenseCess = 0;

  for (const exp of expenses) {
    expenseTaxable += exp.taxableAmount || 0;
    if (exp.isITCClaimable) {
      eligibleExpenseCGST += exp.cgst || 0;
      eligibleExpenseSGST += exp.sgst || 0;
      eligibleExpenseIGST += exp.igst || 0;
      eligibleExpenseCess += exp.cess || 0;
    } else {
      ineligibleExpenseCGST += exp.cgst || 0;
      ineligibleExpenseSGST += exp.sgst || 0;
      ineligibleExpenseIGST += exp.igst || 0;
      ineligibleExpenseCess += exp.cess || 0;
    }
  }

  // Net Inward Purchases
  const netPurchasesTaxable = round2(grossPurchasesTaxable - dnTaxable);
  const inputCGST = round2(grossPurchasesCGST - dnCGST);
  const inputSGST = round2(grossPurchasesSGST - dnSGST);
  const inputIGST = round2(grossPurchasesIGST - dnIGST);
  const inputCess = round2(grossPurchasesCess - dnCess);
  const totalInputTax = round2(inputCGST + inputSGST + inputIGST + inputCess);

  // Eligible ITC (Purchases - Debit Notes + Eligible Expenses)
  const eligibleITC = {
    cgst: Math.max(0, round2(eligiblePurchasesCGST - dnCGST + eligibleExpenseCGST)),
    sgst: Math.max(0, round2(eligiblePurchasesSGST - dnSGST + eligibleExpenseSGST)),
    igst: Math.max(0, round2(eligiblePurchasesIGST - dnIGST + eligibleExpenseIGST)),
    cess: Math.max(0, round2(eligiblePurchasesCess - dnCess + eligibleExpenseCess)),
  };
  eligibleITC.total = round2(eligibleITC.cgst + eligibleITC.sgst + eligibleITC.igst + eligibleITC.cess);

  // Ineligible ITC
  const ineligibleITC = {
    cgst: round2(ineligiblePurchasesCGST + ineligibleExpenseCGST),
    sgst: round2(ineligiblePurchasesSGST + ineligibleExpenseSGST),
    igst: round2(ineligiblePurchasesIGST + ineligibleExpenseIGST),
    cess: round2(ineligiblePurchasesCess + ineligibleExpenseCess),
  };
  ineligibleITC.total = round2(ineligibleITC.cgst + ineligibleITC.sgst + ineligibleITC.igst + ineligibleITC.cess);

  // Net GST Liability calculation using legal cross-utilization rules
  const outputTax = {
    cgst: outputCGST,
    sgst: outputSGST,
    igst: outputIGST,
    cess: outputCess,
    total: totalOutputTax,
  };

  const utilizationResult = calculateTaxUtilization({
    outputTax,
    eligibleITC,
  });

  return {
    period: {
      returnPeriod,
      financialYear,
      startDate,
      endDate,
    },
    counts: {
      salesInvoices: salesInvoices.length,
      creditNotes: creditNotes.length,
      purchaseBills: purchaseBills.length,
      debitNotes: debitNotes.length,
      expenses: expenses.length,
    },
    outwardSupplies: {
      grossTaxableSales: round2(grossSalesTaxable),
      creditNoteAdjustments: round2(cnTaxable),
      netTaxableSales: netSalesTaxable,
      cgst: outputCGST,
      sgst: outputSGST,
      igst: outputIGST,
      cess: outputCess,
      totalOutputTax,
    },
    inwardSupplies: {
      grossTaxablePurchases: round2(grossPurchasesTaxable),
      debitNoteAdjustments: round2(dnTaxable),
      netTaxablePurchases: netPurchasesTaxable,
      cgst: inputCGST,
      sgst: inputSGST,
      igst: inputIGST,
      cess: inputCess,
      totalInputTax,
    },
    inputTaxCredit: {
      eligible: eligibleITC,
      ineligible: ineligibleITC,
    },
    netLiability: {
      outputTax,
      eligibleITC,
      utilization: utilizationResult.utilization,
      taxPayableCash: utilizationResult.taxPayableCash,
      itcCarriedForward: utilizationResult.itcBalanceCarriedForward,
    },
  };
};

/**
 * ========================================================
 * 2. GSTR-1 PREPARATION & EXPORT
 * ========================================================
 */
export const getGSTR1Data = async (tenantId, options = {}) => {
  const { startDate, endDate, financialYear, returnPeriod } = resolvePeriodDateRange(options);

  const tenant = await Tenant.findById(tenantId).lean();
  const tenantGSTIN = tenant?.GSTIN || '';

  const [salesInvoices, creditNotes, allInvoicesInPeriod] = await Promise.all([
    SalesInvoice.find({
      tenantId,
      invoiceStatus: 'posted',
      invoiceDate: { $gte: startDate, $lte: endDate },
    }).sort({ invoiceDate: 1, invoiceNumber: 1 }).lean(),
    CreditNote.find({
      tenantId,
      status: 'posted',
      creditNoteDate: { $gte: startDate, $lte: endDate },
    }).sort({ creditNoteDate: 1, creditNoteNumber: 1 }).lean(),
    SalesInvoice.find({
      tenantId,
      invoiceDate: { $gte: startDate, $lte: endDate },
    }).select('invoiceNumber invoiceStatus').lean(),
  ]);

  // GSTR-1 Sections:
  // 1. B2B: Registered recipients with valid GSTIN
  // 2. B2CL: Unregistered recipients, inter-state, invoice value > 2,50,000
  // 3. B2CS: Unregistered recipients, intra-state OR inter-state with invoice value <= 2,50,000
  // 4. CDNR: Credit/Debit notes to registered recipients
  // 5. CDNUR: Credit/Debit notes to unregistered recipients
  // 6. EXP: Exports
  // 7. HSN: HSN Summary
  // 8. DOCS: Document issue summary

  const b2bMap = {};
  const b2clList = [];
  const b2csMap = {};
  const expList = [];
  const cdnrList = [];
  const cdnurList = [];
  const hsnMap = {};
  const validationErrors = [];

  // Process Sales Invoices
  for (const inv of salesInvoices) {
    // Validation checks
    if (!inv.placeOfSupplyCode && !inv.placeOfSupply) {
      validationErrors.push({
        code: 'MISSING_POS',
        message: `Place of supply missing on invoice ${inv.invoiceNumber}`,
        documentNumber: inv.invoiceNumber,
        field: 'placeOfSupply',
      });
    }

    const hasValidGSTIN = isValidGSTIN(inv.partyGSTIN);

    if (inv.partyGSTIN && !hasValidGSTIN) {
      validationErrors.push({
        code: 'INVALID_GSTIN',
        message: `Invalid recipient GSTIN '${inv.partyGSTIN}' on invoice ${inv.invoiceNumber}`,
        documentNumber: inv.invoiceNumber,
        field: 'partyGSTIN',
      });
    }

    // Line items validation & HSN accumulation
    for (const item of inv.items || []) {
      const hsn = (item.HSN || item.SAC || '').trim();
      if (!hsn) {
        validationErrors.push({
          code: 'MISSING_HSN',
          message: `Product '${item.productName}' on invoice ${inv.invoiceNumber} lacks HSN/SAC code`,
          documentNumber: inv.invoiceNumber,
          field: 'HSN',
        });
      }

      const hsnKey = `${hsn || 'OTHERS'}_${item.gstRate || 0}_${item.productName || ''}`;
      if (!hsnMap[hsnKey]) {
        hsnMap[hsnKey] = {
          hsn_sc: hsn || 'OTHERS',
          desc: item.productName || 'Goods/Services',
          uqc: item.unitName || 'PCS',
          qty: 0,
          val: 0,
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
          rt: item.gstRate || 0,
        };
      }
      hsnMap[hsnKey].qty = round2(hsnMap[hsnKey].qty + (item.quantity || 0));
      hsnMap[hsnKey].txval = round2(hsnMap[hsnKey].txval + (item.taxableValue || 0));
      hsnMap[hsnKey].iamt = round2(hsnMap[hsnKey].iamt + (item.igst || 0));
      hsnMap[hsnKey].camt = round2(hsnMap[hsnKey].camt + (item.cgst || 0));
      hsnMap[hsnKey].samt = round2(hsnMap[hsnKey].samt + (item.sgst || 0));
      hsnMap[hsnKey].csamt = round2(hsnMap[hsnKey].csamt + (item.cess || 0));
      hsnMap[hsnKey].val = round2(hsnMap[hsnKey].val + (item.lineTotal || 0));
    }

    // Section classification
    if (inv.isExport) {
      expList.push({
        exp_typ: inv.exportType || 'WOPAY',
        inv: [
          {
            inum: inv.invoiceNumber,
            idt: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '',
            val: inv.grandTotal,
            pos: inv.placeOfSupplyCode || '97',
            itms: (inv.items || []).map((itm, idx) => ({
              num: idx + 1,
              itm_det: {
                txval: itm.taxableValue,
                rt: itm.gstRate,
                iamt: itm.igst,
                csamt: itm.cess,
              },
            })),
          },
        ],
      });
    } else if (hasValidGSTIN) {
      // B2B
      const gstin = inv.partyGSTIN.toUpperCase();
      if (!b2bMap[gstin]) {
        b2bMap[gstin] = {
          ctin: gstin,
          tradeName: inv.partyName,
          inv: [],
        };
      }
      b2bMap[gstin].inv.push({
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '',
        val: inv.grandTotal,
        pos: inv.placeOfSupplyCode || resolveStateCode(inv.placeOfSupply) || '27',
        rchrg: 'N',
        inv_typ: 'R',
        itms: (inv.items || []).map((itm, idx) => ({
          num: idx + 1,
          itm_det: {
            txval: itm.taxableValue,
            rt: itm.gstRate,
            iamt: itm.igst,
            camt: itm.cgst,
            samt: itm.sgst,
            csamt: itm.cess,
          },
        })),
      });
    } else {
      // Unregistered Party
      const isInterState = inv.isInterState;
      const isLarge = isInterState && (inv.grandTotal || 0) > 250000;

      if (isLarge) {
        // B2CL
        const pos = inv.placeOfSupplyCode || resolveStateCode(inv.placeOfSupply) || '97';
        let b2clGroup = b2clList.find((g) => g.pos === pos);
        if (!b2clGroup) {
          b2clGroup = { pos, inv: [] };
          b2clList.push(b2clGroup);
        }
        b2clGroup.inv.push({
          inum: inv.invoiceNumber,
          idt: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '',
          val: inv.grandTotal,
          itms: (inv.items || []).map((itm, idx) => ({
            num: idx + 1,
            itm_det: {
              txval: itm.taxableValue,
              rt: itm.gstRate,
              iamt: itm.igst,
              csamt: itm.cess,
            },
          })),
        });
      } else {
        // B2CS
        const pos = inv.placeOfSupplyCode || resolveStateCode(inv.placeOfSupply) || '27';
        const sply_ty = isInterState ? 'INTER' : 'INTRA';

        for (const itm of inv.items || []) {
          const key = `${pos}_${itm.gstRate}_${sply_ty}`;
          if (!b2csMap[key]) {
            b2csMap[key] = {
              sply_ty,
              pos,
              rt: itm.gstRate,
              txval: 0,
              iamt: 0,
              camt: 0,
              samt: 0,
              csamt: 0,
            };
          }
          b2csMap[key].txval = round2(b2csMap[key].txval + (itm.taxableValue || 0));
          b2csMap[key].iamt = round2(b2csMap[key].iamt + (itm.igst || 0));
          b2csMap[key].camt = round2(b2csMap[key].camt + (itm.cgst || 0));
          b2csMap[key].samt = round2(b2csMap[key].samt + (itm.sgst || 0));
          b2csMap[key].csamt = round2(b2csMap[key].csamt + (itm.cess || 0));
        }
      }
    }
  }

  // Process Credit Notes (CDNR / CDNUR)
  for (const cn of creditNotes) {
    const hasValidGSTIN = isValidGSTIN(cn.partyGSTIN);
    const noteEntry = {
      nt_num: cn.creditNoteNumber,
      nt_dt: cn.creditNoteDate ? new Date(cn.creditNoteDate).toISOString().split('T')[0] : '',
      ntty: 'C', // Credit note
      inum: cn.invoiceNumber || '',
      idt: cn.invoiceDate ? new Date(cn.invoiceDate).toISOString().split('T')[0] : '',
      val: cn.grandTotal,
      pos: cn.placeOfSupplyCode || resolveStateCode(cn.placeOfSupply) || '27',
      itms: (cn.items || []).map((itm, idx) => ({
        num: idx + 1,
        itm_det: {
          txval: itm.taxableValue,
          rt: itm.gstRate,
          iamt: itm.igst,
          camt: itm.cgst,
          samt: itm.sgst,
          csamt: itm.cess,
        },
      })),
    };

    if (hasValidGSTIN) {
      const gstin = cn.partyGSTIN.toUpperCase();
      let cdnrGroup = cdnrList.find((g) => g.ctin === gstin);
      if (!cdnrGroup) {
        cdnrGroup = { ctin: gstin, nt: [] };
        cdnrList.push(cdnrGroup);
      }
      cdnrGroup.nt.push(noteEntry);
    } else {
      cdnurList.push(noteEntry);
    }
  }

  // Document Issue Summary
  const invoiceDocNumbers = allInvoicesInPeriod.map((i) => i.invoiceNumber).filter(Boolean).sort();
  const cancelledInvoices = allInvoicesInPeriod.filter((i) => i.invoiceStatus === 'cancelled').length;
  const cnDocNumbers = creditNotes.map((c) => c.creditNoteNumber).filter(Boolean).sort();

  const docIssue = [
    {
      doc_num: 1,
      doc_typ: 'Invoices for outward supply',
      from: invoiceDocNumbers[0] || 'N/A',
      to: invoiceDocNumbers[invoiceDocNumbers.length - 1] || 'N/A',
      totnum: allInvoicesInPeriod.length,
      canc: cancelledInvoices,
      net_issue: allInvoicesInPeriod.length - cancelledInvoices,
    },
    {
      doc_num: 2,
      doc_typ: 'Credit Note',
      from: cnDocNumbers[0] || 'N/A',
      to: cnDocNumbers[cnDocNumbers.length - 1] || 'N/A',
      totnum: creditNotes.length,
      canc: 0,
      net_issue: creditNotes.length,
    },
  ];

  const b2bArray = Object.values(b2bMap);
  const b2csArray = Object.values(b2csMap);
  const hsnArray = Object.values(hsnMap);

  // Section totals
  const summary = {
    b2b: {
      count: b2bArray.reduce((acc, g) => acc + g.inv.length, 0),
      taxableValue: round2(
        b2bArray.reduce(
          (acc, g) =>
            acc +
            g.inv.reduce((iacc, inv) => iacc + inv.itms.reduce((tacc, itm) => tacc + itm.itm_det.txval, 0), 0),
          0
        )
      ),
      taxAmount: round2(
        b2bArray.reduce(
          (acc, g) =>
            acc +
            g.inv.reduce(
              (iacc, inv) =>
                iacc +
                inv.itms.reduce(
                  (tacc, itm) =>
                    tacc +
                    (itm.itm_det.iamt || 0) +
                    (itm.itm_det.camt || 0) +
                    (itm.itm_det.samt || 0) +
                    (itm.itm_det.csamt || 0),
                  0
                ),
              0
            ),
          0
        )
      ),
    },
    b2cl: {
      count: b2clList.reduce((acc, g) => acc + g.inv.length, 0),
      taxableValue: round2(
        b2clList.reduce(
          (acc, g) =>
            acc +
            g.inv.reduce((iacc, inv) => iacc + inv.itms.reduce((tacc, itm) => tacc + itm.itm_det.txval, 0), 0),
          0
        )
      ),
      taxAmount: round2(
        b2clList.reduce(
          (acc, g) =>
            acc +
            g.inv.reduce(
              (iacc, inv) =>
                iacc +
                inv.itms.reduce((tacc, itm) => tacc + (itm.itm_det.iamt || 0) + (itm.itm_det.csamt || 0), 0),
              0
            ),
          0
        )
      ),
    },
    b2cs: {
      count: b2csArray.length,
      taxableValue: round2(b2csArray.reduce((acc, item) => acc + item.txval, 0)),
      taxAmount: round2(
        b2csArray.reduce((acc, item) => acc + item.iamt + item.camt + item.samt + item.csamt, 0)
      ),
    },
    cdnr: {
      count: cdnrList.reduce((acc, g) => acc + g.nt.length, 0),
      taxableValue: round2(
        cdnrList.reduce(
          (acc, g) =>
            acc +
            g.nt.reduce((iacc, n) => iacc + n.itms.reduce((tacc, itm) => tacc + itm.itm_det.txval, 0), 0),
          0
        )
      ),
    },
    cdnur: {
      count: cdnurList.length,
      taxableValue: round2(
        cdnurList.reduce((acc, n) => acc + n.itms.reduce((tacc, itm) => tacc + itm.itm_det.txval, 0), 0)
      ),
    },
    exp: {
      count: expList.reduce((acc, g) => acc + g.inv.length, 0),
      taxableValue: round2(
        expList.reduce(
          (acc, g) =>
            acc +
            g.inv.reduce((iacc, inv) => iacc + inv.itms.reduce((tacc, itm) => tacc + itm.itm_det.txval, 0), 0),
          0
        )
      ),
    },
    hsn: {
      count: hsnArray.length,
      taxableValue: round2(hsnArray.reduce((acc, item) => acc + item.txval, 0)),
    },
  };

  return {
    meta: {
      gstin: tenantGSTIN,
      financialYear,
      returnPeriod,
      startDate,
      endDate,
      validationErrorsCount: validationErrors.length,
    },
    validationErrors,
    summary,
    sections: {
      b2b: b2bArray,
      b2cl: b2clList,
      b2cs: b2csArray,
      cdnr: cdnrList,
      cdnur: cdnurList,
      exp: expList,
      hsn: hsnArray,
      doc_issue: docIssue,
    },
  };
};

/**
 * Export GSTR-1 as JSON (Offline tool schema) or CSV
 */
export const exportGSTR1 = async (tenantId, options = {}, format = 'json') => {
  const gstr1 = await getGSTR1Data(tenantId, options);

  if (format === 'json') {
    const offlinePayload = {
      gstin: gstr1.meta.gstin,
      fp: gstr1.meta.returnPeriod,
      gt: 0,
      cur_gt: 0,
      b2b: gstr1.sections.b2b,
      b2cl: gstr1.sections.b2cl,
      b2cs: gstr1.sections.b2cs,
      cdnr: gstr1.sections.cdnr,
      cdnur: gstr1.sections.cdnur,
      exp: gstr1.sections.exp,
      hsn: { data: gstr1.sections.hsn },
      doc_issue: { doc_det: gstr1.sections.doc_issue },
    };
    return { format: 'json', data: offlinePayload, filename: `GSTR1_${gstr1.meta.returnPeriod}.json` };
  }

  // CSV format
  const rows = [];
  rows.push(['Section', 'Invoice/Note No', 'Date', 'Recipient GSTIN', 'POS', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess', 'Total Value'].join(','));

  // B2B
  for (const group of gstr1.sections.b2b) {
    for (const inv of group.inv) {
      const tx = inv.itms.reduce((a, b) => a + b.itm_det.txval, 0);
      const i = inv.itms.reduce((a, b) => a + (b.itm_det.iamt || 0), 0);
      const c = inv.itms.reduce((a, b) => a + (b.itm_det.camt || 0), 0);
      const s = inv.itms.reduce((a, b) => a + (b.itm_det.samt || 0), 0);
      const cs = inv.itms.reduce((a, b) => a + (b.itm_det.csamt || 0), 0);
      rows.push(['B2B', inv.inum, inv.idt, group.ctin, inv.pos, tx, i, c, s, cs, inv.val].join(','));
    }
  }

  // B2CL
  for (const group of gstr1.sections.b2cl) {
    for (const inv of group.inv) {
      const tx = inv.itms.reduce((a, b) => a + b.itm_det.txval, 0);
      const i = inv.itms.reduce((a, b) => a + (b.itm_det.iamt || 0), 0);
      rows.push(['B2CL', inv.inum, inv.idt, 'URP', group.pos, tx, i, 0, 0, 0, inv.val].join(','));
    }
  }

  // B2CS
  for (const itm of gstr1.sections.b2cs) {
    rows.push(['B2CS', 'N/A', 'N/A', 'URP', itm.pos, itm.txval, itm.iamt, itm.camt, itm.samt, itm.csamt, round2(itm.txval + itm.iamt + itm.camt + itm.samt + itm.csamt)].join(','));
  }

  return { format: 'csv', data: rows.join('\n'), filename: `GSTR1_${gstr1.meta.returnPeriod}.csv` };
};

/**
 * ========================================================
 * 3. GSTR-3B PREPARATION
 * ========================================================
 */
export const getGSTR3BData = async (tenantId, options = {}) => {
  const dashboard = await getGSTDashboard(tenantId, options);
  const { returnPeriod, financialYear } = dashboard.period;

  // Table 3.1 Outward supplies and inward supplies liable to reverse charge
  const table3_1 = {
    // (a) Outward taxable supplies (other than zero rated, nil rated and exempted)
    outwardTaxableSupplies: {
      txval: dashboard.outwardSupplies.netTaxableSales,
      iamt: dashboard.outwardSupplies.igst,
      camt: dashboard.outwardSupplies.cgst,
      samt: dashboard.outwardSupplies.sgst,
      csamt: dashboard.outwardSupplies.cess,
    },
    // (b) Outward taxable supplies (zero rated)
    outwardZeroRated: {
      txval: 0,
      iamt: 0,
      csamt: 0,
    },
    // (c) Other outward supplies (nil rated, exempted)
    otherOutwardNilExempt: {
      txval: 0,
    },
    // (d) Inward supplies (liable to reverse charge)
    inwardReverseCharge: {
      txval: 0,
      iamt: 0,
      camt: 0,
      samt: 0,
      csamt: 0,
    },
    // (e) Non-GST outward supplies
    nonGSTOutward: {
      txval: 0,
    },
  };

  // Table 4 Eligible ITC
  const table4 = {
    itcAvailable: {
      importGoods: { iamt: 0, csamt: 0 },
      importServices: { iamt: 0, csamt: 0 },
      inwardReverseCharge: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
      inwardISD: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
      allOtherITC: {
        iamt: dashboard.inputTaxCredit.eligible.igst,
        camt: dashboard.inputTaxCredit.eligible.cgst,
        samt: dashboard.inputTaxCredit.eligible.sgst,
        csamt: dashboard.inputTaxCredit.eligible.cess,
      },
    },
    itcReversed: {
      asPerRules: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
      others: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
    },
    netITCAvailable: {
      iamt: dashboard.inputTaxCredit.eligible.igst,
      camt: dashboard.inputTaxCredit.eligible.cgst,
      samt: dashboard.inputTaxCredit.eligible.sgst,
      csamt: dashboard.inputTaxCredit.eligible.cess,
    },
    ineligibleITC: {
      asPerSection17_5: {
        iamt: dashboard.inputTaxCredit.ineligible.igst,
        camt: dashboard.inputTaxCredit.ineligible.cgst,
        samt: dashboard.inputTaxCredit.ineligible.sgst,
        csamt: dashboard.inputTaxCredit.ineligible.cess,
      },
      others: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
    },
  };

  // Table 5 Values of exempt, nil-rated and non-GST inward supplies
  const table5 = {
    interStateSupplies: 0,
    intraStateSupplies: 0,
  };

  // Table 6.1 Payment of tax
  const table6_1 = {
    taxPayable: dashboard.netLiability.outputTax,
    paidThroughITC: dashboard.netLiability.utilization,
    taxPayableCash: dashboard.netLiability.taxPayableCash,
    itcCarriedForward: dashboard.netLiability.itcCarriedForward,
  };

  return {
    meta: {
      financialYear,
      returnPeriod,
      generatedAt: new Date(),
    },
    table3_1,
    table4,
    table5,
    table6_1,
  };
};

/**
 * ========================================================
 * 4. GSTR-2B IMPORT & RECONCILIATION
 * ========================================================
 */
export const importGSTR2B = async (tenantId, userId, data) => {
  const tenant = await Tenant.findById(tenantId);
  const tenantGSTIN = (data.gstin || tenant?.GSTIN || '').trim().toUpperCase();

  const { returnPeriod, financialYear: providedFY } = data;
  const financialYear = providedFY || getFinancialYear(new Date());

  // Parse entries
  let rawEntries = [];
  if (Array.isArray(data.entries)) {
    rawEntries = data.entries;
  } else if (data.rawPayload) {
    // Check official GSTR-2B JSON structure: data.rawPayload.data.docdata.b2b
    const b2bDocs = data.rawPayload?.data?.docdata?.b2b || data.rawPayload?.b2b || [];
    for (const supplierGroup of b2bDocs) {
      const supplierGSTIN = supplierGroup.ctin;
      const supplierName = supplierGroup.trdnm || '';
      for (const inv of supplierGroup.inv || []) {
        const taxable = (inv.items || []).reduce((acc, it) => acc + (it.txval || 0), 0);
        const igst = (inv.items || []).reduce((acc, it) => acc + (it.igst || 0), 0);
        const cgst = (inv.items || []).reduce((acc, it) => acc + (it.cgst || 0), 0);
        const sgst = (inv.items || []).reduce((acc, it) => acc + (it.sgst || 0), 0);
        const cess = (inv.items || []).reduce((acc, it) => acc + (it.cess || 0), 0);

        rawEntries.push({
          supplierGSTIN,
          supplierName,
          invoiceNumber: inv.inum,
          documentType: 'INV',
          invoiceDate: inv.dt ? new Date(inv.dt) : new Date(),
          invoiceValue: inv.val || 0,
          placeOfSupply: inv.pos || '',
          reverseCharge: inv.rev === 'Y',
          taxableValue: taxable,
          igst,
          cgst,
          sgst,
          cess,
          itcAvailability: inv.itcavvl !== 'N',
        });
      }
    }
  }

  if (rawEntries.length === 0) {
    const error = new Error('No valid GSTR-2B entries found in payload');
    error.statusCode = 400;
    throw error;
  }

  // Calculate deterministic file hash based on entries to prevent duplicate import
  const contentSignature = JSON.stringify(
    rawEntries.map((e) => ({
      g: e.supplierGSTIN,
      n: normalizeDocNumber(e.invoiceNumber),
      d: e.invoiceDate,
      t: round2(e.taxableValue),
    }))
  );
  const fileHash = crypto.createHash('sha256').update(contentSignature).digest('hex');

  // Prevent duplicate import
  const existingImport = await GSTR2BImport.findOne({
    tenantId,
    returnPeriod,
    fileHash,
  });

  if (existingImport) {
    const error = new Error(
      `Duplicate GSTR-2B import: identical data has already been imported for period ${returnPeriod} on ${existingImport.importedAt.toISOString().split('T')[0]}`
    );
    error.statusCode = 409;
    throw error;
  }

  let totalTaxable = 0;
  let totalTax = 0;
  const processedEntries = rawEntries.map((e) => {
    const tx = round2(e.taxableValue);
    const tax = round2((e.igst || 0) + (e.cgst || 0) + (e.sgst || 0) + (e.cess || 0));
    totalTaxable += tx;
    totalTax += tax;

    return {
      supplierGSTIN: e.supplierGSTIN.toUpperCase(),
      supplierName: e.supplierName || '',
      invoiceNumber: e.invoiceNumber.trim(),
      documentType: e.documentType || 'INV',
      invoiceDate: new Date(e.invoiceDate),
      invoiceValue: round2(e.invoiceValue || tx + tax),
      placeOfSupply: e.placeOfSupply || '',
      reverseCharge: Boolean(e.reverseCharge),
      taxableValue: tx,
      igst: round2(e.igst || 0),
      cgst: round2(e.cgst || 0),
      sgst: round2(e.sgst || 0),
      cess: round2(e.cess || 0),
      itcAvailability: e.itcAvailability !== false,
      reconciliationStatus: 'unmatched',
    };
  });

  const gstr2bImport = new GSTR2BImport({
    tenantId,
    gstin: tenantGSTIN,
    returnPeriod,
    financialYear,
    sourceFileName: data.sourceFileName || 'gstr2b_data.json',
    fileHash,
    recordCount: processedEntries.length,
    totalTaxableValue: round2(totalTaxable),
    totalTaxAmount: round2(totalTax),
    importedBy: userId,
    entries: processedEntries,
  });

  await gstr2bImport.save();
  return gstr2bImport;
};

/**
 * Reconcile GSTR-2B entries with Purchase Bills
 * Identifies: matched, value/tax mismatch, missing in books, missing in 2B, duplicates
 */
export const reconcileGSTR2B = async (tenantId, importId, tolerance = 1) => {
  if (!mongoose.isValidObjectId(importId)) {
    const error = new Error('Invalid GSTR-2B import ID format');
    error.statusCode = 400;
    throw error;
  }

  const gstr2b = await GSTR2BImport.findOne({ _id: importId, tenantId });
  if (!gstr2b) {
    const error = new Error('GSTR-2B import record not found');
    error.statusCode = 404;
    throw error;
  }

  // Fetch all posted purchase bills for this tenant
  const purchaseBills = await PurchaseBill.find({
    tenantId,
    billStatus: 'posted',
  }).lean();

  // Create an index of purchase bills by:
  // 1. Exact: normalizedSupplierGSTIN + '_' + normalizedDocNumber
  // 2. DocOnly: normalizedDocNumber (for GSTIN mismatch detection)
  const exactBillsMap = {};
  const docOnlyBillsMap = {};

  for (const bill of purchaseBills) {
    const gstin = (bill.supplierGSTIN || '').trim().toUpperCase();
    const docNo = normalizeDocNumber(bill.supplierInvoiceNumber || bill.billNumber);

    if (gstin && docNo) {
      const key = `${gstin}_${docNo}`;
      exactBillsMap[key] = bill;
    }
    if (docNo) {
      docOnlyBillsMap[docNo] = bill;
    }
  }

  const matchedEntries = [];
  const mismatchedEntries = [];
  const missingInBooksEntries = [];
  const matchedBillIds = new Set();
  const seen2BKeys = new Set();
  const duplicate2BEntries = [];

  for (const entry of gstr2b.entries) {
    const entryGSTIN = entry.supplierGSTIN.toUpperCase();
    const entryDocNo = normalizeDocNumber(entry.invoiceNumber);
    const key = `${entryGSTIN}_${entryDocNo}`;

    // Check duplicate within 2B
    if (seen2BKeys.has(key)) {
      duplicate2BEntries.push(entry);
    } else {
      seen2BKeys.add(key);
    }

    const exactBill = exactBillsMap[key];

    if (exactBill) {
      // Check values and taxes
      const billTaxable = exactBill.taxableAmount || 0;
      const billTax = round2(
        (exactBill.igstTotal || 0) +
          (exactBill.cgstTotal || 0) +
          (exactBill.sgstTotal || 0) +
          (exactBill.cessTotal || 0)
      );

      const entryTaxable = entry.taxableValue || 0;
      const entryTax = round2(entry.igst + entry.cgst + entry.sgst + entry.cess);

      const diffTaxable = Math.abs(billTaxable - entryTaxable);
      const diffTax = Math.abs(billTax - entryTax);

      if (diffTaxable <= tolerance && diffTax <= tolerance) {
        entry.reconciliationStatus = 'matched';
        entry.matchedBillId = exactBill._id;
        entry.mismatchReasons = [];
        matchedEntries.push({
          entry,
          bill: exactBill,
        });
        matchedBillIds.add(exactBill._id.toString());
      } else {
        entry.reconciliationStatus = 'mismatched';
        entry.matchedBillId = exactBill._id;
        const reasons = [];
        if (diffTaxable > tolerance) {
          reasons.push(
            `Taxable value mismatch: GSTR-2B = ₹${entryTaxable}, Books = ₹${billTaxable} (Diff: ₹${round2(diffTaxable)})`
          );
        }
        if (diffTax > tolerance) {
          reasons.push(
            `Tax amount mismatch: GSTR-2B = ₹${entryTax}, Books = ₹${billTax} (Diff: ₹${round2(diffTax)})`
          );
        }
        entry.mismatchReasons = reasons;
        mismatchedEntries.push({
          entry,
          bill: exactBill,
          reasons,
        });
        matchedBillIds.add(exactBill._id.toString());
      }
    } else {
      // Check if document exists with a mismatched GSTIN
      const candidateByDoc = docOnlyBillsMap[entryDocNo];
      if (candidateByDoc) {
        entry.reconciliationStatus = 'mismatched';
        entry.matchedBillId = candidateByDoc._id;
        const reasons = [
          `Supplier GSTIN mismatch: GSTR-2B = ${entryGSTIN}, Books = ${candidateByDoc.supplierGSTIN || 'N/A'}`,
        ];
        entry.mismatchReasons = reasons;
        mismatchedEntries.push({
          entry,
          bill: candidateByDoc,
          reasons,
        });
        matchedBillIds.add(candidateByDoc._id.toString());
      } else {
        entry.reconciliationStatus = 'missing_in_books';
        entry.mismatchReasons = ['Document not found in purchase records'];
        missingInBooksEntries.push(entry);
      }
    }
  }

  // Identify purchase bills missing in GSTR-2B
  const missingIn2BBills = purchaseBills.filter(
    (bill) => !matchedBillIds.has(bill._id.toString())
  );

  // Save updated reconciliation statuses on GSTR2BImport
  await gstr2b.save();

  return {
    meta: {
      importId: gstr2b._id,
      returnPeriod: gstr2b.returnPeriod,
      tolerance,
      reconciledAt: new Date(),
    },
    summary: {
      totalGSTR2BRecords: gstr2b.entries.length,
      totalPurchaseBills: purchaseBills.length,
      matchedCount: matchedEntries.length,
      mismatchedCount: mismatchedEntries.length,
      missingInBooksCount: missingInBooksEntries.length,
      missingInGSTR2BCount: missingIn2BBills.length,
      possibleDuplicateIn2BCount: duplicate2BEntries.length,
    },
    matched: matchedEntries,
    mismatched: mismatchedEntries,
    missingInBooks: missingInBooksEntries,
    missingInGSTR2B: missingIn2BBills,
    duplicatesIn2B: duplicate2BEntries,
  };
};

/**
 * ========================================================
 * 5. RETURN PERIOD & FILING CALENDAR
 * ========================================================
 */
export const getFilingCalendar = async (tenantId, financialYear = getFinancialYear(new Date())) => {
  const [startYearStr, endYearStr] = financialYear.split('-');
  const startYear = parseInt(startYearStr, 10);

  // 12 Monthly periods for the FY (April of startYear to March of startYear + 1)
  const periods = [
    { month: '04', name: 'April', year: startYear },
    { month: '05', name: 'May', year: startYear },
    { month: '06', name: 'June', year: startYear },
    { month: '07', name: 'July', year: startYear },
    { month: '08', name: 'August', year: startYear },
    { month: '09', name: 'September', year: startYear },
    { month: '10', name: 'October', year: startYear },
    { month: '11', name: 'November', year: startYear },
    { month: '12', name: 'December', year: startYear },
    { month: '01', name: 'January', year: startYear + 1 },
    { month: '02', name: 'February', year: startYear + 1 },
    { month: '03', name: 'March', year: startYear + 1 },
  ];

  // Standard statutory due date generator
  // GSTR-1: 11th of succeeding month
  // GSTR-3B: 20th of succeeding month
  // GSTR-2B: Available on 14th of succeeding month
  const calendarSchedule = [];

  for (const p of periods) {
    const returnPeriod = `${p.month}${p.year}`;
    const nextMonthDate = new Date(p.year, parseInt(p.month, 10), 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = nextMonthDate.getMonth();

    const gstr1DueDate = new Date(nextYear, nextMonth, 11);
    const gstr3bDueDate = new Date(nextYear, nextMonth, 20);
    const gstr2bAvailableDate = new Date(nextYear, nextMonth, 14);

    calendarSchedule.push({
      monthName: p.name,
      returnPeriod,
      financialYear,
      returns: [
        {
          returnType: 'GSTR-1',
          dueDate: gstr1DueDate,
          description: 'Outward supplies statement',
        },
        {
          returnType: 'GSTR-3B',
          dueDate: gstr3bDueDate,
          description: 'Summary return & tax payment',
        },
        {
          returnType: 'GSTR-2B',
          dueDate: gstr2bAvailableDate,
          description: 'Auto-drafted ITC statement',
        },
      ],
    });
  }

  // Load existing period tracking documents from DB
  const trackedPeriods = await GSTReturnPeriod.find({
    tenantId,
    financialYear,
  }).lean();

  const trackedMap = {};
  for (const tp of trackedPeriods) {
    const key = `${tp.returnPeriod}_${tp.returnType}`;
    trackedMap[key] = tp;
  }

  // Merge tracking status with calendar
  const calendar = calendarSchedule.map((cs) => {
    return {
      monthName: cs.monthName,
      returnPeriod: cs.returnPeriod,
      financialYear: cs.financialYear,
      returns: cs.returns.map((r) => {
        const key = `${cs.returnPeriod}_${r.returnType}`;
        const tracked = trackedMap[key];
        return {
          returnType: r.returnType,
          description: r.description,
          dueDate: r.dueDate,
          preparationStatus: tracked?.preparationStatus || 'not_started',
          validationStatus: tracked?.validationStatus || 'not_validated',
          validationErrors: tracked?.validationErrors || [],
          filingStatus: tracked?.filingStatus || 'not_filed',
          filingDate: tracked?.filingDate || null,
          acknowledgementNumber: tracked?.acknowledgementNumber || '',
          notes: tracked?.notes || '',
        };
      }),
    };
  });

  return {
    financialYear,
    calendar,
  };
};

/**
 * Update preparation/filing status of a GST Return Period
 */
export const updateReturnPeriodStatus = async (tenantId, data) => {
  const { returnPeriod, financialYear, returnType } = data;

  let periodDoc = await GSTReturnPeriod.findOne({
    tenantId,
    financialYear,
    returnPeriod,
    returnType,
  });

  if (!periodDoc) {
    // Generate default due date
    const month = parseInt(returnPeriod.substring(0, 2), 10);
    const year = parseInt(returnPeriod.substring(2, 6), 10);
    const dueDate = new Date(year, month, returnType === 'GSTR-1' ? 11 : 20);

    periodDoc = new GSTReturnPeriod({
      tenantId,
      financialYear,
      returnPeriod,
      returnType,
      dueDate,
    });
  }

  if (data.preparationStatus) periodDoc.preparationStatus = data.preparationStatus;
  if (data.filingStatus) periodDoc.filingStatus = data.filingStatus;
  if (data.filingDate !== undefined) {
    periodDoc.filingDate = data.filingDate ? new Date(data.filingDate) : null;
  }
  if (data.acknowledgementNumber !== undefined) {
    periodDoc.acknowledgementNumber = data.acknowledgementNumber.trim();
  }
  if (data.notes !== undefined) {
    periodDoc.notes = data.notes.trim();
  }

  await periodDoc.save();
  return periodDoc;
};

/**
 * Validate Return Period transactions
 */
export const validateReturnPeriod = async (tenantId, { returnPeriod, financialYear, returnType }) => {
  let periodDoc = await GSTReturnPeriod.findOne({
    tenantId,
    financialYear,
    returnPeriod,
    returnType,
  });

  if (!periodDoc) {
    const month = parseInt(returnPeriod.substring(0, 2), 10);
    const year = parseInt(returnPeriod.substring(2, 6), 10);
    const dueDate = new Date(year, month, returnType === 'GSTR-1' ? 11 : 20);

    periodDoc = new GSTReturnPeriod({
      tenantId,
      financialYear,
      returnPeriod,
      returnType,
      dueDate,
    });
  }

  const { startDate, endDate } = resolvePeriodDateRange({ returnPeriod, financialYear });
  const validationErrors = [];

  if (returnType === 'GSTR-1') {
    const invoices = await SalesInvoice.find({
      tenantId,
      invoiceStatus: 'posted',
      invoiceDate: { $gte: startDate, $lte: endDate },
    }).lean();

    for (const inv of invoices) {
      if (inv.partyGSTIN && !isValidGSTIN(inv.partyGSTIN)) {
        validationErrors.push({
          code: 'INVALID_GSTIN',
          message: `Invalid recipient GSTIN format on invoice ${inv.invoiceNumber}`,
          documentNumber: inv.invoiceNumber,
          field: 'partyGSTIN',
        });
      }
      if (!inv.placeOfSupplyCode && !inv.placeOfSupply) {
        validationErrors.push({
          code: 'MISSING_POS',
          message: `Missing Place of Supply on invoice ${inv.invoiceNumber}`,
          documentNumber: inv.invoiceNumber,
          field: 'placeOfSupply',
        });
      }
      for (const item of inv.items || []) {
        if (!item.HSN && !item.SAC) {
          validationErrors.push({
            code: 'MISSING_HSN',
            message: `Product '${item.productName}' on invoice ${inv.invoiceNumber} lacks HSN/SAC code`,
            documentNumber: inv.invoiceNumber,
            field: 'HSN',
          });
        }
      }
    }
  } else if (returnType === 'GSTR-3B') {
    const bills = await PurchaseBill.find({
      tenantId,
      billStatus: 'posted',
      billDate: { $gte: startDate, $lte: endDate },
    }).lean();

    for (const bill of bills) {
      if (bill.supplierGSTIN && !isValidGSTIN(bill.supplierGSTIN)) {
        validationErrors.push({
          code: 'INVALID_SUPPLIER_GSTIN',
          message: `Invalid supplier GSTIN format on bill ${bill.billNumber}`,
          documentNumber: bill.billNumber,
          field: 'supplierGSTIN',
        });
      }
    }
  }

  periodDoc.validationErrors = validationErrors;
  periodDoc.validationStatus = validationErrors.length === 0 ? 'valid' : 'has_errors';
  periodDoc.lastValidatedAt = new Date();

  await periodDoc.save();
  return periodDoc;
};

/**
 * ========================================================
 * 6. GST REPORTS
 * ========================================================
 */
export const getGSTReports = async (tenantId, reportType, options = {}) => {
  const { startDate, endDate, financialYear, returnPeriod } = resolvePeriodDateRange(options);

  switch (reportType) {
    case 'sales_gst': {
      const invoices = await SalesInvoice.find({
        tenantId,
        invoiceStatus: 'posted',
        invoiceDate: { $gte: startDate, $lte: endDate },
      }).sort({ invoiceDate: 1 }).lean();

      const creditNotes = await CreditNote.find({
        tenantId,
        status: 'posted',
        creditNoteDate: { $gte: startDate, $lte: endDate },
      }).sort({ creditNoteDate: 1 }).lean();

      return {
        reportType,
        period: { returnPeriod, financialYear, startDate, endDate },
        invoices: invoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          partyName: inv.partyName,
          partyGSTIN: inv.partyGSTIN || 'URP',
          placeOfSupply: inv.placeOfSupplyCode || inv.placeOfSupply,
          isInterState: inv.isInterState,
          taxableAmount: inv.taxableAmount,
          cgst: inv.cgstTotal,
          sgst: inv.sgstTotal,
          igst: inv.igstTotal,
          cess: inv.cessTotal,
          grandTotal: inv.grandTotal,
        })),
        creditNotes: creditNotes.map((cn) => ({
          creditNoteNumber: cn.creditNoteNumber,
          creditNoteDate: cn.creditNoteDate,
          invoiceNumber: cn.invoiceNumber,
          partyName: cn.partyName,
          taxableAmount: -cn.taxableAmount,
          cgst: -cn.cgstTotal,
          sgst: -cn.sgstTotal,
          igst: -cn.igstTotal,
          cess: -cn.cessTotal,
          grandTotal: -cn.grandTotal,
        })),
      };
    }

    case 'purchase_gst': {
      const bills = await PurchaseBill.find({
        tenantId,
        billStatus: 'posted',
        billDate: { $gte: startDate, $lte: endDate },
      }).sort({ billDate: 1 }).lean();

      const debitNotes = await DebitNote.find({
        tenantId,
        status: 'posted',
        debitNoteDate: { $gte: startDate, $lte: endDate },
      }).sort({ debitNoteDate: 1 }).lean();

      return {
        reportType,
        period: { returnPeriod, financialYear, startDate, endDate },
        bills: bills.map((b) => ({
          billNumber: b.billNumber,
          supplierInvoiceNumber: b.supplierInvoiceNumber,
          billDate: b.billDate,
          supplierName: b.supplierName,
          supplierGSTIN: b.supplierGSTIN || 'URP',
          isITCClaimable: b.isITCClaimable !== false,
          taxableAmount: b.taxableAmount,
          cgst: b.cgstTotal,
          sgst: b.sgstTotal,
          igst: b.igstTotal,
          cess: b.cessTotal,
          grandTotal: b.grandTotal,
        })),
        debitNotes: debitNotes.map((dn) => ({
          debitNoteNumber: dn.debitNoteNumber,
          debitNoteDate: dn.debitNoteDate,
          billNumber: dn.billNumber,
          supplierName: dn.supplierName,
          taxableAmount: -dn.taxableAmount,
          cgst: -dn.cgstTotal,
          sgst: -dn.sgstTotal,
          igst: -dn.igstTotal,
          cess: -dn.cessTotal,
          grandTotal: -dn.grandTotal,
        })),
      };
    }

    case 'itc': {
      const dashboard = await getGSTDashboard(tenantId, options);
      return {
        reportType,
        period: { returnPeriod, financialYear, startDate, endDate },
        eligibleITC: dashboard.inputTaxCredit.eligible,
        ineligibleITC: dashboard.inputTaxCredit.ineligible,
      };
    }

    case 'output_tax': {
      const dashboard = await getGSTDashboard(tenantId, options);
      return {
        reportType,
        period: { returnPeriod, financialYear, startDate, endDate },
        outputTax: dashboard.outwardSupplies,
      };
    }

    case 'hsn': {
      const gstr1 = await getGSTR1Data(tenantId, options);
      return {
        reportType,
        period: { returnPeriod, financialYear, startDate, endDate },
        hsnSummary: gstr1.sections.hsn,
      };
    }

    case 'rate_wise': {
      const invoices = await SalesInvoice.find({
        tenantId,
        invoiceStatus: 'posted',
        invoiceDate: { $gte: startDate, $lte: endDate },
      }).lean();

      const rateMap = {};
      for (const inv of invoices) {
        for (const itm of inv.items || []) {
          const rate = itm.gstRate || 0;
          if (!rateMap[rate]) {
            rateMap[rate] = { rate, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalTax: 0 };
          }
          rateMap[rate].taxableAmount = round2(rateMap[rate].taxableAmount + (itm.taxableValue || 0));
          rateMap[rate].cgst = round2(rateMap[rate].cgst + (itm.cgst || 0));
          rateMap[rate].sgst = round2(rateMap[rate].sgst + (itm.sgst || 0));
          rateMap[rate].igst = round2(rateMap[rate].igst + (itm.igst || 0));
          rateMap[rate].cess = round2(rateMap[rate].cess + (itm.cess || 0));
          rateMap[rate].totalTax = round2(
            rateMap[rate].totalTax + (itm.cgst || 0) + (itm.sgst || 0) + (itm.igst || 0) + (itm.cess || 0)
          );
        }
      }

      return {
        reportType,
        period: { returnPeriod, financialYear, startDate, endDate },
        rates: Object.values(rateMap).sort((a, b) => a.rate - b.rate),
      };
    }

    default: {
      const error = new Error(`Unsupported report type: ${reportType}`);
      error.statusCode = 400;
      throw error;
    }
  }
};

export default {
  getGSTDashboard,
  getGSTR1Data,
  exportGSTR1,
  getGSTR3BData,
  importGSTR2B,
  reconcileGSTR2B,
  getFilingCalendar,
  updateReturnPeriodStatus,
  validateReturnPeriod,
  getGSTReports,
};
