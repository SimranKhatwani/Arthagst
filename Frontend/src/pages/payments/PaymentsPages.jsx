import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CheckCircle2, RotateCcw, Landmark } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PAYMENT_METHODS } from '../../data/constants';
import { formatINR, formatDateIN } from '../../services/calculationService';
import { CashBookSection, BankBookSection } from '../accounting/AccountingPages';
import {
  PageHeader,
  DataTable,
  StatusLabel,
  StatCard,
  SegmentedTabs,
  InputField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

const PaymentInSection = () => {
  const { state, recordPayment, notify } = useApp();
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('UPI');
  const [refNo, setRefNo] = useState(`UPI${Date.now().toString().slice(-6)}`);

  const pendingInvoices = useMemo(() => {
    return (state.invoices || []).filter(
      (i) =>
        i.status === 'Finalized' &&
        i.paymentStatus !== 'Paid' &&
        (!customerId || i.customerId === customerId)
    );
  }, [state.invoices, customerId]);

  const selectedInvoice = pendingInvoices.find((i) => i.id === invoiceId) || pendingInvoices[0];

  const handleInvoicePick = (id) => {
    setInvoiceId(id);
    const inv = state.invoices.find((i) => i.id === id);
    if (inv) {
      setCustomerId(inv.customerId);
      setAmount(String(Math.max(0, (inv.grandTotal || 0) - (inv.amountPaid || 0))));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedInvoice) {
      notify('Select an unpaid or partially paid invoice', 'error');
      return;
    }
    const maxBal = Math.max(0, (selectedInvoice.grandTotal || 0) - (selectedInvoice.amountPaid || 0));
    const payAmt = Number(amount || maxBal);
    if (payAmt > maxBal) {
      notify(`Amount exceeds remaining invoice balance of ${formatINR(maxBal)}`, 'error');
      return;
    }
    const ok = recordPayment({
      type: 'Payment In',
      date,
      partyId: selectedInvoice.customerId,
      partyName: selectedInvoice.customerName,
      invoiceId: selectedInvoice.id,
      invoiceNumber: selectedInvoice.invoiceNumber,
      amount: payAmt,
      method,
      referenceNo: refNo,
      notes: `Receipt for ${selectedInvoice.invoiceNumber}`,
    });
    if (ok) {
      setAmount('');
      setRefNo(`UPI${Date.now().toString().slice(-6)}`);
    }
  };

  const recentIn = state.payments.filter((p) => p.type === 'Payment In');

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InputField label="Filter by Customer">
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setInvoiceId('');
              }}
              className={inputClass}
            >
              <option value="">All Customers with Pending Invoices</option>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </InputField>
          <InputField label="Select Pending Invoice" required>
            <select
              value={selectedInvoice?.id || ''}
              onChange={(e) => handleInvoicePick(e.target.value)}
              className={inputClass}
            >
              {pendingInvoices.length === 0 ? (
                <option value="">No pending invoices</option>
              ) : (
                pendingInvoices.map((inv) => {
                  const bal = Math.max(0, inv.grandTotal - inv.amountPaid);
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.customerName} (Bal: {formatINR(bal)})
                    </option>
                  );
                })
              )}
            </select>
          </InputField>
          <InputField label="Amount Received (₹)" required>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              placeholder={
                selectedInvoice
                  ? String(Math.max(0, selectedInvoice.grandTotal - selectedInvoice.amountPaid))
                  : '0.00'
              }
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </InputField>
          <InputField label="Payment Date" required>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </InputField>
          <InputField label="Payment Method">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
              {PAYMENT_METHODS.filter((m) => m !== 'Credit').map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </InputField>
          <InputField label="UTR / Reference Number">
            <input type="text" value={refNo} onChange={(e) => setRefNo(e.target.value)} className={`${inputClass} font-mono`} />
          </InputField>
        </div>
        {selectedInvoice && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
            <span>
              Invoice Total: <strong className="font-mono text-slate-900">{formatINR(selectedInvoice.grandTotal)}</strong> ·
              Already Paid: <strong className="font-mono text-emerald-700">{formatINR(selectedInvoice.amountPaid)}</strong> ·
              Balance Due: <strong className="font-mono text-amber-700">{formatINR(selectedInvoice.grandTotal - selectedInvoice.amountPaid)}</strong>
            </span>
            <button type="submit" className={btnPrimary}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Record Receipt
            </button>
          </div>
        )}
      </form>

      <DataTable
        data={recentIn}
        searchFields={['paymentNumber', 'partyName', 'invoiceNumber', 'referenceNo']}
        columns={[
          { key: 'paymentNumber', label: 'Receipt #', render: (r) => <span className="font-mono font-semibold text-indigo-700">{r.paymentNumber}</span> },
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'partyName', label: 'Customer' },
          { key: 'invoiceNumber', label: 'Invoice Ref', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
          { key: 'method', label: 'Method' },
          { key: 'referenceNo', label: 'Reference', render: (r) => <span className="font-mono text-xs">{r.referenceNo}</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold text-emerald-700">{formatINR(r.amount)}</span> },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
        ]}
      />
    </div>
  );
};

