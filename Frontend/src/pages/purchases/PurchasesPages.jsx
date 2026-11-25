import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Eye, IndianRupee, CheckCircle2, RotateCcw, PackageCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GST_RATES, PAYMENT_METHODS } from '../../data/constants';
import { calculateInvoiceTotals, formatINR, formatDateIN } from '../../services/calculationService';
import { generateNextDocNumber } from '../../services/invoiceService';
import { exportToCSV } from '../../services/storageService';
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

export const PurchasesPage = ({ defaultTab = 'bills' }) => {
  const { state, recordPayment } = useApp();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(defaultTab);

  useEffect(() => {
    setViewMode(defaultTab);
  }, [defaultTab]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewPurchase, setViewPurchase] = useState(null);
  const [payPurchase, setPayPurchase] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', method: 'NEFT', referenceNo: '', date: new Date().toISOString().slice(0, 10) });

  const outPayments = useMemo(() => state.payments.filter((p) => p.type === 'Payment Out'), [state.payments]);
  const pendingBills = useMemo(() => state.purchases.filter((p) => p.paymentStatus !== 'Paid'), [state.purchases]);

  const filtered = useMemo(() => {
    return (state.purchases || []).filter((p) => {
      if (statusFilter !== 'All' && p.paymentStatus !== statusFilter) return false;
      return true;
    });
  }, [state.purchases, statusFilter]);

  const openPayModal = (pur) => {
    const bal = Math.max(0, (pur.grandTotal || 0) - (pur.amountPaid || 0));
    setPayPurchase(pur);
    setPayForm({
      amount: String(bal),
      method: 'NEFT',
      referenceNo: `NEFT${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const submitPay = async (e) => {
    e.preventDefault();
    if (!payPurchase) return;
    const bal = Math.max(0, (payPurchase.grandTotal || 0) - (payPurchase.amountPaid || 0));
    const amt = Math.min(bal, Number(payForm.amount) || 0);
    const ok = await recordPayment({
      type: 'Payment Out',
      date: payForm.date,
      partyId: payPurchase.supplierId,
      partyName: payPurchase.supplierName,
      invoiceId: payPurchase.id || payPurchase._id,
      invoiceNumber: payPurchase.billNumber,
      amount: amt,
      method: payForm.method,
      referenceNo: payForm.referenceNo,
      notes: `Settlement for ${payPurchase.supplierInvoiceNo}`,
    });
    if (ok) setPayPurchase(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Invoices"
        subtitle="Track supplier bills, eligible Input Tax Credit (ITC), and payables"
        breadcrumbs={['Purchases', 'Purchase Invoices']}
        actions={
          <>
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  'purchase-register.csv',
                  ['Bill #', 'Supplier Inv', 'Supplier', 'Date', 'Taxable', 'GST', 'Total', 'Paid', 'Status'],
                  filtered.map((p) => [p.billNumber, p.supplierInvoiceNo, p.supplierName, p.date, p.taxableValue, p.totalTax, p.grandTotal, p.amountPaid, p.paymentStatus])
                )
              }
              className={btnSecondary}
            >
              Export CSV
            </button>
            <button type="button" onClick={() => navigate('/purchases/new')} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" />
              Add Purchase
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          activeTab={viewMode}
          onChange={setViewMode}
          tabs={[
            { id: 'bills', label: 'Purchase Bills', count: state.purchases.length },
            { id: 'payments', label: 'Payables & Payments', count: pendingBills.length },
          ]}
        />
        {viewMode === 'bills' ? (
          <SegmentedTabs activeTab={statusFilter} onChange={setStatusFilter} tabs={['All', 'Paid', 'Partial', 'Unpaid']} />
        ) : (
          <button type="button" onClick={() => navigate('/payments/out')} className={btnSecondary}>
            <IndianRupee className="h-3.5 w-3.5" /> Record Payment Out
          </button>
        )}
      </div>

      {viewMode === 'bills' ? (
        <DataTable
          data={filtered}
          searchFields={['billNumber', 'supplierInvoiceNo', 'supplierName']}
          searchPlaceholder="Search bill number or supplier..."
          columns={[
            { key: 'billNumber', label: 'Bill #', sortable: true, render: (r) => <span className="font-mono font-semibold text-slate-900">{r.billNumber}</span> },
            { key: 'supplierInvoiceNo', label: 'Supplier Inv #', render: (r) => <span className="font-mono text-xs">{r.supplierInvoiceNo}</span> },
            { key: 'supplierName', label: 'Supplier', sortable: true },
            { key: 'date', label: 'Date', sortable: true, render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'taxableValue', label: 'Taxable', align: 'right', render: (r) => formatINR(r.taxableValue) },
            { key: 'totalTax', label: 'GST (ITC)', align: 'right', render: (r) => formatINR(r.totalTax) },
            { key: 'grandTotal', label: 'Total', align: 'right', render: (r) => <span className="font-semibold text-slate-900">{formatINR(r.grandTotal)}</span> },
            { key: 'amountPaid', label: 'Paid', align: 'right', render: (r) => formatINR(r.amountPaid) },
            { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => formatINR(Math.max(0, (r.grandTotal || 0) - (r.amountPaid || 0))) },
            { key: 'paymentStatus', label: 'Status', render: (r) => <StatusLabel status={r.paymentStatus} /> },
            {
              key: 'actions',
              label: 'Actions',
              nowrap: true,
              render: (r) => (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setViewPurchase(r)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  {r.paymentStatus !== 'Paid' && (
                    <button type="button" onClick={() => openPayModal(r)} title="Record Supplier Payment" className="rounded p-1 text-emerald-600 hover:bg-emerald-50">
                      <IndianRupee className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">
              Pending Supplier Bills ({pendingBills.length})
            </h3>
            <DataTable
              data={pendingBills}
              columns={[
                { key: 'billNumber', label: 'Bill #', render: (r) => <span className="font-mono font-semibold">{r.billNumber}</span> },
                { key: 'supplierName', label: 'Supplier' },
                { key: 'dueDate', label: 'Due Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.dueDate)}</span> },
                { key: 'grandTotal', label: 'Bill Total', align: 'right', render: (r) => formatINR(r.grandTotal) },
                { key: 'balance', label: 'Payable', align: 'right', render: (r) => <span className="font-semibold text-rose-700">{formatINR(r.grandTotal - r.amountPaid)}</span> },
                { key: 'paymentStatus', label: 'Status', render: (r) => <StatusLabel status={r.paymentStatus} /> },
                {
                  key: 'payAction',
                  label: 'Action',
                  render: (r) => (
                    <button type="button" onClick={() => openPayModal(r)} className="text-xs font-medium text-emerald-700 hover:underline">
                      Pay Now
                    </button>
                  ),
                },
              ]}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">
              Supplier Payment History
            </h3>
            <DataTable
              data={outPayments}
              searchFields={['paymentNumber', 'partyName', 'invoiceNumber']}
              columns={[
                { key: 'paymentNumber', label: 'Payment #', render: (r) => <span className="font-mono font-semibold">{r.paymentNumber}</span> },
                { key: 'partyName', label: 'Supplier' },
                { key: 'invoiceNumber', label: 'Bill Ref', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
                { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
                { key: 'method', label: 'Method' },
                { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatINR(r.amount) },
              ]}
            />
          </div>
        </div>
      )}

      <Modal open={Boolean(viewPurchase)} onClose={() => setViewPurchase(null)} title={`Purchase Bill — ${viewPurchase?.billNumber}`} size="lg">
        {viewPurchase && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded bg-slate-50 p-3">
              <div><strong>Supplier:</strong> {viewPurchase.supplierName}</div>
              <div><strong>Supplier Inv:</strong> <span className="font-mono">{viewPurchase.supplierInvoiceNo}</span></div>
              <div><strong>GSTIN:</strong> <span className="font-mono">{viewPurchase.supplierGstin}</span></div>
              <div><strong>Supply Type:</strong> {viewPurchase.isIntraState ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}</div>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-y border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">HSN</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Rate</th>
                  <th className="px-2 py-2 text-right">GST</th>
                  <th className="px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(viewPurchase.items || []).map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">{it.name}</td>
                    <td className="px-2 py-2 font-mono">{it.hsn}</td>
                    <td className="px-2 py-2 text-right font-mono">{it.qty}</td>
                    <td className="px-2 py-2 text-right font-mono">{formatINR(it.rate)}</td>
                    <td className="px-2 py-2 text-right font-mono">{formatINR(it.totalTax)}</td>
                    <td className="px-2 py-2 text-right font-mono font-semibold">{formatINR(it.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right font-mono text-sm font-bold">
              Grand Total: {formatINR(viewPurchase.grandTotal)}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(payPurchase)}
        onClose={() => setPayPurchase(null)}
        title={`Pay Supplier — ${payPurchase?.billNumber}`}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setPayPurchase(null)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="sup-pay-form" className={btnPrimary}>Record Payment Out</button>
          </>
        }
      >
        <form id="sup-pay-form" onSubmit={submitPay} className="space-y-3">
          <InputField label="Amount Paid (INR)" required>
            <input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className={inputClass} required />
          </InputField>
          <InputField label="Payment Date" required>
            <input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} className={inputClass} required />
          </InputField>
          <InputField label="Method">
            <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className={inputClass}>
              {PAYMENT_METHODS.filter((m) => m !== 'Credit').map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </InputField>
          <InputField label="Reference / UTR">
            <input type="text" value={payForm.referenceNo} onChange={(e) => setPayForm({ ...payForm, referenceNo: e.target.value })} className={inputClass} />
          </InputField>
        </form>
      </Modal>
    </div>
  );
};

export const AddPurchasePage = () => {
  const { state, selectedFY, savePurchaseBill, notify } = useApp();
  const navigate = useNavigate();

  const [supplierId, setSupplierId] = useState(state.suppliers[0]?.id || state.suppliers[0]?._id || '');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState(`SUP/${Math.floor(100 + Math.random() * 900)}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [shipping, setShipping] = useState(0);
  const [payStatus, setPayStatus] = useState('Unpaid');
  const [paymentMethod, setPaymentMethod] = useState('NEFT');
  const [isSaving, setIsSaving] = useState(false);

  const [items, setItems] = useState(() => {
    const p = state.products[0];
    return [
      {
        productId: p?.id || p?._id || '',
        name: p?.name || '',
        sku: p?.sku || '',
        hsn: p?.hsn || '',
        unit: p?.unit || 'PCS',
        qty: 10,
        rate: p?.purchasePrice || 0,
        discountPct: 0,
        gstRate: p?.gstRate || 18,
      },
    ];
  });

  useEffect(() => {
    if (!supplierId && state.suppliers?.length > 0) {
      setSupplierId(state.suppliers[0].id || state.suppliers[0]._id);
    }
  }, [state.suppliers, supplierId]);

  useEffect(() => {
    if (items.length === 1 && !items[0].productId && state.products?.length > 0) {
      const p = state.products[0];
      setItems([
        {
          productId: p.id || p._id,
          name: p.name || '',
          sku: p.sku || '',
          hsn: p.hsn || '',
          unit: p.unit || 'PCS',
          qty: 10,
          rate: p.purchasePrice || 0,
          discountPct: 0,
          gstRate: p.gstRate || 18,
        },
      ]);
    }
  }, [state.products, items]);

  const supplier = state.suppliers.find((s) => (s.id || s._id) === supplierId);
  const computed = useMemo(
    () =>
      calculateInvoiceTotals({
        items,
        sellerState: supplier?.state || state.business.state,
        placeOfSupply: state.business.state,
        shipping,
      }),
    [items, supplier, state.business.state, shipping]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!supplier || !supplierInvoiceNo.trim()) {
      notify('Supplier and Supplier Invoice Number are required', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await savePurchaseBill({
        supplierInvoiceNo,
        date,
        dueDate,
        financialYear: selectedFY,
        supplierId: supplier.id || supplier._id,
        supplierName: supplier.name,
        supplierGstin: supplier.gstin || supplier.GSTIN || '',
        supplierState: supplier.state,
        warehouseId: state.warehouses[0]?.id || state.warehouses[0]?._id,
        paymentMethod,
        amountPaid: payStatus === 'Paid' ? computed.grandTotal : 0,
        itcEligible: true,
        ...computed,
      });
      navigate('/purchases');
    } catch {
      // error handled in context
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Add Purchase Entry"
        subtitle="Record supplier invoice, input GST credit, and update product stock"
        breadcrumbs={['Purchases', 'Add Purchase']}
      />
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-4">
          <InputField label="Supplier" required>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
              ))}
            </select>
          </InputField>
          <InputField label="Supplier Invoice No." required>
            <input type="text" value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} className={`${inputClass} font-mono`} />
          </InputField>
          <InputField label="Invoice Date" required>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </InputField>
          <InputField label="Due Date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </InputField>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900">Purchased Products</h3>
            <button
              type="button"
              onClick={() => {
                const p = state.products[0];
                setItems([...items, { productId: p.id, name: p.name, sku: p.sku, hsn: p.hsn, unit: p.unit, qty: 10, rate: p.purchasePrice, discountPct: 0, gstRate: p.gstRate }]);
              }}
              className={btnSecondary}
            >
              <Plus className="h-3.5 w-3.5" /> Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-xs">
              <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-left">HSN</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Purchase Rate</th>
                  <th className="px-2 py-2 text-right">Disc%</th>
                  <th className="px-2 py-2 text-right">GST%</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computed.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">
                      <select
                        value={it.productId}
                        onChange={(e) => {
                          const p = state.products.find((pr) => pr.id === e.target.value);
                          if (!p) return;
                          setItems(items.map((r, i) => (i === idx ? { ...r, productId: p.id, name: p.name, sku: p.sku, hsn: p.hsn, unit: p.unit, rate: p.purchasePrice, gstRate: p.gstRate } : r)));
                        }}
                        className="w-full rounded border border-slate-200 px-2 py-1.5"
                      >
                        {state.products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 font-mono">{it.hsn}</td>
                    <td className="px-2 py-2 text-right">
                      <input type="number" min="1" value={it.qty} onChange={(e) => setItems(items.map((r, i) => (i === idx ? { ...r, qty: e.target.value } : r)))} className="w-20 rounded border border-slate-200 px-2 py-1 text-right font-mono" />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input type="number" min="0" step="0.01" value={it.rate} onChange={(e) => setItems(items.map((r, i) => (i === idx ? { ...r, rate: e.target.value } : r)))} className="w-24 rounded border border-slate-200 px-2 py-1 text-right font-mono" />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input type="number" min="0" max="100" value={it.discountPct} onChange={(e) => setItems(items.map((r, i) => (i === idx ? { ...r, discountPct: e.target.value } : r)))} className="w-16 rounded border border-slate-200 px-2 py-1 text-right font-mono" />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <select value={it.gstRate} onChange={(e) => setItems(items.map((r, i) => (i === idx ? { ...r, gstRate: Number(e.target.value) } : r)))} className="rounded border border-slate-200 px-2 py-1 font-mono">
                        {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-semibold">{formatINR(it.totalAmount)}</td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" disabled={items.length <= 1} onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-600 disabled:opacity-30">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Freight / Additional Charges">
              <input type="number" min="0" value={shipping} onChange={(e) => setShipping(e.target.value)} className={`${inputClass} font-mono`} />
            </InputField>
            <InputField label="Payment Status">
              <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)} className={inputClass}>
                <option value="Unpaid">Credit (Unpaid)</option>
                <option value="Paid">Paid Immediately</option>
              </select>
            </InputField>
            {payStatus === 'Paid' && (
              <InputField label="Payment Method">
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                  {['NEFT', 'IMPS', 'UPI', 'Cheque', 'Cash'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </InputField>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span>Taxable Value</span><span className="font-mono">{formatINR(computed.taxableValue)}</span></div>
            <div className="flex justify-between"><span>{computed.isIntraState ? 'CGST + SGST (ITC)' : 'IGST (ITC)'}</span><span className="font-mono">{formatINR(computed.totalTax)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><span>Total Purchase Bill</span><span className="font-mono">{formatINR(computed.grandTotal)}</span></div>
            <div className="pt-3 flex justify-end gap-2">
              <button type="button" onClick={() => navigate('/purchases')} className={btnSecondary}>Cancel</button>
              <button type="submit" className={btnPrimary}><CheckCircle2 className="h-3.5 w-3.5" /> Save Purchase &amp; Update Stock</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export const PurchaseReturnsPage = () => {
  const { state, createPurchaseReturn, notify } = useApp();
  const [purchaseId, setPurchaseId] = useState(state.purchases[0]?.id || state.purchases[0]?._id || '');
  const [qtyMap, setQtyMap] = useState({});
  const [reason, setReason] = useState('Damaged stock returned to supplier');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!purchaseId && state.purchases?.length > 0) {
      setPurchaseId(state.purchases[0].id || state.purchases[0]._id);
    }
  }, [state.purchases, purchaseId]);

  const selectedPur = state.purchases.find((p) => (p.id || p._id) === purchaseId);

  const handleReturn = async (e) => {
    e.preventDefault();
    if (!selectedPur) return;
    const retItems = (selectedPur.items || [])
      .map((it) => {
        const pid = it.productId?._id || it.productId || it.id;
        return { ...it, productId: pid, qty: Number(qtyMap[pid] || 0) };
      })
      .filter((it) => it.qty > 0);
    if (!retItems.length) {
      notify('Enter return quantity for at least one item', 'error');
      return;
    }
    const calc = calculateInvoiceTotals({
      items: retItems,
      sellerState: selectedPur.supplierState,
      placeOfSupply: state.business.state,
    });
    setIsSubmitting(true);
    try {
      await createPurchaseReturn({
        date: new Date().toISOString().slice(0, 10),
        purchaseId: selectedPur._id || selectedPur.id,
        billNumber: selectedPur.billNumber,
        supplierId: selectedPur.supplierId,
        supplierName: selectedPur.supplierName,
        reason,
        ...calc,
      });
      setQtyMap({});
    } catch {
      // handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Returns (Debit Note to Supplier)"
        subtitle="Return defective goods to suppliers, reduce stock, and reverse ITC"
        breadcrumbs={['Purchases', 'Purchase Returns']}
      />
      <form onSubmit={handleReturn} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InputField label="Select Original Purchase Bill">
            <select value={purchaseId} onChange={(e) => { setPurchaseId(e.target.value); setQtyMap({}); }} className={inputClass}>
              {state.purchases.map((p) => (
                <option key={p.id || p._id} value={p.id || p._id}>{p.billNumber} — {p.supplierName} ({formatINR(p.grandTotal)})</option>
              ))}
            </select>
          </InputField>
          <InputField label="Return Reason">
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
          </InputField>
        </div>
        {selectedPur && (
          <table className="w-full text-left text-xs">
            <thead className="border-y border-slate-200 bg-slate-50">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Purchased Qty</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Return Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(selectedPur.items || []).map((it) => {
                const pid = it.productId?._id || it.productId || it.id;
                return (
                  <tr key={pid}>
                    <td className="px-3 py-2 font-medium">{it.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{it.qty}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatINR(it.rate)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max={it.qty}
                        value={qtyMap[pid] || 0}
                        onChange={(e) => setQtyMap({ ...qtyMap, [pid]: Math.min(it.qty, Number(e.target.value)) })}
                        className="w-24 rounded border border-slate-200 px-2 py-1 text-right font-mono"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting} className={`${btnPrimary} disabled:opacity-50`}>
            <RotateCcw className="h-3.5 w-3.5" /> {isSubmitting ? 'Recording...' : 'Record Purchase Return'}
          </button>
        </div>
      </form>

      <DataTable
        data={state.purchaseReturns}
        searchFields={['returnNumber', 'billNumber', 'supplierName']}
        columns={[
          { key: 'returnNumber', label: 'Return #', render: (r) => <span className="font-mono font-semibold">{r.returnNumber}</span> },
          { key: 'billNumber', label: 'Purchase Bill', render: (r) => <span className="font-mono text-xs">{r.billNumber}</span> },
          { key: 'supplierName', label: 'Supplier' },
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'reason', label: 'Reason' },
          { key: 'grandTotal', label: 'Return Value', align: 'right', render: (r) => formatINR(r.grandTotal) },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
        ]}
      />
    </div>
  );
};

export const GRNPage = () => {
  const { state, upsertRecord } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    poReference: `PO-26-${Math.floor(120 + Math.random() * 80)}`,
    supplierId: state.suppliers[0]?.id || state.suppliers[0]?._id || '',
    warehouseId: state.warehouses[0]?.id || state.warehouses[0]?._id || '',
    productId: state.products[0]?.id || state.products[0]?._id || '',
    orderedQty: 20,
    receivedQty: 18,
    damagedQty: 1,
    missingQty: 1,
    notes: '',
  });

  useEffect(() => {
    if (!form.supplierId && state.suppliers?.length > 0) {
      setForm((prev) => ({ ...prev, supplierId: state.suppliers[0].id || state.suppliers[0]._id }));
    }
    if (!form.productId && state.products?.length > 0) {
      setForm((prev) => ({ ...prev, productId: state.products[0].id || state.products[0]._id }));
    }
    if (!form.warehouseId && state.warehouses?.length > 0) {
      setForm((prev) => ({ ...prev, warehouseId: state.warehouses[0].id || state.warehouses[0]._id }));
    }
  }, [state.suppliers, state.products, state.warehouses, form.supplierId, form.productId, form.warehouseId]);

  const handleCreateGRN = async (e) => {
    e.preventDefault();
    const sup = state.suppliers.find((s) => (s.id || s._id) === form.supplierId);
    const prod = state.products.find((p) => (p.id || p._id) === form.productId);
    const wh = state.warehouses.find((w) => (w.id || w._id) === form.warehouseId) || state.warehouses[0];
    const warehouseId = wh?.id || wh?._id;
    const grnNumber = generateNextDocNumber('GRN/26-27/', state.grns, 'grnNumber');
    setIsSubmitting(true);
    try {
      await upsertRecord(
        'grns',
        {
          id: `grn-${Date.now()}`,
          grnNumber,
          date: new Date().toISOString().slice(0, 10),
          poReference: form.poReference,
          supplierId: sup?._id || sup?.id || form.supplierId,
          supplierName: sup?.name || '',
          warehouseId: String(warehouseId),
          items: [
            {
              productId: prod?._id || prod?.id || form.productId,
              productName: prod?.name,
              orderedQty: Number(form.orderedQty),
              receivedQty: Number(form.receivedQty),
              damagedQty: Number(form.damagedQty),
              missingQty: Number(form.missingQty),
            },
          ],
          status: 'Completed',
          notes: form.notes || 'Goods received and verified',
        },
        'GRN',
        'grnNumber'
      );
      setModalOpen(false);
    } catch {
      // Handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Goods Received Notes (GRN)"
        subtitle="Inspect inbound shipments, log damaged/missing counts, and update godown stock"
        breadcrumbs={['Purchases', 'Goods Received Notes']}
        actions={
          <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
            <PackageCheck className="h-3.5 w-3.5" /> Record GRN
          </button>
        }
      />

      <DataTable
        data={state.grns}
        searchFields={['grnNumber', 'poReference', 'supplierName']}
        columns={[
          { key: 'grnNumber', label: 'GRN #', render: (r) => <span className="font-mono font-semibold">{r.grnNumber}</span> },
          { key: 'poReference', label: 'PO Ref', render: (r) => <span className="font-mono text-xs">{r.poReference}</span> },
          { key: 'supplierName', label: 'Supplier' },
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          {
            key: 'qty',
            label: 'Rcvd / Dmg / Miss',
            render: (r) => {
              const it = r.items?.[0] || {};
              return <span className="font-mono text-xs">{it.receivedQty || 0} / {it.damagedQty || 0} / {it.missingQty || 0}</span>;
            },
          },
          { key: 'notes', label: 'Notes' },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Goods Received Note (GRN)"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="grn-form" disabled={isSubmitting} className={`${btnPrimary} disabled:opacity-50`}>
              {isSubmitting ? 'Saving...' : 'Save GRN & Update Stock'}
            </button>
          </>
        }
      >
        <form id="grn-form" onSubmit={handleCreateGRN} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="PO Reference" required>
              <input type="text" value={form.poReference} onChange={(e) => setForm({ ...form, poReference: e.target.value })} className={inputClass} />
            </InputField>
            <InputField label="Supplier" required>
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={inputClass}>
                {state.suppliers.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>)}
              </select>
            </InputField>
            <InputField label="Product" required>
              <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className={inputClass}>
                {state.products.map((p) => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
              </select>
            </InputField>
            <InputField label="Warehouse">
              <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className={inputClass}>
                {state.warehouses.map((w) => <option key={w.id || w._id} value={w.id || w._id}>{w.name}</option>)}
              </select>
            </InputField>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <InputField label="Ordered"><input type="number" value={form.orderedQty} onChange={(e) => setForm({ ...form, orderedQty: e.target.value })} className={inputClass} /></InputField>
            <InputField label="Received"><input type="number" value={form.receivedQty} onChange={(e) => setForm({ ...form, receivedQty: e.target.value })} className={inputClass} /></InputField>
            <InputField label="Damaged"><input type="number" value={form.damagedQty} onChange={(e) => setForm({ ...form, damagedQty: e.target.value })} className={inputClass} /></InputField>
            <InputField label="Missing"><input type="number" value={form.missingQty} onChange={(e) => setForm({ ...form, missingQty: e.target.value })} className={inputClass} /></InputField>
          </div>
          <InputField label="Inspection Notes">
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
          </InputField>
        </form>
      </Modal>
    </div>
  );
};

export const PurchasePaymentsPage = () => <PurchasesPage defaultTab="payments" />;
