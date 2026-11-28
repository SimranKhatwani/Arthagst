import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Download,
  Eye,
  Edit3,
  Copy,
  XCircle,
  RotateCcw,
  IndianRupee,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatINR, formatDateIN } from '../../services/calculationService';
import { exportToCSV } from '../../services/storageService';
import { PAYMENT_METHODS } from '../../data/constants';
import {
  PageHeader,
  DataTable,
  StatusLabel,
  SegmentedTabs,
  Modal,
  InputField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';
import { TaxInvoicePreview } from '../../components/invoice/TaxInvoicePreview';

export const InvoicesPage = () => {
  const { state, selectedFY, cancelSalesInvoice, recordPayment, confirmAction, canAccess } = useApp();
  const navigate = useNavigate();
  const canEdit = canAccess ? canAccess('sales', 'edit') : true;

  const [statusFilter, setStatusFilter] = useState('All');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [previewInv, setPreviewInv] = useState(null);
  const [payModalInv, setPayModalInv] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', method: 'UPI', referenceNo: '', date: new Date().toISOString().slice(0, 10) });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const filteredInvoices = useMemo(() => {
    return (state.invoices || []).filter((inv) => {
      if (selectedFY && inv.financialYear !== selectedFY) return false;
      if (statusFilter !== 'All' && inv.paymentStatus !== statusFilter && inv.status !== statusFilter) {
        return false;
      }
      if (customerFilter !== 'All' && inv.customerId !== customerFilter) return false;
      if (dateFrom && inv.date < dateFrom) return false;
      if (dateTo && inv.date > dateTo) return false;
      return true;
    });
  }, [state.invoices, selectedFY, statusFilter, customerFilter, dateFrom, dateTo]);

  const handleExportCSV = () => {
    exportToCSV(
      `sales-invoices-${selectedFY}.csv`,
      ['Invoice Number', 'Date', 'Due Date', 'Customer', 'GSTIN', 'Taxable', 'GST', 'Grand Total', 'Paid', 'Balance', 'Payment Status', 'Invoice Status'],
      filteredInvoices.map((i) => [
        i.invoiceNumber,
        i.date,
        i.dueDate,
        i.customerName,
        i.customerGstin || 'URP',
        i.taxableValue,
        i.totalTax,
        i.grandTotal,
        i.amountPaid,
        Math.max(0, i.grandTotal - i.amountPaid),
        i.paymentStatus,
        i.status,
      ])
    );
  };

  const handleCancel = async (inv) => {
    const ok = await confirmAction({
      title: `Cancel Invoice ${inv.invoiceNumber}?`,
      message:
        'Cancelling a finalized invoice preserves the record for GST audit compliance and restores product stock. This cannot be undone.',
      confirmText: 'Cancel Invoice',
      danger: true,
    });
    if (ok) await cancelSalesInvoice(inv.id || inv._id, 'Cancelled by user from Invoice Register');
  };

  const openPaymentModal = (inv) => {
    const bal = Math.max(0, (inv.grandTotal || 0) - (inv.amountPaid || 0));
    setPayModalInv(inv);
    setPayForm({
      amount: String(bal),
      method: 'UPI',
      referenceNo: `UTR${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!payModalInv || isSubmittingPayment) return;
    setIsSubmittingPayment(true);
    try {
      const bal = Math.max(0, (payModalInv.grandTotal || 0) - (payModalInv.amountPaid || 0));
      const amt = Math.min(bal, Number(payForm.amount) || 0);
      const ok = await recordPayment({
        type: 'Payment In',
        date: payForm.date,
        partyId: payModalInv.customerId,
        partyName: payModalInv.customerName,
        invoiceId: payModalInv.id || payModalInv._id,
        invoiceNumber: payModalInv.invoiceNumber,
        amount: amt,
        method: payForm.method,
        referenceNo: payForm.referenceNo,
        notes: `Invoice payment for ${payModalInv.invoiceNumber}`,
      });
      if (ok) setPayModalInv(null);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const columns = [
    {
      key: 'invoiceNumber',
      label: 'Invoice #',
      sortable: true,
      nowrap: true,
      render: (r) => (
        <button
          type="button"
          onClick={() => setPreviewInv(r)}
          className="font-mono font-semibold text-indigo-700 hover:underline"
        >
          {r.invoiceNumber}
        </button>
      ),
    },
    { key: 'customerName', label: 'Customer', sortable: true },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      nowrap: true,
      render: (r) => (
        <div>
          <span className="font-mono text-xs">{formatDateIN(r.date)}</span>
          {r.dueDate && r.dueDate !== r.date && (
            <div className="text-[10px] text-slate-400">Due {formatDateIN(r.dueDate)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'grandTotal',
      label: 'Amount',
      align: 'right',
      sortable: true,
      render: (r) => (
        <div className="text-right">
          <div className="font-semibold text-slate-900">{formatINR(r.grandTotal)}</div>
          <div className="text-[10px] text-slate-400">Tax {formatINR(r.totalTax || 0)}</div>
        </div>
      ),
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'right',
      render: (r) => {
        const bal = r.status === 'Cancelled' ? 0 : Math.max(0, (r.grandTotal || 0) - (r.amountPaid || 0));
        return (
          <div className="text-right">
            <span className={`font-mono font-medium ${bal > 0 ? 'text-amber-700' : 'text-slate-600'}`}>{formatINR(bal)}</span>
            {r.amountPaid > 0 && <div className="text-[10px] text-emerald-600">Paid {formatINR(r.amountPaid)}</div>}
          </div>
        );
      },
    },
    {
      key: 'paymentStatus',
      label: 'Payment',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <StatusLabel status={r.paymentStatus} />
          {r.status === 'Finalized' && r.paymentStatus !== 'Paid' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPaymentModal(r);
              }}
              className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
              title="Record payment for this invoice"
            >
              <IndianRupee className="h-3 w-3" /> Pay
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusLabel status={r.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      nowrap: true,
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="View & Print Invoice"
            onClick={() => setPreviewInv(r)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {canEdit && r.status === 'Draft' && (
            <button
              type="button"
              title="Edit Draft"
              onClick={() => navigate(`/sales/invoices/edit/${r.id}`)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && r.status === 'Finalized' && r.paymentStatus !== 'Paid' && (
            <button
              type="button"
              title="Record Payment"
              onClick={() => openPaymentModal(r)}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
            >
              <IndianRupee className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              title="Duplicate Invoice"
              onClick={() => navigate(`/sales/invoices/new?duplicate=${r.id}`)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && r.status === 'Finalized' && (
            <button
              type="button"
              title="Create Credit Note / Return"
              onClick={() => navigate(`/sales/returns?invoiceId=${r.id}`)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-amber-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && r.status === 'Finalized' && (
            <button
              type="button"
              title="Cancel Invoice"
              onClick={() => handleCancel(r)}
              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const linkedEInv = previewInv
    ? state.eInvoices.find((e) => e.invoiceId === previewInv.id)
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Invoices"
        subtitle="Manage GST tax invoices, drafts, collections, and credit note returns"
        breadcrumbs={['Sales', 'All Invoices']}
        actions={
          <>
            <button type="button" onClick={handleExportCSV} className={btnSecondary}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => navigate('/sales/invoices/new')}
                className={btnPrimary}
              >
                <Plus className="h-3.5 w-3.5" />
                Create Invoice
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Read-Only View
              </div>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          activeTab={statusFilter}
          onChange={setStatusFilter}
          tabs={['All', 'Paid', 'Partial', 'Unpaid', 'Draft', 'Cancelled']}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="All">All Customers</option>
            {state.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredInvoices}
        searchFields={['invoiceNumber', 'customerName', 'customerGstin']}
        searchPlaceholder="Search invoice number or customer..."
        emptyTitle="No matching invoices"
        emptyDescription="Create a new GST tax invoice or clear active filters."
        emptyAction={
          <button
            type="button"
            onClick={() => navigate('/sales/invoices/new')}
            className={btnPrimary}
          >
            Create First Invoice
          </button>
        }
      />

      {/* Invoice Preview Modal */}
      <Modal
        open={Boolean(previewInv)}
        onClose={() => setPreviewInv(null)}
        title={`Tax Invoice — ${previewInv?.invoiceNumber}`}
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {previewInv?.status === 'Finalized' && previewInv?.paymentStatus !== 'Paid' && (
                <button
                  type="button"
                  onClick={() => {
                    const inv = previewInv;
                    setPreviewInv(null);
                    openPaymentModal(inv);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs cursor-pointer"
                >
                  <IndianRupee className="h-3.5 w-3.5" /> Record Payment (Mark as Paid)
                </button>
              )}
            </div>
            <button type="button" onClick={() => setPreviewInv(null)} className={btnSecondary}>
              Close
            </button>
          </div>
        }
      >
        <TaxInvoicePreview
          invoice={previewInv}
          business={state.business}
          eInvoice={linkedEInv}
        />
      </Modal>

      {/* Quick Payment In Modal */}
      <Modal
        open={Boolean(payModalInv)}
        onClose={() => setPayModalInv(null)}
        title={`Record Payment — ${payModalInv?.invoiceNumber}`}
        subtitle={`Customer: ${payModalInv?.customerName}`}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setPayModalInv(null)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="quick-pay-form" disabled={isSubmittingPayment} className={btnPrimary}>
              {isSubmittingPayment ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving Payment...
                </>
              ) : (
                'Save Payment'
              )}
            </button>
          </>
        }
      >
        <form id="quick-pay-form" onSubmit={submitPayment} className="space-y-3">
          <div className="rounded bg-slate-50 p-2.5 text-xs text-slate-600 flex justify-between">
            <span>Remaining Balance:</span>
            <span className="font-mono font-semibold text-slate-900">
              {formatINR(
                Math.max(0, (payModalInv?.grandTotal || 0) - (payModalInv?.amountPaid || 0))
              )}
            </span>
          </div>
          <InputField label="Amount Received (INR)" required>
            <input
              type="number"
              step="0.01"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              className={inputClass}
              required
            />
          </InputField>
          <InputField label="Payment Date" required>
            <input
              type="date"
              value={payForm.date}
              onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
              className={inputClass}
              required
            />
          </InputField>
          <InputField label="Payment Method">
            <select
              value={payForm.method}
              onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
              className={inputClass}
            >
              {PAYMENT_METHODS.filter((m) => m !== 'Credit').map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </InputField>
          <InputField label="UTR / Reference No.">
            <input
              type="text"
              value={payForm.referenceNo}
              onChange={(e) => setPayForm({ ...payForm, referenceNo: e.target.value })}
              className={inputClass}
            />
          </InputField>
        </form>
      </Modal>
    </div>
  );
};
