import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Edit3, Trash2, Eye, Download, ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { INDIAN_STATES, REGISTRATION_TYPES } from '../../data/constants';
import { validateGSTIN } from '../../utils/gstinValidator';
import {
  formatINR,
  formatDateIN,
  getCustomerOutstanding,
  getSupplierOutstanding,
} from '../../services/calculationService';
import { exportToCSV } from '../../services/storageService';
import {
  PageHeader,
  DataTable,
  StatusLabel,
  StatCard,
  SegmentedTabs,
  Modal,
  InputField,
  GSTINInput,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

const PartiesTabs = ({ active }) => {
  const { state } = useApp();
  const navigate = useNavigate();
  return (
    <SegmentedTabs
      activeTab={active}
      onChange={(next) => navigate(next === 'customers' ? '/parties/customers' : '/parties/suppliers')}
      tabs={[
        { id: 'customers', label: 'Customers', count: (state.customers || []).length },
        { id: 'suppliers', label: 'Suppliers', count: (state.suppliers || []).filter((s) => s.status !== 'Archived').length },
      ]}
    />
  );
};

export const CustomersPage = () => {
  const { state, upsertRecord, deleteRecord, confirmAction, notify } = useApp();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const emptyCust = {
    name: '',
    businessName: '',
    mobile: '',
    email: '',
    gstin: '',
    registrationType: 'Regular',
    billingAddress: '',
    shippingAddress: '',
    state: 'Rajasthan',
    openingBalance: 0,
    creditLimit: 200000,
    paymentTerms: 'Net 15',
    status: 'Active',
  };
  const [form, setForm] = useState(emptyCust);

  const enrichedCustomers = useMemo(() => {
    return (state.customers || []).map((c) => {
      const custInvoices = (state.invoices || []).filter(
        (i) => i.customerId === c.id && i.status !== 'Draft' && i.status !== 'Cancelled'
      );
      const totalSales = custInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
      const outstanding = getCustomerOutstanding(c, state.invoices, state.creditNotes);
      return { ...c, totalSales, outstanding };
    });
  }, [state.customers, state.invoices, state.creditNotes]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyCust);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ ...c });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const phoneVal = (form.mobile || form.phone || '').trim();
    if (!form.name.trim() || !phoneVal) {
      notify('Customer name and mobile number are required', 'error');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phoneVal)) {
      notify('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    if (form.gstin && form.gstin.trim()) {
      const gstinCheck = validateGSTIN(form.gstin);
      if (!gstinCheck.isValid) {
        notify(gstinCheck.error, 'error');
        return;
      }
    }
    try {
      await upsertRecord(
        'customers',
        {
          ...form,
          id: editing ? (editing.id || editing._id) : undefined,
          _id: editing ? (editing._id || editing.id) : undefined,
          partyType: 'customer',
          phone: form.mobile || form.phone,
          GSTIN: form.gstin || form.GSTIN || null,
          businessName: form.businessName || form.name,
          shippingAddress: form.shippingAddress || form.billingAddress,
          openingBalance: Number(form.openingBalance) || 0,
          creditLimit: Number(form.creditLimit) || 0,
        },
        'Customer',
        'name'
      );
      setModalOpen(false);
    } catch (err) {
      notify(err.message || 'Failed to save customer', 'error');
    }
  };

  const handleDelete = async (c) => {
    const ok = await confirmAction({
      title: `Remove Customer ${c.name}?`,
      message: 'Are you sure you want to delete this customer from the directory?',
      confirmText: 'Delete Customer',
      danger: true,
    });
    if (ok) {
      try {
        await deleteRecord('customers', c.id || c._id, 'Customer', c.name);
      } catch (err) {
        notify(err.message || 'Failed to delete customer', 'error');
      }
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parties — Customers"
        subtitle="Manage B2B GSTIN customers, walk-in consumers, credit limits, and receivables"
        breadcrumbs={['Parties', 'Customers']}
        actions={
          <>
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  'customers-directory.csv',
                  ['Name', 'Mobile', 'Email', 'GSTIN', 'State', 'Total Sales', 'Outstanding'],
                  enrichedCustomers.map((c) => [c.name, c.mobile, c.email, c.gstin || 'URP', c.state, c.totalSales, c.outstanding])
                )
              }
              className={btnSecondary}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button type="button" onClick={openAdd} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" /> Add Customer
            </button>
          </>
        }
      />

      <PartiesTabs active="customers" />

      <DataTable
        data={enrichedCustomers}
        searchFields={['name', 'mobile', 'gstin', 'state']}
        searchPlaceholder="Search customer name, mobile, GSTIN or state..."
        columns={[
          {
            key: 'name',
            label: 'Customer Name',
            sortable: true,
            render: (r) => (
              <button
                type="button"
                onClick={() => navigate(`/parties/customers/${r.id}`)}
                className="font-medium text-indigo-700 hover:underline text-left"
              >
                {r.name}
              </button>
            ),
          },
          { key: 'mobile', label: 'Mobile', render: (r) => <span className="font-mono text-xs">{r.mobile}</span> },
          { key: 'gstin', label: 'GSTIN', render: (r) => <span className="font-mono text-xs text-slate-600">{r.gstin || 'Unregistered'}</span> },
          { key: 'state', label: 'State', sortable: true },
          { key: 'totalSales', label: 'Total Sales', align: 'right', sortable: true, render: (r) => formatINR(r.totalSales) },
          {
            key: 'outstanding',
            label: 'Outstanding',
            align: 'right',
            sortable: true,
            render: (r) => (
              <span className={`font-semibold ${r.outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {formatINR(r.outstanding)}
              </span>
            ),
          },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          {
            key: 'actions',
            label: 'Actions',
            nowrap: true,
            render: (r) => (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => navigate(`/parties/customers/${r.id}`)} title="View Ledger & Details" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Eye className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => openEdit(r)} title="Edit" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => handleDelete(r)} title="Delete" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Customer — ${editing.name}` : 'Add Customer'}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="cust-form" className={btnPrimary}>Save Customer</button>
          </>
        }
      >
        <form id="cust-form" onSubmit={handleSave} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InputField label="Customer Name" required><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Business / Trade Name"><input type="text" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Mobile Number" required><input type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile number" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={inputClass} /></InputField>
          <InputField label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Registration Type">
            <select value={form.registrationType} onChange={(e) => setForm({ ...form, registrationType: e.target.value })} className={inputClass}>
              {REGISTRATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </InputField>
          <GSTINInput
            value={form.gstin}
            onChange={(e) => setForm({ ...form, gstin: e.target.value })}
            label="GSTIN (Optional for Unregistered)"
            onPanDerived={(pan) => {
              if (!form.pan) setForm((prev) => ({ ...prev, pan }));
            }}
          />
          <InputField label="State">
            <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputClass}>
              {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
            </select>
          </InputField>
          <InputField label="Payment Terms">
            <select value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} className={inputClass}>
              {['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </InputField>
          <InputField label="Opening Balance (₹)"><input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} className={`${inputClass} font-mono`} /></InputField>
          <InputField label="Credit Limit (₹)"><input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} className={`${inputClass} font-mono`} /></InputField>
          <div className="sm:col-span-2">
            <InputField label="Billing Address"><input type="text" value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} className={inputClass} /></InputField>
          </div>
          <div className="sm:col-span-2">
            <InputField label="Shipping Address"><input type="text" value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} className={inputClass} /></InputField>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const CustomerDetailPage = () => {
  const { id } = useParams();
  const { state } = useApp();
  const navigate = useNavigate();
  const [detailTab, setDetailTab] = useState('ledger');

  const customer = state.customers.find((c) => c.id === id || c._id === id) || (id === 'first' ? state.customers[0] : null);
  if (!customer) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">Customer not found.</p>
        <button type="button" onClick={() => navigate('/parties/customers')} className={`${btnSecondary} mt-4`}>
          Back to Customers
        </button>
      </div>
    );
  }

  const custInvoices = state.invoices.filter((i) => i.customerId === customer.id && i.status !== 'Draft' && i.status !== 'Cancelled');
  const custPayments = state.payments.filter((p) => p.type === 'Payment In' && p.partyId === customer.id);
  const custCNs = state.creditNotes.filter((cn) => cn.customerId === customer.id);
  const outstanding = getCustomerOutstanding(customer, state.invoices, state.creditNotes);
  const totalSales = custInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);

  // Build running ledger
  const ledgerRows = [];
  if (customer.openingBalance > 0) {
    ledgerRows.push({ date: '2026-04-01', ref: 'OPEN-BAL', type: 'Opening Balance', debit: customer.openingBalance, credit: 0 });
  }
  custInvoices.forEach((i) => ledgerRows.push({ date: i.date, ref: i.invoiceNumber, type: 'Sales Invoice', debit: i.grandTotal, credit: 0 }));
  custPayments.forEach((p) => ledgerRows.push({ date: p.date, ref: p.paymentNumber, type: `Receipt (${p.method})`, debit: 0, credit: p.amount }));
  custCNs.forEach((cn) => ledgerRows.push({ date: cn.date, ref: cn.creditNoteNumber, type: 'Credit Note', debit: 0, credit: cn.grandTotal }));
  ledgerRows.sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  const ledgerWithBal = ledgerRows.map((r) => {
    running += (r.debit || 0) - (r.credit || 0);
    return { ...r, balance: running };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={customer.name}
        subtitle={`${customer.registrationType} · GSTIN: ${customer.gstin || 'Unregistered'} · ${customer.state}`}
        breadcrumbs={['Parties', 'Customers', customer.name]}
        actions={
          <>
            <button type="button" onClick={() => navigate('/parties/customers')} className={btnSecondary}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button type="button" onClick={() => navigate('/payments/in')} className={btnSecondary}>
              Record Receipt
            </button>
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  `customer-statement-${customer.name}.csv`,
                  ['Date', 'Reference', 'Particulars', 'Debit', 'Credit', 'Balance'],
                  ledgerWithBal.map((r) => [r.date, r.ref, r.type, r.debit, r.credit, r.balance])
                )
              }
              className={btnPrimary}
            >
              <Download className="h-3.5 w-3.5" /> Download Statement
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Total Sales" value={formatINR(totalSales)} />
        <StatCard label="Payments Received" value={formatINR(custPayments.reduce((s, p) => s + p.amount, 0))} />
        <StatCard label="Current Outstanding" value={formatINR(outstanding)} tone={outstanding > 0 ? 'warning' : 'success'} />
        <StatCard label="Credit Limit" value={formatINR(customer.creditLimit)} subtext={`Terms: ${customer.paymentTerms}`} />
      </div>

      <SegmentedTabs
        activeTab={detailTab}
        onChange={setDetailTab}
        tabs={[
          { id: 'ledger', label: 'Customer Ledger', count: ledgerWithBal.length },
          { id: 'invoices', label: 'Invoices & Returns', count: custInvoices.length + custCNs.length },
          { id: 'payments', label: 'Receipts', count: custPayments.length },
        ]}
      />

      {detailTab === 'ledger' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Customer Account Ledger</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Ref #</th>
                  <th className="px-3 py-2">Particulars</th>
                  <th className="px-3 py-2 text-right">Debit (₹)</th>
                  <th className="px-3 py-2 text-right">Credit (₹)</th>
                  <th className="px-3 py-2 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerWithBal.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-mono">{formatDateIN(row.date)}</td>
                    <td className="px-3 py-2 font-mono font-medium">{row.ref}</td>
                    <td className="px-3 py-2">{row.type}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.debit ? formatINR(row.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.credit ? formatINR(row.credit) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatINR(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailTab === 'invoices' && (
        <DataTable
          data={custInvoices}
          searchFields={['invoiceNumber']}
          columns={[
            { key: 'invoiceNumber', label: 'Invoice #', render: (r) => <span className="font-mono font-semibold">{r.invoiceNumber}</span> },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'grandTotal', label: 'Invoice Value', align: 'right', render: (r) => formatINR(r.grandTotal) },
            { key: 'amountPaid', label: 'Paid', align: 'right', render: (r) => formatINR(r.amountPaid) },
            { key: 'paymentStatus', label: 'Payment', render: (r) => <StatusLabel status={r.paymentStatus} /> },
          ]}
        />
      )}

      {detailTab === 'payments' && (
        <DataTable
          data={custPayments}
          searchFields={['paymentNumber', 'invoiceNumber', 'referenceNo']}
          columns={[
            { key: 'paymentNumber', label: 'Receipt #', render: (r) => <span className="font-mono font-semibold">{r.paymentNumber}</span> },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'invoiceNumber', label: 'Against Invoice', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
            { key: 'method', label: 'Method' },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatINR(r.amount) },
          ]}
        />
      )}
    </div>
  );
};

