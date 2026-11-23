import { round2 } from './calculationService';
import { getStateCode } from '../data/constants';

export const isIntraStateSupply = (sellerState, placeOfSupply) => {
  return (
    String(sellerState || 'Rajasthan').trim().toLowerCase() ===
    String(placeOfSupply || sellerState || 'Rajasthan').trim().toLowerCase()
  );
};

export const computeGSTSummary = ({
  invoices = [],
  purchases = [],
  expenses = [],
  creditNotes = [],
}) => {
  const activeInvoices = invoices.filter(
    (i) => i.status !== 'Draft' && i.status !== 'Cancelled'
  );
  const activeCNs = creditNotes.filter((c) => c.status === 'Issued');
  const activePurchases = purchases.filter((p) => p.status !== 'Cancelled');
  const activeExpenses = expenses.filter((e) => e.status !== 'Archived' && e.itcEligible !== false);

  const outCgst = round2(
    activeInvoices.reduce((s, i) => s + (Number(i.cgst) || 0), 0) -
      activeCNs.reduce((s, c) => s + (Number(c.cgst) || 0), 0)
  );
  const outSgst = round2(
    activeInvoices.reduce((s, i) => s + (Number(i.sgst) || 0), 0) -
      activeCNs.reduce((s, c) => s + (Number(c.sgst) || 0), 0)
  );
  const outIgst = round2(
    activeInvoices.reduce((s, i) => s + (Number(i.igst) || 0), 0) -
      activeCNs.reduce((s, c) => s + (Number(c.igst) || 0), 0)
  );
  const outputTax = round2(Math.max(0, outCgst + outSgst + outIgst));

  const inCgst = round2(
    activePurchases.reduce((s, p) => s + (Number(p.cgst) || 0), 0) +
      activeExpenses.reduce((s, e) => s + (Number(e.cgst) || 0), 0)
  );
  const inSgst = round2(
    activePurchases.reduce((s, p) => s + (Number(p.sgst) || 0), 0) +
      activeExpenses.reduce((s, e) => s + (Number(e.sgst) || 0), 0)
  );
  const inIgst = round2(
    activePurchases.reduce((s, p) => s + (Number(p.igst) || 0), 0) +
      activeExpenses.reduce((s, e) => s + (Number(e.igst) || 0), 0)
  );
  const inputItc = round2(inCgst + inSgst + inIgst);

  const netCgst = round2(Math.max(0, outCgst - inCgst));
  const netSgst = round2(Math.max(0, outSgst - inSgst));
  const netIgst = round2(Math.max(0, outIgst - inIgst));
  const netLiability = round2(Math.max(0, outputTax - inputItc));

  const totalOutwardTaxable = round2(
    activeInvoices.reduce((s, i) => s + (Number(i.taxableValue) || 0), 0) -
      activeCNs.reduce((s, c) => s + (Number(c.taxableValue) || 0), 0)
  );
  const totalInwardTaxable = round2(
    activePurchases.reduce((s, p) => s + (Number(p.taxableValue) || 0), 0) +
      activeExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  );

  return {
    totalOutwardTaxable,
    totalInwardTaxable,
    outputTax,
    outCgst: Math.max(0, outCgst),
    outSgst: Math.max(0, outSgst),
    outIgst: Math.max(0, outIgst),
    inputItc,
    inCgst,
    inSgst,
    inIgst,
    netLiability,
    netCgst,
    netSgst,
    netIgst,
    itcCarryForward: round2(Math.max(0, inputItc - outputTax)),
  };
};

export const generateHSNSummary = (invoices = []) => {
  const map = new Map();
  invoices
    .filter((i) => i.status !== 'Draft' && i.status !== 'Cancelled')
    .forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const hsn = item.hsn || '9999';
        const key = `${hsn}_${item.gstRate}`;
        if (!map.has(key)) {
          map.set(key, {
            hsn,
            description: item.name || 'Taxable Goods',
            uqc: item.unit || 'PCS',
            gstRate: Number(item.gstRate) || 0,
            qty: 0,
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0,
            totalValue: 0,
          });
        }
        const entry = map.get(key);
        entry.qty = round2(entry.qty + (Number(item.qty) || 0));
        entry.taxableValue = round2(entry.taxableValue + (Number(item.taxableAmount) || 0));
        entry.cgst = round2(entry.cgst + (Number(item.cgst) || 0));
        entry.sgst = round2(entry.sgst + (Number(item.sgst) || 0));
        entry.igst = round2(entry.igst + (Number(item.igst) || 0));
        entry.totalTax = round2(entry.cgst + entry.sgst + entry.igst);
        entry.totalValue = round2(entry.taxableValue + entry.totalTax);
      });
    });
  return Array.from(map.values()).sort((a, b) => b.taxableValue - a.taxableValue);
};

