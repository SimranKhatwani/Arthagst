import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Printer } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CHART_OF_ACCOUNTS } from '../../data/constants';
import { generateGeneralLedgerEntries, computeFinancialStatements } from '../../services/accountingService';
import { formatINR, formatDateIN, round2 } from '../../services/calculationService';
import { generateNextDocNumber } from '../../services/invoiceService';
import { exportToCSV } from '../../services/storageService';
import { printElement } from '../../services/printService';
import {
  PageHeader,
  DataTable,
  StatCard,
  Modal,
  InputField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

export const ChartOfAccountsPage = () => {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Standard Indian double-entry ledger groups across Assets, Liabilities, Equity, Income & Expenses"
        breadcrumbs={['Accounting', 'Chart of Accounts']}
      />
      <DataTable
        data={CHART_OF_ACCOUNTS}
        searchFields={['code', 'name', 'group', 'type']}
        columns={[
          { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-semibold text-indigo-700">{r.code}</span> },
          { key: 'name', label: 'Account Name', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
          { key: 'group', label: 'Sub-Group' },
          { key: 'type', label: 'Classification' },
          { key: 'normalBalance', label: 'Normal Balance' },
          { key: 'openingBalance', label: 'Opening Bal.', align: 'right', render: (r) => formatINR(r.openingBalance) },
        ]}
      />
    </div>
  );
};

export const GeneralLedgerPage = () => {
  const { state } = useApp();
  const navigate = useNavigate();
  const entries = useMemo(() => generateGeneralLedgerEntries(state), [state]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="General Ledger"
        subtitle="Consolidated double-entry transaction stream derived from invoices, purchases, payments & journals"
        breadcrumbs={['Accounting', 'General Ledger']}
        actions={
          <>
            <button type="button" onClick={() => navigate('/parties/customers')} className={btnSecondary}>
              Party Ledgers
            </button>
            <button type="button" onClick={() => navigate('/payments/cash-book')} className={btnSecondary}>
              Cash &amp; Bank Books
            </button>
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  'general-ledger.csv',
                  ['Date', 'Voucher #', 'Type', 'Account', 'Contra', 'Debit', 'Credit'],
                  entries.map((e) => [e.date, e.voucherNo, e.voucherType, e.accountName, e.contraAccount, e.debit, e.credit])
                )
              }
              className={btnSecondary}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </>
        }
      />
      <DataTable
        data={entries}
        searchFields={['voucherNo', 'accountName', 'narration', 'voucherType']}
        columns={[
          { key: 'date', label: 'Date', sortable: true, render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'voucherNo', label: 'Voucher #', render: (r) => <span className="font-mono font-semibold">{r.voucherNo}</span> },
          { key: 'voucherType', label: 'Type' },
          { key: 'accountName', label: 'Account', render: (r) => <span className="font-medium text-slate-900">{r.accountName}</span> },
          { key: 'narration', label: 'Narration' },
          { key: 'debit', label: 'Debit (₹)', align: 'right', render: (r) => (r.debit ? formatINR(r.debit) : '—') },
          { key: 'credit', label: 'Credit (₹)', align: 'right', render: (r) => (r.credit ? formatINR(r.credit) : '—') },
        ]}
      />
    </div>
  );
};