export const SuppliersPage = () => {
  const { state, upsertRecord, confirmAction, notify } = useApp();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const emptySup = { name: '', contactPerson: '', mobile: '', email: '', gstin: '', pan: '', address: '', state: 'Rajasthan', openingBalance: 0, status: 'Active' };
  const [form, setForm] = useState(emptySup);

  const enrichedSuppliers = useMemo(() => {
    return (state.suppliers || [])
      .filter((s) => s.status !== 'Archived')
      .map((sup) => {
        const purList = state.purchases.filter((p) => p.supplierId === sup.id);
        const totalPurchases = purList.reduce((s, p) => s + (Number(p.grandTotal) || 0), 0);
        const outstanding = getSupplierOutstanding(sup, state.purchases, state.purchaseReturns);
        return { ...sup, totalPurchases, outstanding };
      });
  }, [state.suppliers, state.purchases, state.purchaseReturns]);

  const handleSave = async (e) => {
    e.preventDefault();
    const supPhoneVal = (form.mobile || form.phone || '').trim();
    if (!form.name.trim() || !supPhoneVal) {
      notify('Supplier name and mobile are required', 'error');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(supPhoneVal)) {
      notify('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    if (form.gstin && form.gstin.trim()) {
      const gstinCheck = validateGSTIN(form.gstin);
      if (!gstinCheck.isValid) {
        notify(gstinCheck.error, 'error');
        return;
      }
    }
    try {
      await upsertRecord(
        'suppliers',
        {
          ...form,
          id: editing ? (editing.id || editing._id) : undefined,
          _id: editing ? (editing._id || editing.id) : undefined,
          partyType: 'supplier',
          phone: form.mobile || form.phone,
          GSTIN: form.gstin || form.GSTIN || null,
          PAN: form.pan || form.PAN || null,
          billingAddress: form.address || form.billingAddress || '',
          openingBalance: Number(form.openingBalance) || 0,
        },
        'Supplier',
        'name'
      );
      setModalOpen(false);
    } catch (err) {
      notify(err.message || 'Failed to save supplier', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parties — Suppliers & Vendors"
        subtitle="Manage vendor GSTINs, purchase history, and accounts payable"
        breadcrumbs={['Parties', 'Suppliers']}
        actions={
          <button type="button" onClick={() => { setEditing(null); setForm(emptySup); setModalOpen(true); }} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" /> Add Supplier
          </button>
        }
      />

      <PartiesTabs active="suppliers" />

      <DataTable
        data={enrichedSuppliers}
        searchFields={['name', 'gstin', 'state', 'contactPerson']}
        columns={[
          {
            key: 'name',
            label: 'Supplier Name',
            sortable: true,
            render: (r) => (
              <button type="button" onClick={() => navigate(`/parties/suppliers/${r.id}`)} className="font-medium text-indigo-700 hover:underline text-left">
                {r.name}
              </button>
            ),
          },
          { key: 'contactPerson', label: 'Contact' },
          { key: 'mobile', label: 'Mobile', render: (r) => <span className="font-mono text-xs">{r.mobile}</span> },
          { key: 'gstin', label: 'GSTIN', render: (r) => <span className="font-mono text-xs">{r.gstin}</span> },
          { key: 'state', label: 'State' },
          { key: 'totalPurchases', label: 'Total Purchases', align: 'right', render: (r) => formatINR(r.totalPurchases) },
          {
            key: 'outstanding',
            label: 'Payable',
            align: 'right',
            render: (r) => <span className={`font-semibold ${r.outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatINR(r.outstanding)}</span>,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => navigate(`/parties/suppliers/${r.id}`)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Eye className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => { setEditing(r); setForm(r); setModalOpen(true); }} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5" /></button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmAction({ title: `Delete ${r.name}?`, message: 'Remove this supplier from active directory?', confirmText: 'Delete', danger: true })) {
                      try {
                        await deleteRecord('suppliers', r.id || r._id, 'Supplier', r.name);
                      } catch (err) {
                        notify(err.message || 'Failed to delete supplier', 'error');
                      }
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
        title={editing ? `Edit Supplier — ${editing.name}` : 'Add Supplier'}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="sup-form" className={btnPrimary}>Save Supplier</button>
          </>
        }
      >
        <form id="sup-form" onSubmit={handleSave} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InputField label="Supplier Name" required><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Contact Person"><input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Mobile" required><input type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile number" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={inputClass} /></InputField>
          <InputField label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></InputField>
          <GSTINInput
            value={form.gstin}
            onChange={(e) => setForm({ ...form, gstin: e.target.value })}
            label="GSTIN (Optional)"
            onPanDerived={(pan) => {
              if (!form.pan) setForm((prev) => ({ ...prev, pan }));
            }}
          />
          <InputField label="PAN">
            <input
              type="text"
              maxLength={10}
              placeholder="e.g. AAAAA9999A"
              value={form.pan}
              onChange={(e) =>
                setForm({
                  ...form,
                  pan: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10),
                })
              }
              className={`${inputClass} font-mono uppercase`}
            />
          </InputField>
          <InputField label="State">
            <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputClass}>
              {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
            </select>
          </InputField>
          <InputField label="Opening Balance (₹)"><input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} className={`${inputClass} font-mono`} /></InputField>
          <div className="sm:col-span-2"><InputField label="Address"><input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} /></InputField></div>
        </form>
      </Modal>
    </div>
  );
};

export const SupplierDetailPage = () => {
  const { id } = useParams();
  const { state } = useApp();
  const navigate = useNavigate();
  const [detailTab, setDetailTab] = useState('ledger');

  const supplier = state.suppliers.find((s) => s.id === id || s._id === id) || (id === 'first' ? state.suppliers[0] : null);
  if (!supplier) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">Supplier not found.</p>
        <button type="button" onClick={() => navigate('/parties/suppliers')} className={`${btnSecondary} mt-4`}>Back</button>
      </div>
    );
  }

  const purList = state.purchases.filter((p) => p.supplierId === supplier.id);
  const payList = state.payments.filter((p) => p.type === 'Payment Out' && p.partyId === supplier.id);
  const outstanding = getSupplierOutstanding(supplier, state.purchases, state.purchaseReturns);

  const ledger = [];
  if (supplier.openingBalance > 0) ledger.push({ date: '2026-04-01', ref: 'OPEN-BAL', particulars: 'Opening Payable', debit: 0, credit: supplier.openingBalance });
  purList.forEach((p) => ledger.push({ date: p.date, ref: p.billNumber, particulars: `Purchase (${p.supplierInvoiceNo})`, debit: 0, credit: p.grandTotal }));
  payList.forEach((p) => ledger.push({ date: p.date, ref: p.paymentNumber, particulars: `Payment Out (${p.method})`, debit: p.amount, credit: 0 }));
  ledger.sort((a, b) => a.date.localeCompare(b.date));

  let bal = 0;
  const rows = ledger.map((r) => {
    bal += (r.credit || 0) - (r.debit || 0);
    return { ...r, balance: bal };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={supplier.name}
        subtitle={`GSTIN: ${supplier.gstin} · PAN: ${supplier.pan} · ${supplier.state}`}
        breadcrumbs={['Parties', 'Suppliers', supplier.name]}
        actions={
          <>
            <button type="button" onClick={() => navigate('/parties/suppliers')} className={btnSecondary}><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
            <button type="button" onClick={() => navigate('/payments/out')} className={btnSecondary}>Pay Supplier</button>
            <button
              type="button"
              onClick={() => exportToCSV(`supplier-statement-${supplier.name}.csv`, ['Date', 'Ref', 'Particulars', 'Debit', 'Credit', 'Balance'], rows.map((r) => [r.date, r.ref, r.particulars, r.debit, r.credit, r.balance]))}
              className={btnPrimary}
            >
              <Download className="h-3.5 w-3.5" /> Statement CSV
            </button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Purchases" value={formatINR(purList.reduce((s, p) => s + p.grandTotal, 0))} />
        <StatCard label="Payments Settled" value={formatINR(payList.reduce((s, p) => s + p.amount, 0))} />
        <StatCard label="Outstanding Payable" value={formatINR(outstanding)} tone={outstanding > 0 ? 'danger' : 'success'} />
      </div>

      <SegmentedTabs
        activeTab={detailTab}
        onChange={setDetailTab}
        tabs={[
          { id: 'ledger', label: 'Supplier Ledger', count: rows.length },
          { id: 'bills', label: 'Purchase Bills', count: purList.length },
          { id: 'payments', label: 'Disbursements', count: payList.length },
        ]}
      />

      {detailTab === 'ledger' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 overflow-x-auto">
          <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Supplier Ledger</h3>
          <table className="w-full text-left text-xs">
            <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Ref #</th>
                <th className="px-3 py-2">Particulars</th>
                <th className="px-3 py-2 text-right">Debit (Paid)</th>
                <th className="px-3 py-2 text-right">Credit (Billed)</th>
                <th className="px-3 py-2 text-right">Payable Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono">{formatDateIN(r.date)}</td>
                  <td className="px-3 py-2 font-mono font-medium">{r.ref}</td>
                  <td className="px-3 py-2">{r.particulars}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.debit ? formatINR(r.debit) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.credit ? formatINR(r.credit) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{formatINR(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailTab === 'bills' && (
        <DataTable
          data={purList}
          searchFields={['billNumber', 'supplierInvoiceNo']}
          columns={[
            { key: 'billNumber', label: 'Bill #', render: (r) => <span className="font-mono font-semibold">{r.billNumber}</span> },
            { key: 'supplierInvoiceNo', label: 'Supplier Inv #', render: (r) => <span className="font-mono text-xs">{r.supplierInvoiceNo}</span> },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'grandTotal', label: 'Total', align: 'right', render: (r) => formatINR(r.grandTotal) },
            { key: 'paymentStatus', label: 'Status', render: (r) => <StatusLabel status={r.paymentStatus} /> },
          ]}
        />
      )}

      {detailTab === 'payments' && (
        <DataTable
          data={payList}
          searchFields={['paymentNumber', 'invoiceNumber', 'referenceNo']}
          columns={[
            { key: 'paymentNumber', label: 'Payment #', render: (r) => <span className="font-mono font-semibold">{r.paymentNumber}</span> },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'invoiceNumber', label: 'Against Bill', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
            { key: 'method', label: 'Method' },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatINR(r.amount) },
          ]}
        />
      )}
    </div>
  );
};
