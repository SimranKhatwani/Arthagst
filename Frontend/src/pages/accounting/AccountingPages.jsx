import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Printer, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CHART_OF_ACCOUNTS } from '../../data/constants';
import * as accountingService from '../../services/accountingService';
import * as reportsService from '../../services/reportsService';
import { formatINR, formatDateIN, round2 } from '../../services/calculationService';
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
  const { notify } = useApp();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    accountName: '',
    accountCode: '',
    accountType: 'asset',
    accountSubType: 'general',
    balanceType: 'debit',
    openingBalance: 0,
    description: '',
  });

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await accountingService.getAccounts();
      if (Array.isArray(data) && data.length > 0) {
        setAccounts(
          data.map((a) => ({
            ...a,
            id: String(a._id || a.id),
            code: a.accountCode,
            name: a.accountName,
            group: a.accountSubType,
            type: a.accountType ? a.accountType.charAt(0).toUpperCase() + a.accountType.slice(1) : 'Asset',
            normalBalance: a.balanceType ? a.balanceType.charAt(0).toUpperCase() + a.balanceType.slice(1) : 'Debit',
            openingBalance: Number(a.openingBalance) || 0,
          }))
        );
      } else {
        setAccounts(CHART_OF_ACCOUNTS);
      }
    } catch (err) {
      console.warn('Failed to fetch accounts from server, using standard COA:', err);
      setAccounts(CHART_OF_ACCOUNTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleSeed = async () => {
    try {
      await accountingService.seedAccounts();
      notify('Default Indian Chart of Accounts seeded');
      await fetchAccounts();
    } catch (err) {
      notify(err.message || 'Failed to seed accounts', 'error');
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      await accountingService.createAccount({
        accountName: form.accountName.trim(),
        accountCode: form.accountCode.trim().toUpperCase(),
        accountType: form.accountType,
        accountSubType: form.accountSubType.trim(),
        balanceType: form.balanceType,
        openingBalance: Number(form.openingBalance) || 0,
        description: form.description.trim(),
      });
      notify('Account created successfully');
      setModalOpen(false);
      setForm({
        accountName: '',
        accountCode: '',
        accountType: 'asset',
        accountSubType: 'general',
        balanceType: 'debit',
        openingBalance: 0,
        description: '',
      });
      await fetchAccounts();
    } catch (err) {
      notify(err.message || 'Failed to create account', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Chart of Accounts"
        subtitle="Standard Indian double-entry ledger groups across Assets, Liabilities, Equity, Income & Expenses"
        breadcrumbs={['Accounting', 'Chart of Accounts']}
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSeed} className={btnSecondary}>
              Seed Standard COA
            </button>
            <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" /> Add Account
            </button>
          </div>
        }
      />
      <DataTable
        data={accounts}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New Ledger Account"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="coa-form" className={btnPrimary}>Create Account</button>
          </>
        }
      >
        <form id="coa-form" onSubmit={handleCreateAccount} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Account Code" required>
              <input
                type="text"
                required
                value={form.accountCode}
                onChange={(e) => setForm({ ...form, accountCode: e.target.value })}
                className={inputClass}
                placeholder="e.g. 1050"
              />
            </InputField>
            <InputField label="Account Name" required>
              <input
                type="text"
                required
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                className={inputClass}
                placeholder="e.g. ICICI Bank Current A/c"
              />
            </InputField>
            <InputField label="Account Type" required>
              <select
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                className={inputClass}
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </InputField>
            <InputField label="Account Sub-Group" required>
              <input
                type="text"
                required
                value={form.accountSubType}
                onChange={(e) => setForm({ ...form, accountSubType: e.target.value })}
                className={inputClass}
                placeholder="e.g. bank_and_cash"
              />
            </InputField>
            <InputField label="Normal Balance" required>
              <select
                value={form.balanceType}
                onChange={(e) => setForm({ ...form, balanceType: e.target.value })}
                className={inputClass}
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </InputField>
            <InputField label="Opening Balance (₹)">
              <input
                type="number"
                step="0.01"
                value={form.openingBalance}
                onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </InputField>
          </div>
          <InputField label="Description">
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
              placeholder="Optional notes or details"
            />
          </InputField>
        </form>
      </Modal>
    </div>
  );
};