export const CustomerLedgerPage = () => {
  const { state } = useApp();
  const [customerId, setCustomerId] = useState(state.customers[0]?.id || '');
  const customer = state.customers.find((c) => c.id === customerId);

  const rows = useMemo(() => {
    if (!customer) return [];
    const list = [];
    if (customer.openingBalance > 0) list.push({ date: '2026-04-01', ref: 'OPEN', type: 'Opening Balance', debit: customer.openingBalance, credit: 0 });
    state.invoices
      .filter((i) => i.customerId === customer.id && i.status !== 'Draft' && i.status !== 'Cancelled')
      .forEach((i) => list.push({ date: i.date, ref: i.invoiceNumber, type: 'Sales Invoice', debit: i.grandTotal, credit: 0 }));
    state.payments
      .filter((p) => p.type === 'Payment In' && p.partyId === customer.id)
      .forEach((p) => list.push({ date: p.date, ref: p.paymentNumber, type: `Receipt (${p.method})`, debit: 0, credit: p.amount }));
    state.creditNotes
      .filter((c) => c.customerId === customer.id)
      .forEach((c) => list.push({ date: c.date, ref: c.creditNoteNumber, type: 'Credit Note', debit: 0, credit: c.grandTotal }));
    list.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return list.map((r) => {
      bal = round2(bal + r.debit - r.credit);
      return { ...r, balance: bal };
    });
  }, [customer, state.invoices, state.payments, state.creditNotes]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer Ledger"
        subtitle="Party-wise debit/credit statement with running receivable balance"
        breadcrumbs={['Accounting', 'Customer Ledger']}
        actions={
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium">
            {state.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        }
      />
      <DataTable
        data={rows}
        columns={[
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'ref', label: 'Voucher #', render: (r) => <span className="font-mono font-semibold">{r.ref}</span> },
          { key: 'type', label: 'Particulars' },
          { key: 'debit', label: 'Debit (₹)', align: 'right', render: (r) => (r.debit ? formatINR(r.debit) : '—') },
          { key: 'credit', label: 'Credit (₹)', align: 'right', render: (r) => (r.credit ? formatINR(r.credit) : '—') },
          { key: 'balance', label: 'Running Balance', align: 'right', render: (r) => <span className="font-semibold">{formatINR(r.balance)}</span> },
        ]}
      />
    </div>
  );
};

export const SupplierLedgerPage = () => {
  const { state } = useApp();
  const [supplierId, setSupplierId] = useState(state.suppliers[0]?.id || '');
  const supplier = state.suppliers.find((s) => s.id === supplierId);

  const rows = useMemo(() => {
    if (!supplier) return [];
    const list = [];
    if (supplier.openingBalance > 0) list.push({ date: '2026-04-01', ref: 'OPEN', type: 'Opening Payable', debit: 0, credit: supplier.openingBalance });
    state.purchases
      .filter((p) => p.supplierId === supplier.id)
      .forEach((p) => list.push({ date: p.date, ref: p.billNumber, type: `Purchase (${p.supplierInvoiceNo})`, debit: 0, credit: p.grandTotal }));
    state.payments
      .filter((p) => p.type === 'Payment Out' && p.partyId === supplier.id)
      .forEach((p) => list.push({ date: p.date, ref: p.paymentNumber, type: `Payment Out (${p.method})`, debit: p.amount, credit: 0 }));
    list.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return list.map((r) => {
      bal = round2(bal + r.credit - r.debit);
      return { ...r, balance: bal };
    });
  }, [supplier, state.purchases, state.payments]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Supplier Ledger"
        subtitle="Vendor-wise bills, disbursements, and running payable balance"
        breadcrumbs={['Accounting', 'Supplier Ledger']}
        actions={
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium">
            {state.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        }
      />
      <DataTable
        data={rows}
        columns={[
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'ref', label: 'Voucher #', render: (r) => <span className="font-mono font-semibold">{r.ref}</span> },
          { key: 'type', label: 'Particulars' },
          { key: 'debit', label: 'Debit (Paid)', align: 'right', render: (r) => (r.debit ? formatINR(r.debit) : '—') },
          { key: 'credit', label: 'Credit (Billed)', align: 'right', render: (r) => (r.credit ? formatINR(r.credit) : '—') },
          { key: 'balance', label: 'Payable Balance', align: 'right', render: (r) => <span className="font-semibold">{formatINR(r.balance)}</span> },
        ]}
      />
    </div>
  );
};