const PaymentOutSection = () => {
  const { state, recordPayment, notify } = useApp();
  const [purchaseId, setPurchaseId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('NEFT');
  const [refNo, setRefNo] = useState(`NEFT${Date.now().toString().slice(-6)}`);

  const pendingBills = useMemo(
    () => (state.purchases || []).filter((p) => p.paymentStatus !== 'Paid'),
    [state.purchases]
  );
  const selectedPur = pendingBills.find((p) => p.id === purchaseId) || pendingBills[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedPur) {
      notify('No unpaid supplier bills pending', 'error');
      return;
    }
    const maxBal = Math.max(0, (selectedPur.grandTotal || 0) - (selectedPur.amountPaid || 0));
    const payAmt = Number(amount || maxBal);
    if (payAmt > maxBal) {
      notify(`Amount exceeds payable balance of ${formatINR(maxBal)}`, 'error');
      return;
    }
    const ok = recordPayment({
      type: 'Payment Out',
      date,
      partyId: selectedPur.supplierId,
      partyName: selectedPur.supplierName,
      invoiceId: selectedPur.id,
      invoiceNumber: selectedPur.billNumber,
      amount: payAmt,
      method,
      referenceNo: refNo,
      notes: `Settlement for ${selectedPur.supplierInvoiceNo}`,
    });
    if (ok) setAmount('');
  };

  const recentOut = state.payments.filter((p) => p.type === 'Payment Out');

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <InputField label="Select Pending Supplier Bill" required>
              <select
                value={selectedPur?.id || ''}
                onChange={(e) => {
                  setPurchaseId(e.target.value);
                  const b = pendingBills.find((x) => x.id === e.target.value);
                  if (b) setAmount(String(Math.max(0, b.grandTotal - b.amountPaid)));
                }}
                className={inputClass}
              >
                {pendingBills.length === 0 ? (
                  <option value="">All supplier bills are settled</option>
                ) : (
                  pendingBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.billNumber} — {b.supplierName} (Bal: {formatINR(b.grandTotal - b.amountPaid)})
                    </option>
                  ))
                )}
              </select>
            </InputField>
          </div>
          <InputField label="Amount Paid (₹)" required>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              placeholder={selectedPur ? String(selectedPur.grandTotal - selectedPur.amountPaid) : '0'}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </InputField>
          <InputField label="Payment Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </InputField>
          <InputField label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
              {PAYMENT_METHODS.filter((m) => m !== 'Credit').map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </InputField>
          <InputField label="UTR / Cheque Ref">
            <input type="text" value={refNo} onChange={(e) => setRefNo(e.target.value)} className={`${inputClass} font-mono`} />
          </InputField>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={!selectedPur} className={btnPrimary}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Record Payment Out
          </button>
        </div>
      </form>

      <DataTable
        data={recentOut}
        searchFields={['paymentNumber', 'partyName', 'invoiceNumber']}
        columns={[
          { key: 'paymentNumber', label: 'Payment #', render: (r) => <span className="font-mono font-semibold">{r.paymentNumber}</span> },
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'partyName', label: 'Supplier' },
          { key: 'invoiceNumber', label: 'Bill Ref', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
          { key: 'method', label: 'Method' },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold text-rose-700">{formatINR(r.amount)}</span> },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
        ]}
      />
    </div>
  );
};