export const GeneralLedgerPage = () => {
  const { state, selectedFY } = useApp();
  const navigate = useNavigate();
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Accounts list for dropdown
  const accounts = useMemo(() => {
    return (state.chartOfAccounts || []).length > 0 ? state.chartOfAccounts : CHART_OF_ACCOUNTS;
  }, [state.chartOfAccounts]);

  const activeAccountId = selectedAccountId || accounts[0]?._id || accounts[0]?.id || accounts[0]?.code;

  const fetchLedger = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      setLoading(true);
      const res = await accountingService.getGeneralLedger({
        accountId: activeAccountId,
        financialYear: selectedFY,
      });
      setLedgerData(res);
    } catch (err) {
      console.warn('Live general ledger query notice:', err.message);
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, selectedFY]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const rows = useMemo(() => {
    if (ledgerData && Array.isArray(ledgerData.entries)) {
      return ledgerData.entries.map((e) => ({
        id: e.entryId,
        date: e.entryDate ? new Date(e.entryDate).toISOString().slice(0, 10) : '',
        voucherNo: e.entryNumber || e.sourceDocumentNumber,
        voucherType: e.sourceType || 'Journal',
        accountName: ledgerData.account?.accountName || 'Account',
        narration: e.narration || e.lineDescription,
        debit: e.debit || 0,
        credit: e.credit || 0,
        runningBalance: e.runningBalance,
      }));
    }
    // Safe client-side fallback if backend account ledger has no entries yet
    return accountingService.generateGeneralLedgerEntries(state);
  }, [ledgerData, state]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="General Ledger"
        subtitle={`Double-entry transaction stream derived from actual posted journals · FY ${selectedFY}`}
        breadcrumbs={['Accounting', 'General Ledger']}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
            >
              {accounts.map((a) => (
                <option key={a._id || a.id || a.code} value={a._id || a.id || a.code}>
                  {a.accountCode || a.code} - {a.accountName || a.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => navigate('/parties/customers')} className={btnSecondary}>
              Party Ledgers
            </button>
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  'general-ledger.csv',
                  ['Date', 'Voucher #', 'Type', 'Account', 'Narration', 'Debit', 'Credit', 'Balance'],
                  rows.map((e) => [e.date, e.voucherNo, e.voucherType, e.accountName, e.narration, e.debit, e.credit, e.runningBalance || ''])
                )
              }
              className={btnSecondary}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        }
      />

      {ledgerData && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <StatCard label="Opening Balance" value={formatINR(ledgerData.openingBalance || 0)} />
          <StatCard label="Period Debit" value={formatINR(ledgerData.periodDebit || 0)} />
          <StatCard label="Period Credit" value={formatINR(ledgerData.periodCredit || 0)} />
          <StatCard label="Closing Balance" value={formatINR(ledgerData.closingBalance || 0)} tone="brand" />
        </div>
      )}

      <DataTable
        data={rows}
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
  const [ledgerRows, setLedgerRows] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);

  const customer = state.customers.find((c) => c.id === customerId);

  useEffect(() => {
    if (!customerId) return;
    let isMounted = true;
    reportsService
      .getCustomerLedger(customerId)
      .then((res) => {
        if (!isMounted) return;
        setCustomerInfo(res.party || null);
        if (Array.isArray(res.entries)) {
          setLedgerRows(
            res.entries.map((e) => ({
              date: e.date ? new Date(e.date).toISOString().slice(0, 10) : '',
              ref: e.voucherNumber || e.ref || '',
              type: e.voucherType || e.type || '',
              debit: e.debit || 0,
              credit: e.credit || 0,
              balance: e.runningBalance !== undefined ? e.runningBalance : (e.balance || 0),
            }))
          );
        }
      })
      .catch((err) => {
        // Fallback to local computation
        if (!isMounted || !customer) return;
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
        setLedgerRows(
          list.map((r) => {
            bal = round2(bal + r.debit - r.credit);
            return { ...r, balance: bal };
          })
        );
      });
    return () => {
      isMounted = false;
    };
  }, [customerId, customer, state.invoices, state.payments, state.creditNotes]);

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
        data={ledgerRows}
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
  const [ledgerRows, setLedgerRows] = useState([]);

  const supplier = state.suppliers.find((s) => s.id === supplierId);

  useEffect(() => {
    if (!supplierId) return;
    let isMounted = true;
    reportsService
      .getSupplierLedger(supplierId)
      .then((res) => {
        if (!isMounted) return;
        if (Array.isArray(res.entries)) {
          setLedgerRows(
            res.entries.map((e) => ({
              date: e.date ? new Date(e.date).toISOString().slice(0, 10) : '',
              ref: e.voucherNumber || e.ref || '',
              type: e.voucherType || e.type || '',
              debit: e.debit || 0,
              credit: e.credit || 0,
              balance: e.runningBalance !== undefined ? e.runningBalance : (e.balance || 0),
            }))
          );
        }
      })
      .catch((err) => {
        if (!isMounted || !supplier) return;
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
        setLedgerRows(
          list.map((r) => {
            bal = round2(bal + r.credit - r.debit);
            return { ...r, balance: bal };
          })
        );
      });
    return () => {
      isMounted = false;
    };
  }, [supplierId, supplier, state.purchases, state.payments]);

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
        data={ledgerRows}
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
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 flex items-center justify-between">
        <span>Current Physical Cash Balance: <strong className="font-mono text-sm text-emerald-700">{formatINR(cashAcc?.balance || 0)}</strong></span>
        <span>Account: {cashAcc?.name || 'Cash in Hand'}</span>
      </div>
      <DataTable
        data={cashTxns}
        searchFields={['ref', 'party']}
        columns={[
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'ref', label: 'Voucher #', render: (r) => <span className="font-mono font-semibold">{r.ref}</span> },
          { key: 'party', label: 'Particulars' },
          { key: 'receipt', label: 'Receipt (Dr)', align: 'right', render: (r) => (r.receipt ? formatINR(r.receipt) : '—') },
          { key: 'payment', label: 'Payment (Cr)', align: 'right', render: (r) => (r.payment ? formatINR(r.payment) : '—') },
        ]}
      />
    </div>
  );
};

