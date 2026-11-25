import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useApp } from '../../context/AppContext';
import * as reportsService from '../../services/reportsService';
import {
  formatINR,
  formatDateIN,
  round2,
  getCustomerOutstanding,
  getSupplierOutstanding,
} from '../../services/calculationService';
import { GSTReportsContent } from '../gst/GSTPages';
import { getStockValuationSummary } from '../../services/inventoryService';
import { computeFinancialStatements } from '../../services/accountingService';
import { printElement } from '../../services/printService';
import { exportToCSV } from '../../services/storageService';
import {
  PageHeader,
  DataTable,
  StatCard,
  SegmentedTabs,
  btnSecondary,
} from '../../components/common/UI';

export const ReportsCenterPage = ({ category = 'sales' }) => {
  const { state, selectedFY, notify } = useApp();
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState('2026-04-01');
  const [dateTo, setDateTo] = useState('2027-03-31');
  const [subTab, setSubTab] = useState('primary');
  const [backendReport, setBackendReport] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchReport = async () => {
      try {
        const params = { financialYear: selectedFY, startDate: dateFrom, endDate: dateTo };
        let res = null;
        if (category === 'sales') res = await reportsService.getSalesSummary(params);
        else if (category === 'purchases') res = await reportsService.getPurchaseSummary(params);
        else if (category === 'inventory') res = await reportsService.getStockValuationReport();
        if (!cancelled && res) setBackendReport(res);
      } catch (err) {
        console.warn('Backend report notice:', err?.message);
      }
    };
    fetchReport();
    return () => { cancelled = true; };
  }, [category, selectedFY, dateFrom, dateTo]);

  const inRange = (d) => (!d ? true : d >= dateFrom && d <= dateTo);

  const validInvoices = useMemo(
    () =>
      (state.invoices || []).filter(
        (i) => i.status !== 'Draft' && i.status !== 'Cancelled' && i.financialYear === selectedFY && inRange(i.date)
      ),
    [state.invoices, selectedFY, dateFrom, dateTo]
  );

  const validPurchases = useMemo(
    () =>
      (state.purchases || []).filter(
        (p) => p.status !== 'Cancelled' && p.financialYear === selectedFY && inRange(p.date)
      ),
    [state.purchases, selectedFY, dateFrom, dateTo]
  );

  const validExpenses = useMemo(
    () => (state.expenses || []).filter((e) => e.status !== 'Archived' && inRange(e.date)),
    [state.expenses, dateFrom, dateTo]
  );

  // Product-wise sales
  const productSales = useMemo(() => {
    const map = new Map();
    validInvoices.forEach((inv) => {
      (inv.items || []).forEach((it) => {
        if (!map.has(it.productId || it.name)) {
          map.set(it.productId || it.name, { name: it.name, sku: it.sku, qty: 0, revenue: 0 });
        }
        const e = map.get(it.productId || it.name);
        e.qty += Number(it.qty) || 0;
        e.revenue = round2(e.revenue + (Number(it.totalAmount) || 0));
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [validInvoices]);

  // Customer-wise sales
  const customerSales = useMemo(() => {
    const map = new Map();
    validInvoices.forEach((inv) => {
      if (!map.has(inv.customerId)) {
        map.set(inv.customerId, { id: inv.customerId, name: inv.customerName, count: 0, taxable: 0, total: 0 });
      }
      const c = map.get(inv.customerId);
      c.count += 1;
      c.taxable = round2(c.taxable + inv.taxableValue);
      c.total = round2(c.total + inv.grandTotal);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [validInvoices]);

  // Ageing buckets for receivables
  const receivablesAgeing = useMemo(() => {
    const today = new Date();
    return state.customers
      .map((c) => {
        const out = getCustomerOutstanding(c, state.invoices, state.creditNotes);
        const unpaidInvs = state.invoices.filter((i) => i.customerId === c.id && i.status === 'Finalized' && i.paymentStatus !== 'Paid');
        let b0_30 = 0;
        let b31_60 = 0;
        let b60plus = 0;
        unpaidInvs.forEach((inv) => {
          const bal = Math.max(0, inv.grandTotal - inv.amountPaid);
          const days = Math.floor((today - new Date(inv.date)) / 86400000);
          if (days <= 30) b0_30 += bal;
          else if (days <= 60) b31_60 += bal;
          else b60plus += bal;
        });
        return { id: c.id, name: c.name, state: c.state, total: out, b0_30: round2(b0_30), b31_60: round2(b31_60), b60plus: round2(b60plus) };
      })
      .filter((r) => r.total > 0);
  }, [state.customers, state.invoices, state.creditNotes]);

  const payablesList = useMemo(
    () =>
      state.suppliers
        .map((s) => ({ id: s.id, name: s.name, state: s.state, payable: getSupplierOutstanding(s, state.purchases, state.purchaseReturns) }))
        .filter((r) => r.payable > 0),
    [state.suppliers, state.purchases, state.purchaseReturns]
  );

  const stockSummary = useMemo(() => getStockValuationSummary(state.products), [state.products]);
  const finStatements = useMemo(() => computeFinancialStatements(state), [state]);

  const titleMap = {
    sales: 'Sales Reports & Register',
    purchases: 'Purchase Reports & Register',
    inventory: 'Inventory Valuation & Expiry Reports',
    gst: 'GST Tax & HSN Reports',
    financial: 'Financial Statements & Cash Flow',
    expenses: 'Expense Analytics Report',
    'receivables-payables': 'Receivables, Payables & Ageing Report',
    analytics: 'Executive Business Analytics',
  };

  const DateFilterBar = (
    <div className="no-print flex flex-wrap items-center gap-2 text-xs">
      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5" />
      <span className="text-slate-400">to</span>
      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5" />
      <button
        type="button"
        onClick={() =>
          printElement({
            elementId: 'report-center-sheet',
            title: titleMap[category] || 'ArthaGST Report',
            fileName: `report-${category}.html`,
            onNotify: notify,
          })
        }
        className={btnSecondary}
      >
        <Printer className="h-3.5 w-3.5" /> Print
      </button>
    </div>
  );

  return (
    <div id="report-center-sheet" className="space-y-5">
      <PageHeader
        title={titleMap[category] || 'Reports & Analytics'}
        subtitle={`FY ${selectedFY} · Live derived insights with CSV export and drill-down`}
        breadcrumbs={['Reports & Analytics', titleMap[category]]}
        actions={DateFilterBar}
      />

      {category === 'sales' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total Sales Value" value={formatINR(backendReport?.totalGrossSales ?? validInvoices.reduce((s, i) => s + i.grandTotal, 0), false)} />
            <StatCard label="Taxable Turnover" value={formatINR(backendReport?.totalTaxableAmount ?? validInvoices.reduce((s, i) => s + i.taxableValue, 0), false)} />
            <StatCard label="Invoices Count" value={backendReport?.invoiceCount ?? validInvoices.length} />
          </div>
          <SegmentedTabs
            activeTab={subTab}
            onChange={setSubTab}
            tabs={[
              { id: 'primary', label: 'Sales Register' },
              { id: 'products', label: 'Product-wise Sales' },
              { id: 'customers', label: 'Customer-wise Sales' },
            ]}
          />
          {subTab === 'primary' && (
            <DataTable
              data={validInvoices}
              searchFields={['invoiceNumber', 'customerName']}
              filters={
                <button
                  type="button"
                  onClick={() => exportToCSV('sales-register.csv', ['Invoice', 'Date', 'Customer', 'Taxable', 'GST', 'Total'], validInvoices.map((i) => [i.invoiceNumber, i.date, i.customerName, i.taxableValue, i.totalTax, i.grandTotal]))}
                  className={btnSecondary}
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              }
              columns={[
                { key: 'invoiceNumber', label: 'Invoice #', render: (r) => <button type="button" onClick={() => navigate('/sales/invoices')} className="font-mono font-semibold text-indigo-700 hover:underline">{r.invoiceNumber}</button> },
                { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
                { key: 'customerName', label: 'Customer' },
                { key: 'taxableValue', label: 'Taxable', align: 'right', render: (r) => formatINR(r.taxableValue) },
                { key: 'totalTax', label: 'GST', align: 'right', render: (r) => formatINR(r.totalTax) },
                { key: 'grandTotal', label: 'Total', align: 'right', render: (r) => formatINR(r.grandTotal) },
              ]}
            />
          )}
          {subTab === 'products' && (
            <DataTable
              data={productSales}
              searchFields={['name', 'sku']}
              columns={[
                { key: 'sku', label: 'SKU', render: (r) => <span className="font-mono text-xs">{r.sku}</span> },
                { key: 'name', label: 'Product Name' },
                { key: 'qty', label: 'Units Sold', align: 'right' },
                { key: 'revenue', label: 'Sales Revenue', align: 'right', render: (r) => formatINR(r.revenue) },
              ]}
            />
          )}
          {subTab === 'customers' && (
            <DataTable
              data={customerSales}
              columns={[
                { key: 'name', label: 'Customer', render: (r) => <button type="button" onClick={() => navigate(`/parties/customers/${r.id}`)} className="font-medium text-indigo-700 hover:underline">{r.name}</button> },
                { key: 'count', label: 'Invoices', align: 'right' },
                { key: 'taxable', label: 'Taxable Value', align: 'right', render: (r) => formatINR(r.taxable) },
                { key: 'total', label: 'Total Billed', align: 'right', render: (r) => formatINR(r.total) },
              ]}
            />
          )}
        </>
      )}

      {category === 'purchases' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total Purchases" value={formatINR(backendReport?.totalGrossPurchases ?? validPurchases.reduce((s, p) => s + p.grandTotal, 0), false)} />
            <StatCard label="Input GST (ITC)" value={formatINR(backendReport?.totalTaxAmount ?? validPurchases.reduce((s, p) => s + p.totalTax, 0), false)} tone="success" />
            <StatCard label="Purchase Bills" value={backendReport?.billCount ?? validPurchases.length} />
          </div>
          <DataTable
            data={validPurchases}
            searchFields={['billNumber', 'supplierName', 'supplierInvoiceNo']}
            filters={
              <button
                type="button"
                onClick={() => exportToCSV('purchase-report.csv', ['Bill', 'Supplier Inv', 'Supplier', 'Date', 'Taxable', 'GST', 'Total'], validPurchases.map((p) => [p.billNumber, p.supplierInvoiceNo, p.supplierName, p.date, p.taxableValue, p.totalTax, p.grandTotal]))}
                className={btnSecondary}
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            }
            columns={[
              { key: 'billNumber', label: 'Bill #', render: (r) => <span className="font-mono font-semibold">{r.billNumber}</span> },
              { key: 'supplierInvoiceNo', label: 'Supplier Inv' },
              { key: 'supplierName', label: 'Supplier' },
              { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
              { key: 'taxableValue', label: 'Taxable', align: 'right', render: (r) => formatINR(r.taxableValue) },
              { key: 'totalTax', label: 'GST', align: 'right', render: (r) => formatINR(r.totalTax) },
              { key: 'grandTotal', label: 'Total', align: 'right', render: (r) => formatINR(r.grandTotal) },
            ]}
          />
        </>
      )}

      {category === 'inventory' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard label="Cost Valuation" value={formatINR(stockSummary.costValuation, false)} />
            <StatCard label="Retail Valuation" value={formatINR(stockSummary.retailValuation, false)} />
            <StatCard label="Potential Margin" value={formatINR(stockSummary.potentialMargin, false)} tone="success" />
            <StatCard label="Low / Out of Stock" value={`${stockSummary.lowStock.length} / ${stockSummary.outOfStock.length}`} tone="warning" />
          </div>
          <DataTable
            data={state.products.filter((p) => !p.archived)}
            searchFields={['name', 'sku', 'category']}
            columns={[
              { key: 'sku', label: 'SKU', render: (r) => <span className="font-mono text-xs">{r.sku}</span> },
              { key: 'name', label: 'Product' },
              { key: 'category', label: 'Category' },
              { key: 'stock', label: 'Stock Qty', align: 'right' },
              { key: 'purchasePrice', label: 'Cost/Unit', align: 'right', render: (r) => formatINR(r.purchasePrice) },
              { key: 'val', label: 'Cost Value', align: 'right', render: (r) => formatINR(r.stock * r.purchasePrice) },
            ]}
          />
        </>
      )}

      {category === 'gst' && (
        <GSTReportsContent
          invoicesOverride={validInvoices}
          purchasesOverride={validPurchases}
          expensesOverride={validExpenses}
        />
      )}

      {category === 'financial' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Net Sales" value={formatINR(finStatements.pnl.netSales, false)} onClick={() => navigate('/accounting/pnl')} />
          <StatCard label="Net Profit" value={formatINR(finStatements.pnl.netProfit, false)} tone="success" onClick={() => navigate('/accounting/pnl')} />
          <StatCard label="Total Balance Sheet Assets" value={formatINR(finStatements.balanceSheet.assets.totalAssets, false)} onClick={() => navigate('/accounting/balance-sheet')} />
        </div>
      )}

      {category === 'expenses' && (
        <DataTable
          data={validExpenses}
          searchFields={['expenseNumber', 'title', 'category', 'vendorName']}
          columns={[
            { key: 'expenseNumber', label: 'Voucher #', render: (r) => <span className="font-mono">{r.expenseNumber}</span> },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'title', label: 'Title' },
            { key: 'category', label: 'Category' },
            { key: 'totalAmount', label: 'Total', align: 'right', render: (r) => formatINR(r.totalAmount) },
          ]}
        />
      )}

      {category === 'receivables-payables' && (
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Receivables Ageing Report (Customers)</h3>
            <DataTable
              data={receivablesAgeing}
              columns={[
                { key: 'name', label: 'Customer', render: (r) => <button type="button" onClick={() => navigate(`/parties/customers/${r.id}`)} className="font-medium text-indigo-700 hover:underline">{r.name}</button> },
                { key: 'state', label: 'State' },
                { key: 'b0_30', label: '0–30 Days', align: 'right', render: (r) => formatINR(r.b0_30) },
                { key: 'b31_60', label: '31–60 Days', align: 'right', render: (r) => formatINR(r.b31_60) },
                { key: 'b60plus', label: '60+ Days', align: 'right', render: (r) => formatINR(r.b60plus) },
                { key: 'total', label: 'Total Receivable', align: 'right', render: (r) => <span className="font-semibold">{formatINR(r.total)}</span> },
              ]}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Outstanding Supplier Payables</h3>
            <DataTable
              data={payablesList}
              columns={[
                { key: 'name', label: 'Supplier', render: (r) => <button type="button" onClick={() => navigate(`/parties/suppliers/${r.id}`)} className="font-medium text-indigo-700 hover:underline">{r.name}</button> },
                { key: 'state', label: 'State' },
                { key: 'payable', label: 'Outstanding Payable', align: 'right', render: (r) => <span className="font-semibold text-rose-700">{formatINR(r.payable)}</span> },
              ]}
            />
          </div>
        </div>
      )}

      {category === 'analytics' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Top Customers by Revenue</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerSales.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val) => formatINR(val)} />
                  <Bar dataKey="total" fill="#4F46E5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Top Selling Products</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productSales.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val) => formatINR(val)} />
                  <Bar dataKey="revenue" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