export const CashBookSection = () => {
  const { state } = useApp();
  const cashAcc = state.bankAccounts.find((a) => a.type === 'Cash');
  const cashTxns = [
    ...state.payments
      .filter((p) => p.method === 'Cash')
      .map((p) => ({
        date: p.date,
        ref: p.paymentNumber,
        party: p.partyName,
        receipt: p.type === 'Payment In' ? p.amount : 0,
        payment: p.type === 'Payment Out' ? p.amount : 0,
      })),
    ...state.expenses
      .filter((e) => e.paymentMethod === 'Cash')
      .map((e) => ({
        date: e.date,
        ref: e.expenseNumber,
        party: `${e.title} (${e.vendorName})`,
        receipt: 0,
        payment: e.totalAmount,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 flex items-center justify-between">
        <span>Petty Cash Counter · Opening: <strong className="font-mono text-slate-900">{formatINR(cashAcc?.openingBalance || 0)}</strong></span>
        <span>Current Cash Balance: <strong className="font-mono text-sm text-indigo-700">{formatINR(cashAcc?.balance || 0)}</strong></span>
      </div>
      <DataTable
        data={cashTxns}
        searchFields={['ref', 'party']}
        columns={[
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'ref', label: 'Voucher #', render: (r) => <span className="font-mono font-semibold">{r.ref}</span> },
          { key: 'party', label: 'Particulars' },
          { key: 'receipt', label: 'Cash In (Dr)', align: 'right', render: (r) => (r.receipt ? formatINR(r.receipt) : '—') },
          { key: 'payment', label: 'Cash Out (Cr)', align: 'right', render: (r) => (r.payment ? formatINR(r.payment) : '—') },
        ]}
      />
    </div>
  );
};

export const CashBookPage = () => {
  const { state } = useApp();
  const cashAcc = state.bankAccounts.find((a) => a.type === 'Cash');
  return (
    <div className="space-y-5">
      <PageHeader title="Cash Book" subtitle={`Petty Cash Counter · Current Balance: ${formatINR(cashAcc?.balance || 0)}`} breadcrumbs={['Payments', 'Cash Book']} />
      <CashBookSection />
    </div>
  );
};

export const BankBookSection = () => {
  const { state } = useApp();
  const bankTotal = state.bankAccounts.filter((a) => a.type !== 'Cash').reduce((s, a) => s + a.balance, 0);
  const bankTxns = state.payments
    .filter((p) => p.method !== 'Cash')
    .map((p) => ({
      date: p.date,
      ref: p.paymentNumber,
      account: p.accountName,
      party: `${p.partyName} (${p.method})`,
      deposit: p.type === 'Payment In' ? p.amount : 0,
      withdrawal: p.type === 'Payment Out' ? p.amount : 0,
    }));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 flex items-center justify-between">
        <span>Bank &amp; UPI Accounts ({state.bankAccounts.filter((a) => a.type !== 'Cash').length})</span>
        <span>Combined Bank &amp; UPI Balance: <strong className="font-mono text-sm text-indigo-700">{formatINR(bankTotal)}</strong></span>
      </div>
      <DataTable
        data={bankTxns}
        searchFields={['ref', 'party', 'account']}
        columns={[
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'ref', label: 'Voucher #', render: (r) => <span className="font-mono font-semibold">{r.ref}</span> },
          { key: 'account', label: 'Bank / UPI Account' },
          { key: 'party', label: 'Particulars' },
          { key: 'deposit', label: 'Deposit (Dr)', align: 'right', render: (r) => (r.deposit ? formatINR(r.deposit) : '—') },
          { key: 'withdrawal', label: 'Withdrawal (Cr)', align: 'right', render: (r) => (r.withdrawal ? formatINR(r.withdrawal) : '—') },
        ]}
      />
    </div>
  );
};

export const BankBookPage = () => {
  const { state } = useApp();
  const bankTotal = state.bankAccounts.filter((a) => a.type !== 'Cash').reduce((s, a) => s + a.balance, 0);
  return (
    <div className="space-y-5">
      <PageHeader title="Bank & UPI Book" subtitle={`Combined Bank & UPI Balance: ${formatINR(bankTotal)}`} breadcrumbs={['Payments', 'Bank Book']} />
      <BankBookSection />
    </div>
  );
};

