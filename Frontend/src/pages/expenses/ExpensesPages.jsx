import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit3, Trash2, Eye, Repeat } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useApp } from '../../context/AppContext';
import { EXPENSE_CATEGORIES, GST_RATES } from '../../data/constants';
import { formatINR, formatDateIN, round2 } from '../../services/calculationService';
import { generateNextDocNumber } from '../../services/invoiceService';
import { exportToCSV } from '../../services/storageService';
import {
  PageHeader,
  DataTable,
  StatusLabel,
  StatCard,
  Modal,
  InputField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

export const ExpensesPage = () => {
  const { state, upsertRecord, deleteRecord, confirmAction, notify } = useApp();
  const [catFilter, setCatFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [previewExp, setPreviewExp] = useState(null);
  const [editing, setEditing] = useState(null);

  const emptyExp = {
    title: '',
    category: EXPENSE_CATEGORIES[0].name,
    date: new Date().toISOString().slice(0, 10),
    vendorName: '',
    vendorGstin: '',
    amount: 0,
    gstRate: 18,
    paymentMethod: 'UPI',
    recurring: false,
    itcEligible: true,
    notes: '',
  };
  const [form, setForm] = useState(emptyExp);

  const filtered = useMemo(
    () => state.expenses.filter((e) => e.status !== 'Archived' && (catFilter === 'All' || e.category === catFilter)),
    [state.expenses, catFilter]
  );

  const totalExpenseVal = filtered.reduce((s, e) => s + (Number(e.totalAmount) || 0), 0);
  const totalGstItc = filtered.filter((e) => e.itcEligible).reduce((s, e) => s + (Number(e.cgst) || 0) + (Number(e.sgst) || 0) + (Number(e.igst) || 0), 0);

  const monthlyData = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const m = (e.date || '').slice(0, 7);
      map.set(m, round2((map.get(m) || 0) + (Number(e.totalAmount) || 0)));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount }));
  }, [filtered]);

  const openModal = (exp = null) => {
    setEditing(exp);
    setForm(exp ? { ...exp } : emptyExp);
    setModalOpen(true);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.title.trim() || !form.amount) {
      notify('Expense title and base amount are required', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const base = round2(Number(form.amount) || 0);
      const gstAmt = round2((base * (Number(form.gstRate) || 0)) / 100);
      const cgst = round2(gstAmt / 2);
      const sgst = round2(gstAmt - cgst);

      await upsertRecord(
        'expenses',
        {
          ...form,
          ...(editing ? { _id: editing._id || editing.id, id: editing.id || editing._id } : {}),
          amount: base,
          gstRate: Number(form.gstRate) || 0,
          cgst,
          sgst,
          igst: 0,
          totalAmount: round2(base + gstAmt),
          bankAccountId: state.bankAccounts?.[0]?.id || state.bankAccounts?.[0]?._id,
          status: 'Paid',
        },
        'Expense',
        'expenseNumber'
      );
      setModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Business Expenses"
        subtitle="Record operating expenses, recurring bills, and eligible GST Input Tax Credit"
        breadcrumbs={['Expenses', 'All Expenses']}
        actions={
          <>
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  'expenses-register.csv',
                  ['Voucher', 'Date', 'Title', 'Category', 'Vendor', 'Base Amount', 'GST', 'Total'],
                  filtered.map((e) => [e.expenseNumber, e.date, e.title, e.category, e.vendorName, e.amount, e.cgst + e.sgst + e.igst, e.totalAmount])
                )
              }
              className={btnSecondary}
            >
              Export CSV
            </button>
            <button type="button" onClick={() => openModal()} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" /> Add Expense
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Expenses" value={formatINR(totalExpenseVal, false)} />
        <StatCard label="Eligible Expense GST ITC" value={formatINR(totalGstItc, false)} tone="success" />
        <StatCard label="Recurring Expenses" value={filtered.filter((e) => e.recurring).length} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Monthly Expense Trend</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(val) => formatINR(val)} />
              <Bar dataKey="amount" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DataTable
        data={filtered}
        searchFields={['expenseNumber', 'title', 'vendorName', 'category']}
        filters={
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
            <option value="All">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        }
        columns={[
          { key: 'expenseNumber', label: 'Voucher #', render: (r) => <span className="font-mono font-semibold">{r.expenseNumber}</span> },
          { key: 'date', label: 'Date', sortable: true, render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          {
            key: 'title',
            label: 'Description',
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-900">{r.title}</span>
                {r.recurring && <Repeat className="h-3 w-3 text-indigo-600" title="Recurring Expense" />}
              </div>
            ),
          },
          { key: 'category', label: 'Category' },
          { key: 'vendorName', label: 'Vendor' },
          { key: 'amount', label: 'Base', align: 'right', render: (r) => formatINR(r.amount) },
          { key: 'gst', label: 'GST', align: 'right', render: (r) => formatINR((r.cgst || 0) + (r.sgst || 0) + (r.igst || 0)) },
          { key: 'totalAmount', label: 'Total', align: 'right', sortable: true, render: (r) => <span className="font-semibold">{formatINR(r.totalAmount)}</span> },
          {
            key: 'actions',
            label: 'Actions',
            nowrap: true,
            render: (r) => (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPreviewExp(r)} title="Attachment Preview" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Eye className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => openModal(r)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5" /></button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmAction({ title: `Delete ${r.expenseNumber}?`, message: 'Remove this expense record?', confirmText: 'Delete', danger: true })) {
                      deleteRecord('expenses', r.id, 'Expense', r.expenseNumber);
                    }
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Expense — ${editing.expenseNumber}` : 'Add New Expense'}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="exp-form" className={btnPrimary}>Save Expense</button>
          </>
        }
      >
        <form id="exp-form" onSubmit={handleSave} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <InputField label="Expense Title / Particulars" required>
              <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
            </InputField>
          </div>
          <InputField label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </InputField>
          <InputField label="Expense Date" required>
            <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} />
          </InputField>
          <InputField label="Vendor Name">
            <input type="text" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} className={inputClass} />
          </InputField>
          <InputField label="Vendor GSTIN (Optional)">
            <input type="text" value={form.vendorGstin} onChange={(e) => setForm({ ...form, vendorGstin: e.target.value })} className={`${inputClass} font-mono`} />
          </InputField>
          <InputField label="Base Amount (Excl. GST)" required>
            <input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${inputClass} font-mono`} />
          </InputField>
          <InputField label="GST Rate (%)">
            <select value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })} className={inputClass}>
              {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
            </select>
          </InputField>
          <InputField label="Payment Method">
            <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className={inputClass}>
              {['UPI', 'NEFT', 'Cash', 'Card', 'Cheque'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </InputField>
          <div className="flex items-center gap-4 pt-5 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
              Recurring Monthly
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={form.itcEligible} onChange={(e) => setForm({ ...form, itcEligible: e.target.checked })} />
              ITC Eligible
            </label>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(previewExp)} onClose={() => setPreviewExp(null)} title={`Expense Receipt — ${previewExp?.expenseNumber}`}>
        {previewExp && (
          <div className="space-y-3 text-xs">
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center space-y-2">
              <div className="font-mono text-xs text-slate-500">SIMULATED VOUCHER ATTACHMENT</div>
              <div className="font-display text-base font-semibold text-slate-900">{previewExp.vendorName || 'Vendor Receipt'}</div>
              <div className="text-slate-600">{previewExp.title}</div>
              <div className="font-mono text-lg font-bold text-slate-900">{formatINR(previewExp.totalAmount)}</div>
              <div className="text-slate-500">Date: {formatDateIN(previewExp.date)} · Paid via {previewExp.paymentMethod}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export const AddExpensePage = () => {
  const { state, upsertRecord, notify } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    category: EXPENSE_CATEGORIES[0].name,
    date: new Date().toISOString().slice(0, 10),
    vendorName: '',
    vendorGstin: '',
    amount: '',
    gstRate: 18,
    paymentMethod: 'UPI',
    recurring: false,
    itcEligible: true,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!form.title.trim() || !form.amount) {
      notify('Title and amount are required', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const base = round2(Number(form.amount));
      const gst = round2((base * Number(form.gstRate)) / 100);
      await upsertRecord(
        'expenses',
        {
          ...form,
          amount: base,
          cgst: round2(gst / 2),
          sgst: round2(gst - round2(gst / 2)),
          igst: 0,
          totalAmount: round2(base + gst),
          bankAccountId: state.bankAccounts?.[0]?.id || state.bankAccounts?.[0]?._id,
          status: 'Paid',
        },
        'Expense',
        'expenseNumber'
      );
      navigate('/expenses');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Add Expense Voucher" subtitle="Record business expenditure with GST ITC breakup" breadcrumbs={['Expenses', 'Add Expense']} />
      <form onSubmit={handleSubmit} className="max-w-3xl rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><InputField label="Expense Particulars" required><input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="e.g. Godown Electricity Bill" /></InputField></div>
          <InputField label="Category"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>{EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></InputField>
          <InputField label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Vendor Name"><input type="text" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Vendor GSTIN"><input type="text" value={form.vendorGstin} onChange={(e) => setForm({ ...form, vendorGstin: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Base Amount (₹)" required><input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} /></InputField>
          <InputField label="GST Rate (%)"><select value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })} className={inputClass}>{GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}</select></InputField>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate('/expenses')} className={btnSecondary}>Cancel</button>
          <button type="submit" className={btnPrimary}>Save Expense</button>
        </div>
      </form>
    </div>
  );
};

export const ExpenseCategoriesPage = () => {
  const { state } = useApp();
  const rows = EXPENSE_CATEGORIES.map((cat) => {
    const matching = state.expenses.filter((e) => e.category === cat.name);
    const total = matching.reduce((s, e) => s + (Number(e.totalAmount) || 0), 0);
    return { ...cat, count: matching.length, total };
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Expense Categories" subtitle="Standard Indian accounting heads with SAC/HSN and default GST rates" breadcrumbs={['Expenses', 'Categories']} />
      <DataTable
        data={rows}
        searchFields={['name', 'hsn']}
        columns={[
          { key: 'name', label: 'Category Name', render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
          { key: 'hsn', label: 'SAC / HSN', render: (r) => <span className="font-mono text-xs">{r.hsn}</span> },
          { key: 'defaultGst', label: 'Default GST', align: 'right', render: (r) => `${r.defaultGst}%` },
          { key: 'description', label: 'Description' },
          { key: 'count', label: 'Vouchers', align: 'right' },
          { key: 'total', label: 'Total Spend', align: 'right', render: (r) => formatINR(r.total) },
        ]}
      />
    </div>
  );
};
