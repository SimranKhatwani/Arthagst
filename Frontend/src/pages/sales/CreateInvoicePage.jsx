import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Eye, Printer, Save, CheckCircle2, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { INDIAN_STATES, GST_RATES, PAYMENT_METHODS, REGISTRATION_TYPES } from '../../data/constants';
import { calculateInvoiceTotals, formatINR } from '../../services/calculationService';
import { generateNextDocNumber } from '../../services/invoiceService';
import {
  PageHeader,
  Modal,
  InputField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';
import { TaxInvoicePreview } from '../../components/invoice/TaxInvoicePreview';

export const CreateInvoicePage = () => {
  const { state, selectedFY, saveSalesInvoice, upsertRecord, notify } = useApp();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get('duplicate');
  const fromQuoteId = searchParams.get('fromQuote');

  const existingDraft = useMemo(() => {
    if (editId) return state.invoices.find((i) => i.id === editId);
    if (duplicateId) return state.invoices.find((i) => i.id === duplicateId);
    if (fromQuoteId) return state.quotations.find((q) => q.id === fromQuoteId);
    return null;
  }, [editId, duplicateId, fromQuoteId, state.invoices, state.quotations]);

  const defaultCustomer = state.customers[0];

  const [customerId, setCustomerId] = useState(existingDraft?.customerId || defaultCustomer?.id || '');
  const [placeOfSupply, setPlaceOfSupply] = useState(
    existingDraft?.placeOfSupply || defaultCustomer?.state || state.business.state
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    editId && existingDraft?.invoiceNumber
      ? existingDraft.invoiceNumber
      : generateNextDocNumber(state.settings.invoice.prefix, state.invoices, 'invoiceNumber')
  );
  const [invoiceDate, setInvoiceDate] = useState(
    editId ? existingDraft?.date : new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(() => {
    if (editId && existingDraft?.dueDate) return existingDraft.dueDate;
    const d = new Date();
    d.setDate(d.getDate() + (state.settings.invoice.defaultDueDays || 15));
    return d.toISOString().slice(0, 10);
  });
  const [invoiceType, setInvoiceType] = useState(existingDraft?.invoiceType || 'Tax Invoice');
  const [priceInclusive, setPriceInclusive] = useState(
    state.settings.gst.priceInclusiveDefault || false
  );
  const [roundOffEnabled, setRoundOffEnabled] = useState(
    state.settings.invoice.roundOffEnabled ?? true
  );
  const [shipping, setShipping] = useState(existingDraft?.shipping || 0);
  const [otherCharges, setOtherCharges] = useState(existingDraft?.otherCharges || 0);
  const [notes, setNotes] = useState(existingDraft?.notes || 'Thank you for your business.');

  const [lineItems, setLineItems] = useState(() => {
    if (existingDraft?.items?.length) {
      return existingDraft.items.map((it) => ({ ...it }));
    }
    const p = state.products[0];
    return [
      {
        productId: p?.id || '',
        name: p?.name || '',
        sku: p?.sku || '',
        hsn: p?.hsn || '',
        unit: p?.unit || 'PCS',
        qty: 1,
        rate: p?.sellingPrice || 0,
        discountPct: 0,
        gstRate: p?.gstRate || 18,
        cessRate: p?.cessRate || 0,
      },
    ];
  });

  // Payment Section
  const [paymentMode, setPaymentMode] = useState('Credit'); // 'Credit' | 'Full' | 'Partial' | 'Split'
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentRef, setPaymentRef] = useState('');
  const [splitEntries, setSplitEntries] = useState([
    { method: 'Cash', amount: 0 },
    { method: 'UPI', amount: 0 },
  ]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [newCust, setNewCust] = useState({
    name: '',
    mobile: '',
    email: '',
    gstin: '',
    registrationType: 'Regular',
    state: 'Rajasthan',
    billingAddress: '',
  });

  const selectedCustomer = useMemo(
    () => state.customers.find((c) => c.id === customerId) || defaultCustomer,
    [customerId, state.customers, defaultCustomer]
  );

  useEffect(() => {
    if (selectedCustomer && !existingDraft) {
      setPlaceOfSupply(selectedCustomer.state || state.business.state);
    }
  }, [selectedCustomer, existingDraft, state.business.state]);

  const computed = useMemo(
    () =>
      calculateInvoiceTotals({
        items: lineItems,
        sellerState: state.business.state,
        placeOfSupply,
        shipping,
        otherCharges,
        roundOffEnabled,
        priceInclusive,
      }),
    [lineItems, state.business.state, placeOfSupply, shipping, otherCharges, roundOffEnabled, priceInclusive]
  );

  const handleProductChange = (idx, productId) => {
    const prod = state.products.find((p) => p.id === productId);
    if (!prod) return;
    setLineItems((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              productId: prod.id,
              name: prod.name,
              sku: prod.sku,
              hsn: prod.hsn,
              unit: prod.unit,
              rate: prod.sellingPrice,
              gstRate: prod.gstRate,
              cessRate: prod.cessRate || 0,
            }
          : row
      )
    );
  };

  const updateLine = (idx, field, val) => {
    setLineItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const addLine = () => {
    const p = state.products[0];
    setLineItems((prev) => [
      ...prev,
      {
        productId: p?.id || '',
        name: p?.name || '',
        sku: p?.sku || '',
        hsn: p?.hsn || '',
        unit: p?.unit || 'PCS',
        qty: 1,
        rate: p?.sellingPrice || 0,
        discountPct: 0,
        gstRate: p?.gstRate || 18,
        cessRate: p?.cessRate || 0,
      },
    ]);
  };

  const removeLine = (idx) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildPayload = (status) => ({
    id: editId || undefined,
    invoiceNumber,
    date: invoiceDate,
    dueDate,
    financialYear: selectedFY,
    invoiceType,
    customerId: selectedCustomer?.id,
    customerName: selectedCustomer?.name,
    customerGstin: selectedCustomer?.gstin || '',
    customerState: selectedCustomer?.state || placeOfSupply,
    placeOfSupply,
    registrationType: selectedCustomer?.registrationType || 'Regular',
    billingAddress: selectedCustomer?.billingAddress || '',
    shippingAddress: selectedCustomer?.shippingAddress || selectedCustomer?.billingAddress || '',
    paymentMethod: paymentMode === 'Credit' ? 'Credit' : paymentMethod,
    status,
    notes,
    ...computed,
  });

  const handleSave = (status, shouldPrint = false) => {
    if (!selectedCustomer) {
      notify('Select a customer first', 'error');
      return;
    }
    if (!lineItems.some((l) => l.name && Number(l.qty) > 0)) {
      notify('Add at least one product line item with quantity > 0', 'error');
      return;
    }

    let payDetail = null;
    if (status === 'Finalized' && paymentMode !== 'Credit') {
      if (paymentMode === 'Split') {
        payDetail = splitEntries
          .filter((e) => Number(e.amount) > 0)
          .map((e, i) => ({
            amount: Number(e.amount),
            method: e.method,
            referenceNo: paymentRef ? `${paymentRef}-${i + 1}` : `INV-${invoiceNumber.slice(-3)}-${i + 1}`,
          }));
      } else {
        const amt =
          paymentMode === 'Full'
            ? computed.grandTotal
            : Math.min(computed.grandTotal, Number(paidAmount) || 0);
        if (amt > 0) {
          payDetail = {
            amount: amt,
            method: paymentMethod,
            referenceNo: paymentRef || `INV-${invoiceNumber.slice(-3)}`,
          };
        }
      }
    }

    const payload = buildPayload(status);
    saveSalesInvoice(payload, payDetail);
    if (shouldPrint) {
      setPreviewOpen(true);
    } else {
      navigate('/sales/invoices');
    }
  };

  const handleQuickAddCustomer = (e) => {
    e.preventDefault();
    if (!newCust.name.trim() || !newCust.mobile.trim()) {
      notify('Customer name and mobile are required', 'error');
      return;
    }
    const created = {
      id: `cust-${Date.now()}`,
      ...newCust,
      businessName: newCust.name,
      shippingAddress: newCust.billingAddress,
      openingBalance: 0,
      creditLimit: 100000,
      paymentTerms: 'Net 15',
      status: 'Active',
    };
    upsertRecord('customers', created, 'Customer', 'name');
    setCustomerId(created.id);
    setPlaceOfSupply(created.state);
    setCustModalOpen(false);
    setNewCust({
      name: '',
      mobile: '',
      email: '',
      gstin: '',
      registrationType: 'Regular',
      state: 'Rajasthan',
      billingAddress: '',
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={editId ? `Edit Draft — ${invoiceNumber}` : 'Create GST Tax Invoice'}
        subtitle="Live CGST/SGST & IGST calculation based on Place of Supply"
        breadcrumbs={['Sales', 'Invoices', editId ? 'Edit Draft' : 'Create']}
        actions={
          <>
            <button type="button" onClick={() => setPreviewOpen(true)} className={btnSecondary}>
              <Eye className="h-3.5 w-3.5" />
              Preview Invoice
            </button>
            <button type="button" onClick={() => handleSave('Draft')} className={btnSecondary}>
              <Save className="h-3.5 w-3.5" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave('Finalized', false)}
              className={btnPrimary}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Generate Invoice
            </button>
          </>
        }
      />

      {/* Section 1 & 2: Customer + Invoice Details */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              1. Customer &amp; Place of Supply
            </h2>
            <button
              type="button"
              onClick={() => setCustModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              <UserPlus className="h-3.5 w-3.5" />
              New Customer
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField label="Select Customer" required>
              <select
                value={customerId}
                onChange={(e) => {
                  const c = state.customers.find((cu) => cu.id === e.target.value);
                  setCustomerId(e.target.value);
                  if (c) setPlaceOfSupply(c.state);
                }}
                className={inputClass}
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.state})
                  </option>
                ))}
              </select>
            </InputField>
            <InputField label="Place of Supply (State)">
              <select
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                className={inputClass}
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </InputField>
          </div>
          {selectedCustomer && (
            <div className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 sm:grid-cols-2">
              <div>
                <span className="font-medium text-slate-800">GSTIN:</span>{' '}
                <span className="font-mono">{selectedCustomer.gstin || 'Unregistered'}</span>
              </div>
              <div>
                <span className="font-medium text-slate-800">Reg Type:</span>{' '}
                {selectedCustomer.registrationType}
              </div>
              <div className="sm:col-span-2">
                <span className="font-medium text-slate-800">Billing Address:</span>{' '}
                {selectedCustomer.billingAddress}
              </div>
              <div className="sm:col-span-2 font-medium text-indigo-700">
                Tax Treatment:{' '}
                {computed.isIntraState
                  ? `Intra-State (${state.business.state} → ${placeOfSupply}) · CGST + SGST`
                  : `Inter-State (${state.business.state} → ${placeOfSupply}) · IGST`}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-900">2. Invoice Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Invoice Number" required>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </InputField>
            <InputField label="Invoice Type">
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                className={inputClass}
              >
                <option value="Tax Invoice">Tax Invoice</option>
                <option value="Bill of Supply">Bill of Supply</option>
                <option value="Export Invoice">Export Invoice</option>
              </select>
            </InputField>
            <InputField label="Invoice Date" required>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className={inputClass}
              />
            </InputField>
            <InputField label="Due Date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </InputField>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-700">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={priceInclusive}
                onChange={(e) => setPriceInclusive(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Tax-Inclusive Rates
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={roundOffEnabled}
                onChange={(e) => setRoundOffEnabled(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Auto Round-Off
            </label>
          </div>
        </div>
      </div>

      {/* Section 3: Line Items */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            3. Product &amp; Service Line Items
          </h2>
          <button type="button" onClick={addLine} className={btnSecondary}>
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-xs">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-2 py-2 text-left w-64">Product</th>
                <th className="px-2 py-2 text-left w-24">HSN/SAC</th>
                <th className="px-2 py-2 text-right w-20">Qty</th>
                <th className="px-2 py-2 text-right w-24">Rate (₹)</th>
                <th className="px-2 py-2 text-right w-20">Disc %</th>
                <th className="px-2 py-2 text-right w-20">GST %</th>
                <th className="px-2 py-2 text-right w-24">Taxable</th>
                <th className="px-2 py-2 text-right w-24">
                  {computed.isIntraState ? 'CGST+SGST' : 'IGST'}
                </th>
                <th className="px-2 py-2 text-right w-28">Line Total</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {computed.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-2">
                    <select
                      value={item.productId}
                      onChange={(e) => handleProductChange(idx, e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900"
                    >
                      {state.products
                        .filter((p) => !p.archived)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.stock})
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={item.hsn}
                      onChange={(e) => updateLine(idx, 'hsn', e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-right font-mono text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-right font-mono text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={item.discountPct}
                      onChange={(e) => updateLine(idx, 'discountPct', e.target.value)}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-right font-mono text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={item.gstRate}
                      onChange={(e) => updateLine(idx, 'gstRate', Number(e.target.value))}
                      className="w-full rounded border border-slate-200 px-2 py-1.5 text-right font-mono text-xs"
                    >
                      {GST_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-700">
                    {formatINR(item.taxableAmount)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-600">
                    {formatINR(item.cgst + item.sgst + item.igst)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {formatINR(item.totalAmount)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      disabled={lineItems.length <= 1}
                      onClick={() => removeLine(idx)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4 & 5: Payment + Calculations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7 space-y-4">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            4. Payment &amp; Notes
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { id: 'Credit', label: 'Credit (Unpaid)' },
              { id: 'Full', label: 'Paid in Full' },
              { id: 'Partial', label: 'Partial Payment' },
              { id: 'Split', label: 'Split Methods' },
            ].map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => setPaymentMode(pm.id)}
                className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  paymentMode === pm.id
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>

          {(paymentMode === 'Full' || paymentMode === 'Partial') && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <InputField label="Payment Method">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={inputClass}
                >
                  {PAYMENT_METHODS.filter((m) => m !== 'Credit').map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </InputField>
              {paymentMode === 'Partial' && (
                <InputField label="Amount Paid Now (₹)">
                  <input
                    type="number"
                    min="0"
                    max={computed.grandTotal}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className={inputClass}
                  />
                </InputField>
              )}
              <InputField label="Reference / UTR">
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Optional UTR / Cheque No"
                  className={inputClass}
                />
              </InputField>
            </div>
          )}

          {paymentMode === 'Split' && (
            <div className="grid grid-cols-2 gap-3">
              {splitEntries.map((sp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={sp.method}
                    onChange={(e) =>
                      setSplitEntries((prev) =>
                        prev.map((row, idx) => (idx === i ? { ...row, method: e.target.value } : row))
                      )
                    }
                    className="rounded border border-slate-200 px-2 py-1.5 text-xs"
                  >
                    {['Cash', 'UPI', 'Card', 'NEFT'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={sp.amount}
                    onChange={(e) =>
                      setSplitEntries((prev) =>
                        prev.map((row, idx) => (idx === i ? { ...row, amount: e.target.value } : row))
                      )
                    }
                    className={`${inputClass} font-mono`}
                    placeholder="Amount"
                  />
                </div>
              ))}
            </div>
          )}

          <InputField label="Invoice Notes / Remarks">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </InputField>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5 space-y-2.5 text-xs">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            5. Tax &amp; Invoice Totals
          </h2>
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{formatINR(computed.subtotal)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Total Discount</span>
            <span className="font-mono tabular-nums">- {formatINR(computed.totalDiscount)}</span>
          </div>
          <div className="flex justify-between font-medium text-slate-800 border-t border-slate-100 pt-2">
            <span>Taxable Value</span>
            <span className="font-mono tabular-nums">{formatINR(computed.taxableValue)}</span>
          </div>
          {computed.isIntraState ? (
            <>
              <div className="flex justify-between text-slate-600">
                <span>CGST</span>
                <span className="font-mono tabular-nums">{formatINR(computed.cgst)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST / UTGST</span>
                <span className="font-mono tabular-nums">{formatINR(computed.sgst)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-slate-600">
              <span>IGST</span>
              <span className="font-mono tabular-nums">{formatINR(computed.igst)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <InputField label="Shipping (₹)">
              <input
                type="number"
                min="0"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                className={`${inputClass} font-mono text-right`}
              />
            </InputField>
            <InputField label="Other Charges (₹)">
              <input
                type="number"
                min="0"
                value={otherCharges}
                onChange={(e) => setOtherCharges(e.target.value)}
                className={`${inputClass} font-mono text-right`}
              />
            </InputField>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Round Off</span>
            <span className="font-mono tabular-nums">{formatINR(computed.roundOff)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
            <span>Grand Total</span>
            <span className="font-mono tabular-nums">{formatINR(computed.grandTotal)}</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-3">
            <button
              type="button"
              onClick={() => handleSave('Finalized', true)}
              className={`${btnSecondary} flex-1`}
            >
              <Printer className="h-3.5 w-3.5" />
              Generate &amp; Print
            </button>
            <button
              type="button"
              onClick={() => handleSave('Finalized', false)}
              className={`${btnPrimary} flex-1`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Generate Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Invoice Preview — ${invoiceNumber}`}
        size="xl"
      >
        <TaxInvoicePreview
          invoice={buildPayload('Finalized')}
          business={state.business}
        />
      </Modal>

      {/* Quick Add Customer Modal */}
      <Modal
        open={custModalOpen}
        onClose={() => setCustModalOpen(false)}
        title="Add New Customer"
        footer={
          <>
            <button type="button" onClick={() => setCustModalOpen(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="quick-cust-form" className={btnPrimary}>
              Save Customer
            </button>
          </>
        }
      >
        <form id="quick-cust-form" onSubmit={handleQuickAddCustomer} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField label="Customer / Business Name" required>
              <input
                type="text"
                required
                value={newCust.name}
                onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                className={inputClass}
              />
            </InputField>
            <InputField label="Mobile Number" required>
              <input
                type="tel"
                required
                value={newCust.mobile}
                onChange={(e) => setNewCust({ ...newCust, mobile: e.target.value })}
                className={inputClass}
              />
            </InputField>
            <InputField label="Registration Type">
              <select
                value={newCust.registrationType}
                onChange={(e) => setNewCust({ ...newCust, registrationType: e.target.value })}
                className={inputClass}
              >
                {REGISTRATION_TYPES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </InputField>
            <InputField label="State">
              <select
                value={newCust.state}
                onChange={(e) => setNewCust({ ...newCust, state: e.target.value })}
                className={inputClass}
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>{s.name}</option>
                ))}
              </select>
            </InputField>
            <InputField label="GSTIN (Optional)">
              <input
                type="text"
                value={newCust.gstin}
                onChange={(e) => setNewCust({ ...newCust, gstin: e.target.value })}
                className={inputClass}
              />
            </InputField>
            <InputField label="Email">
              <input
                type="email"
                value={newCust.email}
                onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                className={inputClass}
              />
            </InputField>
          </div>
          <InputField label="Billing Address">
            <input
              type="text"
              value={newCust.billingAddress}
              onChange={(e) => setNewCust({ ...newCust, billingAddress: e.target.value })}
              className={inputClass}
            />
          </InputField>
        </form>
      </Modal>
    </div>
  );
};
