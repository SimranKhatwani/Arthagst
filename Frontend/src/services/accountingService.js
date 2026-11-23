import { round2 } from './calculationService';
import { CHART_OF_ACCOUNTS } from '../data/constants';

export const generateGeneralLedgerEntries = (data) => {
  const entries = [];

  (data.invoices || [])
    .filter((i) => i.status !== 'Draft' && i.status !== 'Cancelled')
    .forEach((inv) => {
      entries.push({
        id: `gl-inv-${inv.id}`,
        date: inv.date,
        voucherNo: inv.invoiceNumber,
        voucherType: 'Sales Invoice',
        accountName: inv.customerName,
        accountCode: '1100',
        contraAccount: 'Sales Revenue & Output GST',
        debit: Number(inv.grandTotal) || 0,
        credit: 0,
        narration: `Tax Invoice ${inv.invoiceNumber} to ${inv.customerName}`,
      });
      entries.push({
        id: `gl-inv-cr-${inv.id}`,
        date: inv.date,
        voucherNo: inv.invoiceNumber,
        voucherType: 'Sales Invoice',
        accountName: 'Sales Revenue (Taxable Goods)',
        accountCode: '4001',
        contraAccount: inv.customerName,
        debit: 0,
        credit: Number(inv.taxableValue) || 0,
        narration: `Sales taxable value for ${inv.invoiceNumber}`,
      });
    });

  (data.purchases || [])
    .filter((p) => p.status !== 'Cancelled')
    .forEach((pur) => {
      entries.push({
        id: `gl-pur-${pur.id}`,
        date: pur.date,
        voucherNo: pur.billNumber,
        voucherType: 'Purchase Bill',
        accountName: 'Cost of Goods Purchased',
        accountCode: '5001',
        contraAccount: pur.supplierName,
        debit: Number(pur.taxableValue) || 0,
        credit: 0,
        narration: `Purchase bill ${pur.supplierInvoiceNo || pur.billNumber} from ${pur.supplierName}`,
      });
      entries.push({
        id: `gl-pur-cr-${pur.id}`,
        date: pur.date,
        voucherNo: pur.billNumber,
        voucherType: 'Purchase Bill',
        accountName: pur.supplierName,
        accountCode: '2001',
        contraAccount: 'Cost of Goods Purchased',
        debit: 0,
        credit: Number(pur.grandTotal) || 0,
        narration: `Payable to ${pur.supplierName}`,
      });
    });

  (data.payments || []).forEach((pay) => {
    const isIn = pay.type === 'Payment In';
    entries.push({
      id: `gl-pay-${pay.id}`,
      date: pay.date,
      voucherNo: pay.paymentNumber,
      voucherType: isIn ? 'Receipt' : 'Payment',
      accountName: pay.accountName || (pay.method === 'Cash' ? 'Cash in Hand' : 'HDFC Bank Current A/c'),
      accountCode: pay.method === 'Cash' ? '1001' : '1002',
      contraAccount: pay.partyName,
      debit: isIn ? Number(pay.amount) || 0 : 0,
      credit: isIn ? 0 : Number(pay.amount) || 0,
      narration: `${pay.type} (${pay.method}) - ${pay.partyName} (${pay.referenceNo || 'Ref'})`,
    });
  });

  (data.expenses || [])
    .filter((e) => e.status !== 'Archived')
    .forEach((exp) => {
      entries.push({
        id: `gl-exp-${exp.id}`,
        date: exp.date,
        voucherNo: exp.expenseNumber,
        voucherType: 'Expense',
        accountName: exp.category,
        accountCode: '5100',
        contraAccount: exp.paymentMethod,
        debit: Number(exp.totalAmount) || 0,
        credit: 0,
        narration: `${exp.title} — ${exp.vendorName}`,
      });
    });

  (data.journalEntries || []).forEach((je) => {
    (je.lines || []).forEach((line, idx) => {
      entries.push({
        id: `gl-je-${je.id}-${idx}`,
        date: je.date,
        voucherNo: je.entryNumber,
        voucherType: je.voucherType || 'Journal',
        accountName: line.accountName,
        accountCode: line.accountCode || '9999',
        contraAccount: je.narration,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        narration: je.narration,
      });
    });
  });

  return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};

