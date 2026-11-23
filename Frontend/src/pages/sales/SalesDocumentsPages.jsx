import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, FileCheck2, Trash2, Eye, ArrowRight, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { calculateInvoiceTotals, formatINR, formatDateIN } from '../../services/calculationService';
import { generateNextDocNumber } from '../../services/invoiceService';
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

// Shared helper modal to create Quotation / Sales Order / Delivery Challan / Debit Note
const SimpleSalesDocModal = ({ open, onClose, docType, onSave, state }) => {
  const [customerId, setCustomerId] = useState(state.customers[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [secondDate, setSecondDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10));
  const [productId, setProductId] = useState(state.products[0]?.id || '');
  const [qty, setQty] = useState(5);
  const [vehicleNo, setVehicleNo] = useState('RJ-14-GC-4412');
  const [transporter, setTransporter] = useState('Self / Local Courier');
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cust = state.customers.find((c) => c.id === customerId);
    const prod = state.products.find((p) => p.id === productId);
    if (!cust || !prod) return;
    const totals = calculateInvoiceTotals({
      items: [
        {
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          hsn: prod.hsn,
          unit: prod.unit,
          qty: Number(qty) || 1,
          rate: prod.sellingPrice,
          discountPct: 0,
          gstRate: prod.gstRate,
        },
      ],
      sellerState: state.business.state,
      placeOfSupply: cust.state,
    });
    onSave({
      customerId: cust.id,
      customerName: cust.name,
      customerGstin: cust.gstin,
      customerState: cust.state,
      placeOfSupply: cust.state,
      date,
      secondDate,
      vehicleNo,
      transporter,
      reason,
      ...totals,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Create ${docType}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" form="simple-doc-form" className={btnPrimary}>
            Save {docType}
          </button>
        </>
      }
    >
      <form id="simple-doc-form" onSubmit={handleSubmit} className="space-y-3">
        <InputField label="Customer" required>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
            {state.customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.state})</option>
            ))}
          </select>
        </InputField>
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Document Date" required>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </InputField>
          <InputField label={docType === 'Quotation' ? 'Valid Until' : 'Expected Date'}>
            <input type="date" value={secondDate} onChange={(e) => setSecondDate(e.target.value)} className={inputClass} />
          </InputField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <InputField label="Primary Product" required>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (₹{p.sellingPrice})</option>
                ))}
              </select>
            </InputField>
          </div>
          <InputField label="Qty" required>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className={inputClass} />
          </InputField>
        </div>
        {docType === 'Delivery Challan' && (
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Vehicle Number">
              <input type="text" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={inputClass} />
            </InputField>
            <InputField label="Transporter">
              <input type="text" value={transporter} onChange={(e) => setTransporter(e.target.value)} className={inputClass} />
            </InputField>
          </div>
        )}
        {docType === 'Debit Note' && (
          <InputField label="Reason / Adjustment Note">
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="e.g. Freight or rate revision" />
          </InputField>
        )}
      </form>
    </Modal>
  );
};