export const JournalEntriesPage = () => {
  const { state, updateStateWithAudit, notify } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [voucherType, setVoucherType] = useState('Journal');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [debitAcc, setDebitAcc] = useState(CHART_OF_ACCOUNTS[0].name);
  const [creditAcc, setCreditAcc] = useState(CHART_OF_ACCOUNTS[1].name);
  const [amount, setAmount] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    const amt = round2(Number(amount) || 0);
    if (amt <= 0 || debitAcc === creditAcc) {
      notify('Enter a valid amount and select different Debit and Credit accounts', 'error');
      return;
    }
    const entryNumber = generateNextDocNumber(
      voucherType === 'Contra' ? 'CN/26-27/' : 'JV/26-27/',
      state.journalEntries,
      'entryNumber'
    );
    const newJE = {
      id: `je-${Date.now()}`,
      entryNumber,
      date,
      voucherType,
      narration: narration || `${voucherType} voucher entry`,
      lines: [
        { accountCode: '1000', accountName: debitAcc, debit: amt, credit: 0 },
        { accountCode: '2000', accountName: creditAcc, debit: 0, credit: amt },
      ],
    };
    updateStateWithAudit(
      (prev) => ({ ...prev, journalEntries: [newJE, ...prev.journalEntries] }),
      { action: `Posted ${voucherType} Entry`, module: 'Accounting', recordRef: entryNumber, prevValue: '—', newValue: `₹${amt}` }
    );
    notify(`${voucherType} entry ${entryNumber} posted`);
    setModalOpen(false);
    setAmount('');
    setNarration('');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal & Contra Entries"
        subtitle="Record manual accounting adjustments, depreciation, and contra transfers"
        breadcrumbs={['Accounting', 'Journal Entries']}
        actions={
          <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" /> Post Journal / Contra
          </button>
        }
      />

      <div className="space-y-3">
        {state.journalEntries.map((je) => (
          <div key={je.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-indigo-700">{je.entryNumber}</span>
                <span className="text-slate-400">·</span>
                <span className="font-medium text-slate-700">{je.voucherType}</span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-slate-500">{formatDateIN(je.date)}</span>
              </div>
              <div className="text-slate-500">{je.narration}</div>
            </div>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {je.lines.map((l, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 font-medium text-slate-800">{l.accountName}</td>
                    <td className="py-1.5 text-right font-mono w-32">{l.debit ? formatINR(l.debit) : '—'}</td>
                    <td className="py-1.5 text-right font-mono w-32">{l.credit ? formatINR(l.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Post Journal / Contra Voucher"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="je-form" className={btnPrimary}>Post Entry</button>
          </>
        }
      >
        <form id="je-form" onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Voucher Type">
              <select value={voucherType} onChange={(e) => setVoucherType(e.target.value)} className={inputClass}>
                <option value="Journal">Journal Voucher</option>
                <option value="Contra">Contra Entry</option>
              </select>
            </InputField>
            <InputField label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></InputField>
            <InputField label="Debit Account (Dr)">
              <select value={debitAcc} onChange={(e) => setDebitAcc(e.target.value)} className={inputClass}>
                {CHART_OF_ACCOUNTS.map((a) => <option key={a.code} value={a.name}>{a.code} - {a.name}</option>)}
              </select>
            </InputField>
            <InputField label="Credit Account (Cr)">
              <select value={creditAcc} onChange={(e) => setCreditAcc(e.target.value)} className={inputClass}>
                {CHART_OF_ACCOUNTS.map((a) => <option key={a.code} value={a.name}>{a.code} - {a.name}</option>)}
              </select>
            </InputField>
          </div>
          <InputField label="Amount (₹)" required>
            <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} font-mono`} />
          </InputField>
          <InputField label="Narration">
            <input type="text" value={narration} onChange={(e) => setNarration(e.target.value)} className={inputClass} placeholder="Adjustment narration" />
          </InputField>
        </form>
      </Modal>
    </div>
  );
};

export const TrialBalancePage = () => {
  const { state, notify } = useApp();
  const { trialBalance } = useMemo(() => computeFinancialStatements(state), [state]);
  const totalDr = trialBalance.reduce((s, r) => s + r.debit, 0);
  const totalCr = trialBalance.reduce((s, r) => s + r.credit, 0);

  return (
    <div id="trial-balance-sheet" className="space-y-5">
      <PageHeader
        title="Trial Balance (Simplified Prototype Summary)"
        subtitle="Account-wise Debit & Credit closing summary derived from demo transactions"
        breadcrumbs={['Accounting', 'Trial Balance']}
        actions={
          <button
            type="button"
            onClick={() =>
              printElement({
                elementId: 'trial-balance-sheet',
                title: 'Trial Balance',
                fileName: 'trial-balance.html',
                onNotify: notify,
              })
            }
            className={`${btnSecondary} no-print`}
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        }
      />
      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Account Name</th>
              <th className="px-4 py-2.5">Group</th>
              <th className="px-4 py-2.5 text-right">Debit (₹)</th>
              <th className="px-4 py-2.5 text-right">Credit (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trialBalance.map((r) => (
              <tr key={r.code}>
                <td className="px-4 py-2 font-mono text-slate-500">{r.code}</td>
                <td className="px-4 py-2 font-medium text-slate-900">{r.name}</td>
                <td className="px-4 py-2 text-slate-600">{r.group}</td>
                <td className="px-4 py-2 text-right font-mono">{r.debit ? formatINR(r.debit) : '—'}</td>
                <td className="px-4 py-2 text-right font-mono">{r.credit ? formatINR(r.credit) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
            <tr>
              <td colSpan={3} className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right font-mono">{formatINR(totalDr)}</td>
              <td className="px-4 py-2.5 text-right font-mono">{formatINR(totalCr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export const ProfitLossPage = () => {
  const { state, notify } = useApp();
  const { pnl } = useMemo(() => computeFinancialStatements(state), [state]);

  return (
    <div id="pnl-sheet" className="space-y-5">
      <PageHeader
        title="Profit & Loss Statement (Simplified)"
        subtitle="FY 2026-27 Income, COGS, Operating Expenses & Net Profit derived from transactions"
        breadcrumbs={['Accounting', 'Profit & Loss']}
        actions={
          <button
            type="button"
            onClick={() =>
              printElement({
                elementId: 'pnl-sheet',
                title: 'Profit & Loss Statement',
                fileName: 'profit-and-loss.html',
                onNotify: notify,
              })
            }
            className={`${btnSecondary} no-print`}
          >
            <Printer className="h-3.5 w-3.5" /> Print P&amp;L
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Net Sales (Excl. GST)" value={formatINR(pnl.netSales, false)} />
        <StatCard label="Est. Cost of Goods Sold" value={formatINR(pnl.cogs, false)} />
        <StatCard label="Gross Profit" value={formatINR(pnl.grossProfit, false)} tone="success" />
        <StatCard label="Net Profit" value={formatINR(pnl.netProfit, false)} tone={pnl.netProfit >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 text-xs">
        <div className="space-y-1.5">
          <div className="font-display text-sm font-semibold text-slate-900">Trading &amp; Income</div>
          <div className="flex justify-between"><span>Gross Taxable Sales</span><span className="font-mono">{formatINR(pnl.grossSales)}</span></div>
          <div className="flex justify-between text-rose-700"><span>Less: Sales Returns (Credit Notes)</span><span className="font-mono">- {formatINR(pnl.salesReturns)}</span></div>
          <div className="flex justify-between"><span>Shipping &amp; Other Recoveries</span><span className="font-mono">{formatINR(pnl.shippingIncome)}</span></div>
          <div className="flex justify-between"><span>Less: Estimated Cost of Goods Sold</span><span className="font-mono">- {formatINR(pnl.cogs)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
            <span>Gross Profit</span><span className="font-mono">{formatINR(pnl.grossProfit)}</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="font-display text-sm font-semibold text-slate-900">Operating Expenses</div>
          {Object.entries(pnl.expenseByCategory).map(([cat, amt]) => (
            <div key={cat} className="flex justify-between text-slate-600">
              <span>{cat}</span>
              <span className="font-mono">{formatINR(amt)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
            <span>Total Operating Expenses</span>
            <span className="font-mono">{formatINR(pnl.totalOperatingExpenses)}</span>
          </div>
        </div>

        <div className="flex justify-between rounded-md bg-indigo-50 p-3 text-sm font-bold text-indigo-950">
          <span>Estimated Net Profit (Before Income Tax)</span>
          <span className="font-mono">{formatINR(pnl.netProfit)}</span>
        </div>
      </div>
    </div>
  );
};

export const BalanceSheetPage = () => {
  const { state, notify } = useApp();
  const { balanceSheet } = useMemo(() => computeFinancialStatements(state), [state]);
  const { assets, liabilitiesAndEquity } = balanceSheet;

  return (
    <div id="balance-sheet-doc" className="space-y-5">
      <PageHeader
        title="Balance Sheet (Simplified Prototype Summary)"
        subtitle="Snapshot of Business Assets, Liabilities & Owner's Equity"
        breadcrumbs={['Accounting', 'Balance Sheet']}
        actions={
          <button
            type="button"
            onClick={() =>
              printElement({
                elementId: 'balance-sheet-doc',
                title: 'Balance Sheet',
                fileName: 'balance-sheet.html',
                onNotify: notify,
              })
            }
            className={`${btnSecondary} no-print`}
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5 text-xs">
          <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Assets</h3>
          <div className="flex justify-between"><span>Cash, Bank &amp; UPI Balances</span><span className="font-mono">{formatINR(assets.cashAndBank)}</span></div>
          <div className="flex justify-between"><span>Accounts Receivable (Debtors)</span><span className="font-mono">{formatINR(assets.accountsReceivable)}</span></div>
          <div className="flex justify-between"><span>Closing Inventory Valuation</span><span className="font-mono">{formatINR(assets.closingInventory)}</span></div>
          <div className="flex justify-between"><span>Fixed Assets (Furniture &amp; Systems)</span><span className="font-mono">{formatINR(assets.fixedAssets)}</span></div>
          <div className="flex justify-between border-t border-slate-300 pt-2.5 text-sm font-bold text-slate-900">
            <span>Total Assets</span>
            <span className="font-mono">{formatINR(assets.totalAssets)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5 text-xs">
          <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Liabilities &amp; Capital</h3>
          <div className="flex justify-between"><span>Accounts Payable (Creditors)</span><span className="font-mono">{formatINR(liabilitiesAndEquity.accountsPayable)}</span></div>
          <div className="flex justify-between"><span>Estimated Net GST Liability</span><span className="font-mono">{formatINR(liabilitiesAndEquity.gstPayable)}</span></div>
          <div className="flex justify-between"><span>TDS &amp; Statutory Payables</span><span className="font-mono">{formatINR(liabilitiesAndEquity.statutoryPayables)}</span></div>
          <div className="flex justify-between border-t border-slate-100 pt-2 font-medium"><span>Total Liabilities</span><span className="font-mono">{formatINR(liabilitiesAndEquity.totalLiabilities)}</span></div>
          <div className="flex justify-between"><span>Proprietor Capital &amp; Reserves</span><span className="font-mono">{formatINR(liabilitiesAndEquity.capitalAndReserves)}</span></div>
          <div className="flex justify-between"><span>Current Year Net Profit</span><span className="font-mono">{formatINR(liabilitiesAndEquity.currentYearProfit)}</span></div>
          <div className="flex justify-between border-t border-slate-300 pt-2.5 text-sm font-bold text-slate-900">
            <span>Total Liabilities &amp; Equity</span>
            <span className="font-mono">{formatINR(liabilitiesAndEquity.totalLiabilities + liabilitiesAndEquity.totalEquity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