export const computeFinancialStatements = (data) => {
  const validInvoices = (data.invoices || []).filter(
    (i) => i.status !== 'Draft' && i.status !== 'Cancelled'
  );
  const validCNs = (data.creditNotes || []).filter((c) => c.status === 'Issued');
  const validPurchases = (data.purchases || []).filter((p) => p.status !== 'Cancelled');
  const validExpenses = (data.expenses || []).filter((e) => e.status !== 'Archived');

  const grossSales = validInvoices.reduce((s, i) => s + (Number(i.taxableValue) || 0), 0);
  const salesReturns = validCNs.reduce((s, c) => s + (Number(c.taxableValue) || 0), 0);
  const netSales = round2(grossSales - salesReturns);
  const shippingIncome = validInvoices.reduce(
    (s, i) => s + (Number(i.shipping) || 0) + (Number(i.otherCharges) || 0),
    0
  );

  const totalPurchases = validPurchases.reduce((s, p) => s + (Number(p.taxableValue) || 0), 0);
  const closingStock = (data.products || [])
    .filter((p) => !p.archived)
    .reduce((s, p) => s + Math.max(0, Number(p.stock) || 0) * (Number(p.purchasePrice) || 0), 0);

  const cogs = round2(Math.max(0, totalPurchases * 0.72));
  const grossProfit = round2(netSales + shippingIncome - cogs);

  const expenseByCategory = {};
  validExpenses.forEach((e) => {
    expenseByCategory[e.category] = round2((expenseByCategory[e.category] || 0) + (Number(e.amount) || 0));
  });
  const totalOperatingExpenses = round2(
    Object.values(expenseByCategory).reduce((s, v) => s + v, 0)
  );
  const netProfit = round2(grossProfit - totalOperatingExpenses);

  const cashBankTotal = (data.bankAccounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const receivables = validInvoices.reduce(
    (s, i) => s + Math.max(0, (Number(i.grandTotal) || 0) - (Number(i.amountPaid) || 0)),
    0
  );
  const payables = validPurchases.reduce(
    (s, p) => s + Math.max(0, (Number(p.grandTotal) || 0) - (Number(p.amountPaid) || 0)),
    0
  );
  const fixedAssets = 485000;
  const outputGst = validInvoices.reduce((s, i) => s + (Number(i.totalTax) || 0), 0);
  const inputGst = validPurchases.reduce((s, p) => s + (Number(p.totalTax) || 0), 0);
  const netGstLiability = round2(Math.max(0, outputGst - inputGst));

  const totalAssets = round2(cashBankTotal + receivables + closingStock + fixedAssets);
  const totalLiabilities = round2(payables + netGstLiability + 18000);
  const totalEquity = round2(totalAssets - totalLiabilities);

  // Trial Balance summary derived from accounts + transactions
  const trialBalance = CHART_OF_ACCOUNTS.map((acc) => {
    let debit = 0;
    let credit = 0;
    if (acc.code === '1001') {
      const cashAcc = (data.bankAccounts || []).find((b) => b.type === 'Cash');
      debit = cashAcc ? cashAcc.balance : acc.openingBalance;
    } else if (acc.code === '1002') {
      const hdfc = (data.bankAccounts || []).find((b) => b.name.includes('HDFC'));
      debit = hdfc ? hdfc.balance : acc.openingBalance;
    } else if (acc.code === '1003') {
      const icici = (data.bankAccounts || []).find((b) => b.name.includes('ICICI'));
      debit = icici ? icici.balance : acc.openingBalance;
    } else if (acc.code === '1004') {
      const upi = (data.bankAccounts || []).find((b) => b.type === 'UPI');
      debit = upi ? upi.balance : acc.openingBalance;
    } else if (acc.code === '1100') {
      debit = round2(receivables);
    } else if (acc.code === '1200') {
      debit = round2(closingStock);
    } else if (acc.code === '1300') {
      debit = round2(inputGst);
    } else if (acc.code === '1500') {
      debit = fixedAssets;
    } else if (acc.code === '2001') {
      credit = round2(payables);
    } else if (acc.code === '2100') {
      credit = round2(outputGst);
    } else if (acc.code === '4001') {
      credit = round2(netSales);
    } else if (acc.code === '4002') {
      credit = round2(shippingIncome);
    } else if (acc.code === '5001') {
      debit = round2(totalPurchases);
    } else if (acc.code === '5100') {
      debit = round2(totalOperatingExpenses);
    } else {
      if (acc.normalBalance === 'Debit') debit = acc.openingBalance;
      else credit = acc.openingBalance;
    }
    return {
      ...acc,
      debit: round2(debit),
      credit: round2(credit),
    };
  });

  return {
    pnl: {
      grossSales: round2(grossSales),
      salesReturns: round2(salesReturns),
      netSales,
      shippingIncome: round2(shippingIncome),
      totalPurchases: round2(totalPurchases),
      closingStock: round2(closingStock),
      cogs,
      grossProfit,
      expenseByCategory,
      totalOperatingExpenses,
      netProfit,
    },
    balanceSheet: {
      assets: {
        cashAndBank: round2(cashBankTotal),
        accountsReceivable: round2(receivables),
        closingInventory: round2(closingStock),
        fixedAssets,
        totalAssets,
      },
      liabilitiesAndEquity: {
        accountsPayable: round2(payables),
        gstPayable: netGstLiability,
        statutoryPayables: 18000,
        totalLiabilities,
        capitalAndReserves: round2(totalEquity - netProfit),
        currentYearProfit: netProfit,
        totalEquity,
      },
    },
    trialBalance,
  };
};