export const generateGSTR1Data = ({ invoices = [], creditNotes = [], debitNotes = [], customers = [] }) => {
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const validInvoices = invoices.filter((i) => i.status !== 'Draft' && i.status !== 'Cancelled');

  const b2b = [];
  const b2cl = [];
  const b2csMap = new Map();
  const exportsList = [];

  validInvoices.forEach((inv) => {
    const cust = customerMap.get(inv.customerId);
    const hasGstin = cust?.gstin && !cust.gstin.toLowerCase().includes('unreg') && cust.registrationType !== 'Unregistered / Consumer';
    const posCode = getStateCode(inv.placeOfSupply || cust?.state);

    if (cust?.registrationType === 'Overseas / Export') {
      exportsList.push({
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        customerName: inv.customerName,
        portCode: 'INJAI6',
        taxableValue: inv.taxableValue,
        igst: inv.igst,
        grandTotal: inv.grandTotal,
      });
    } else if (hasGstin) {
      b2b.push({
        id: inv.id,
        gstin: cust.gstin,
        customerName: inv.customerName,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        placeOfSupply: `${posCode}-${inv.placeOfSupply || cust?.state}`,
        reverseCharge: 'N',
        invoiceType: 'Regular',
        taxableValue: inv.taxableValue,
        cgst: inv.cgst,
        sgst: inv.sgst,
        igst: inv.igst,
        grandTotal: inv.grandTotal,
      });
    } else if (!inv.isIntraState && Number(inv.grandTotal) > 250000) {
      b2cl.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        placeOfSupply: `${posCode}-${inv.placeOfSupply}`,
        taxableValue: inv.taxableValue,
        igst: inv.igst,
        grandTotal: inv.grandTotal,
      });
    } else {
      const supplyType = inv.isIntraState ? 'Intra-State' : 'Inter-State';
      const key = `${inv.placeOfSupply}_${supplyType}`;
      if (!b2csMap.has(key)) {
        b2csMap.set(key, {
          placeOfSupply: `${posCode}-${inv.placeOfSupply}`,
          supplyType,
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0,
        });
      }
      const row = b2csMap.get(key);
      row.taxableValue = round2(row.taxableValue + (Number(inv.taxableValue) || 0));
      row.cgst = round2(row.cgst + (Number(inv.cgst) || 0));
      row.sgst = round2(row.sgst + (Number(inv.sgst) || 0));
      row.igst = round2(row.igst + (Number(inv.igst) || 0));
      row.totalTax = round2(row.cgst + row.sgst + row.igst);
    }
  });

  const cdnr = [
    ...creditNotes.map((cn) => ({
      docType: 'Credit Note',
      number: cn.creditNoteNumber,
      date: cn.date,
      customerName: cn.customerName,
      againstInvoice: cn.invoiceNumber,
      taxableValue: cn.taxableValue,
      cgst: cn.cgst,
      sgst: cn.sgst,
      igst: cn.igst,
      grandTotal: cn.grandTotal,
    })),
    ...debitNotes.map((dn) => ({
      docType: 'Debit Note',
      number: dn.debitNoteNumber,
      date: dn.date,
      customerName: dn.customerName,
      againstInvoice: dn.invoiceNumber,
      taxableValue: dn.taxableValue,
      cgst: dn.cgst,
      sgst: dn.sgst,
      igst: dn.igst,
      grandTotal: dn.grandTotal,
    })),
  ];

  const hsnSummary = generateHSNSummary(validInvoices);

  const invNumbers = validInvoices.map((i) => i.invoiceNumber).sort();
  const docSummary = [
    {
      nature: 'Invoices for outward supply',
      from: invNumbers[0] || '—',
      to: invNumbers[invNumbers.length - 1] || '—',
      totalIssued: invoices.filter((i) => i.status !== 'Draft').length,
      cancelled: invoices.filter((i) => i.status === 'Cancelled').length,
      netIssued: validInvoices.length,
    },
    {
      nature: 'Credit Notes',
      from: creditNotes[0]?.creditNoteNumber || '—',
      to: creditNotes[creditNotes.length - 1]?.creditNoteNumber || '—',
      totalIssued: creditNotes.length,
      cancelled: 0,
      netIssued: creditNotes.length,
    },
    {
      nature: 'Debit Notes',
      from: debitNotes[0]?.debitNoteNumber || '—',
      to: debitNotes[debitNotes.length - 1]?.debitNoteNumber || '—',
      totalIssued: debitNotes.length,
      cancelled: 0,
      netIssued: debitNotes.length,
    },
  ];

  return {
    b2b,
    b2cl,
    b2cs: Array.from(b2csMap.values()),
    exports: exportsList,
    cdnr,
    hsnSummary,
    docSummary,
  };
};
