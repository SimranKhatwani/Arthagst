import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  PlayCircle,
  Printer,
  Download,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { calculateInvoiceTotals, formatINR } from '../../services/calculationService';
import { generateNextDocNumber } from '../../services/invoiceService';
import { printElement, downloadPrintableHtml } from '../../services/printService';
import {
  Modal,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

const POS_PAGE_SIZE = 9;

export const POSBillingPage = () => {
  const { state, setState, saveSalesInvoice, notify } = useApp();

  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [category, setCategory] = useState('All');
  const [catalogPage, setCatalogPage] = useState(1);
  const [customerId, setCustomerId] = useState('cust-16');
  const [cart, setCart] = useState([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [payMethod, setPayMethod] = useState('UPI');
  const [splitCash, setSplitCash] = useState(0);
  const [splitUpi, setSplitUpi] = useState(0);
  const [receiptInv, setReceiptInv] = useState(null);
  const [heldModalOpen, setHeldModalOpen] = useState(false);

  const activeProducts = useMemo(
    () => state.products.filter((p) => !p.archived && p.stock > 0),
    [state.products]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (category !== 'All' && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || '').includes(q)
      );
    });
  }, [activeProducts, category, search]);

  useEffect(() => {
    setCatalogPage(1);
  }, [search, category]);

  const totalCatalogPages = Math.max(1, Math.ceil(filteredProducts.length / POS_PAGE_SIZE));
  const safeCatalogPage = Math.min(catalogPage, totalCatalogPages);
  const visibleProducts = filteredProducts.slice(
    (safeCatalogPage - 1) * POS_PAGE_SIZE,
    safeCatalogPage * POS_PAGE_SIZE
  );

  const addToCart = (prod) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === prod.id);
      if (existing) {
        if (existing.qty >= prod.stock) {
          notify(`Only ${prod.stock} ${prod.unit} available in stock`, 'error');
          return prev;
        }
        return prev.map((c) => (c.productId === prod.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          hsn: prod.hsn,
          unit: prod.unit,
          qty: 1,
          rate: prod.sellingPrice,
          discountPct: Number(discountPct) || 0,
          gstRate: prod.gstRate,
          cessRate: prod.cessRate || 0,
        },
      ];
    });
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const code = barcodeInput.trim().toLowerCase();
    if (!code) return;
    const prod = activeProducts.find(
      (p) => (p.barcode || '').toLowerCase() === code || p.sku.toLowerCase() === code
    );
    if (prod) {
      addToCart(prod);
      setBarcodeInput('');
    } else {
      notify('No in-stock product found for barcode/SKU', 'error');
    }
  };

  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((c) => (c.productId === productId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const customer = state.customers.find((c) => c.id === customerId) || state.customers[0];

  const computed = useMemo(
    () =>
      calculateInvoiceTotals({
        items: cart.map((c) => ({ ...c, discountPct: Number(discountPct) || 0 })),
        sellerState: state.business.state,
        placeOfSupply: customer?.state || state.business.state,
      }),
    [cart, discountPct, state.business.state, customer]
  );

  const handleHoldBill = () => {
    if (!cart.length) return;
    const held = {
      id: `hold-${Date.now()}`,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      customerId,
      customerName: customer?.name,
      cart,
      discountPct,
      total: computed.grandTotal,
    };
    setState((prev) => ({ ...prev, posHeldBills: [held, ...(prev.posHeldBills || [])] }));
    setCart([]);
    notify('Bill put on hold');
  };

  const handleResumeBill = (held) => {
    setCustomerId(held.customerId);
    setCart(held.cart);
    setDiscountPct(held.discountPct || 0);
    setState((prev) => ({
      ...prev,
      posHeldBills: prev.posHeldBills.filter((h) => h.id !== held.id),
    }));
    setHeldModalOpen(false);
    notify('Held bill resumed');
  };

  const handleCheckout = () => {
    if (!cart.length) {
      notify('Cart is empty', 'error');
      return;
    }
    let paymentPayload = {
      amount: computed.grandTotal,
      method: payMethod,
      referenceNo: `POS-${Date.now().toString().slice(-6)}`,
    };
    let displayMethod = payMethod;

    if (payMethod === 'Split') {
      const cashAmt = Number(splitCash) || 0;
      const upiAmt = Number(splitUpi) || 0;
      if (cashAmt + upiAmt > computed.grandTotal + 0.05) {
        notify('Split payment total cannot exceed payable total', 'error');
        return;
      }
      if (cashAmt > 0 || upiAmt > 0) {
        paymentPayload = [
          ...(cashAmt > 0 ? [{ amount: cashAmt, method: 'Cash', referenceNo: `POS-C-${Date.now().toString().slice(-5)}` }] : []),
          ...(upiAmt > 0 ? [{ amount: upiAmt, method: 'UPI', referenceNo: `POS-U-${Date.now().toString().slice(-5)}` }] : []),
        ];
        displayMethod = `Split (Cash ₹${cashAmt} + UPI ₹${upiAmt})`;
      } else {
        paymentPayload = {
          amount: computed.grandTotal,
          method: 'UPI',
          referenceNo: `POS-${Date.now().toString().slice(-6)}`,
        };
      }
    }

    const invoiceNumber = generateNextDocNumber(
      state.settings.invoice.prefix,
      state.invoices,
      'invoiceNumber'
    );
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      invoiceNumber,
      date: today,
      dueDate: today,
      financialYear: state.business.financialYear,
      invoiceType: 'POS Retail Invoice',
      customerId: customer?.id,
      customerName: customer?.name,
      customerGstin: customer?.gstin || '',
      customerState: customer?.state || state.business.state,
      placeOfSupply: customer?.state || state.business.state,
      registrationType: customer?.registrationType || 'Unregistered / Consumer',
      billingAddress: customer?.billingAddress || 'Counter Sale',
      shippingAddress: customer?.billingAddress || 'Counter Sale',
      paymentMethod: displayMethod,
      status: 'Finalized',
      notes: `POS Counter Sale · Cashier: ${state.currentUser?.name}`,
      ...computed,
    };

    const saved = saveSalesInvoice(payload, paymentPayload);
    setReceiptInv(saved || payload);
    setCart([]);
    setDiscountPct(0);
    setSplitCash(0);
    setSplitUpi(0);
  };

  return (
    <div className="space-y-4">
      {/* Top POS Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-slate-900">POS Retail Billing</h1>
          <p className="text-xs text-slate-500">
            Cashier: <strong className="text-slate-800">{state.currentUser?.name}</strong> · Counter #1 · {state.business.businessName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={handleBarcodeSubmit} className="relative">
            <Barcode className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan barcode / SKU + Enter"
              className="w-56 rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 font-mono text-xs focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </form>
          <button
            type="button"
            onClick={() => setHeldModalOpen(true)}
            className={btnSecondary}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Held Bills ({(state.posHeldBills || []).length})
          </button>
        </div>
      </div>

      {/* Equal-Height Two Column POS Workspace */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch lg:h-[calc(100vh-11.5rem)] lg:min-h-[540px]">
        {/* Left: Product Catalog (Paginated & Equal Height) */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name or SKU..."
                className="w-full rounded-md border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-3 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {['All', ...state.categories.map((c) => c.name)].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    category === cat
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            {visibleProducts.length === 0 ? (
              <div className="flex h-full items-center justify-center py-12 text-xs text-slate-400">
                No matching in-stock products found.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {visibleProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/30"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span className="truncate">{p.sku}</span>
                        <span>GST {p.gstRate}%</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-900 min-h-[2rem]">
                        {p.name}
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                      <span className="font-mono text-sm font-bold text-indigo-700">
                        {formatINR(p.sellingPrice, false)}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {p.stock} {p.unit}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500 shrink-0">
            <span className="tabular-nums">
              {filteredProducts.length === 0
                ? '0 products'
                : `Showing ${(safeCatalogPage - 1) * POS_PAGE_SIZE + 1}–${Math.min(
                    safeCatalogPage * POS_PAGE_SIZE,
                    filteredProducts.length
                  )} of ${filteredProducts.length} items`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safeCatalogPage <= 1}
                onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-mono tabular-nums">
                {safeCatalogPage} / {totalCatalogPages}
              </span>
              <button
                type="button"
                disabled={safeCatalogPage >= totalCatalogPages}
                onClick={() => setCatalogPage((p) => Math.min(totalCatalogPages, p + 1))}
                className="inline-flex items-center rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Checkout Cart & Bill Generation (Exact Matching Height) */}
        <div className="lg:col-span-5 flex flex-col justify-between h-full min-h-0 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div className="shrink-0">
            <label className="mb-1 block text-xs font-medium text-slate-600">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.state})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-h-0 divide-y divide-slate-100 overflow-y-auto border-y border-slate-200 py-1">
            {cart.length === 0 ? (
              <div className="flex h-full items-center justify-center py-10 text-center text-xs text-slate-400">
                Click any product card or scan a barcode to start billing
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">{item.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {formatINR(item.rate)} × {item.qty} · GST {item.gstRate}%
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, -1)}
                      className="rounded border border-slate-200 p-1 hover:bg-slate-100"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-mono font-semibold">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, 1)}
                      className="rounded border border-slate-200 p-1 hover:bg-slate-100"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCart((prev) => prev.filter((c) => c.productId !== item.productId))}
                      className="ml-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Cart Discount %</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  className="w-20 rounded border border-slate-200 px-2 py-1 text-right font-mono"
                />
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value</span>
                <span className="font-mono">{formatINR(computed.taxableValue)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST ({computed.isIntraState ? 'CGST+SGST' : 'IGST'})</span>
                <span className="font-mono">{formatINR(computed.totalTax)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                <span>Payable Total</span>
                <span className="font-mono">{formatINR(computed.grandTotal)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1.5">
                {['Cash', 'UPI', 'Card', 'Split'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={`rounded border py-1.5 text-xs font-medium ${
                      payMethod === m
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {payMethod === 'Split' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    type="number"
                    placeholder="Cash ₹"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    className="rounded border border-slate-200 px-2 py-1 font-mono"
                  />
                  <input
                    type="number"
                    placeholder="UPI/Card ₹"
                    value={splitUpi}
                    onChange={(e) => setSplitUpi(e.target.value)}
                    className="rounded border border-slate-200 px-2 py-1 font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!cart.length}
                onClick={handleHoldBill}
                className={`${btnSecondary} flex-1`}
              >
                <PauseCircle className="h-3.5 w-3.5" /> Hold Bill
              </button>
              <button
                type="button"
                disabled={!cart.length}
                onClick={handleCheckout}
                className={`${btnPrimary} flex-1`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Pay &amp; Receipt
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Held Bills Modal */}
      <Modal open={heldModalOpen} onClose={() => setHeldModalOpen(false)} title="Held POS Bills">
        {(state.posHeldBills || []).length === 0 ? (
          <p className="text-xs text-slate-500">No bills are currently on hold.</p>
        ) : (
          <div className="space-y-2">
            {state.posHeldBills.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded border border-slate-200 p-3 text-xs">
                <div>
                  <div className="font-semibold text-slate-900">{h.customerName}</div>
                  <div className="text-slate-500">
                    Held at {h.time} · {h.cart.length} items · {formatINR(h.total)}
                  </div>
                </div>
                <button type="button" onClick={() => handleResumeBill(h)} className={btnPrimary}>
                  Resume
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Thermal Receipt Modal */}
      <Modal open={Boolean(receiptInv)} onClose={() => setReceiptInv(null)} title="POS Thermal Receipt (80mm)" size="sm">
        {receiptInv && (
          <div className="space-y-3">
            <div id="pos-thermal-receipt" className="mx-auto max-w-[320px] rounded border border-slate-200 bg-white p-4 space-y-3 font-mono text-xs text-slate-900">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <div className="text-sm font-bold">{state.business.businessName}</div>
                <div className="text-[11px]">{state.business.address}, {state.business.city}</div>
                <div className="text-[11px]">GSTIN: {state.business.gstin}</div>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Bill: {receiptInv.invoiceNumber}</span>
                <span>{receiptInv.date}</span>
              </div>
              <div className="text-[11px]">Customer: {receiptInv.customerName}</div>
              <div className="border-y border-dashed border-slate-300 py-2 space-y-1">
                {(receiptInv.items || []).map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="truncate pr-2">{it.name} x{it.qty}</span>
                    <span>{formatINR(it.totalAmount)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between"><span>Taxable:</span><span>{formatINR(receiptInv.taxableValue)}</span></div>
                <div className="flex justify-between"><span>GST:</span><span>{formatINR(receiptInv.totalTax)}</span></div>
                <div className="flex justify-between text-sm font-bold pt-1"><span>TOTAL:</span><span>{formatINR(receiptInv.grandTotal)}</span></div>
                <div className="flex justify-between"><span>Paid via:</span><span>{receiptInv.paymentMethod}</span></div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">
                Thank you for shopping with {state.business.businessName}
              </div>
            </div>

            <div className="no-print flex flex-wrap justify-end gap-2 pt-1">
              <button type="button" onClick={() => setReceiptInv(null)} className={btnSecondary}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadPrintableHtml(
                    'pos-thermal-receipt',
                    `receipt-${receiptInv.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.html`,
                    `Receipt ${receiptInv.invoiceNumber}`
                  );
                  notify('Printable receipt downloaded (.html)');
                }}
                className={btnSecondary}
              >
                <Download className="h-3.5 w-3.5" /> Download Bill
              </button>
              <button
                type="button"
                onClick={() =>
                  printElement({
                    elementId: 'pos-thermal-receipt',
                    title: `Receipt ${receiptInv.invoiceNumber}`,
                    fileName: `receipt-${receiptInv.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.html`,
                    onNotify: notify,
                  })
                }
                className={btnPrimary}
              >
                <Printer className="h-3.5 w-3.5" /> Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
