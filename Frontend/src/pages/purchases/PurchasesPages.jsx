import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Eye, IndianRupee, CheckCircle2, RotateCcw, PackageCheck, Loader2, PackagePlus, ShieldAlert, PenSquare, ListFilter, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GST_RATES, PAYMENT_METHODS } from '../../data/constants';
import { calculateInvoiceTotals, formatINR, formatDateIN, formatNumberIN } from '../../services/calculationService';
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
  const { state, recordPayment, canAccess } = useApp();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(defaultTab);
  const canEdit = canAccess ? canAccess('purchases', 'edit') : true;

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
            {canEdit ? (
              <button type="button" onClick={() => navigate('/purchases/new')} className={btnPrimary}>
                <Plus className="h-3.5 w-3.5" />
                Add Purchase
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
          activeTab={viewMode}
          onChange={setViewMode}
          tabs={[
            { id: 'bills', label: 'Purchase Bills', count: state.purchases.length },
            { id: 'payments', label: 'Payables & Payments', count: pendingBills.length },
          ]}
        />
        {viewMode === 'bills' ? (
          <SegmentedTabs activeTab={statusFilter} onChange={setStatusFilter} tabs={['All', 'Paid', 'Partial', 'Unpaid']} />
        ) : canEdit ? (
          <button type="button" onClick={() => navigate('/payments/out')} className={btnSecondary}>
            <IndianRupee className="h-3.5 w-3.5" /> Record Payment Out
          </button>
        ) : null}
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
                {(viewPurchase.items || []).map((it, idx) => {
                  const itemRate = it.rate !== undefined ? it.rate : (it.unitPrice || 0);
                  const itemQty = it.qty !== undefined ? it.qty : (it.quantity || 1);
                  const itemTax = it.totalTax !== undefined ? it.totalTax : ((it.cgstAmount || 0) + (it.sgstAmount || 0) + (it.igstAmount || 0) + (it.cessAmount || 0));
                  const itemTotal = it.totalAmount !== undefined ? it.totalAmount : ((it.taxableValue || (itemRate * itemQty)) + itemTax);
                  return (
                    <tr key={idx}>
                      <td className="px-2 py-2">
                        <div className="font-medium text-slate-900">{it.name || it.productName}</div>
                        {(it.description || it.brand) && (
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            {[it.brand, it.description].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono">{it.hsn || it.HSN || '-'}</td>
                      <td className="px-2 py-2 text-right font-mono">{itemQty}</td>
                      <td className="px-2 py-2 text-right font-mono">{formatINR(itemRate)}</td>
                      <td className="px-2 py-2 text-right font-mono">{formatINR(itemTax)}</td>
                      <td className="px-2 py-2 text-right font-mono font-semibold">{formatINR(itemTotal)}</td>
                    </tr>
                  );
                })}
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
  const { state, selectedFY, savePurchaseBill, upsertRecord, notify, canAccess } = useApp();
  const navigate = useNavigate();
  const canEdit = canAccess ? canAccess('purchases', 'edit') : true;

  const [supplierId, setSupplierId] = useState(state.suppliers[0]?.id || state.suppliers[0]?._id || '');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState(`SUP/${Math.floor(100 + Math.random() * 900)}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [shipping, setShipping] = useState(0);
  const [payStatus, setPayStatus] = useState('Unpaid');
  const [paymentMethod, setPaymentMethod] = useState('NEFT');
  const [isSaving, setIsSaving] = useState(false);

  // Quick Product Modal State
  const [quickProdModal, setQuickProdModal] = useState(false);
  const [quickProdForm, setQuickProdForm] = useState({
    name: '',
    sku: '',
    hsn: '8536',
    purchasePrice: '',
    sellingPrice: '',
    gstRate: 18,
  });
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  const openQuickAddProduct = () => {
    setQuickProdForm({
      name: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      hsn: '8536',
      purchasePrice: '',
      sellingPrice: '',
      gstRate: 18,
    });
    setQuickProdModal(true);
  };

  const handleSaveQuickProduct = async (e) => {
    e.preventDefault();
    if (!quickProdForm.name.trim()) {
      notify('Product name is required', 'error');
      return;
    }
    setIsCreatingProduct(true);
    try {
      const cleanSKU = quickProdForm.sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
      const pPrice = Number(quickProdForm.purchasePrice) || 0;
      const sPrice = Number(quickProdForm.sellingPrice) || pPrice || 0;
      const cleanHSN = quickProdForm.hsn.trim() || '8536';
      const gRate = Number(quickProdForm.gstRate) || 18;

      const created = await upsertRecord(
        'products',
        {
          name: quickProdForm.name.trim(),
          sku: cleanSKU,
          SKU: cleanSKU,
          hsn: cleanHSN,
          HSN: cleanHSN,
          purchasePrice: pPrice,
          sellingPrice: sPrice,
          mrp: sPrice,
          gstRate: gRate,
          stock: 0,
          openingStock: 0,
        },
        'Product'
      );

      if (created) {
        const newId = created.id || created._id;
        setItems((prev) => [
          ...prev,
          {
            productId: newId,
            name: created.name,
            sku: created.sku || cleanSKU,
            hsn: created.hsn || cleanHSN,
            unit: created.unit || 'PCS',
            qty: 1,
            rate: pPrice,
            discountPct: 0,
            gstRate: gRate,
            description: '',
          },
        ]);
        setQuickProdModal(false);
        notify(`Product '${created.name}' created and added to purchase entry`);
      }
    } catch (err) {
      notify(err.message || 'Failed to create product', 'error');
    } finally {
      setIsCreatingProduct(false);
    }
  };

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
    if (!canEdit) {
      notify('Permission Denied: Your account only has read-only permission for Purchases.', 'error');
      return;
    }
    if (!supplier || !supplierInvoiceNo.trim()) {
      notify('Supplier and Supplier Invoice Number are required', 'error');
      return;
    }
    for (const it of items) {
      if (it.isManual && (!it.name || !it.name.trim())) {
        notify('Please enter a product name for the manually added product row', 'error');
        return;
      }
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
      {isSaving && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 text-xs text-indigo-950 shadow-sm flex items-center gap-3 animate-pulse">
          <Loader2 className="h-5 w-5 text-indigo-600 animate-spin shrink-0" />
          <div>
            <div className="font-semibold text-sm text-indigo-900">Saving Purchase &amp; Updating Inventory Stock...</div>
            <p className="mt-0.5 text-indigo-700">
              Recording purchase bill, allocating product variants, and synchronizing warehouse stock. Please wait a moment.
            </p>
          </div>
        </div>
      )}
      {!canEdit && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm text-amber-950">Read-Only Mode: Purchase Bill Creation Disabled</div>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              Your account permissions for Purchases are set to <strong>Read-Only</strong>. You can inspect invoice entries, but you cannot record new purchases or alter product stock.
            </p>
          </div>
        </div>
      )}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-4">
          <InputField label="Supplier" required>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass} disabled={!canEdit}>
              {state.suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
              ))}
            </select>
          </InputField>
          <InputField label="Supplier Invoice No." required>
            <input type="text" value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} className={`${inputClass} font-mono`} disabled={!canEdit} />
          </InputField>
          <InputField label="Invoice Date" required>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} disabled={!canEdit} />
          </InputField>
          <InputField label="Due Date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} disabled={!canEdit} />
          </InputField>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">Purchased Products</h3>
              <p className="text-[11px] text-slate-500">Select an existing product or add a new variant/model with its own SKU</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openQuickAddProduct}
                disabled={!canEdit}
                className={`inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50/70 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-100'}`}
                title={canEdit ? 'Create a new product with its own name and SKU' : 'Disabled in read-only mode'}
              >
                <PackagePlus className="h-3.5 w-3.5 text-indigo-600" /> + New Product
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  const p = state.products[0];
                  setItems([...items, { productId: p?.id || p?._id, name: p?.name, sku: p?.sku, hsn: p?.hsn, unit: p?.unit, qty: 10, rate: p?.purchasePrice || 0, discountPct: 0, gstRate: p?.gstRate || 18, description: '' }]);
                }}
                className={`${btnSecondary} ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left w-64">Product &amp; Description</th>
                  <th className="px-2 py-2 text-left w-24">HSN</th>
                  <th className="px-2 py-2 text-right w-20">Qty</th>
                  <th className="px-2 py-2 text-right w-24">Purchase Rate</th>
                  <th className="px-2 py-2 text-right w-20">Disc%</th>
                  <th className="px-2 py-2 text-right w-20">GST%</th>
                  <th className="px-2 py-2 text-right w-28">Total</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computed.items.map((it, idx) => (
                  <tr key={idx} className="align-top">
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          {it.isManual ? '✏️ Custom Product Name' : 'Product'}
                        </span>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => {
                            setItems(items.map((r, i) => {
                              if (i !== idx) return r;
                              const nextManual = !r.isManual;
                              const fallbackProd = state.products[0];
                              return {
                                ...r,
                                isManual: nextManual,
                                productId: nextManual ? '__manual__' : (fallbackProd?.id || fallbackProd?._id),
                                name: nextManual ? (r.name && r.name !== fallbackProd?.name ? r.name : '') : (fallbackProd?.name || ''),
                                sku: nextManual ? '' : (fallbackProd?.sku || fallbackProd?.SKU || ''),
                                hsn: nextManual ? (r.hsn || '8536') : (fallbackProd?.hsn || fallbackProd?.HSN || ''),
                                unit: nextManual ? (r.unit || 'PCS') : (fallbackProd?.unit || 'PCS'),
                                rate: nextManual ? (r.rate || 0) : (fallbackProd?.purchasePrice || 0),
                                gstRate: nextManual ? (r.gstRate || 18) : (fallbackProd?.gstRate || 18),
                              };
                            }));
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                          title={it.isManual ? 'Switch back to catalog dropdown' : 'Type a new product name manually'}
                        >
                          {it.isManual ? (
                            <>
                              <ListFilter className="h-3 w-3" /> Select from Dropdown
                            </>
                          ) : (
                            <>
                              <PenSquare className="h-3 w-3" /> + Type Manually
                            </>
                          )}
                        </button>
                      </div>

                      {it.isManual ? (
                        <div>
                          <input
                            type="text"
                            required
                            placeholder="Type new product name (e.g. Microwave Oven)..."
                            value={it.name || ''}
                            onChange={(e) => setItems(items.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))}
                            className="w-full rounded border border-indigo-300 bg-indigo-50/50 px-2 py-1.5 text-xs font-semibold text-indigo-950 placeholder:text-indigo-400 focus:border-indigo-600 focus:bg-white focus:outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-1 text-[9.5px] text-indigo-700 font-medium mt-0.5">
                            <Sparkles className="h-2.5 w-2.5" /> Auto-creates as a new product in your catalog
                          </div>
                        </div>
                      ) : (
                        <select
                          value={it.productId}
                          onChange={(e) => {
                            if (e.target.value === '__manual__') {
                              setItems(items.map((r, i) => (i === idx ? { ...r, isManual: true, productId: '__manual__', name: '' } : r)));
                              return;
                            }
                            const p = state.products.find((pr) => (pr.id || pr._id) === e.target.value);
                            if (!p) return;
                            setItems(items.map((r, i) => (i === idx ? { ...r, isManual: false, productId: p.id || p._id, name: p.name, sku: p.sku || p.SKU, hsn: p.hsn || p.HSN, unit: p.unit, rate: p.purchasePrice, gstRate: p.gstRate } : r)));
                          }}
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="__manual__">➕ Type New Product Manually...</option>
                          <optgroup label="Catalog Products &amp; Variants">
                            {state.products.map((p) => {
                              const descOrBrand = [p.brand, p.description].filter(Boolean).join(' • ');
                              return (
                                <option key={p.id || p._id} value={p.id || p._id}>
                                  {p.name}{descOrBrand ? ` (${descOrBrand})` : ''} ({p.sku || p.SKU || 'No SKU'}) — Stock: {p.stock || 0} {p.unit || 'PCS'}
                                </option>
                              );
                            })}
                          </optgroup>
                        </select>
                      )}

                      <input
                        type="text"
                        placeholder="Brand / Description / Model / Batch No. (e.g. LG 7kg)"
                        value={it.description || ''}
                        onChange={(e) => setItems(items.map((r, i) => (i === idx ? { ...r, description: e.target.value, createAsVariant: Boolean(e.target.value.trim()) } : r)))}
                        className="mt-1.5 w-full rounded border border-slate-200 bg-slate-50/70 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
                      />
                      {Boolean(it.description && it.description.trim()) && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                          <span>✨ Tracked as separate variant in inventory ({it.description.trim()})</span>
                        </div>
                      )}
                      {(() => {
                        const prod = state.products.find((pr) => (pr.id || pr._id) === it.productId);
                        const rateDiffers = prod && prod.purchasePrice !== undefined && Number(it.rate) > 0 && Number(it.rate) !== Number(prod.purchasePrice);
                        return (
                          <div className="mt-1 space-y-1">
                            {rateDiffers && !it.description && (
                              <div className="flex flex-wrap items-center gap-1.5 rounded bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800 border border-amber-200">
                                <span>Rate differs from base cost (₹{formatNumberIN(prod.purchasePrice)}).</span>
                                <label className="inline-flex items-center gap-1 font-semibold text-indigo-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(it.trackAsVariant)}
                                    onChange={(e) => setItems(items.map((r, i) => (i === idx ? { ...r, trackAsVariant: e.target.checked } : r)))}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                                  />
                                  <span>Track as new variant</span>
                                </label>
                              </div>
                            )}
                            {it.trackAsVariant && !it.description && (
                              <input
                                type="text"
                                placeholder={`Variant / Brand Name (e.g. ${it.name || 'Product'} 55 Inch 4K)`}
                                value={it.variantName || ''}
                                onChange={(e) => setItems(items.map((r, i) => (i === idx ? { ...r, variantName: e.target.value } : r)))}
                                className="w-full rounded border border-indigo-200 bg-indigo-50/50 px-2 py-1 text-[11px] text-indigo-900 placeholder:text-indigo-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
                              />
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={it.hsn || ''}
                        onChange={(e) => setItems(items.map((r, i) => (i === idx ? { ...r, hsn: e.target.value } : r)))}
                        placeholder="HSN"
                        className="w-24 rounded border border-slate-200 px-2 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
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
              <button type="button" disabled={isSaving} onClick={() => navigate('/purchases')} className={btnSecondary}>Cancel</button>
              <button
                type="submit"
                disabled={isSaving || !canEdit}
                title={!canEdit ? 'Read-only access: Editing restricted' : ''}
                className={`${btnPrimary} ${(!canEdit || isSaving) ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {!canEdit ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5" /> Read-Only (Creation Disabled)
                  </>
                ) : isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving &amp; Updating Stock...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Save Purchase &amp; Update Stock
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Quick Add Product Modal */}
      <Modal
        open={quickProdModal}
        onClose={() => setQuickProdModal(false)}
        title="Quick Add Product / Model"
        size="md"
      >
        <form onSubmit={handleSaveQuickProduct} className="space-y-4">
          <p className="text-xs text-slate-500">
            Create a distinct product record with its own name and SKU so stock and pricing are tracked separately.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="sm:col-span-2">
              <InputField label="Product Name" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. TV 55 Inch 4K Smart LED"
                  value={quickProdForm.name}
                  onChange={(e) => setQuickProdForm({ ...quickProdForm, name: e.target.value })}
                  className={inputClass}
                />
              </InputField>
            </div>
            <InputField label="SKU">
              <input
                type="text"
                value={quickProdForm.sku}
                onChange={(e) => setQuickProdForm({ ...quickProdForm, sku: e.target.value })}
                className={`${inputClass} font-mono`}
                placeholder="Auto-generated if blank"
              />
            </InputField>
            <InputField label="HSN Code">
              <input
                type="text"
                value={quickProdForm.hsn}
                onChange={(e) => setQuickProdForm({ ...quickProdForm, hsn: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </InputField>
            <InputField label="Purchase Rate (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={quickProdForm.purchasePrice}
                onChange={(e) => setQuickProdForm({ ...quickProdForm, purchasePrice: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </InputField>
            <InputField label="Selling Price (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={quickProdForm.sellingPrice}
                onChange={(e) => setQuickProdForm({ ...quickProdForm, sellingPrice: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </InputField>
            <div className="sm:col-span-2">
              <InputField label="GST Rate">
                <select
                  value={quickProdForm.gstRate}
                  onChange={(e) => setQuickProdForm({ ...quickProdForm, gstRate: Number(e.target.value) })}
                  className={inputClass}
                >
                  {GST_RATES.map((g) => (
                    <option key={g} value={g}>{g}%</option>
                  ))}
                </select>
              </InputField>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setQuickProdModal(false)} className={btnSecondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingProduct}
              className={`${btnPrimary} ${isCreatingProduct ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isCreatingProduct ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...
                </>
              ) : (
                'Create & Add to Purchase'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const PurchaseReturnsPage = () => {
  const { state, createPurchaseReturn, notify, canAccess } = useApp();
  const canEdit = canAccess ? canAccess('purchases', 'edit') : true;
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
    if (!canEdit) {
      notify('Permission Denied: Your account only has read-only permission for Purchases.', 'error');
      return;
    }
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
      {!canEdit && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm text-amber-950">Read-Only Mode: Purchase Returns Disabled</div>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              Your account permissions for Purchases are set to <strong>Read-Only</strong>. Debit note generation is restricted.
            </p>
          </div>
        </div>
      )}
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
          <button
            type="submit"
            disabled={isSubmitting || !canEdit}
            title={!canEdit ? 'Read-only access: Editing restricted' : ''}
            className={`${btnPrimary} ${(!canEdit || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RotateCcw className="h-3.5 w-3.5" /> {!canEdit ? 'Read-Only (Return Disabled)' : isSubmitting ? 'Recording...' : 'Record Purchase Return'}
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
  const { state, upsertRecord, notify, canAccess } = useApp();
  const canEdit = canAccess ? canAccess('purchases', 'edit') : true;
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
    if (!canEdit) {
      notify('Permission Denied: Your account only has read-only permission for Purchases.', 'error');
      return;
    }
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
          canEdit ? (
            <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
              <PackageCheck className="h-3.5 w-3.5" /> Record GRN
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Read-Only View
            </div>
          )
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
