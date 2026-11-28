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
  UserPlus,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { calculateInvoiceTotals, formatINR } from '../../services/calculationService';
import { generateNextDocNumber } from '../../services/invoiceService';
import { printElement, downloadPrintableHtml } from '../../services/printService';
import { INDIAN_STATES, REGISTRATION_TYPES } from '../../data/constants';
import { GSTINInput } from '../../components/common/GSTINInput';
import { validateGSTIN } from '../../utils/gstinValidator';
import {
  Modal,
  InputField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

const POS_PAGE_SIZE = 9;

export const POSBillingPage = () => {
  const { state, setState, saveSalesInvoice, upsertRecord, notify } = useApp();

  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [category, setCategory] = useState('All');
  const [catalogPage, setCatalogPage] = useState(1);
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [payMethod, setPayMethod] = useState('UPI');
  const [splitCash, setSplitCash] = useState(0);
  const [splitUpi, setSplitUpi] = useState(0);
  const [receiptInv, setReceiptInv] = useState(null);
  const [heldModalOpen, setHeldModalOpen] = useState(false);

  // Quick Add Customer Modal
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    mobile: '',
    email: '',
    gstin: '',
    state: state.business?.state || 'Maharashtra',
    registrationType: 'Unregistered / Consumer',
    address: '',
  });
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  useEffect(() => {
    if (state.customers && state.customers.length > 0) {
      if (!customerId || !state.customers.some((c) => (c.id || c._id) === customerId)) {
        setCustomerId(state.customers[0].id || state.customers[0]._id);
      }
    }
  }, [state.customers, customerId]);

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
    const pId = prod.id || prod._id;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === pId);
      if (existing) {
        if (existing.qty >= prod.stock) {
          notify(`Only ${prod.stock} ${prod.unit} available in stock`, 'error');
          return prev;
        }
        return prev.map((c) => (c.productId === pId ? { ...c, qty: c.qty + 1 } : c));
      }
      return [
        ...prev,
        {
          productId: pId,
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

  const handleQuickAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      notify('Customer name is required', 'error');
      return;
    }
    if (!newCustomerForm.mobile.trim() || newCustomerForm.mobile.replace(/\D/g, '').length !== 10) {
      notify('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    if (newCustomerForm.gstin && newCustomerForm.gstin.trim()) {
      const gstinVal = validateGSTIN(newCustomerForm.gstin.trim());
      if (!gstinVal.isValid) {
        notify(gstinVal.message || 'Invalid GSTIN format', 'error');
        return;
      }
    }

    setIsSubmittingCustomer(true);
    try {
      const payload = {
        name: newCustomerForm.name.trim(),
        mobile: newCustomerForm.mobile.trim(),
        phone: newCustomerForm.mobile.trim(),
        email: newCustomerForm.email.trim() || null,
        gstin: newCustomerForm.gstin ? newCustomerForm.gstin.trim().toUpperCase() : null,
        state: newCustomerForm.state || state.business?.state || 'Maharashtra',
        registrationType: newCustomerForm.registrationType || 'Unregistered / Consumer',
        billingAddress: newCustomerForm.address.trim() || 'Counter Sale',
        shippingAddress: newCustomerForm.address.trim() || 'Counter Sale',
      };

      const saved = await upsertRecord('customers', payload, 'Customer');
      const savedId = saved?._id || saved?.id;
      if (savedId) {
        setCustomerId(savedId);
      }
      setAddCustomerModalOpen(false);
      setNewCustomerForm({
        name: '',
        mobile: '',
        email: '',
        gstin: '',
        state: state.business?.state || 'Maharashtra',
        registrationType: 'Unregistered / Consumer',
        address: '',
      });
      notify(`Customer ${payload.name} created and selected`);
    } catch (err) {
      notify(err.message || 'Failed to create customer', 'error');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckout = async () => {
    if (isCheckingOut) return;
    if (!cart.length) {
      notify('Cart is empty', 'error');
      return;
    }
    setIsCheckingOut(true);
    try {
      // Ensure customer exists or auto-fallback to Walk-in Customer
      let activeCustomer = (state.customers || []).find((c) => (c.id || c._id) === customerId);

      if (!activeCustomer && (state.customers || []).length > 0) {
        activeCustomer = state.customers[0];
      }

      if (!activeCustomer || !(activeCustomer.id || activeCustomer._id)) {
        // Look for existing Walk-in Customer
        activeCustomer = (state.customers || []).find(
          (c) => (c.name || '').toLowerCase().includes('walk-in') || (c.name || '').toLowerCase().includes('counter')
        );

        if (!activeCustomer) {
          try {
            const walkInPayload = {
              name: 'Walk-in Customer',
              mobile: '9999999999',
              phone: '9999999999',
              state: state.business?.state || 'Maharashtra',
              registrationType: 'Unregistered / Consumer',
              billingAddress: 'Counter Sale',
              shippingAddress: 'Counter Sale',
            };
            const createdWalkIn = await upsertRecord('customers', walkInPayload, 'Customer');
            if (createdWalkIn) {
              activeCustomer = createdWalkIn;
              setCustomerId(createdWalkIn.id || createdWalkIn._id);
            }
          } catch (autoErr) {
            console.warn('Auto-create walk-in customer notice:', autoErr.message);
          }
        }
      }

      const custId = activeCustomer?.id || activeCustomer?._id;
      if (!custId) {
        notify('Please select or create a customer to proceed with checkout', 'error');
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
          paymentPayload = {
            amount: computed.grandTotal,
            method: cashAmt >= upiAmt ? 'Cash' : 'UPI',
            referenceNo: `POS-SPLIT-${Date.now().toString().slice(-5)}`,
          };
          displayMethod = `Split (Cash ₹${cashAmt} + UPI ₹${upiAmt})`;
        } else {
          paymentPayload = {
            amount: computed.grandTotal,
            method: 'UPI',
            referenceNo: `POS-${Date.now().toString().slice(-6)}`,
          };
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      const whId = state.warehouses?.[0]?.id || state.warehouses?.[0]?._id;

      const payload = {
        date: today,
        dueDate: today,
        financialYear: state.business?.financialYear || '2026-27',
        invoiceType: 'POS Retail Invoice',
        customerId: custId,
        partyId: custId,
        warehouseId: whId,
        customerName: activeCustomer?.name || 'Walk-in Customer',
        customerGstin: activeCustomer?.gstin || activeCustomer?.GSTIN || '',
        customerState: activeCustomer?.state || state.business?.state || 'Maharashtra',
        placeOfSupply: activeCustomer?.state || state.business?.state || 'Maharashtra',
        registrationType: activeCustomer?.registrationType || 'Unregistered / Consumer',
        billingAddress: activeCustomer?.billingAddress || activeCustomer?.address || 'Counter Sale',
        shippingAddress: activeCustomer?.shippingAddress || activeCustomer?.billingAddress || 'Counter Sale',
        paymentMethod: displayMethod,
        status: 'Finalized',
        notes: `POS Counter Sale · Cashier: ${state.currentUser?.name || 'Cashier'}`,
        items: cart,
        ...computed,
      };

      const currentCart = [...cart];
      const saved = await saveSalesInvoice(payload, paymentPayload);
      const invoiceData = saved?.data || saved?.invoice || saved || {};

      const receiptItems = (currentCart && currentCart.length > 0)
        ? currentCart.map((c) => ({
            name: c.name || c.productName || 'Item',
            productName: c.name || c.productName || 'Item',
            qty: c.qty || c.quantity || 1,
            quantity: c.qty || c.quantity || 1,
            rate: c.rate || c.unitPrice || 0,
            unitPrice: c.rate || c.unitPrice || 0,
            gstRate: c.gstRate || 0,
            description: c.description || c.brand || '',
            brand: c.brand || '',
            totalAmount: c.totalAmount !== undefined
              ? c.totalAmount
              : Number(((c.rate || 0) * (c.qty || 1) * (1 + (c.gstRate || 0) / 100)).toFixed(2)),
            lineTotal: c.totalAmount !== undefined
              ? c.totalAmount
              : Number(((c.rate || 0) * (c.qty || 1) * (1 + (c.gstRate || 0) / 100)).toFixed(2)),
          }))
        : ((invoiceData.items || []).map((it) => ({
            name: it.productName || it.name || 'Item',
            productName: it.productName || it.name || 'Item',
            qty: it.quantity || it.qty || 1,
            quantity: it.quantity || it.qty || 1,
            rate: it.unitPrice || it.rate || 0,
            unitPrice: it.unitPrice || it.rate || 0,
            gstRate: it.gstRate || 0,
            description: it.description || it.brand || '',
            brand: it.brand || '',
            totalAmount: it.lineTotal !== undefined ? it.lineTotal : ((it.unitPrice || 0) * (it.quantity || 1)),
            lineTotal: it.lineTotal !== undefined ? it.lineTotal : ((it.unitPrice || 0) * (it.quantity || 1)),
          })));

      const receiptTaxable = invoiceData.taxableAmount !== undefined && Number(invoiceData.taxableAmount) > 0
        ? Number(invoiceData.taxableAmount)
        : (invoiceData.taxableValue !== undefined && Number(invoiceData.taxableValue) > 0 ? Number(invoiceData.taxableValue) : computed.taxableValue);

      const receiptTotalTax = (invoiceData.cgstTotal !== undefined || invoiceData.igstTotal !== undefined)
        ? ((Number(invoiceData.cgstTotal) || 0) + (Number(invoiceData.sgstTotal) || 0) + (Number(invoiceData.igstTotal) || 0) + (Number(invoiceData.cessTotal) || 0))
        : (invoiceData.totalTax !== undefined && Number(invoiceData.totalTax) > 0 ? Number(invoiceData.totalTax) : computed.totalTax);

      const receiptGrandTotal = invoiceData.grandTotal !== undefined && Number(invoiceData.grandTotal) > 0
        ? Number(invoiceData.grandTotal)
        : computed.grandTotal;

      const receiptData = {
        invoiceNumber: invoiceData.invoiceNumber || payload.invoiceNumber || 'INV-0001',
        date: payload.date || (invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN') : today),
        customerName: activeCustomer?.name || invoiceData.customerName || invoiceData.partyName || payload.customerName || 'Walk-in Customer',
        customerGstin: activeCustomer?.gstin || activeCustomer?.GSTIN || invoiceData.customerGstin || invoiceData.partyGSTIN || '',
        paymentMethod: displayMethod,
        taxableValue: receiptTaxable,
        totalTax: receiptTotalTax,
        grandTotal: receiptGrandTotal,
        roundOff: invoiceData.roundOff !== undefined ? invoiceData.roundOff : computed.roundOff,
        items: receiptItems,
      };

      setReceiptInv(receiptData);
      setCart([]);
      setDiscountPct(0);
      setSplitCash(0);
      setSplitUpi(0);
    } catch (err) {
      notify(err.message || 'Failed to complete POS billing', 'error');
    } finally {
      setIsCheckingOut(false);
    }
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
                    key={p.id || p._id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/30"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span className="truncate">{p.sku || p.SKU || 'SKU'}</span>
                        <span>GST {p.gstRate}%</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-900 min-h-[2rem]">
                        <div>{(p.name || '').replace(/\s*\(₹[\d,]+\s*Rate\)/gi, '').trim() || p.name}</div>
                        {(p.description || p.brand) && (
                          <div className="text-[11px] font-normal text-slate-500 truncate">
                            {[p.brand, p.description].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                      <span className="font-mono text-sm font-bold text-indigo-700">
                        {formatINR(p.sellingPrice, false)}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {p.stock} {p.unit || 'PCS'}
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">Customer</label>
              <button
                type="button"
                onClick={() => setAddCustomerModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="h-3 w-3" /> Add Customer
              </button>
            </div>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium"
            >
              {(state.customers || []).length === 0 ? (
                <option value="">Walk-in Customer (Auto-created on checkout)</option>
              ) : (
                state.customers.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name} ({c.state || state.business?.state || 'Local'})
                  </option>
                ))
              )}
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
                disabled={!cart.length || isCheckingOut}
                onClick={handleHoldBill}
                className={`${btnSecondary} flex-1`}
              >
                <PauseCircle className="h-3.5 w-3.5" /> Hold Bill
              </button>
              <button
                type="button"
                disabled={!cart.length || isCheckingOut}
                onClick={handleCheckout}
                className={`${btnPrimary} flex-1 justify-center ${isCheckingOut ? 'cursor-wait opacity-90' : ''}`}
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Generating Receipt...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Pay &amp; Generate Receipt
                  </>
                )}
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
                <div className="text-sm font-bold">{(state.business?.businessName || 'Artha Tech Enterprises').replace(/Aurelle/gi, 'Artha')}</div>
                <div className="text-[11px]">{state.business.address}, {state.business.city}</div>
                <div className="text-[11px]">GSTIN: {state.business.gstin}</div>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Bill: {receiptInv.invoiceNumber}</span>
                <span>{receiptInv.date || receiptInv.invoiceDate || new Date().toLocaleDateString('en-IN')}</span>
              </div>
              <div className="text-[11px]">
                Customer: <strong className="font-semibold">{receiptInv.customerName || receiptInv.partyName || 'Walk-in Customer'}</strong>
              </div>
              {receiptInv.customerGstin && (
                <div className="text-[10px] text-slate-500 font-mono">GSTIN: {receiptInv.customerGstin}</div>
              )}
              <div className="border-y border-dashed border-slate-300 py-2 space-y-1">
                {(receiptInv.items || []).map((it, i) => {
                  const itName = it.name || it.productName || 'Item';
                  const itQty = it.qty || it.quantity || 1;
                  const itRate = it.rate || it.unitPrice || 0;
                  const itTotal = it.totalAmount !== undefined
                    ? it.totalAmount
                    : (it.lineTotal !== undefined ? it.lineTotal : itRate * itQty);
                  return (
                    <div key={i} className="flex justify-between items-start text-[11px] py-0.5">
                      <div className="truncate pr-2">
                        <span className="font-medium text-slate-800">{itName} × {itQty}</span>
                        {(it.description || it.brand) && (
                          <div className="text-[9px] text-slate-500 font-normal">
                            {[it.brand, it.description].filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx).join(' • ')}
                          </div>
                        )}
                      </div>
                      <span className="font-semibold font-mono whitespace-nowrap">{formatINR(itTotal)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable:</span>
                  <span className="font-mono">
                    {formatINR(
                      receiptInv.taxableValue !== undefined
                        ? receiptInv.taxableValue
                        : (receiptInv.taxableAmount !== undefined ? receiptInv.taxableAmount : 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST:</span>
                  <span className="font-mono">
                    {formatINR(
                      receiptInv.totalTax !== undefined
                        ? receiptInv.totalTax
                        : ((receiptInv.cgstTotal || 0) +
                           (receiptInv.sgstTotal || 0) +
                           (receiptInv.igstTotal || 0) +
                           (receiptInv.cessTotal || 0))
                    )}
                  </span>
                </div>
                {receiptInv.roundOff !== 0 && receiptInv.roundOff !== undefined && (
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Round-off:</span>
                    <span className="font-mono">{formatINR(receiptInv.roundOff)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-dotted border-slate-200">
                  <span>TOTAL:</span>
                  <span className="font-mono text-indigo-700">{formatINR(receiptInv.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 pt-0.5">
                  <span>Paid via:</span>
                  <span className="font-semibold">{receiptInv.paymentMethod || 'Cash'}</span>
                </div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500">
                Thank you for shopping with {(state.business?.businessName || 'Artha Tech Enterprises').replace(/Aurelle/gi, 'Artha')}
              </div>
            </div>

            <div className="no-print flex flex-wrap justify-end gap-2 pt-1">
              <button type="button" onClick={() => setReceiptInv(null)} className={btnSecondary}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const invNum = receiptInv.invoiceNumber || 'INV-0001';
                  downloadPrintableHtml(
                    'pos-thermal-receipt',
                    `receipt-${invNum.replace(/[^a-zA-Z0-9-]/g, '_')}.html`,
                    `Receipt ${invNum}`
                  );
                  notify('Printable receipt downloaded (.html)');
                }}
                className={btnSecondary}
              >
                <Download className="h-3.5 w-3.5" /> Download Bill
              </button>
              <button
                type="button"
                onClick={() => {
                  const invNum = receiptInv.invoiceNumber || 'INV-0001';
                  printElement({
                    elementId: 'pos-thermal-receipt',
                    title: `Receipt ${invNum}`,
                    fileName: `receipt-${invNum.replace(/[^a-zA-Z0-9-]/g, '_')}.html`,
                    onNotify: notify,
                  });
                }}
                className={btnPrimary}
              >
                <Printer className="h-3.5 w-3.5" /> Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick Add Customer Modal */}
      <Modal
        open={addCustomerModalOpen}
        onClose={() => setAddCustomerModalOpen(false)}
        title="Add Customer"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAddCustomerModalOpen(false)}
              className={btnSecondary}
              disabled={isSubmittingCustomer}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="pos-add-customer-form"
              className={btnPrimary}
              disabled={isSubmittingCustomer}
            >
              {isSubmittingCustomer ? 'Saving...' : 'Save & Select Customer'}
            </button>
          </>
        }
      >
        <form id="pos-add-customer-form" onSubmit={handleQuickAddCustomer} className="space-y-3">
          <InputField label="Customer Name" required>
            <input
              type="text"
              required
              placeholder="Full name or company name"
              value={newCustomerForm.name}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
              className={inputClass}
            />
          </InputField>

          <InputField label="Mobile Number" required>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              placeholder="10-digit mobile number"
              required
              value={newCustomerForm.mobile}
              onChange={(e) =>
                setNewCustomerForm({
                  ...newCustomerForm,
                  mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                })
              }
              className={inputClass}
            />
          </InputField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField label="Email Address">
              <input
                type="email"
                placeholder="customer@example.com"
                value={newCustomerForm.email}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                className={inputClass}
              />
            </InputField>

            <InputField label="State">
              <select
                value={newCustomerForm.state}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, state: e.target.value })}
                className={inputClass}
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </InputField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField label="Registration Type">
              <select
                value={newCustomerForm.registrationType}
                onChange={(e) =>
                  setNewCustomerForm({ ...newCustomerForm, registrationType: e.target.value })
                }
                className={inputClass}
              >
                {REGISTRATION_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </InputField>

            <GSTINInput
              value={newCustomerForm.gstin}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, gstin: e.target.value })}
              label="GSTIN (Optional)"
            />
          </div>

          <InputField label="Address / Counter Note">
            <input
              type="text"
              placeholder="Local billing address"
              value={newCustomerForm.address}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
              className={inputClass}
            />
          </InputField>
        </form>
      </Modal>
    </div>
  );
};
