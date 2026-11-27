import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit3, Trash2, Eye, ArrowLeftRight, AlertTriangle, Warehouse, Split, Layers, Tag, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GST_RATES } from '../../data/constants';
import { formatINR, formatDateIN, formatNumberIN } from '../../services/calculationService';
import { getStockValuationSummary } from '../../services/inventoryService';
import { exportToCSV } from '../../services/storageService';
import {
  PageHeader,
  DataTable,
  StatusLabel,
  SegmentedTabs,
  StatCard,
  Modal,
  InputField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

export const ProductsPage = () => {
  const { state, upsertRecord, deleteRecord, confirmAction, notify, splitProductLot } = useApp();
  const [filterTab, setFilterTab] = useState('All Products');
  const [catFilter, setCatFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailProd, setDetailProd] = useState(null);
  const [editing, setEditing] = useState(null);

  // Lot splitting modal state
  const [splitModalLot, setSplitModalLot] = useState(null);
  const [splitForm, setSplitForm] = useState({
    newProductName: '',
    newSku: '',
    purchasePrice: 0,
    sellingPrice: 0,
    qtyToTransfer: 1,
  });
  const [isSplitting, setIsSplitting] = useState(false);

  const emptyProduct = {
    name: '',
    sku: '',
    barcode: '',
    hsn: '8536',
    category: state.categories[0]?.name || 'Electronics',
    brand: '',
    unit: state.units[0]?.shortName || 'PCS',
    purchasePrice: 0,
    sellingPrice: 0,
    mrp: 0,
    gstRate: 18,
    cessRate: 0,
    openingStock: 0,
    stock: 0,
    minStock: 10,
    warehouseId: state.warehouses[0]?.id || 'wh-1',
    archived: false,
  };

  const [form, setForm] = useState(emptyProduct);

  const summary = useMemo(() => getStockValuationSummary(state.products), [state.products]);

  const filtered = useMemo(() => {
    return (state.products || []).filter((p) => {
      if (p.archived) return false;
      if (catFilter !== 'All' && p.category !== catFilter) return false;
      if (filterTab === 'Low Stock') return p.stock > 0 && p.stock <= (p.minStock || 5);
      if (filterTab === 'Out of Stock') return (p.stock || 0) <= 0;
      return true;
    });
  }, [state.products, filterTab, catFilter]);

  // Compute all purchase lots across purchase bills to show breakdown by rate & lot
  const purchaseLots = useMemo(() => {
    const lots = [];
    (state.purchases || []).forEach((bill) => {
      (bill.items || []).forEach((it, idx) => {
        const pId = String(it.productId?._id || it.productId || it.id || '');
        const prod = (state.products || []).find((p) => String(p.id || p._id) === pId);
        const rate = Number(it.rate || it.unitPrice || 0);
        const qty = Number(it.qty || it.quantity || 0);
        const gst = Number(it.gstRate || it.gst || 0);
        const total = it.lineTotal || (rate * qty * (1 + gst / 100));
        lots.push({
          id: `${bill.id || bill._id}-${pId}-${rate}-${idx}`,
          billNumber: bill.billNumber || bill.billNo || 'N/A',
          supplierInvoiceNumber: bill.supplierInvoiceNumber || bill.supplierInvoiceNo || 'N/A',
          supplierName: bill.supplierName || 'Supplier',
          date: bill.billDate || bill.date,
          productId: pId,
          productName: it.productName || it.name || prod?.name || 'Product',
          sku: prod?.sku || prod?.SKU || 'SKU-N/A',
          hsn: it.HSN || it.hsn || prod?.hsn || '8536',
          rate,
          qty,
          currentProdStock: prod?.stock || 0,
          currentProdCost: prod?.purchasePrice || 0,
          total,
          billId: bill.id || bill._id,
          description: it.description || '',
          isMultiRate: prod && prod.purchasePrice !== rate,
          prodRecord: prod,
        });
      });
    });
    return lots.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [state.purchases, state.products]);

  const openSplitModal = (item) => {
    const isLot = Boolean(item.billNumber);
    const prod = isLot
      ? (state.products || []).find((p) => String(p.id || p._id) === String(item.productId)) || item.prodRecord || item
      : item;
    const pRate = isLot ? item.rate : (prod.purchasePrice || 0);
    const maxQty = isLot ? item.qty : (prod.stock || 1);
    const cleanProdName = (prod.name || '').replace(/\s*\(₹[\d,]+\s*Rate\)/gi, '').trim() || prod.name;
    const descDetail = isLot ? (item.description || '') : (prod.description || '');
    const initialName = descDetail ? `${cleanProdName} (${descDetail})` : cleanProdName;

    setSplitModalLot({
      originalProductId: prod.id || prod._id,
      productName: cleanProdName,
      currentStock: prod.stock || 0,
      purchaseBillId: isLot ? item.billId : null,
      purchaseRate: pRate,
      maxQty,
    });
    setSplitForm({
      newProductName: initialName,
      newSku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      brand: prod.brand || '',
      description: descDetail || '',
      purchasePrice: pRate,
      sellingPrice: prod.sellingPrice ? Math.round(prod.sellingPrice * (pRate / (prod.purchasePrice || pRate || 1))) : Math.round(pRate * 1.3),
      qtyToTransfer: Math.min(maxQty, Math.max(1, Math.min(10, maxQty))),
    });
  };

  const handleExecuteSplit = async (e) => {
    e.preventDefault();
    if (!splitForm.newProductName.trim() || !splitForm.newSku.trim()) {
      notify('Product name and SKU are required', 'error');
      return;
    }
    const transferQty = Number(splitForm.qtyToTransfer);
    if (!transferQty || transferQty <= 0) {
      notify('Quantity to transfer must be greater than 0', 'error');
      return;
    }
    setIsSplitting(true);
    try {
      await splitProductLot({
        originalProductId: splitModalLot.originalProductId,
        newProductName: splitForm.newProductName.trim(),
        newSku: splitForm.newSku.trim().toUpperCase(),
        purchasePrice: Number(splitForm.purchasePrice) || 0,
        sellingPrice: Number(splitForm.sellingPrice) || 0,
        qtyToTransfer: transferQty,
        purchaseBillId: splitModalLot.purchaseBillId,
      });
      setSplitModalLot(null);
      notify(`Separated '${splitForm.newProductName}' into its own product variant with ${transferQty} stock`);
    } catch (err) {
      notify(err.message || 'Failed to split product lot', 'error');
    } finally {
      setIsSplitting(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...emptyProduct,
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: `8901234${Math.floor(100000 + Math.random() * 899999)}`,
    });
    setModalOpen(true);
  };

  const openEdit = (p) => {
    const skuVal = p.sku || p.SKU || '';
    const hsnVal = p.hsn || p.HSN || '';
    const currentStock = p.stock !== undefined ? p.stock : (p.openingStock !== undefined ? p.openingStock : 0);
    setEditing(p);
    setForm({
      ...p,
      sku: skuVal,
      SKU: skuVal,
      hsn: hsnVal,
      HSN: hsnVal,
      stock: currentStock,
      openingStock: currentStock,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !(form.sku || form.SKU || '').trim()) {
      notify('Product name and SKU are required', 'error');
      return;
    }
    if (form.mrp && Number(form.mrp) > 0 && Number(form.sellingPrice) > Number(form.mrp)) {
      notify('Selling price cannot exceed MRP', 'error');
      return;
    }
    try {
      const cleanSKU = (form.sku || form.SKU || '').trim().toUpperCase();
      const cleanHSN = (form.hsn || form.HSN || '').trim();
      const stockVal = Number(form.stock !== undefined ? form.stock : form.openingStock) || 0;
      const payload = {
        ...form,
        id: editing ? (editing.id || editing._id) : undefined,
        _id: editing ? (editing._id || editing.id) : undefined,
        sku: cleanSKU,
        SKU: cleanSKU,
        hsn: cleanHSN,
        HSN: cleanHSN,
        purchasePrice: Number(form.purchasePrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        mrp: Number(form.mrp) || 0,
        gstRate: Number(form.gstRate) || 0,
        cessRate: Number(form.cessRate) || 0,
        openingStock: stockVal,
        stock: stockVal,
        minStock: Number(form.minStock) || 0,
      };
      await upsertRecord('products', payload, 'Product', 'name');
      setModalOpen(false);
    } catch (err) {
      notify(err.message || 'Failed to save product', 'error');
    }
  };

  const handleArchive = async (p) => {
    const ok = await confirmAction({
      title: `Delete Product ${p.name}?`,
      message: 'Are you sure you want to delete this product from your inventory?',
      confirmText: 'Delete Product',
      danger: true,
    });
    if (ok) {
      try {
        await deleteRecord('products', p.id || p._id, 'Product', p.name);
      } catch (err) {
        notify(err.message || 'Failed to delete product', 'error');
      }
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products & SKUs"
        subtitle="Manage inventory catalog, HSN codes, GST slabs, pricing, and stock thresholds"
        breadcrumbs={['Inventory', 'Products']}
        actions={
          <>
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  'products-catalog.csv',
                  ['SKU', 'Name', 'HSN', 'Category', 'Unit', 'Purchase Price', 'Selling Price', 'GST%', 'Stock'],
                  filtered.map((p) => [p.sku, p.name, p.hsn, p.category, p.unit, p.purchasePrice, p.sellingPrice, p.gstRate, p.stock])
                )
              }
              className={btnSecondary}
            >
              Export CSV
            </button>
            <button type="button" onClick={openAdd} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" /> Add Product
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Active SKUs" value={summary.totalSkus} />
        <StatCard label="Total Units in Stock" value={summary.totalUnits} />
        <StatCard label="Stock Value (Cost)" value={formatINR(summary.costValuation, false)} />
        <StatCard label="Low / Out of Stock" value={`${summary.lowStock.length} / ${summary.outOfStock.length}`} tone="warning" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs activeTab={filterTab} onChange={setFilterTab} tabs={['All Products', 'By Purchase Rate / Lot', 'Low Stock', 'Out of Stock']} />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
        >
          <option value="All">All Categories</option>
          {state.categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {filterTab === 'By Purchase Rate / Lot' ? (
        <DataTable
          data={purchaseLots}
          searchFields={['productName', 'sku', 'billNumber', 'supplierInvoiceNumber', 'supplierName']}
          searchPlaceholder="Search lot by product name, SKU, bill #, or supplier..."
          columns={[
            {
              key: 'billNumber',
              label: 'Purchase Bill & Date',
              sortable: true,
              render: (r) => (
                <div>
                  <span className="font-mono font-semibold text-indigo-600">{r.billNumber}</span>
                  <div className="text-[11px] text-slate-500">{formatDateIN(r.date)} • Inv: {r.supplierInvoiceNumber}</div>
                </div>
              ),
            },
            {
              key: 'supplierName',
              label: 'Supplier',
              sortable: true,
              render: (r) => <span className="font-medium text-slate-800">{r.supplierName}</span>,
            },
            {
              key: 'productName',
              label: 'Product & SKU',
              sortable: true,
              render: (r) => {
                const cleanName = (r.productName || '').replace(/\s*\(₹[\d,]+\s*Rate\)/gi, '').trim() || r.productName;
                const descOrBrand = [r.prodRecord?.brand, r.description || r.prodRecord?.description].filter(Boolean).join(' • ');
                return (
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{cleanName}</span>
                      {descOrBrand ? (
                        <span className="text-[11px] text-slate-600 font-normal">({descOrBrand})</span>
                      ) : null}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">{r.sku}</div>
                  </div>
                );
              },
            },
            {
              key: 'rate',
              label: 'Purchase Rate',
              align: 'right',
              sortable: true,
              render: (r) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {formatINR(r.rate)}
                </span>
              ),
            },
            {
              key: 'qty',
              label: 'Purchased Qty',
              align: 'right',
              sortable: true,
              render: (r) => <span className="font-mono font-semibold text-slate-800">{r.qty} PCS</span>,
            },
            {
              key: 'total',
              label: 'Lot Total',
              align: 'right',
              sortable: true,
              render: (r) => <span className="font-mono">{formatINR(r.total)}</span>,
            },
            {
              key: 'actions',
              label: 'Actions',
              align: 'center',
              render: (r) => (
                <button
                  type="button"
                  onClick={() => openSplitModal(r)}
                  className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                  title="Separate this lot into a dedicated product variant"
                >
                  <Split className="h-3 w-3" /> Split to Variant
                </button>
              ),
            },
          ]}
        />
      ) : (
        <DataTable
          data={filtered}
          searchFields={['name', 'sku', 'hsn', 'brand', 'barcode']}
          searchPlaceholder="Search product name, SKU, barcode or HSN..."
          columns={[
            {
              key: 'sku',
              label: 'SKU',
              sortable: true,
              render: (r) => <span className="font-mono text-xs text-slate-600">{r.sku || r.SKU}</span>,
            },
            {
              key: 'name',
              label: 'Product Name',
              sortable: true,
              render: (r) => {
                const cleanName = (r.name || '').replace(/\s*\(₹[\d,]+\s*Rate\)/gi, '').trim() || r.name;
                const descOrBrand = [r.brand, r.description].filter(Boolean).join(' • ');
                return (
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{cleanName}</span>
                      {descOrBrand ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-normal bg-slate-100 text-slate-700 border border-slate-200">
                          {descOrBrand}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              },
            },
            { key: 'category', label: 'Category', sortable: true },
            { key: 'hsn', label: 'HSN', render: (r) => <span className="font-mono text-xs">{r.hsn || r.HSN}</span> },
            {
              key: 'purchasePrice',
              label: 'Cost (Rate)',
              align: 'right',
              sortable: true,
              render: (r) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {formatINR(r.purchasePrice)}
                </span>
              ),
            },
            { key: 'sellingPrice', label: 'Sale Price', align: 'right', sortable: true, render: (r) => formatINR(r.sellingPrice) },
            { key: 'gstRate', label: 'GST', align: 'right', render: (r) => `${r.gstRate}%` },
            {
              key: 'stock',
              label: 'Stock',
              align: 'right',
              sortable: true,
              render: (r) => (
                <span className={`font-mono font-semibold ${r.stock <= 0 ? 'text-rose-600' : r.stock <= (r.minStock || 5) ? 'text-amber-600' : 'text-slate-900'}`}>
                  {r.stock} {r.unit || 'PCS'}
                </span>
              ),
            },
            {
              key: 'stockStatus',
              label: 'Status',
              render: (r) => (
                <StatusLabel status={r.stock <= 0 ? 'Out of Stock' : r.stock <= (r.minStock || 5) ? 'Low Stock' : 'Active'} />
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              nowrap: true,
              render: (r) => (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setDetailProd(r)} title="View details & purchase lots" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Eye className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => openEdit(r)} title="Edit product" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => openSplitModal(r)} title="Split into new variant / lot" className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"><Split className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => handleArchive(r)} title="Delete product" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Add/Edit Product Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Product — ${editing.name}` : 'Add New Product'}
        size="lg"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="prod-form" className={btnPrimary}>Save Product</button>
          </>
        }
      >
        <form id="prod-form" onSubmit={handleSave} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <InputField label="Product Name" required>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </InputField>
          </div>
          <InputField label="SKU" required>
            <input
              type="text"
              required
              value={form.sku || form.SKU || ''}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setForm({ ...form, sku: val, SKU: val });
              }}
              className={`${inputClass} font-mono`}
            />
          </InputField>
          <InputField label="Barcode">
            <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={`${inputClass} font-mono`} />
          </InputField>
          <InputField label="HSN / SAC Code" required>
            <input
              type="text"
              required
              value={form.hsn || form.HSN || ''}
              onChange={(e) => {
                const val = e.target.value;
                setForm({ ...form, hsn: val, HSN: val });
              }}
              className={`${inputClass} font-mono`}
            />
          </InputField>
          <InputField label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
              {state.categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </InputField>
          <InputField label="Brand">
            <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inputClass} />
          </InputField>
          <InputField label="Unit">
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass}>
              {state.units.map((u) => <option key={u.id} value={u.shortName}>{u.shortName} ({u.name})</option>)}
            </select>
          </InputField>
          <InputField label="Warehouse">
            <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className={inputClass}>
              {state.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </InputField>
          <InputField label="Purchase Price (₹)">
            <input type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} className={`${inputClass} font-mono`} />
          </InputField>
          <InputField label="Selling Price (₹)" required>
            <input type="number" step="0.01" required value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} className={`${inputClass} font-mono`} />
          </InputField>
          <InputField label="MRP (₹)">
            <input type="number" step="0.01" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} className={`${inputClass} font-mono`} />
          </InputField>
          <InputField label="GST Rate (%)">
            <select value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })} className={inputClass}>
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </InputField>
          <InputField label={editing ? 'Current Stock' : 'Opening Stock'}>
            <input
              type="number"
              value={form.stock !== undefined ? form.stock : form.openingStock}
              onChange={(e) => {
                const val = e.target.value;
                setForm({ ...form, stock: val, openingStock: val });
              }}
              className={`${inputClass} font-mono`}
            />
          </InputField>
          <InputField label="Minimum Stock Alert">
            <input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className={`${inputClass} font-mono`} />
          </InputField>
        </form>
      </Modal>

      {/* Product Detail Modal */}
      <Modal open={Boolean(detailProd)} onClose={() => setDetailProd(null)} title={detailProd?.name} size="md">
        {detailProd && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded bg-slate-50 p-2.5"><strong>SKU:</strong> <span className="font-mono">{detailProd.sku || detailProd.SKU}</span></div>
              <div className="rounded bg-slate-50 p-2.5"><strong>Barcode:</strong> <span className="font-mono">{detailProd.barcode || '—'}</span></div>
              <div className="rounded bg-slate-50 p-2.5"><strong>HSN:</strong> <span className="font-mono">{detailProd.hsn || detailProd.HSN}</span></div>
              <div className="rounded bg-slate-50 p-2.5"><strong>GST Slab:</strong> {detailProd.gstRate}%</div>
              <div className="rounded bg-slate-50 p-2.5"><strong>Purchase Cost:</strong> {formatINR(detailProd.purchasePrice)}</div>
              <div className="rounded bg-slate-50 p-2.5"><strong>Selling Price:</strong> {formatINR(detailProd.sellingPrice)}</div>
              <div className="rounded bg-slate-50 p-2.5"><strong>Current Stock:</strong> {detailProd.stock} {detailProd.unit || 'PCS'}</div>
              <div className="rounded bg-slate-50 p-2.5"><strong>Min Threshold:</strong> {detailProd.minStock || 5} {detailProd.unit || 'PCS'}</div>
            </div>

            {/* Purchase Lots History */}
            {purchaseLots.filter((l) => String(l.productId) === String(detailProd.id || detailProd._id)).length > 0 && (
              <div className="border-t border-slate-200 pt-3">
                <h4 className="text-xs font-semibold text-slate-900 mb-2">Purchase Lots &amp; Rates for this Item</h4>
                <div className="max-h-48 overflow-y-auto rounded border border-slate-200 text-[11px]">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-1.5 text-left">Bill #</th>
                        <th className="p-1.5 text-left">Supplier</th>
                        <th className="p-1.5 text-right">Rate</th>
                        <th className="p-1.5 text-right">Qty</th>
                        <th className="p-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchaseLots.filter((l) => String(l.productId) === String(detailProd.id || detailProd._id)).map((l, i) => (
                        <tr key={i}>
                          <td className="p-1.5 font-mono text-indigo-600">{l.billNumber}</td>
                          <td className="p-1.5">{l.supplierName}</td>
                          <td className="p-1.5 text-right font-mono font-semibold text-emerald-700">{formatINR(l.rate)}</td>
                          <td className="p-1.5 text-right font-mono">{l.qty}</td>
                          <td className="p-1.5 text-right font-mono">{formatINR(l.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Split Lot into Dedicated Product Variant Modal */}
      <Modal
        open={Boolean(splitModalLot)}
        onClose={() => setSplitModalLot(null)}
        title={`Split into Dedicated Product Variant — ${splitModalLot?.productName}`}
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setSplitModalLot(null)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="split-lot-form" disabled={isSplitting} className={btnPrimary}>
              {isSplitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Splitting...
                </>
              ) : (
                <>
                  <Split className="h-3.5 w-3.5" /> Confirm Split to Variant
                </>
              )}
            </button>
          </>
        }
      >
        <form id="split-lot-form" onSubmit={handleExecuteSplit} className="space-y-3">
          <p className="text-xs text-slate-600">
            Create an independent product record for this purchase lot so it has its own SKU, purchase rate, sale price, and stock count in inventory and POS.
          </p>
          <div className="rounded bg-indigo-50/70 border border-indigo-100 p-2.5 text-xs text-indigo-900">
            <div><strong>Parent Product:</strong> {splitModalLot?.productName} (Current Stock: {splitModalLot?.currentStock})</div>
            {splitModalLot?.purchaseRate ? <div><strong>Purchase Rate:</strong> {formatINR(splitModalLot.purchaseRate)}</div> : null}
          </div>
          <InputField label="New Product Variant Name" required>
            <input
              type="text"
              required
              value={splitForm.newProductName}
              onChange={(e) => setSplitForm({ ...splitForm, newProductName: e.target.value })}
              className={inputClass}
              placeholder="e.g. TV (Samsung 55 inch OLED)"
            />
          </InputField>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="New SKU" required>
              <input
                type="text"
                required
                value={splitForm.newSku}
                onChange={(e) => setSplitForm({ ...splitForm, newSku: e.target.value.toUpperCase() })}
                className={`${inputClass} font-mono`}
              />
            </InputField>
            <InputField label="Quantity to Transfer" required>
              <input
                type="number"
                min="1"
                max={splitModalLot?.maxQty || splitModalLot?.currentStock || 9999}
                required
                value={splitForm.qtyToTransfer}
                onChange={(e) => setSplitForm({ ...splitForm, qtyToTransfer: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </InputField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Purchase Cost (₹)" required>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={splitForm.purchasePrice}
                onChange={(e) => setSplitForm({ ...splitForm, purchasePrice: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </InputField>
            <InputField label="Selling Price (₹)" required>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={splitForm.sellingPrice}
                onChange={(e) => setSplitForm({ ...splitForm, sellingPrice: e.target.value })}
                className={`${inputClass} font-mono`}
              />
            </InputField>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const CategoriesPage = () => {
  const { state, upsertRecord, deleteRecord, confirmAction } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', description: '', hsnDefault: '' });

  const openModal = (cat = null) => {
    setForm(cat || { id: '', name: '', description: '', hsnDefault: '8536' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await upsertRecord(
        'categories',
        { ...form, id: form.id || form._id || undefined, _id: form._id || form.id || undefined },
        'Category',
        'name'
      );
      setModalOpen(false);
    } catch (err) {
      notify(err.message || 'Failed to save category', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Product Categories"
        subtitle="Organize items by business line and default HSN codes"
        breadcrumbs={['Inventory', 'Categories']}
        actions={<button type="button" onClick={() => openModal()} className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Add Category</button>}
      />
      <DataTable
        data={state.categories}
        searchFields={['name', 'hsnDefault']}
        columns={[
          { key: 'name', label: 'Category Name', render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
          { key: 'hsnDefault', label: 'Default HSN', render: (r) => <span className="font-mono text-xs">{r.hsnDefault}</span> },
          { key: 'description', label: 'Description' },
          {
            key: 'count',
            label: 'Products',
            align: 'right',
            render: (r) => state.products.filter((p) => !p.archived && p.category === r.name).length,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => openModal(r)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5" /></button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmAction({ title: `Delete ${r.name}?`, message: 'Remove this category?', confirmText: 'Delete', danger: true })) {
                      try {
                        await deleteRecord('categories', r.id || r._id, 'Category', r.name);
                      } catch (err) {
                        notify(err.message || 'Failed to delete category', 'error');
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
        title={form.id ? 'Edit Category' : 'Add Category'}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="cat-form" className={btnPrimary}>Save</button>
          </>
        }
      >
        <form id="cat-form" onSubmit={handleSave} className="space-y-3">
          <InputField label="Category Name" required><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Default HSN"><input type="text" value={form.hsnDefault} onChange={(e) => setForm({ ...form, hsnDefault: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Description"><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} /></InputField>
        </form>
      </Modal>
    </div>
  );
};

export const UnitsPage = () => {
  const { state, upsertRecord, deleteRecord, confirmAction } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', shortName: '', uqc: '' });

  const openModal = (u = null) => {
    setForm(u || { id: '', name: '', shortName: '', uqc: '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await upsertRecord(
        'units',
        { ...form, id: form.id || form._id || undefined, _id: form._id || form.id || undefined },
        'Unit',
        'name'
      );
      setModalOpen(false);
    } catch (err) {
      notify(err.message || 'Failed to save unit', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Measurement Units (UQC)"
        subtitle="Configure GST-compliant Unique Quantity Codes for invoicing"
        breadcrumbs={['Inventory', 'Units']}
        actions={<button type="button" onClick={() => openModal()} className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Add Unit</button>}
      />
      <DataTable
        data={state.units}
        columns={[
          { key: 'name', label: 'Unit Name', render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
          { key: 'shortName', label: 'Symbol', render: (r) => <span className="font-mono">{r.shortName}</span> },
          { key: 'uqc', label: 'GST UQC Code', render: (r) => <span className="font-mono text-xs">{r.uqc}</span> },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => openModal(r)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5" /></button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmAction({ title: `Delete ${r.name}?`, message: 'Remove this measurement unit?', confirmText: 'Delete', danger: true })) {
                      try {
                        await deleteRecord('units', r.id || r._id, 'Unit', r.name);
                      } catch (err) {
                        notify(err.message || 'Failed to delete unit', 'error');
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
        title={form.id ? 'Edit Unit' : 'Add Unit'}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="unit-form" className={btnPrimary}>Save</button>
          </>
        }
      >
        <form id="unit-form" onSubmit={handleSave} className="space-y-3">
          <InputField label="Unit Name" required><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Short Symbol" required><input type="text" required value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} className={inputClass} /></InputField>
          <InputField label="GST UQC Code"><input type="text" value={form.uqc} onChange={(e) => setForm({ ...form, uqc: e.target.value })} className={inputClass} placeholder="e.g. PCS-PIECES" /></InputField>
        </form>
      </Modal>
    </div>
  );
};

export const StockOverviewPage = () => {
  const { state } = useApp();
  const navigate = useNavigate();

  const activeProducts = useMemo(() => (state.products || []).filter((p) => !p.archived), [state.products]);
  const summary = useMemo(() => getStockValuationSummary(state.products), [state.products]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map();
    activeProducts.forEach((p) => {
      if (!map.has(p.category)) {
        map.set(p.category, { category: p.category, skus: 0, units: 0, costValue: 0, retailValue: 0 });
      }
      const row = map.get(p.category);
      row.skus += 1;
      row.units += Number(p.stock) || 0;
      row.costValue += (Number(p.stock) || 0) * (Number(p.purchasePrice) || 0);
      row.retailValue += (Number(p.stock) || 0) * (Number(p.sellingPrice) || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.costValue - a.costValue);
  }, [activeProducts]);

  const alertProducts = useMemo(
    () => activeProducts.filter((p) => (p.stock || 0) <= (p.minStock || 5)),
    [activeProducts]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Overview & Valuation"
        subtitle="Real-time inventory valuation, warehouse distribution, and reorder alerts"
        breadcrumbs={['Inventory', 'Stock Overview']}
        actions={
          <>
            <button type="button" onClick={() => navigate('/inventory/stock')} className={btnSecondary}>
              Adjust Stock / Movements
            </button>
            <button type="button" onClick={() => navigate('/purchases/new')} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" /> Reorder Purchase
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cost Valuation" value={formatINR(summary.costValuation, false)} subtext={`${summary.totalSkus} active SKUs`} />
        <StatCard label="Retail Valuation" value={formatINR(summary.retailValuation, false)} subtext={`${summary.totalUnits} total units`} />
        <StatCard label="Potential Gross Margin" value={formatINR(summary.potentialMargin, false)} tone="success" />
        <StatCard
          label="Low / Out of Stock"
          value={`${summary.lowStock.length} / ${summary.outOfStock.length}`}
          tone={alertProducts.length > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7">
          <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Category-Wise Stock Valuation</h3>
          <DataTable
            data={categoryBreakdown}
            pageSize={8}
            columns={[
              { key: 'category', label: 'Category', render: (r) => <span className="font-medium text-slate-900">{r.category}</span> },
              { key: 'skus', label: 'SKUs', align: 'right' },
              { key: 'units', label: 'Units', align: 'right', render: (r) => <span className="font-mono">{r.units}</span> },
              { key: 'costValue', label: 'Cost Value', align: 'right', render: (r) => formatINR(r.costValue) },
              { key: 'retailValue', label: 'Retail Value', align: 'right', render: (r) => formatINR(r.retailValue) },
            ]}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-900">Warehouse Stock Snapshot</h3>
          <div className="space-y-2.5">
            {state.warehouses.map((w) => {
              const prods = activeProducts.filter((p) => p.warehouseId === w.id);
              const val = prods.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.purchasePrice) || 0), 0);
              return (
                <div key={w.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{w.name}</div>
                    <div className="text-slate-500">{w.city} · {prods.length} SKUs</div>
                  </div>
                  <div className="text-right font-mono font-semibold text-slate-900">{formatINR(val, false)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">
          Low Stock &amp; Out-of-Stock Replenishment Alerts ({alertProducts.length})
        </h3>
        <DataTable
          data={alertProducts}
          searchFields={['name', 'sku']}
          emptyTitle="All SKUs are healthy"
          emptyDescription="No active products are below their minimum reorder threshold."
          columns={[
            { key: 'sku', label: 'SKU', render: (r) => <span className="font-mono text-xs">{r.sku}</span> },
            { key: 'name', label: 'Product', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
            { key: 'stock', label: 'Current Stock', align: 'right', render: (r) => <span className="font-mono font-semibold">{r.stock} {r.unit}</span> },
            { key: 'minStock', label: 'Min Threshold', align: 'right', render: (r) => <span className="font-mono">{r.minStock || 5} {r.unit}</span> },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusLabel status={(r.stock || 0) <= 0 ? 'Out of Stock' : 'Low Stock'} />,
            },
          ]}
        />
      </div>
    </div>
  );
};

export const StockManagementPage = () => {
  const { state, adjustInventoryStock } = useApp();
  const navigate = useNavigate();
  const [productId, setProductId] = useState(state.products[0]?.id || '');
  const [adjType, setAdjType] = useState('Stock In');
  const [qty, setQty] = useState(5);
  const [warehouseId, setWarehouseId] = useState(state.warehouses[0]?.id || state.warehouses[0]?._id || '');
  const [notes, setNotes] = useState('');

  const handleAdjust = (e) => {
    e.preventDefault();
    const isOut = adjType === 'Stock Out' || adjType === 'Damaged';
    const delta = isOut ? -Math.abs(Number(qty) || 0) : Math.abs(Number(qty) || 0);
    adjustInventoryStock({
      productId,
      type: adjType,
      qtyChange: delta,
      warehouseId,
      notes: notes || `${adjType} manual adjustment`,
    });
    setNotes('');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Movements & Adjustments"
        subtitle="Record Stock In, Stock Out, physical audit adjustments, and damaged write-offs"
        breadcrumbs={['Inventory', 'Stock Movements']}
        actions={
          <button type="button" onClick={() => navigate('/inventory/stock-overview')} className={btnSecondary}>
            View Stock Overview
          </button>
        }
      />

      <form onSubmit={handleAdjust} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <InputField label="Product" required>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
              {state.products.filter((p) => !p.archived).map((p) => (
                <option key={p.id} value={p.id}>{p.name} (Cur: {p.stock})</option>
              ))}
            </select>
          </InputField>
        </div>
        <InputField label="Movement Type">
          <select value={adjType} onChange={(e) => setAdjType(e.target.value)} className={inputClass}>
            <option value="Stock In">Stock In (+)</option>
            <option value="Stock Out">Stock Out (-)</option>
            <option value="Adjustment">Audit Adjustment (+)</option>
            <option value="Damaged">Damaged Stock (-)</option>
          </select>
        </InputField>
        <InputField label="Quantity" required>
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputClass} font-mono`} />
        </InputField>
        <InputField label="Warehouse">
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass}>
            {state.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </InputField>
        <div className="flex items-end">
          <button type="submit" className={`${btnPrimary} w-full`}>Update Stock</button>
        </div>
        <div className="sm:col-span-6">
          <InputField label="Reason / Audit Remarks">
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Physical godown verification" className={inputClass} />
          </InputField>
        </div>
      </form>

      <DataTable
        data={state.stockMovements}
        searchFields={['productName', 'sku', 'reference', 'type']}
        searchPlaceholder="Search movements by SKU, product or reference..."
        columns={[
          { key: 'date', label: 'Date', sortable: true, render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'reference', label: 'Reference', render: (r) => <span className="font-mono text-xs font-medium">{r.reference}</span> },
          { key: 'productName', label: 'Product' },
          { key: 'warehouseName', label: 'Warehouse' },
          { key: 'type', label: 'Type', render: (r) => <StatusLabel status={r.type} /> },
          {
            key: 'qtyChange',
            label: 'Qty Delta',
            align: 'right',
            render: (r) => (
              <span className={`font-mono font-semibold ${r.qtyChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {r.qtyChange >= 0 ? `+${r.qtyChange}` : r.qtyChange}
              </span>
            ),
          },
          { key: 'notes', label: 'Notes' },
        ]}
      />
    </div>
  );
};

export const StockTransfersPage = () => {
  const { state, upsertRecord, adjustInventoryStock, notify } = useApp();
  const [productId, setProductId] = useState(state.products[0]?.id || '');
  const [fromWh, setFromWh] = useState(state.warehouses[0]?.id || 'wh-1');
  const [toWh, setToWh] = useState(state.warehouses[1]?.id || 'wh-2');
  const [qty, setQty] = useState(5);

  const handleTransfer = (e) => {
    e.preventDefault();
    if (fromWh === toWh) {
      notify('Select different source and destination warehouses', 'error');
      return;
    }
    const prod = state.products.find((p) => p.id === productId);
    const toWarehouse = state.warehouses.find((w) => w.id === toWh);
    const fromWarehouse = state.warehouses.find((w) => w.id === fromWh);
    if (!prod) return;

    upsertRecord('products', { ...prod, warehouseId: toWh }, 'Product', 'name');
    adjustInventoryStock({
      productId,
      type: 'Transfer Out',
      qtyChange: 0,
      warehouseId: toWh,
      reference: `TRF-${Date.now().toString().slice(-5)}`,
      notes: `Transferred ${qty} ${prod.unit} from ${fromWarehouse?.name} to ${toWarehouse?.name}`,
    });
    notify(`Transferred ${qty} ${prod.unit} to ${toWarehouse?.name}`);
  };

  const transferMovements = state.stockMovements.filter((m) => m.type.includes('Transfer'));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inter-Warehouse Stock Transfers"
        subtitle="Move inventory between Jaipur Main Godown, Sitapura Hub, and Vishwakarma Depot"
        breadcrumbs={['Inventory', 'Stock Transfers']}
      />
      <form onSubmit={handleTransfer} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <InputField label="Product">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
              {state.products.filter((p) => !p.archived).map((p) => (
                <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
              ))}
            </select>
          </InputField>
        </div>
        <InputField label="From Warehouse">
          <select value={fromWh} onChange={(e) => setFromWh(e.target.value)} className={inputClass}>
            {state.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </InputField>
        <InputField label="To Warehouse">
          <select value={toWh} onChange={(e) => setToWh(e.target.value)} className={inputClass}>
            {state.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </InputField>
        <div className="flex items-end gap-2">
          <div className="w-20">
            <InputField label="Qty">
              <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputClass} font-mono`} />
            </InputField>
          </div>
          <button type="submit" className={btnPrimary}><ArrowLeftRight className="h-3.5 w-3.5" /> Transfer</button>
        </div>
      </form>

      <DataTable
        data={transferMovements}
        emptyTitle="No recent inter-warehouse transfers"
        emptyDescription="Submit a transfer above to log a warehouse movement."
        columns={[
          { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
          { key: 'reference', label: 'Transfer Ref', render: (r) => <span className="font-mono">{r.reference}</span> },
          { key: 'productName', label: 'Product' },
          { key: 'warehouseName', label: 'Destination' },
          { key: 'notes', label: 'Details' },
        ]}
      />
    </div>
  );
};

export const WarehousesPage = () => {
  const { state, upsertRecord, deleteRecord, confirmAction, notify } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: '', _id: '', name: '', code: '', city: '', state: '', address: '', manager: '', capacity: '', isDefault: false });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      notify('Warehouse name and code are required', 'error');
      return;
    }
    try {
      await upsertRecord(
        'warehouses',
        {
          ...form,
          id: form.id || form._id || undefined,
          _id: form._id || form.id || undefined,
          warehouseName: form.name.trim(),
          warehouseCode: form.code.trim().toUpperCase(),
          address: form.address ? form.address.trim() : '',
          city: form.city ? form.city.trim() : '',
          state: form.state ? form.state.trim() : '',
          manager: form.manager ? form.manager.trim() : '',
          capacity: form.capacity ? form.capacity.trim() : '',
          isDefault: form.isDefault,
        },
        'Warehouse',
        'name'
      );
      setModalOpen(false);
    } catch (err) {
      notify(err.message || 'Failed to save warehouse', 'error');
    }
  };

  const openAddModal = () => {
    setForm({ id: '', _id: '', name: '', code: '', city: '', state: '', address: '', manager: '', capacity: '', isDefault: false });
    setModalOpen(true);
  };

  const warehouses = state.warehouses || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Warehouses & Godowns"
        subtitle="Manage multi-location storage facilities and warehouse-wise inventory valuation"
        breadcrumbs={['Inventory', 'Warehouses']}
        actions={
          <button type="button" onClick={openAddModal} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" /> Add Warehouse
          </button>
        }
      />

      {warehouses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-2xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-3">
            <Warehouse className="h-6 w-6" />
          </div>
          <h3 className="font-display text-base font-semibold text-slate-900">No warehouses yet</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            No warehouses or godowns have been registered yet. Add your primary warehouse or storage location to track inventory across facilities.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className={`mt-4 ${btnPrimary}`}
          >
            <Plus className="h-3.5 w-3.5" /> Add Warehouse
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {warehouses.map((w) => {
            const wId = w._id || w.id;
            const prods = (state.products || []).filter((p) => !p.archived && (p.warehouseId === wId || p.warehouseId === w.id));
            const val = prods.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.purchasePrice) || 0), 0);
            return (
              <div key={wId || w.code} className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 shadow-2xs hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-indigo-600">{w.code || w.warehouseCode}</span>
                      {(w.isDefault || warehouses.length === 1) && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          Default
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-base font-semibold text-slate-900">{w.name || w.warehouseName}</h3>
                    {(w.city || w.state) && (
                      <p className="text-xs text-slate-500">
                        {w.city}{w.city && w.state ? ', ' : ''}{w.state}
                      </p>
                    )}
                    {w.address && <p className="text-xs text-slate-400 truncate max-w-xs">{w.address}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          id: wId,
                          _id: wId,
                          name: w.name || w.warehouseName || '',
                          code: w.code || w.warehouseCode || '',
                          city: w.city || '',
                          state: w.state || '',
                          address: w.address || '',
                          manager: w.manager || '',
                          capacity: w.capacity || '',
                          isDefault: Boolean(w.isDefault),
                        });
                        setModalOpen(true);
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100"
                      title="Edit Warehouse"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          await confirmAction({
                            title: `Delete ${w.name || w.warehouseName}?`,
                            message: 'Remove this warehouse from your organization?',
                            confirmText: 'Delete',
                            danger: true,
                          })
                        ) {
                          try {
                            await deleteRecord('warehouses', wId, 'Warehouse', w.name || w.warehouseName);
                          } catch (err) {
                            notify(err.message || 'Failed to delete warehouse', 'error');
                          }
                        }
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Delete Warehouse"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <div className="text-slate-500">SKUs Stored</div>
                    <div className="font-mono font-semibold text-slate-900">{prods.length}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Stock Value</div>
                    <div className="font-mono font-semibold text-slate-900">{formatINR(val, false)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Manager</div>
                    <div className="font-medium text-slate-800">{w.manager || '—'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Capacity</div>
                    <div className="font-mono text-slate-800">{w.capacity || '—'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id || form._id ? 'Edit Warehouse' : 'Add Warehouse'}
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="wh-form" className={btnPrimary}>Save Warehouse</button>
          </>
        }
      >
        <form id="wh-form" onSubmit={handleSave} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <InputField label="Warehouse Name" required>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="e.g. Central Distribution Depot"
              />
            </InputField>
          </div>
          <InputField label="Code" required>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={inputClass}
              placeholder="e.g. WH-01"
            />
          </InputField>
          <InputField label="Manager">
            <input
              type="text"
              value={form.manager || ''}
              onChange={(e) => setForm({ ...form, manager: e.target.value })}
              className={inputClass}
              placeholder="e.g. Warehouse In-charge"
            />
          </InputField>
          <InputField label="City">
            <input
              type="text"
              value={form.city || ''}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className={inputClass}
              placeholder="e.g. Mumbai"
            />
          </InputField>
          <InputField label="State">
            <input
              type="text"
              value={form.state || ''}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className={inputClass}
              placeholder="e.g. Maharashtra"
            />
          </InputField>
          <div className="col-span-2">
            <InputField label="Address">
              <input
                type="text"
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={inputClass}
                placeholder="Facility street address, area or plot number"
              />
            </InputField>
          </div>
          <InputField label="Capacity">
            <input
              type="text"
              value={form.capacity || ''}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              className={inputClass}
              placeholder="e.g. 5,000 sq ft"
            />
          </InputField>
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="wh-is-default"
              checked={Boolean(form.isDefault)}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="wh-is-default" className="text-sm font-medium text-slate-700 cursor-pointer">
              Set as primary / default facility
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const BatchExpiryPage = () => {
  const { state, upsertRecord } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    productId: state.products[0]?.id || state.products[0]?._id || '',
    batchNo: '',
    mfgDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    qty: 1,
    warehouseId: state.warehouses[0]?.id || state.warehouses[0]?._id || '',
  });

  const getExpiryStatus = (expDate) => {
    const today = new Date();
    const exp = new Date(expDate);
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Expired';
    if (diffDays <= 45) return 'Pending';
    return 'Active';
  };

  const handleSave = (e) => {
    e.preventDefault();
    const prod = state.products.find((p) => p.id === form.productId);
    upsertRecord(
      'batches',
      {
        id: `bat-${Date.now()}`,
        productId: form.productId,
        productName: prod?.name || '',
        batchNo: form.batchNo,
        mfgDate: form.mfgDate,
        expiryDate: form.expiryDate,
        qty: Number(form.qty),
        warehouseId: form.warehouseId,
      },
      'Batch',
      'batchNo'
    );
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Batch & Expiry Management"
        subtitle="Monitor manufacturing batches, shelf life alerts, and near-expiry FMCG stock"
        breadcrumbs={['Inventory', 'Batch & Expiry']}
        actions={
          <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" /> Add Batch
          </button>
        }
      />



      <DataTable
        data={state.batches}
        searchFields={['batchNo', 'productName']}
        columns={[
          { key: 'batchNo', label: 'Batch #', render: (r) => <span className="font-mono font-semibold text-slate-900">{r.batchNo}</span> },
          { key: 'productName', label: 'Product' },
          { key: 'mfgDate', label: 'Mfg Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.mfgDate)}</span> },
          { key: 'expiryDate', label: 'Expiry Date', sortable: true, render: (r) => <span className="font-mono text-xs font-medium">{formatDateIN(r.expiryDate)}</span> },
          { key: 'qty', label: 'Batch Qty', align: 'right', render: (r) => <span className="font-mono font-semibold">{r.qty}</span> },
          {
            key: 'status',
            label: 'Shelf Status',
            render: (r) => {
              const st = getExpiryStatus(r.expiryDate);
              return <StatusLabel status={st === 'Pending' ? 'Expiring Soon' : st} />;
            },
          },
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Product Batch"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="batch-form" className={btnPrimary}>Save Batch</button>
          </>
        }
      >
        <form id="batch-form" onSubmit={handleSave} className="space-y-3">
          <InputField label="Product" required>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className={inputClass}>
              {state.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </InputField>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Batch Number" required><input type="text" required value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} className={inputClass} /></InputField>
            <InputField label="Quantity" required><input type="number" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={inputClass} /></InputField>
            <InputField label="Mfg Date"><input type="date" value={form.mfgDate} onChange={(e) => setForm({ ...form, mfgDate: e.target.value })} className={inputClass} /></InputField>
            <InputField label="Expiry Date" required><input type="date" required value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputClass} /></InputField>
          </div>
        </form>
      </Modal>
    </div>
  );
};