export const QuotationsPage = () => {
  const { state, upsertRecord, deleteRecord, confirmAction } = useApp();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = (payload) => {
    const quotationNumber = generateNextDocNumber('QT/26-27/', state.quotations, 'quotationNumber');
    upsertRecord(
      'quotations',
      {
        id: `qt-${Date.now()}`,
        quotationNumber,
        validUntil: payload.secondDate,
        status: 'Sent',
        ...payload,
      },
      'Quotation',
      'quotationNumber'
    );
  };

  const handleDelete = async (row) => {
    const ok = await confirmAction({
      title: `Delete ${row.quotationNumber}?`,
      message: 'This quotation will be permanently deleted.',
      confirmText: 'Delete',
      danger: true,
    });
    if (ok) deleteRecord('quotations', row.id, 'Quotation', row.quotationNumber);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotations & Estimates"
        subtitle="Send price quotes and convert accepted estimates into GST invoices"
        breadcrumbs={['Sales', 'Quotations']}
        actions={
          <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />
            New Quotation
          </button>
        }
      />
      <DataTable
        data={state.quotations}
        searchFields={['quotationNumber', 'customerName']}
        columns={[
          { key: 'quotationNumber', label: 'Quotation #', sortable: true, render: (r) => <span className="font-mono font-semibold text-slate-900">{r.quotationNumber}</span> },
          { key: 'customerName', label: 'Customer', sortable: true },
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'validUntil', label: 'Valid Until', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.validUntil)}</span> },
          { key: 'grandTotal', label: 'Total', align: 'right', render: (r) => formatINR(r.grandTotal) },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          {
            key: 'actions',
            label: 'Actions',
            nowrap: true,
            render: (r) => (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/sales/invoices/new?fromQuote=${r.id}`)}
                  className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  Convert to Invoice <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ),
          },
        ]}
      />
      <SimpleSalesDocModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        docType="Quotation"
        onSave={handleSave}
        state={state}
      />
    </div>
  );
};

export const SalesOrdersPage = () => {
  const { state, upsertRecord } = useApp();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = (payload) => {
    const orderNumber = generateNextDocNumber('SO/26-27/', state.salesOrders, 'orderNumber');
    upsertRecord(
      'salesOrders',
      { id: `so-${Date.now()}`, orderNumber, expectedDelivery: payload.secondDate, status: 'Confirmed', ...payload },
      'Sales Order',
      'orderNumber'
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Orders"
        subtitle="Track confirmed customer orders prior to dispatch and invoicing"
        breadcrumbs={['Sales', 'Sales Orders']}
        actions={
          <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />
            New Sales Order
          </button>
        }
      />
      <DataTable
        data={state.salesOrders}
        searchFields={['orderNumber', 'customerName']}
        columns={[
          { key: 'orderNumber', label: 'Order #', render: (r) => <span className="font-mono font-semibold text-slate-900">{r.orderNumber}</span> },
          { key: 'customerName', label: 'Customer' },
          { key: 'date', label: 'Order Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'expectedDelivery', label: 'Expected Delivery', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.expectedDelivery)}</span> },
          { key: 'grandTotal', label: 'Order Value', align: 'right', render: (r) => formatINR(r.grandTotal) },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <button
                type="button"
                onClick={() => navigate('/sales/invoices/new')}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                Bill Order
              </button>
            ),
          },
        ]}
      />
      <SimpleSalesDocModal open={modalOpen} onClose={() => setModalOpen(false)} docType="Sales Order" onSave={handleSave} state={state} />
    </div>
  );
};

export const DeliveryChallansPage = () => {
  const { state, upsertRecord } = useApp();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = (payload) => {
    const challanNumber = generateNextDocNumber('DC/26-27/', state.deliveryChallans, 'challanNumber');
    upsertRecord(
      'deliveryChallans',
      { id: `dc-${Date.now()}`, challanNumber, status: 'Dispatched', ...payload },
      'Delivery Challan',
      'challanNumber'
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Delivery Challans"
        subtitle="Track goods dispatched on job work, approval, or transit"
        breadcrumbs={['Sales', 'Delivery Challans']}
        actions={
          <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />
            New Challan
          </button>
        }
      />
      <DataTable
        data={state.deliveryChallans}
        searchFields={['challanNumber', 'customerName', 'vehicleNo']}
        columns={[
          { key: 'challanNumber', label: 'Challan #', render: (r) => <span className="font-mono font-semibold text-slate-900">{r.challanNumber}</span> },
          { key: 'customerName', label: 'Customer' },
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'transporter', label: 'Transporter' },
          { key: 'vehicleNo', label: 'Vehicle #', render: (r) => <span className="font-mono text-xs">{r.vehicleNo}</span> },
          { key: 'grandTotal', label: 'Challan Value', align: 'right', render: (r) => formatINR(r.grandTotal) },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
        ]}
      />
      <SimpleSalesDocModal open={modalOpen} onClose={() => setModalOpen(false)} docType="Delivery Challan" onSave={handleSave} state={state} />
    </div>
  );
};

export const SalesReturnsPage = () => {
  const { state, createSalesReturnCreditNote, notify } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const finalizedInvoices = useMemo(
    () => state.invoices.filter((i) => i.status === 'Finalized'),
    [state.invoices]
  );

  const initialInvId = searchParams.get('invoiceId') || finalizedInvoices[0]?.id || '';
  const [selectedInvId, setSelectedInvId] = useState(initialInvId);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('Damaged or excess goods returned by customer');
  const [restoreStock, setRestoreStock] = useState(true);
  const [returnQtyMap, setReturnQtyMap] = useState({});

  const selectedInvoice = useMemo(
    () => finalizedInvoices.find((i) => i.id === selectedInvId),
    [finalizedInvoices, selectedInvId]
  );

  const computedReturn = useMemo(() => {
    if (!selectedInvoice) return null;
    const items = (selectedInvoice.items || [])
      .map((it) => {
        const rq = Number(returnQtyMap[it.productId] ?? 0);
        if (rq <= 0) return null;
        return {
          ...it,
          qty: Math.min(it.qty, rq),
        };
      })
      .filter(Boolean);
    if (items.length === 0) return null;
    return calculateInvoiceTotals({
      items,
      sellerState: state.business.state,
      placeOfSupply: selectedInvoice.placeOfSupply,
    });
  }, [selectedInvoice, returnQtyMap, state.business.state]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedInvoice || !computedReturn) {
      notify('Enter return quantity for at least one item', 'error');
      return;
    }
    createSalesReturnCreditNote({
      date: returnDate,
      invoiceId: selectedInvoice.id,
      invoiceNumber: selectedInvoice.invoiceNumber,
      customerId: selectedInvoice.customerId,
      customerName: selectedInvoice.customerName,
      customerState: selectedInvoice.customerState,
      placeOfSupply: selectedInvoice.placeOfSupply,
      reason,
      restoreStock,
      ...computedReturn,
    });
    setReturnQtyMap({});
    navigate('/sales/notes');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Returns (Credit Note Workflow)"
        subtitle="Select an original invoice, enter returned quantities, restore stock, and issue a GST Credit Note"
        breadcrumbs={['Sales', 'Sales Returns']}
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-8 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField label="Select Original Tax Invoice" required>
              <select
                value={selectedInvId}
                onChange={(e) => {
                  setSelectedInvId(e.target.value);
                  setReturnQtyMap({});
                }}
                className={inputClass}
              >
                {finalizedInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — {inv.customerName} ({formatINR(inv.grandTotal)})
                  </option>
                ))}
              </select>
            </InputField>
            <InputField label="Return / Credit Note Date" required>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className={inputClass}
              />
            </InputField>
          </div>

          {selectedInvoice && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Billed Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">GST%</th>
                    <th className="px-3 py-2 text-right w-32">Return Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedInvoice.items || []).map((it) => (
                    <tr key={it.productId}>
                      <td className="px-3 py-2 font-medium text-slate-900">{it.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{it.qty} {it.unit}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(it.rate)}</td>
                      <td className="px-3 py-2 text-right font-mono">{it.gstRate}%</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max={it.qty}
                          value={returnQtyMap[it.productId] ?? 0}
                          onChange={(e) =>
                            setReturnQtyMap({
                              ...returnQtyMap,
                              [it.productId]: Math.min(it.qty, Math.max(0, Number(e.target.value))),
                            })
                          }
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-right font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <InputField label="Return Reason">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
          </InputField>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={restoreStock}
              onChange={(e) => setRestoreStock(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600"
            />
            Goods accepted back into warehouse (Restore inventory stock)
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-4 space-y-3 text-xs">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Credit Note Summary
          </h3>
          {computedReturn ? (
            <>
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value</span>
                <span className="font-mono">{formatINR(computedReturn.taxableValue)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST + SGST / IGST Reversal</span>
                <span className="font-mono">{formatINR(computedReturn.totalTax)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                <span>Total Credit Value</span>
                <span className="font-mono">{formatINR(computedReturn.grandTotal)}</span>
              </div>
            </>
          ) : (
            <p className="text-slate-500">Enter return quantity on any item row to calculate GST reversal.</p>
          )}
          <button
            type="submit"
            disabled={!computedReturn}
            className={`${btnPrimary} w-full`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Issue Credit Note
          </button>
        </div>
      </form>
    </div>
  );
};

export const CreditDebitNotesPage = ({ defaultTab = 'credit' }) => {
  const { state, upsertRecord } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'debit' ? 'debit' : defaultTab;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedCN, setSelectedCN] = useState(null);
  const [dnModalOpen, setDnModalOpen] = useState(false);

  useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'debit' ? 'debit' : defaultTab);
  }, [defaultTab, searchParams]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    setSearchParams(nextTab === 'debit' ? { tab: 'debit' } : {});
  };

  const handleSaveDebitNote = (payload) => {
    const debitNoteNumber = generateNextDocNumber('DN/26-27/', state.debitNotes, 'debitNoteNumber');
    upsertRecord(
      'debitNotes',
      { id: `dn-${Date.now()}`, debitNoteNumber, invoiceNumber: 'ST/26-27/015', status: 'Issued', ...payload },
      'Debit Note',
      'debitNoteNumber'
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Credit & Debit Notes"
        subtitle="Manage GST credit notes from sales returns and supplementary debit note adjustments"
        breadcrumbs={['Sales', 'Credit/Debit Notes']}
        actions={
          activeTab === 'credit' ? (
            <button type="button" onClick={() => navigate('/sales/returns')} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" />
              Create Sales Return / Credit Note
            </button>
          ) : (
            <button type="button" onClick={() => setDnModalOpen(true)} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" />
              New Debit Note
            </button>
          )
        }
      />

      <SegmentedTabs
        activeTab={activeTab}
        onChange={handleTabChange}
        tabs={[
          { id: 'credit', label: 'Credit Notes', count: state.creditNotes.length },
          { id: 'debit', label: 'Debit Notes', count: state.debitNotes.length },
        ]}
      />

      {activeTab === 'credit' ? (
        <DataTable
          data={state.creditNotes}
          searchFields={['creditNoteNumber', 'invoiceNumber', 'customerName']}
          columns={[
            { key: 'creditNoteNumber', label: 'Credit Note #', render: (r) => <span className="font-mono font-semibold text-indigo-700">{r.creditNoteNumber}</span> },
            { key: 'invoiceNumber', label: 'Against Invoice', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
            { key: 'customerName', label: 'Customer' },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'taxableValue', label: 'Taxable', align: 'right', render: (r) => formatINR(r.taxableValue) },
            { key: 'totalTax', label: 'GST Reversal', align: 'right', render: (r) => formatINR(r.totalTax) },
            { key: 'grandTotal', label: 'Total Credit', align: 'right', render: (r) => formatINR(r.grandTotal) },
            { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
            {
              key: 'view',
              label: 'View',
              render: (r) => (
                <button type="button" onClick={() => setSelectedCN(r)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                  <Eye className="h-3.5 w-3.5" />
                </button>
              ),
            },
          ]}
        />
      ) : (
        <DataTable
          data={state.debitNotes}
          searchFields={['debitNoteNumber', 'customerName', 'invoiceNumber']}
          columns={[
            { key: 'debitNoteNumber', label: 'Debit Note #', render: (r) => <span className="font-mono font-semibold text-slate-900">{r.debitNoteNumber}</span> },
            { key: 'invoiceNumber', label: 'Against Invoice', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
            { key: 'customerName', label: 'Customer' },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'reason', label: 'Reason' },
            { key: 'grandTotal', label: 'Total', align: 'right', render: (r) => formatINR(r.grandTotal) },
            { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          ]}
        />
      )}

      <Modal open={Boolean(selectedCN)} onClose={() => setSelectedCN(null)} title={`Credit Note — ${selectedCN?.creditNoteNumber}`}>
        {selectedCN && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded bg-slate-50 p-3">
              <div><strong>Customer:</strong> {selectedCN.customerName}</div>
              <div><strong>Against Invoice:</strong> {selectedCN.invoiceNumber}</div>
              <div><strong>Reason:</strong> {selectedCN.reason}</div>
              <div><strong>Stock Restored:</strong> {selectedCN.restoreStock ? 'Yes' : 'No'}</div>
            </div>
            <div className="font-mono font-semibold text-right text-sm">
              Total Credit: {formatINR(selectedCN.grandTotal)}
            </div>
          </div>
        )}
      </Modal>
      <SimpleSalesDocModal open={dnModalOpen} onClose={() => setDnModalOpen(false)} docType="Debit Note" onSave={handleSaveDebitNote} state={state} />
    </div>
  );
};

export const CreditNotesPage = () => <CreditDebitNotesPage defaultTab="credit" />;
export const DebitNotesPage = () => <CreditDebitNotesPage defaultTab="debit" />;