const CashBankSection = ({ onOpenBook }) => {
  const { state, transferCashBank } = useApp();
  const [fromId, setFromId] = useState(state.bankAccounts[2]?.id || 'acc-3');
  const [toId, setToId] = useState(state.bankAccounts[0]?.id || 'acc-1');
  const [amount, setAmount] = useState('25000');
  const [notes, setNotes] = useState('Cash deposit to HDFC Current Account');

  const totalLiquid = state.bankAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);

  const handleTransfer = (e) => {
    e.preventDefault();
    transferCashBank({ fromId, toId, amount, notes });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs">
        <span className="text-slate-600">
          Combined Cash, Bank &amp; UPI Liquidity:{' '}
          <strong className="font-mono text-sm text-indigo-700">{formatINR(totalLiquid)}</strong>
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onOpenBook('cash-book')} className={btnSecondary}>
            Open Cash Book
          </button>
          <button type="button" onClick={() => onOpenBook('bank-book')} className={btnSecondary}>
            Open Bank Book
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {state.bankAccounts.map((acc) => (
          <div key={acc.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{acc.type} Account</span>
              <Landmark className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="font-display text-sm font-semibold text-slate-900">{acc.name}</div>
            <div className="font-mono text-xs text-slate-500">{acc.accountNo}</div>
            <div className="border-t border-slate-100 pt-2">
              <div className="text-[11px] text-slate-500">Closing Balance</div>
              <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {formatINR(acc.balance)}
              </div>
              <div className="text-[11px] text-slate-400">Opening: {formatINR(acc.openingBalance, false)}</div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleTransfer} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-5">
        <InputField label="From Account">
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputClass}>
            {state.bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </InputField>
        <InputField label="To Account">
          <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputClass}>
            {state.bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </InputField>
        <InputField label="Amount (₹)">
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} font-mono`} />
        </InputField>
        <InputField label="Narration">
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </InputField>
        <div className="flex items-end">
          <button type="submit" className={`${btnPrimary} w-full`}>
            <ArrowLeftRight className="h-3.5 w-3.5" /> Contra Transfer
          </button>
        </div>
      </form>
    </div>
  );
};

const AllTransactionsSection = () => {
  const { state, updateStateWithAudit, notify, confirmAction } = useApp();
  const [typeFilter, setTypeFilter] = useState('All');

  const filtered = state.payments.filter((p) => typeFilter === 'All' || p.type === typeFilter);
  const totalIn = state.payments.filter((p) => p.type === 'Payment In').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalOut = state.payments.filter((p) => p.type === 'Payment Out').reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const simulateRefund = async (pay) => {
    const ok = await confirmAction({
      title: `Simulate Refund for ${pay.paymentNumber}?`,
      message: `Mark ${formatINR(pay.amount)} as Refunded (Demo simulation)?`,
      confirmText: 'Simulate Refund',
      danger: true,
    });
    if (!ok) return;
    updateStateWithAudit(
      (prev) => ({
        ...prev,
        payments: prev.payments.map((p) => (p.id === pay.id ? { ...p, status: 'Refunded (Demo)' } : p)),
      }),
      { action: 'Simulated Refund', module: 'Payments', recordRef: pay.paymentNumber, prevValue: 'Completed', newValue: 'Refunded (Demo)' }
    );
    notify('Refund simulation recorded', 'info');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Receipts (Money In)" value={formatINR(totalIn, false)} tone="success" />
        <StatCard label="Total Disbursements (Money Out)" value={formatINR(totalOut, false)} tone="warning" />
        <StatCard label="Net Cash Flow" value={formatINR(totalIn - totalOut, false)} />
      </div>
      <SegmentedTabs activeTab={typeFilter} onChange={setTypeFilter} tabs={['All', 'Payment In', 'Payment Out']} />
      <DataTable
        data={filtered}
        searchFields={['paymentNumber', 'partyName', 'invoiceNumber', 'referenceNo', 'method']}
        columns={[
          { key: 'paymentNumber', label: 'Voucher #', render: (r) => <span className="font-mono font-semibold">{r.paymentNumber}</span> },
          { key: 'type', label: 'Type' },
          { key: 'date', label: 'Date', sortable: true, render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'partyName', label: 'Party' },
          { key: 'invoiceNumber', label: 'Invoice / Bill', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
          { key: 'method', label: 'Method' },
          { key: 'accountName', label: 'Account' },
          { key: 'amount', label: 'Amount', align: 'right', sortable: true, render: (r) => formatINR(r.amount) },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          {
            key: 'actions',
            label: 'Action',
            render: (r) =>
              r.status === 'Completed' ? (
                <button type="button" onClick={() => simulateRefund(r)} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-rose-600">
                  <RotateCcw className="h-3 w-3" /> Refund
                </button>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              ),
          },
        ]}
      />
    </div>
  );
};

const ReconciliationSection = () => {
  const { state, notify } = useApp();
  const [reconciledIds, setReconciledIds] = useState(() =>
    Object.fromEntries(state.payments.slice(0, 14).map((p) => [p.id, true]))
  );

  const bankTxns = state.payments.filter((p) => p.method !== 'Cash').slice(0, 20);
  const matchedCount = bankTxns.filter((t) => reconciledIds[t.id]).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs">
        <span className="text-slate-600">Match recorded bank/UPI vouchers against imported statement entries (Demo)</span>
        <button
          type="button"
          onClick={() => {
            const all = Object.fromEntries(bankTxns.map((t) => [t.id, true]));
            setReconciledIds(all);
            notify('Auto-matched all UTR references against HDFC demo feed');
          }}
          className={btnPrimary}
        >
          Auto-Match by UTR
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Bank / UPI Entries" value={bankTxns.length} />
        <StatCard label="Matched Entries" value={matchedCount} tone="success" />
        <StatCard label="Unreconciled Entries" value={bankTxns.length - matchedCount} tone="warning" />
      </div>

      <DataTable
        data={bankTxns}
        columns={[
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'paymentNumber', label: 'Book Voucher', render: (r) => <span className="font-mono">{r.paymentNumber}</span> },
          { key: 'partyName', label: 'Party' },
          { key: 'referenceNo', label: 'Bank UTR / Ref', render: (r) => <span className="font-mono text-xs">{r.referenceNo}</span> },
          { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatINR(r.amount) },
          {
            key: 'status',
            label: 'Recon Status',
            render: (r) => <StatusLabel status={reconciledIds[r.id] ? 'Matched' : 'Pending'} />,
          },
          {
            key: 'toggle',
            label: 'Verify',
            render: (r) => (
              <button
                type="button"
                onClick={() => setReconciledIds((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                className={btnSecondary}
              >
                {reconciledIds[r.id] ? 'Unmatch' : 'Mark Matched'}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
};

const PAYMENT_TAB_META = {
  all: {
    title: 'Payments — All Transactions',
    subtitle: 'Unified register of customer receipts, supplier disbursements, and cash/bank books',
    crumb: 'All Transactions',
    path: '/payments',
  },
  in: {
    title: 'Payments — Money In (Receipts)',
    subtitle: 'Record full or partial invoice settlements and update customer balances automatically',
    crumb: 'Money In',
    path: '/payments/in',
  },
  out: {
    title: 'Payments — Money Out (Disbursements)',
    subtitle: 'Settle vendor purchase bills and track bank outflows',
    crumb: 'Money Out',
    path: '/payments/out',
  },
  'cash-bank': {
    title: 'Payments — Cash, Bank & UPI Accounts',
    subtitle: 'Manage liquid cash counters, bank balances, contra transfers, and Cash/Bank books',
    crumb: 'Cash & Bank',
    path: '/payments/cash-bank',
  },
  'cash-book': {
    title: 'Payments — Cash Book',
    subtitle: 'Petty cash receipts and expense disbursements register',
    crumb: 'Cash Book',
    path: '/payments/cash-book',
  },
  'bank-book': {
    title: 'Payments — Bank & UPI Book',
    subtitle: 'All bank transfers, NEFT/RTGS, IMPS, cheque, and UPI settlements',
    crumb: 'Bank Book',
    path: '/payments/bank-book',
  },
  reconciliation: {
    title: 'Payments — Bank Reconciliation',
    subtitle: 'Verify and reconcile book entries against bank statement UTR references',
    crumb: 'Bank Reconciliation',
    path: '/payments/reconciliation',
  },
};

export const PaymentsWorkspacePage = ({ defaultTab = 'all' }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(defaultTab);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const meta = PAYMENT_TAB_META[tab] || PAYMENT_TAB_META.all;

  const switchTab = (next) => {
    setTab(next);
    const target = PAYMENT_TAB_META[next]?.path || '/payments';
    navigate(target);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        breadcrumbs={['Payments', meta.crumb]}
        actions={
          <>
            {tab !== 'in' && (
              <button type="button" onClick={() => switchTab('in')} className={btnSecondary}>
                + Money In
              </button>
            )}
            {tab !== 'out' && (
              <button type="button" onClick={() => switchTab('out')} className={btnSecondary}>
                + Money Out
              </button>
            )}
          </>
        }
      />

      <SegmentedTabs
        activeTab={tab}
        onChange={switchTab}
        tabs={[
          { id: 'all', label: 'All Transactions' },
          { id: 'in', label: 'Money In' },
          { id: 'out', label: 'Money Out' },
          { id: 'cash-bank', label: 'Cash & Bank' },
          { id: 'cash-book', label: 'Cash Book' },
          { id: 'bank-book', label: 'Bank Book' },
          { id: 'reconciliation', label: 'Bank Reconciliation' },
        ]}
      />

      {tab === 'all' && <AllTransactionsSection />}
      {tab === 'in' && <PaymentInSection />}
      {tab === 'out' && <PaymentOutSection />}
      {tab === 'cash-bank' && <CashBankSection onOpenBook={switchTab} />}
      {tab === 'cash-book' && <CashBookSection />}
      {tab === 'bank-book' && <BankBookSection />}
      {tab === 'reconciliation' && <ReconciliationSection />}
    </div>
  );
};

export const PaymentHistoryPage = () => <PaymentsWorkspacePage defaultTab="all" />;
export const PaymentInPage = () => <PaymentsWorkspacePage defaultTab="in" />;
export const PaymentOutPage = () => <PaymentsWorkspacePage defaultTab="out" />;
export const CashBankPage = () => <PaymentsWorkspacePage defaultTab="cash-bank" />;
export const ReconciliationPage = () => <PaymentsWorkspacePage defaultTab="reconciliation" />;
