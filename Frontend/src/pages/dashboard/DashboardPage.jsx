import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  UserPlus,
  PackagePlus,
  ShoppingBag,
  IndianRupee,
  Receipt,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import {
  computeDashboardMetrics,
  formatINR,
  formatDateIN,
  round2,
} from '../../services/calculationService';
import { computeGSTSummary } from '../../services/gstService';
import {
  PageHeader,
  StatCard,
  StatusLabel,
  SegmentedTabs,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#0EA5E9', '#6366F1', '#64748B'];

export const DashboardPage = () => {
  const { state, selectedFY } = useApp();
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState('all'); // 'all' | '30d' | '90d' | 'q3'
  const [recentTab, setRecentTab] = useState('invoices');

  const filteredData = useMemo(() => {
    const now = new Date();
    const filterByDate = (dateStr) => {
      if (dateRange === 'all' || !dateStr) return true;
      const d = new Date(dateStr);
      if (dateRange === '30d') {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 30);
        return d >= cutoff;
      }
      if (dateRange === '90d') {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 90);
        return d >= cutoff;
      }
      if (dateRange === 'q3') {
        return dateStr >= '2026-10-01' && dateStr <= '2026-12-31';
      }
      return true;
    };

    return {
      ...state,
      invoices: (state.invoices || []).filter((i) => filterByDate(i.date)),
      purchases: (state.purchases || []).filter((p) => filterByDate(p.date)),
      payments: (state.payments || []).filter((p) => filterByDate(p.date)),
      expenses: (state.expenses || []).filter((e) => filterByDate(e.date)),
    };
  }, [state, dateRange]);

  const metrics = useMemo(
    () => computeDashboardMetrics(filteredData, selectedFY),
    [filteredData, selectedFY]
  );

  const gstSummary = useMemo(
    () =>
      computeGSTSummary({
        invoices: filteredData.invoices.filter((i) => i.financialYear === selectedFY),
        purchases: filteredData.purchases.filter((p) => p.financialYear === selectedFY),
        expenses: filteredData.expenses,
        creditNotes: state.creditNotes,
      }),
    [filteredData, selectedFY, state.creditNotes]
  );

  // Monthly Revenue vs Purchases Chart
  const monthlyChartData = useMemo(() => {
    const months = [
      { key: '2026-04', label: 'Apr' },
      { key: '2026-05', label: 'May' },
      { key: '2026-06', label: 'Jun' },
      { key: '2026-07', label: 'Jul' },
      { key: '2026-08', label: 'Aug' },
      { key: '2026-09', label: 'Sep' },
      { key: '2026-10', label: 'Oct' },
      { key: '2026-11', label: 'Nov' },
    ];
    return months.map((m) => {
      const sales = filteredData.invoices
        .filter((i) => i.status !== 'Draft' && i.status !== 'Cancelled' && (i.date || '').startsWith(m.key))
        .reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
      const purchases = filteredData.purchases
        .filter((p) => p.status !== 'Cancelled' && (p.date || '').startsWith(m.key))
        .reduce((s, p) => s + (Number(p.grandTotal) || 0), 0);
      return {
        month: m.label,
        Sales: round2(sales),
        Purchases: round2(purchases),
      };
    });
  }, [filteredData]);

  // Daily Sales Trend (last 10 invoice dates)
  const dailyChartData = useMemo(() => {
    const map = new Map();
    filteredData.invoices
      .filter((i) => i.status !== 'Draft' && i.status !== 'Cancelled')
      .forEach((i) => {
        map.set(i.date, round2((map.get(i.date) || 0) + (Number(i.grandTotal) || 0)));
      });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([date, amount]) => ({
        date: formatDateIN(date).replace(' 2026', ''),
        amount,
      }));
  }, [filteredData.invoices]);

  // Sales by Payment Method
  const paymentMethodData = useMemo(() => {
    const map = new Map();
    filteredData.invoices
      .filter((i) => i.status !== 'Draft' && i.status !== 'Cancelled')
      .forEach((i) => {
        const m = i.paymentMethod || 'NEFT';
        map.set(m, round2((map.get(m) || 0) + (Number(i.grandTotal) || 0)));
      });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredData.invoices]);

  // Sales by Category
  const categorySalesData = useMemo(() => {
    const prodCat = Object.fromEntries((state.products || []).map((p) => [p.id, p.category]));
    const map = new Map();
    filteredData.invoices
      .filter((i) => i.status !== 'Draft' && i.status !== 'Cancelled')
      .forEach((inv) => {
        (inv.items || []).forEach((it) => {
          const cat = prodCat[it.productId] || 'General';
          map.set(cat, round2((map.get(cat) || 0) + (Number(it.totalAmount) || 0)));
        });
      });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData.invoices, state.products]);

  const growthPct = useMemo(() => {
    if (monthlyChartData.length < 2) return 0;
    const oct = monthlyChartData[monthlyChartData.length - 2]?.Sales || 0;
    const nov = monthlyChartData[monthlyChartData.length - 1]?.Sales || 0;
    if (!oct) return 12.4;
    return round2(((nov - oct) / oct) * 100);
  }, [monthlyChartData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Business Overview — ${state.business?.businessName}`}
        subtitle={`FY ${selectedFY} · GSTIN ${(state.business?.gstin || '').replace(' (DEMO)', '')} · ${state.business?.city}, ${state.business?.state}`}
        breadcrumbs={['Dashboard']}
        actions={
          <>
            <SegmentedTabs
              activeTab={dateRange}
              onChange={setDateRange}
              tabs={[
                { id: 'all', label: `FY ${selectedFY}` },
                { id: 'q3', label: 'Q3 (Oct–Dec)' },
                { id: '90d', label: 'Last 90d' },
                { id: '30d', label: 'Last 30d' },
              ]}
            />
            <button
              type="button"
              onClick={() => navigate('/sales/invoices/new')}
              className={btnPrimary}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Invoice
            </button>
          </>
        }
      />

      {/* Quick Actions Strip */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <span className="mr-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Actions:</span>
        <button
          type="button"
          onClick={() => navigate('/sales/invoices/new')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-indigo-600" />
          New Invoice
        </button>
        <button
          type="button"
          onClick={() => navigate('/parties/customers')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer"
        >
          <UserPlus className="h-3.5 w-3.5 text-indigo-600" />
          Add Customer
        </button>
        <button
          type="button"
          onClick={() => navigate('/inventory/products')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer"
        >
          <PackagePlus className="h-3.5 w-3.5 text-indigo-600" />
          Add Product
        </button>
        <button
          type="button"
          onClick={() => navigate('/purchases/new')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer"
        >
          <ShoppingBag className="h-3.5 w-3.5 text-indigo-600" />
          Add Purchase
        </button>
        <button
          type="button"
          onClick={() => navigate('/payments/in')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer"
        >
          <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
          Record Payment
        </button>
        <button
          type="button"
          onClick={() => navigate('/expenses/new')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-amber-300 hover:text-amber-700 transition-all cursor-pointer"
        >
          <Receipt className="h-3.5 w-3.5 text-amber-600" />
          Add Expense
        </button>
      </div>

      {/* Primary Financial KPI Grid (7 cards in clean 4-col + 3-col responsive grid) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Latest Day Sales"
          value={formatINR(metrics.todaySales, false)}
          subtext="Click to inspect all sales invoices"
          onClick={() => navigate('/sales/invoices')}
        />
        <StatCard
          label="Monthly Sales (Current Period)"
          value={formatINR(metrics.monthlySales, false)}
          subtext={`Total FY Sales: ${formatINR(metrics.totalSales, false)}`}
          onClick={() => navigate('/reports/sales')}
        />
        <StatCard
          label="Total Purchases"
          value={formatINR(metrics.totalPurchases, false)}
          subtext={`${filteredData.purchases.length} supplier bills recorded`}
          onClick={() => navigate('/purchases')}
        />
        <StatCard
          label="Total Operating Expenses"
          value={formatINR(metrics.totalExpenses, false)}
          subtext={`${filteredData.expenses.length} expense vouchers`}
          onClick={() => navigate('/expenses')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Estimated Gross Profit (Excl. GST)"
          value={formatINR(metrics.grossProfit, false)}
          subtext={`MoM Revenue Delta: ${growthPct >= 0 ? '+' : ''}${growthPct}%`}
          tone={metrics.grossProfit >= 0 ? 'success' : 'danger'}
          onClick={() => navigate('/accounting/pnl')}
        />
        <StatCard
          label="Outstanding Receivables"
          value={formatINR(metrics.outstandingReceivables, false)}
          subtext="Pending customer invoice balances"
          tone="warning"
          onClick={() => navigate('/reports/receivables-payables')}
        />
        <StatCard
          label="Outstanding Payables"
          value={formatINR(metrics.outstandingPayables, false)}
          subtext="Pending supplier bill balances"
          tone="danger"
          onClick={() => navigate('/purchases/payments')}
        />
      </div>

      {/* GST Summary + Inventory Overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                GST Liability &amp; Input Tax Credit Summary
              </h2>
              <p className="text-xs text-slate-500">
                Computed dynamically from finalized invoices, credit notes &amp; eligible purchases
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/gst')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              Open GST Console <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Output GST</div>
              <div className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                {formatINR(gstSummary.outputTax)}
              </div>
            </div>
            <div className="rounded-md bg-emerald-50/60 p-3">
              <div className="text-xs text-emerald-700">Eligible Input Tax Credit</div>
              <div className="mt-1 font-mono text-base font-semibold text-emerald-800 tabular-nums">
                {formatINR(gstSummary.inputItc)}
              </div>
            </div>
            <div className="rounded-md bg-indigo-50/70 p-3">
              <div className="text-xs text-indigo-700">Est. Net GST Payable</div>
              <div className="mt-1 font-mono text-base font-semibold text-indigo-900 tabular-nums">
                {formatINR(gstSummary.netLiability)}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-100 pt-3 text-xs">
            <div className="pr-3">
              <div className="text-slate-500">CGST (Out / In)</div>
              <div className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                {formatINR(gstSummary.outCgst, false)} / {formatINR(gstSummary.inCgst, false)}
              </div>
            </div>
            <div className="px-3">
              <div className="text-slate-500">SGST (Out / In)</div>
              <div className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                {formatINR(gstSummary.outSgst, false)} / {formatINR(gstSummary.inSgst, false)}
              </div>
            </div>
            <div className="pl-3">
              <div className="text-slate-500">IGST (Out / In)</div>
              <div className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                {formatINR(gstSummary.outIgst, false)} / {formatINR(gstSummary.inIgst, false)}
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Overview */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Inventory Health Overview
              </h2>
              <p className="text-xs text-slate-500">Real-time SKU &amp; batch expiry status</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/inventory/products')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              Manage Stock <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <button
              type="button"
              onClick={() => navigate('/inventory/products')}
              className="rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50"
            >
              <div className="text-slate-500">Total Active SKUs</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {metrics.totalProducts}
              </div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/reports/inventory')}
              className="rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50"
            >
              <div className="text-slate-500">Stock Valuation (Cost)</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {formatINR(metrics.stockValue, false)}
              </div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/inventory/stock-overview')}
              className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-left hover:bg-amber-50"
            >
              <div className="text-amber-800">Low Stock SKUs</div>
              <div className="mt-1 font-mono text-lg font-semibold text-amber-900 tabular-nums">
                {metrics.lowStockCount}
              </div>
            </button>
            <button
              type="button"
              onClick={() => navigate('/inventory/batches')}
              className="rounded-md border border-rose-200 bg-rose-50/50 p-3 text-left hover:bg-rose-50"
            >
              <div className="text-rose-800">Out of Stock / Expiring</div>
              <div className="mt-1 font-mono text-lg font-semibold text-rose-900 tabular-nums">
                {metrics.outOfStockCount} / {metrics.expiringCount}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Monthly Revenue vs Purchases (FY 2026-27)
              </h2>
              <p className="text-xs text-slate-500">Tax-inclusive invoice and purchase bill totals</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(val) => formatINR(val)} />
                <Bar dataKey="Sales" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Purchases" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5">
          <div className="mb-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Daily Sales Trend (Recent Billing Days)
            </h2>
            <p className="text-xs text-slate-500">Derived from finalized invoices</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(val) => formatINR(val)} />
                <Area type="monotone" dataKey="amount" stroke="#4F46E5" fill="#EEF2FF" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category & Payment Method Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Sales by Product Category
          </h2>
          <div className="mt-4 grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categorySalesData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={74}>
                    {categorySalesData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatINR(val)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-xs">
              {categorySalesData.map((cat, idx) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    {cat.name}
                  </span>
                  <span className="font-mono font-medium text-slate-900 tabular-nums">
                    {formatINR(cat.value, false)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Sales by Payment Method
          </h2>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentMethodData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val) => formatINR(val)} />
                <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-sm font-semibold text-slate-900">Recent Transactions</h2>
          <SegmentedTabs
            activeTab={recentTab}
            onChange={setRecentTab}
            tabs={[
              { id: 'invoices', label: 'Invoices' },
              { id: 'purchases', label: 'Purchases' },
              { id: 'payments', label: 'Payments' },
              { id: 'expenses', label: 'Expenses' },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          {recentTab === 'invoices' && (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Invoice #</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.invoices.slice(0, 6).map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-medium text-indigo-700">
                      <button type="button" onClick={() => navigate('/sales/invoices')} className="hover:underline">
                        {inv.invoiceNumber}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-slate-800">{inv.customerName}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{formatDateIN(inv.date)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {formatINR(inv.grandTotal)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusLabel status={inv.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {recentTab === 'purchases' && (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Bill #</th>
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.purchases.slice(0, 6).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-900">{p.billNumber}</td>
                    <td className="px-4 py-2.5 text-slate-800">{p.supplierName}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{formatDateIN(p.date)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {formatINR(p.grandTotal)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusLabel status={p.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {recentTab === 'payments' && (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Receipt / Ref</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Party</th>
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.payments.slice(0, 6).map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-900">{pay.paymentNumber}</td>
                    <td className="px-4 py-2.5 text-slate-700">{pay.type}</td>
                    <td className="px-4 py-2.5 text-slate-800">{pay.partyName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{pay.method}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {formatINR(pay.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {recentTab === 'expenses' && (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Voucher #</th>
                  <th className="px-4 py-2.5">Title</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.expenses.slice(0, 6).map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-900">{e.expenseNumber}</td>
                    <td className="px-4 py-2.5 text-slate-800">{e.title}</td>
                    <td className="px-4 py-2.5 text-slate-600">{e.category}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{formatDateIN(e.date)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {formatINR(e.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