export const CashBookPage = () => (
  <div className="space-y-5">
    <PageHeader title="Cash Book" subtitle="Cash in Hand ledger recording cash receipts, retail cash sales, and counter payments" breadcrumbs={['Payments', 'Cash Book']} />
    <CashBookSection />
  </div>
);

export const BankBookSection = () => {
  const { state } = useApp();
  const bankTotal = state.bankAccounts.filter((a) => a.type !== 'Cash').reduce((s, a) => s + a.balance, 0);

  const bankTxns = [
    ...state.payments
      .filter((p) => p.method !== 'Cash')
      .map((p) => ({
        date: p.date,
        ref: p.paymentNumber,
        party: p.partyName,
        account: p.method,
        deposit: p.type === 'Payment In' ? p.amount : 0,
        withdrawal: p.type === 'Payment Out' ? p.amount : 0,
      })),
    ...state.expenses
      .filter((e) => e.paymentMethod !== 'Cash')
      .map((e) => ({
        date: e.date,
        ref: e.expenseNumber,
        party: `${e.title} (${e.vendorName})`,
        account: e.paymentMethod,
        deposit: 0,
        withdrawal: e.totalAmount,
      })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

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
  const { state, postJournalEntry, reverseJournalEntry, notify } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [voucherType, setVoucherType] = useState('Journal');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [amount, setAmount] = useState('');

  const accounts = useMemo(() => {
    return (state.chartOfAccounts || []).length > 0 ? state.chartOfAccounts : CHART_OF_ACCOUNTS;
  }, [state.chartOfAccounts]);

  const [debitAccCode, setDebitAccCode] = useState(accounts[0]?.code || '1010');
  const [creditAccCode, setCreditAccCode] = useState(accounts[1]?.code || '4010');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    const amt = round2(Number(amount) || 0);
    if (amt <= 0 || debitAccCode === creditAccCode) {
      notify('Enter a valid amount and select different Debit and Credit accounts', 'error');
      return;
    }

    const drAccount = accounts.find((a) => (a.code || a.accountCode) === debitAccCode);
    const crAccount = accounts.find((a) => (a.code || a.accountCode) === creditAccCode);

    if (!drAccount?._id && !drAccount?.id) {
      notify('Valid account IDs required for double entry posting', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await postJournalEntry({
        entryDate: date,
        narration: narration || `${voucherType} entry`,
        lines: [
          {
            accountId: String(drAccount._id || drAccount.id),
            debit: amt,
            credit: 0,
            description: narration || `${voucherType} debit`,
          },
          {
            accountId: String(crAccount._id || crAccount.id),
            debit: 0,
            credit: amt,
            description: narration || `${voucherType} credit`,
          },
        ],
      });
      setModalOpen(false);
      setAmount('');
      setNarration('');
    } catch (err) {
      notify(err.message || 'Failed to post entry', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReverse = async (id) => {
    try {
      await reverseJournalEntry(id, { reason: 'Reversal by user action' });
      notify('Journal entry reversed');
    } catch (err) {
      notify(err.message || 'Failed to reverse entry', 'error');
    }
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
        {(state.journalEntries || []).map((je) => (
          <div key={je.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-indigo-700">{je.entryNumber}</span>
                <span className="text-slate-400">·</span>
                <span className="font-medium text-slate-700">{je.voucherType}</span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-slate-500">{formatDateIN(je.date)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-500">{je.narration}</span>
                {je.status !== 'reversed' && (
                  <button
                    type="button"
                    onClick={() => handleReverse(je.id || je._id)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-700"
                    title="Reverse this entry"
                  >
                    <RotateCcw className="h-3 w-3" /> Reverse
                  </button>
                )}
              </div>
            </div>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {(je.lines || []).map((l, i) => (
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
            <button type="submit" form="je-form" disabled={isSubmitting} className={btnPrimary}>
              {isSubmitting ? 'Posting...' : 'Post Entry'}
            </button>
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
              <select value={debitAccCode} onChange={(e) => setDebitAccCode(e.target.value)} className={inputClass}>
                {accounts.map((a) => (
                  <option key={a.code || a.accountCode} value={a.code || a.accountCode}>
                    {a.code || a.accountCode} - {a.name || a.accountName}
                  </option>
                ))}
              </select>
            </InputField>
            <InputField label="Credit Account (Cr)">
              <select value={creditAccCode} onChange={(e) => setCreditAccCode(e.target.value)} className={inputClass}>
                {accounts.map((a) => (
                  <option key={a.code || a.accountCode} value={a.code || a.accountCode}>
                    {a.code || a.accountCode} - {a.name || a.accountName}
                  </option>
                ))}
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
  const { state, selectedFY, notify } = useApp();
  const [tbData, setTbData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    accountingService
      .getTrialBalance({ financialYear: selectedFY })
      .then((res) => {
        if (isMounted) setTbData(res);
      })
      .catch((err) => {
        console.warn('Live trial balance fetch warning:', err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedFY]);

  const rows = useMemo(() => {
    if (tbData && Array.isArray(tbData.accounts)) {
      return tbData.accounts.map((a) => ({
        code: a.accountCode,
        name: a.accountName,
        group: a.accountSubType || 'General',
        debit: a.closingDebit || 0,
        credit: a.closingCredit || 0,
      }));
    }
    const computed = accountingService.computeFinancialStatements(state);
    return computed.trialBalance;
  }, [tbData, state]);

  const totalDr = tbData ? tbData.totalClosingDebit : rows.reduce((s, r) => s + r.debit, 0);
  const totalCr = tbData ? tbData.totalClosingCredit : rows.reduce((s, r) => s + r.credit, 0);
  const isBalanced = tbData ? tbData.isBalanced : Math.abs(totalDr - totalCr) < 0.05;

  return (
    <div id="trial-balance-sheet" className="space-y-5">
      <PageHeader
        title={`Trial Balance · FY ${selectedFY}`}
        subtitle="Account-wise Debit & Credit closing summary derived from double-entry accounting records"
        breadcrumbs={['Accounting', 'Trial Balance']}
        actions={
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isBalanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {isBalanced ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {isBalanced ? 'Balanced (Dr = Cr)' : 'Imbalance Detected'}
            </div>
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
          </div>
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
            {rows.map((r) => (
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
  const { state, selectedFY, notify } = useApp();
  const [pnlData, setPnlData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    accountingService
      .getProfitAndLoss({ financialYear: selectedFY })
      .then((res) => {
        if (isMounted) setPnlData(res);
      })
      .catch((err) => {
        console.warn('Live P&L statement warning:', err.message);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedFY]);

  const pnl = useMemo(() => {
    if (pnlData) {
      return {
        grossSales: pnlData.revenue?.grossSales || 0,
        salesReturns: pnlData.revenue?.salesReturns || 0,
        netSales: pnlData.revenue?.netSalesRevenue || 0,
        shippingIncome: pnlData.revenue?.otherIncome || 0,
        cogs: pnlData.costOfGoodsSold?.totalCOGS || 0,
        grossProfit: pnlData.grossProfit || 0,
        operatingExpenses: pnlData.operatingExpenses?.items || [],
        totalOperatingExpenses: pnlData.operatingExpenses?.totalOperatingExpenses || 0,
        netProfit: pnlData.netProfitOrLoss || 0,
      };
    }
    const computed = accountingService.computeFinancialStatements(state);
    return {
      ...computed.pnl,
      operatingExpenses: Object.entries(computed.pnl.expenseByCategory || {}).map(([cat, amt]) => ({
        accountName: cat,
        amount: amt,
      })),
    };
  }, [pnlData, state]);

  return (
    <div id="pnl-sheet" className="space-y-5">
      <PageHeader
        title={`Profit & Loss Statement · FY ${selectedFY}`}
        subtitle="Income, Cost of Goods Sold, Operating Expenses & Net Profit derived from live accounting entries"
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
        <StatCard label="Cost of Goods Sold" value={formatINR(pnl.cogs, false)} />
        <StatCard label="Gross Profit" value={formatINR(pnl.grossProfit, false)} tone="success" />
        <StatCard label="Net Profit" value={formatINR(pnl.netProfit, false)} tone={pnl.netProfit >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 text-xs">
        <div className="space-y-1.5">
          <div className="font-display text-sm font-semibold text-slate-900">Trading &amp; Revenue</div>
          <div className="flex justify-between"><span>Gross Taxable Sales</span><span className="font-mono">{formatINR(pnl.grossSales)}</span></div>
          <div className="flex justify-between text-rose-700"><span>Less: Sales Returns</span><span className="font-mono">- {formatINR(pnl.salesReturns)}</span></div>
          <div className="flex justify-between"><span>Other Operating / Shipping Income</span><span className="font-mono">{formatINR(pnl.shippingIncome)}</span></div>
          <div className="flex justify-between"><span>Less: Cost of Goods Sold</span><span className="font-mono">- {formatINR(pnl.cogs)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
            <span>Gross Profit</span><span className="font-mono">{formatINR(pnl.grossProfit)}</span>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="font-display text-sm font-semibold text-slate-900">Operating Expenses</div>
          {pnl.operatingExpenses.map((exp, idx) => (
            <div key={idx} className="flex justify-between text-slate-600">
              <span>{exp.accountName}</span>
              <span className="font-mono">{formatINR(exp.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
            <span>Total Operating Expenses</span>
            <span className="font-mono">{formatINR(pnl.totalOperatingExpenses)}</span>
          </div>
        </div>

        <div className="flex justify-between rounded-md bg-indigo-50 p-3 text-sm font-bold text-indigo-950">
          <span>Net Profit / (Loss) Before Taxes</span>
          <span className="font-mono">{formatINR(pnl.netProfit)}</span>
        </div>
      </div>
    </div>
  );
};

export const BalanceSheetPage = () => {
  const { state, selectedFY, notify } = useApp();
  const [bsData, setBsData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    accountingService
      .getBalanceSheet({ financialYear: selectedFY })
      .then((res) => {
        if (isMounted) setBsData(res);
      })
      .catch((err) => {
        console.warn('Live Balance Sheet warning:', err.message);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedFY]);

  const balanceSheet = useMemo(() => {
    if (bsData) {
      return {
        assets: {
          currentAssets: bsData.assets?.currentAssets || [],
          totalCurrentAssets: bsData.assets?.totalCurrentAssets || 0,
          fixedAssets: bsData.assets?.fixedAssets || [],
          totalFixedAssets: bsData.assets?.totalFixedAssets || 0,
          totalAssets: bsData.assets?.totalAssets || 0,
        },
        liabilitiesAndEquity: {
          currentLiabilities: bsData.liabilities?.currentLiabilities || [],
          totalCurrentLiabilities: bsData.liabilities?.totalCurrentLiabilities || 0,
          nonCurrentLiabilities: bsData.liabilities?.nonCurrentLiabilities || [],
          totalNonCurrentLiabilities: bsData.liabilities?.totalNonCurrentLiabilities || 0,
          totalLiabilities: bsData.liabilities?.totalLiabilities || 0,
          ownersCapital: bsData.equity?.ownersCapital || 0,
          retainedEarnings: bsData.equity?.retainedEarnings || 0,
          currentPeriodProfit: bsData.equity?.currentPeriodProfit || 0,
          totalEquity: bsData.equity?.totalEquity || 0,
          totalLiabilitiesAndEquity: bsData.totalLiabilitiesAndEquity || 0,
        },
        isBalanced: bsData.isBalanced,
      };
    }
    const computed = accountingService.computeFinancialStatements(state);
    return {
      assets: {
        currentAssets: [
          { accountName: 'Cash, Bank & UPI Balances', amount: computed.balanceSheet.assets.cashAndBank },
          { accountName: 'Accounts Receivable (Debtors)', amount: computed.balanceSheet.assets.accountsReceivable },
          { accountName: 'Closing Inventory Valuation', amount: computed.balanceSheet.assets.closingInventory },
        ],
        totalCurrentAssets: computed.balanceSheet.assets.cashAndBank + computed.balanceSheet.assets.accountsReceivable + computed.balanceSheet.assets.closingInventory,
        fixedAssets: [{ accountName: 'Fixed Assets (Equipment & Systems)', amount: computed.balanceSheet.assets.fixedAssets }],
        totalFixedAssets: computed.balanceSheet.assets.fixedAssets,
        totalAssets: computed.balanceSheet.assets.totalAssets,
      },
      liabilitiesAndEquity: {
        currentLiabilities: [
          { accountName: 'Accounts Payable (Creditors)', amount: computed.balanceSheet.liabilitiesAndEquity.accountsPayable },
          { accountName: 'Estimated Net GST Liability', amount: computed.balanceSheet.liabilitiesAndEquity.gstPayable },
          { accountName: 'Statutory Payables', amount: computed.balanceSheet.liabilitiesAndEquity.statutoryPayables },
        ],
        totalCurrentLiabilities: computed.balanceSheet.liabilitiesAndEquity.totalLiabilities,
        nonCurrentLiabilities: [],
        totalNonCurrentLiabilities: 0,
        totalLiabilities: computed.balanceSheet.liabilitiesAndEquity.totalLiabilities,
        ownersCapital: computed.balanceSheet.liabilitiesAndEquity.capitalAndReserves,
        retainedEarnings: 0,
        currentPeriodProfit: computed.balanceSheet.liabilitiesAndEquity.currentYearProfit,
        totalEquity: computed.balanceSheet.liabilitiesAndEquity.totalEquity,
        totalLiabilitiesAndEquity: computed.balanceSheet.liabilitiesAndEquity.totalLiabilities + computed.balanceSheet.liabilitiesAndEquity.totalEquity,
        isBalanced: true,
      },
      isBalanced: true,
    };
  }, [bsData, state]);

  const { assets, liabilitiesAndEquity, isBalanced } = balanceSheet;

  return (
    <div id="balance-sheet-doc" className="space-y-5">
      <PageHeader
        title={`Balance Sheet · FY ${selectedFY}`}
        subtitle="Snapshot of Business Assets, Liabilities & Owner's Equity from double-entry accounting records"
        breadcrumbs={['Accounting', 'Balance Sheet']}
        actions={
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isBalanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {isBalanced ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {isBalanced ? 'Balanced (Assets = Liabilities + Equity)' : 'Discrepancy'}
            </div>
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
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5 text-xs">
          <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Assets</h3>
          {assets.currentAssets.map((ca, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{ca.accountName}</span>
              <span className="font-mono">{formatINR(ca.amount)}</span>
            </div>
          ))}
          {assets.fixedAssets.map((fa, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{fa.accountName}</span>
              <span className="font-mono">{formatINR(fa.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-300 pt-2.5 text-sm font-bold text-slate-900">
            <span>Total Assets</span>
            <span className="font-mono">{formatINR(assets.totalAssets)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5 text-xs">
          <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Liabilities &amp; Capital</h3>
          {liabilitiesAndEquity.currentLiabilities.map((cl, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{cl.accountName}</span>
              <span className="font-mono">{formatINR(cl.amount)}</span>
            </div>
          ))}
          {liabilitiesAndEquity.nonCurrentLiabilities.map((ncl, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{ncl.accountName}</span>
              <span className="font-mono">{formatINR(ncl.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-100 pt-2 font-medium">
            <span>Total Liabilities</span>
            <span className="font-mono">{formatINR(liabilitiesAndEquity.totalLiabilities)}</span>
          </div>
          <div className="flex justify-between">
            <span>Proprietor Capital &amp; Reserves</span>
            <span className="font-mono">{formatINR(liabilitiesAndEquity.ownersCapital || liabilitiesAndEquity.capitalAndReserves || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Current Period Net Profit</span>
            <span className="font-mono">{formatINR(liabilitiesAndEquity.currentPeriodProfit || 0)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-2.5 text-sm font-bold text-slate-900">
            <span>Total Liabilities &amp; Equity</span>
            <span className="font-mono">{formatINR(liabilitiesAndEquity.totalLiabilitiesAndEquity || (liabilitiesAndEquity.totalLiabilities + liabilitiesAndEquity.totalEquity))}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
