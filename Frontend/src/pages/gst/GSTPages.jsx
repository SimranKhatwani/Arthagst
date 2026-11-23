import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, AlertTriangle, ArrowUpRight, CheckCircle2, Printer } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { computeGSTSummary, generateGSTR1Data, generateHSNSummary } from '../../services/gstService';
import { formatINR, formatDateIN } from '../../services/calculationService';
import { exportToCSV } from '../../services/storageService';
import { printElement } from '../../services/printService';
import {
  PageHeader,
  DataTable,
  StatCard,
  StatusLabel,
  SegmentedTabs,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

const DemoTaxNotice = () => (
  <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-xs text-indigo-900">
    <AlertTriangle className="h-4 w-4 shrink-0 text-indigo-600" />
    <span>
      GST returns and summaries are computed live from your demo transactions. Actual GSTN portal filing is simulated for prototype demonstration.
    </span>
  </div>
);

export const GSTDashboardPage = () => {
  const { state, selectedFY } = useApp();
  const navigate = useNavigate();

  const summary = useMemo(
    () =>
      computeGSTSummary({
        invoices: state.invoices.filter((i) => i.financialYear === selectedFY),
        purchases: state.purchases.filter((p) => p.financialYear === selectedFY),
        expenses: state.expenses,
        creditNotes: state.creditNotes,
      }),
    [state.invoices, state.purchases, state.expenses, state.creditNotes, selectedFY]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="GST Compliance Dashboard"
        subtitle={`FY ${selectedFY} · GSTIN: ${state.business.gstin} · Regular Taxpayer`}
        breadcrumbs={['GST Management', 'Dashboard']}
        actions={
          <>
            <button type="button" onClick={() => navigate('/gst/reports')} className={btnSecondary}>
              GST &amp; HSN Reports
            </button>
            <button type="button" onClick={() => navigate('/gst/gstr-1')} className={btnSecondary}>
              View GSTR-1
            </button>
            <button type="button" onClick={() => navigate('/gst/gstr-3b')} className={btnPrimary}>
              View GSTR-3B
            </button>
          </>
        }
      />
      <DemoTaxNotice />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outward Taxable Turnover" value={formatINR(summary.totalOutwardTaxable, false)} />
        <StatCard label="Output GST Liability" value={formatINR(summary.outputTax)} />
        <StatCard label="Eligible Input Tax Credit (ITC)" value={formatINR(summary.inputItc)} tone="success" />
        <StatCard label="Estimated Net GST Payable" value={formatINR(summary.netLiability)} tone="warning" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">
          Tax Head-Wise Breakup (CGST / SGST / IGST)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Tax Head</th>
                <th className="px-3 py-2.5 text-right">Output Liability</th>
                <th className="px-3 py-2.5 text-right">Eligible Input ITC</th>
                <th className="px-3 py-2.5 text-right">Est. Net Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2.5 font-medium">CGST (Central GST)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.outCgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{formatINR(summary.inCgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatINR(summary.netCgst)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium">SGST / UTGST (State GST)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.outSgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{formatINR(summary.inSgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatINR(summary.netSgst)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium">IGST (Integrated GST)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.outIgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{formatINR(summary.inIgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatINR(summary.netIgst)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-slate-900">Upcoming Filing Calendar</h3>
          <button type="button" onClick={() => navigate('/gst/calendar')} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
            Full Calendar <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <DataTable
          data={state.gstCalendar}
          pageSize={6}
          columns={[
            { key: 'period', label: 'Return Period' },
            { key: 'returnType', label: 'Return Type', render: (r) => <span className="font-mono font-semibold">{r.returnType}</span> },
            { key: 'dueDate', label: 'Due Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.dueDate)}</span> },
            { key: 'prepStatus', label: 'Preparation', render: (r) => <StatusLabel status={r.prepStatus} /> },
            { key: 'filingStatus', label: 'Filing Status', render: (r) => <StatusLabel status={r.filingStatus} /> },
          ]}
        />
      </div>
    </div>
  );
};

export const GSTR1Page = ({ embedded = false }) => {
  const { state, selectedFY } = useApp();
  const [tab, setTab] = useState('b2b');

  const gstr1 = useMemo(
    () =>
      generateGSTR1Data({
        invoices: state.invoices.filter((i) => i.financialYear === selectedFY),
        creditNotes: state.creditNotes,
        debitNotes: state.debitNotes,
        customers: state.customers,
      }),
    [state.invoices, state.creditNotes, state.debitNotes, state.customers, selectedFY]
  );

  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title="GSTR-1 (Outward Supplies Return)"
          subtitle={`Auto-categorized B2B, B2C, CDNR & HSN summary for FY ${selectedFY}`}
          breadcrumbs={['GST Management', 'Returns', 'GSTR-1']}
          actions={
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  `gstr1-b2b-${selectedFY}.csv`,
                  ['GSTIN', 'Customer', 'Invoice #', 'Date', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
                  gstr1.b2b.map((r) => [r.gstin, r.customerName, r.invoiceNumber, r.date, r.placeOfSupply, r.taxableValue, r.cgst, r.sgst, r.igst, r.grandTotal])
                )
              }
              className={btnSecondary}
            >
              <Download className="h-3.5 w-3.5" /> Export GSTR-1 CSV
            </button>
          }
        />
      )}
      {!embedded && <DemoTaxNotice />}

      <SegmentedTabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'b2b', label: 'B2B Invoices', count: gstr1.b2b.length },
          { id: 'b2cs', label: 'B2C Small', count: gstr1.b2cs.length },
          { id: 'b2cl', label: 'B2C Large', count: gstr1.b2cl.length },
          { id: 'exports', label: 'Exports', count: gstr1.exports.length },
          { id: 'cdnr', label: 'Credit/Debit Notes', count: gstr1.cdnr.length },
          { id: 'hsn', label: 'HSN Summary', count: gstr1.hsnSummary.length },
          { id: 'docs', label: 'Doc Summary', count: gstr1.docSummary.length },
          { id: 'amendments', label: 'Amendments', count: 0 },
        ]}
      />

      {tab === 'b2b' && (
        <DataTable
          data={gstr1.b2b}
          searchFields={['gstin', 'customerName', 'invoiceNumber']}
          columns={[
            { key: 'gstin', label: 'Receiver GSTIN', render: (r) => <span className="font-mono text-xs">{r.gstin}</span> },
            { key: 'customerName', label: 'Customer' },
            { key: 'invoiceNumber', label: 'Invoice #', render: (r) => <span className="font-mono font-semibold">{r.invoiceNumber}</span> },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'placeOfSupply', label: 'POS' },
            { key: 'taxableValue', label: 'Taxable', align: 'right', render: (r) => formatINR(r.taxableValue) },
            { key: 'cgst', label: 'CGST', align: 'right', render: (r) => formatINR(r.cgst) },
            { key: 'sgst', label: 'SGST', align: 'right', render: (r) => formatINR(r.sgst) },
            { key: 'igst', label: 'IGST', align: 'right', render: (r) => formatINR(r.igst) },
            { key: 'grandTotal', label: 'Invoice Value', align: 'right', render: (r) => formatINR(r.grandTotal) },
          ]}
        />
      )}

      {tab === 'b2cs' && (
        <DataTable
          data={gstr1.b2cs}
          columns={[
            { key: 'placeOfSupply', label: 'Place of Supply' },
            { key: 'supplyType', label: 'Supply Type' },
            { key: 'taxableValue', label: 'Taxable Value', align: 'right', render: (r) => formatINR(r.taxableValue) },
            { key: 'cgst', label: 'CGST', align: 'right', render: (r) => formatINR(r.cgst) },
            { key: 'sgst', label: 'SGST', align: 'right', render: (r) => formatINR(r.sgst) },
            { key: 'igst', label: 'IGST', align: 'right', render: (r) => formatINR(r.igst) },
            { key: 'totalTax', label: 'Total Tax', align: 'right', render: (r) => formatINR(r.totalTax) },
          ]}
        />
      )}

      {tab === 'b2cl' && (
        <DataTable
          data={gstr1.b2cl}
          emptyTitle="No B2C Large (> ₹2.5 Lakh Inter-State) Invoices"
          emptyDescription="Unregistered inter-state invoices exceeding ₹2,50,000 appear here."
          columns={[
            { key: 'invoiceNumber', label: 'Invoice #' },
            { key: 'date', label: 'Date' },
            { key: 'placeOfSupply', label: 'Place of Supply' },
            { key: 'taxableValue', label: 'Taxable Value', align: 'right', render: (r) => formatINR(r.taxableValue) },
            { key: 'igst', label: 'IGST', align: 'right', render: (r) => formatINR(r.igst) },
          ]}
        />
      )}

      {tab === 'exports' && (
        <DataTable
          data={gstr1.exports}
          emptyTitle="No Export Invoices Recorded"
          emptyDescription="Invoices billed to Overseas / Export customers appear in Table 6A."
          columns={[
            { key: 'invoiceNumber', label: 'Invoice #' },
            { key: 'customerName', label: 'Customer' },
            { key: 'portCode', label: 'Port Code' },
            { key: 'taxableValue', label: 'Taxable Value', align: 'right', render: (r) => formatINR(r.taxableValue) },
          ]}
        />
      )}

      {tab === 'cdnr' && (
        <DataTable
          data={gstr1.cdnr}
          columns={[
            { key: 'docType', label: 'Type' },
            { key: 'number', label: 'Note #', render: (r) => <span className="font-mono font-semibold">{r.number}</span> },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.date)}</span> },
            { key: 'customerName', label: 'Customer' },
            { key: 'againstInvoice', label: 'Against Invoice', render: (r) => <span className="font-mono text-xs">{r.againstInvoice}</span> },
            { key: 'taxableValue', label: 'Taxable', align: 'right', render: (r) => formatINR(r.taxableValue) },
            { key: 'grandTotal', label: 'Note Value', align: 'right', render: (r) => formatINR(r.grandTotal) },
          ]}
        />
      )}

      {tab === 'hsn' && (
        <DataTable
          data={gstr1.hsnSummary}
          columns={[
            { key: 'hsn', label: 'HSN/SAC', render: (r) => <span className="font-mono font-semibold">{r.hsn}</span> },
            { key: 'description', label: 'Description' },
            { key: 'uqc', label: 'UQC' },
            { key: 'qty', label: 'Total Qty', align: 'right' },
            { key: 'gstRate', label: 'Rate %', align: 'right', render: (r) => `${r.gstRate}%` },
            { key: 'taxableValue', label: 'Taxable Value', align: 'right', render: (r) => formatINR(r.taxableValue) },
            { key: 'cgst', label: 'CGST', align: 'right', render: (r) => formatINR(r.cgst) },
            { key: 'sgst', label: 'SGST', align: 'right', render: (r) => formatINR(r.sgst) },
            { key: 'igst', label: 'IGST', align: 'right', render: (r) => formatINR(r.igst) },
          ]}
        />
      )}

      {tab === 'docs' && (
        <DataTable
          data={gstr1.docSummary}
          columns={[
            { key: 'nature', label: 'Nature of Document' },
            { key: 'from', label: 'Sr. No. From', render: (r) => <span className="font-mono text-xs">{r.from}</span> },
            { key: 'to', label: 'Sr. No. To', render: (r) => <span className="font-mono text-xs">{r.to}</span> },
            { key: 'totalIssued', label: 'Total Number', align: 'right' },
            { key: 'cancelled', label: 'Cancelled', align: 'right' },
            { key: 'netIssued', label: 'Net Issued', align: 'right' },
          ]}
        />
      )}

      {tab === 'amendments' && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          No B2B/B2C amendments queued for the selected period.
        </div>
      )}
    </div>
  );
};

export const GSTR3BPage = ({ embedded = false }) => {
  const { state, selectedFY } = useApp();
  const summary = useMemo(
    () =>
      computeGSTSummary({
        invoices: state.invoices.filter((i) => i.financialYear === selectedFY),
        purchases: state.purchases.filter((p) => p.financialYear === selectedFY),
        expenses: state.expenses,
        creditNotes: state.creditNotes,
      }),
    [state.invoices, state.purchases, state.expenses, state.creditNotes, selectedFY]
  );

  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title="GSTR-3B (Monthly Summary Return)"
          subtitle="Summary of outward supplies, reverse charge, eligible ITC, and net tax payment"
          breadcrumbs={['GST Management', 'Returns', 'GSTR-3B']}
        />
      )}
      {!embedded && <DemoTaxNotice />}

      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          3.1 Details of Outward Supplies &amp; Inward Supplies Liable to Reverse Charge
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Nature of Supplies</th>
                <th className="px-3 py-2 text-right">Total Taxable Value</th>
                <th className="px-3 py-2 text-right">Integrated Tax (IGST)</th>
                <th className="px-3 py-2 text-right">Central Tax (CGST)</th>
                <th className="px-3 py-2 text-right">State/UT Tax (SGST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2.5 font-medium">(a) Outward taxable supplies (other than zero rated, nil rated &amp; exempted)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.totalOutwardTaxable)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.outIgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.outCgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.outSgst)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium">(c) Other outward supplies (Nil rated, exempted)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium">(d) Inward supplies (liable to reverse charge)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          4. Eligible ITC &amp; 6.1 Payment of Tax Summary
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">IGST</th>
                <th className="px-3 py-2 text-right">CGST</th>
                <th className="px-3 py-2 text-right">SGST</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2.5 font-medium">(A) ITC Available — All other ITC (Purchases &amp; Expenses)</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{formatINR(summary.inIgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{formatINR(summary.inCgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{formatINR(summary.inSgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-700">{formatINR(summary.inputItc)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium">(B) ITC Reversed (Rule 42/43 &amp; Others)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(0)}</td>
              </tr>
              <tr className="bg-indigo-50/50 font-semibold text-slate-900">
                <td className="px-3 py-2.5">Estimated Net Tax Payable in Cash (After ITC Offset)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.netIgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.netCgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.netSgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(summary.netLiability)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const GSTR2BReconciliationPage = () => {
  const { state, updateStateWithAudit, notify } = useApp();
  const [statusFilter, setStatusFilter] = useState('All');

  const records = state.gstr2bRecords || [];
  const filtered = records.filter((r) => statusFilter === 'All' || r.matchStatus === statusFilter);

  const importSample2B = () => {
    const newRow = {
      id: `2b-${Date.now()}`,
      supplierName: 'Luminous Power Technologies Dist.',
      gstin: '08AAACL1010K1Z2 (DEMO)',
      invoiceNo: 'LUM/JPR/219',
      date: '2026-09-04',
      taxable2B: 89600,
      tax2B: 16128,
      booksTaxable: 89600,
      booksTax: 16128,
      matchStatus: 'Matched',
      itcEligible: true,
    };
    updateStateWithAudit(
      (prev) => ({
        ...prev,
        gstr2bRecords: prev.gstr2bRecords.some((r) => r.invoiceNo === newRow.invoiceNo)
          ? prev.gstr2bRecords
          : [newRow, ...prev.gstr2bRecords],
      }),
      { action: 'Imported Sample GSTR-2B', module: 'GST', recordRef: 'GSTR-2B Demo JSON', prevValue: '—', newValue: 'Matched LUM/JPR/219' }
    );
    notify('Sample GSTR-2B file imported and matched against purchase books');
  };

  const toggleItc = (row) => {
    updateStateWithAudit(
      (prev) => ({
        ...prev,
        gstr2bRecords: prev.gstr2bRecords.map((r) =>
          r.id === row.id ? { ...r, itcEligible: !r.itcEligible } : r
        ),
      }),
      { action: 'Updated ITC Eligibility', module: 'GST', recordRef: row.invoiceNo, prevValue: String(row.itcEligible), newValue: String(!row.itcEligible) }
    );
  };

  const markResolved = (row) => {
    updateStateWithAudit(
      (prev) => ({
        ...prev,
        gstr2bRecords: prev.gstr2bRecords.map((r) =>
          r.id === row.id ? { ...r, matchStatus: 'Matched', itcEligible: true } : r
        ),
      }),
      { action: 'Resolved 2B Mismatch', module: 'GST', recordRef: row.invoiceNo, prevValue: row.matchStatus, newValue: 'Matched' }
    );
    notify(`${row.invoiceNo} marked as Matched`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="GSTR-2B Reconciliation"
        subtitle="Compare portal GSTR-2B auto-drafted ITC against your purchase register"
        breadcrumbs={['GST Management', 'GSTR-2B Recon']}
        actions={
          <button type="button" onClick={importSample2B} className={btnPrimary}>
            <Upload className="h-3.5 w-3.5" /> Import Sample GSTR-2B File
          </button>
        }
      />
      <DemoTaxNotice />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Matched Invoices" value={records.filter((r) => r.matchStatus === 'Matched').length} tone="success" />
        <StatCard label="Tax / GSTIN Mismatches" value={records.filter((r) => r.matchStatus.includes('Mismatch')).length} tone="warning" />
        <StatCard label="Missing in Books" value={records.filter((r) => r.matchStatus === 'Missing in Books').length} tone="danger" />
        <StatCard label="Missing in GSTR-2B" value={records.filter((r) => r.matchStatus === 'Missing in GSTR-2B').length} tone="danger" />
      </div>

      <SegmentedTabs
        activeTab={statusFilter}
        onChange={setStatusFilter}
        tabs={['All', 'Matched', 'Tax Mismatch', 'GSTIN Mismatch', 'Missing in Books', 'Missing in GSTR-2B']}
      />

      <DataTable
        data={filtered}
        searchFields={['supplierName', 'gstin', 'invoiceNo']}
        columns={[
          { key: 'invoiceNo', label: 'Supplier Inv #', render: (r) => <span className="font-mono font-semibold">{r.invoiceNo}</span> },
          { key: 'supplierName', label: 'Supplier' },
          { key: 'gstin', label: 'GSTIN', render: (r) => <span className="font-mono text-xs">{r.gstin}</span> },
          { key: 'tax2B', label: '2B Tax', align: 'right', render: (r) => formatINR(r.tax2B) },
          { key: 'booksTax', label: 'Books Tax', align: 'right', render: (r) => formatINR(r.booksTax) },
          { key: 'matchStatus', label: 'Recon Status', render: (r) => <StatusLabel status={r.matchStatus} /> },
          {
            key: 'itcEligible',
            label: 'ITC Claim',
            render: (r) => (
              <button type="button" onClick={() => toggleItc(r)} className="text-xs font-medium text-indigo-600 hover:underline">
                {r.itcEligible ? 'Eligible' : 'Hold / Ineligible'}
              </button>
            ),
          },
          {
            key: 'action',
            label: 'Action',
            render: (r) =>
              r.matchStatus !== 'Matched' ? (
                <button type="button" onClick={() => markResolved(r)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                </button>
              ) : (
                <span className="text-xs text-slate-400">Verified</span>
              ),
          },
        ]}
      />
    </div>
  );
};

export const GSTReturnsPage = ({ defaultTab = 'gstr1' }) => {
  const navigate = useNavigate();
  const { selectedFY } = useApp();
  const [returnTab, setReturnTab] = useState(defaultTab);

  useEffect(() => {
    setReturnTab(defaultTab);
  }, [defaultTab]);

  const handleSwitch = (next) => {
    setReturnTab(next);
    navigate(next === 'gstr3b' ? '/gst/gstr-3b' : '/gst/gstr-1');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={returnTab === 'gstr3b' ? 'GSTR-3B (Monthly Summary Return)' : 'GSTR-1 (Outward Supplies Return)'}
        subtitle={`Prepare and inspect GST return tables for FY ${selectedFY}`}
        breadcrumbs={['GST Management', 'Returns', returnTab === 'gstr3b' ? 'GSTR-3B' : 'GSTR-1']}
      />
      <DemoTaxNotice />
      <SegmentedTabs
        activeTab={returnTab}
        onChange={handleSwitch}
        tabs={[
          { id: 'gstr1', label: 'GSTR-1 (Outward Supplies)' },
          { id: 'gstr3b', label: 'GSTR-3B (Summary Return)' },
        ]}
      />
      {returnTab === 'gstr1' ? <GSTR1Page embedded /> : <GSTR3BPage embedded />}
    </div>
  );
};

export const GSTSummaryPage = () => <GSTDashboardPage />;

export const GSTReportsContent = ({ invoicesOverride, purchasesOverride, expensesOverride }) => {
  const { state, selectedFY } = useApp();
  const [reportTab, setReportTab] = useState('hsn');

  const fyInvoices = invoicesOverride || state.invoices.filter((i) => i.financialYear === selectedFY);
  const fyPurchases = purchasesOverride || state.purchases.filter((p) => p.financialYear === selectedFY);
  const fyExpenses = expensesOverride || state.expenses;

  const gstSummary = useMemo(
    () =>
      computeGSTSummary({
        invoices: fyInvoices,
        purchases: fyPurchases,
        expenses: fyExpenses,
        creditNotes: state.creditNotes,
      }),
    [fyInvoices, fyPurchases, fyExpenses, state.creditNotes]
  );

  const hsnData = useMemo(() => generateHSNSummary(fyInvoices), [fyInvoices]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Outward Taxable Turnover" value={formatINR(gstSummary.totalOutwardTaxable, false)} />
        <StatCard label="Output GST Liability" value={formatINR(gstSummary.outputTax)} />
        <StatCard label="Eligible Input Tax Credit" value={formatINR(gstSummary.inputItc)} tone="success" />
        <StatCard label="Net GST Payable" value={formatINR(gstSummary.netLiability)} tone="warning" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          activeTab={reportTab}
          onChange={setReportTab}
          tabs={[
            { id: 'hsn', label: 'HSN / SAC Summary', count: hsnData.length },
            { id: 'tax-breakup', label: 'Tax Head Breakup (CGST / SGST / IGST)' },
          ]}
        />
        <button
          type="button"
          onClick={() =>
            exportToCSV(
              `hsn-summary-${selectedFY}.csv`,
              ['HSN', 'Description', 'UQC', 'Qty', 'GST%', 'Taxable Value', 'CGST', 'SGST', 'IGST'],
              hsnData.map((h) => [h.hsn, h.description, h.uqc, h.qty, h.gstRate, h.taxableValue, h.cgst, h.sgst, h.igst])
            )
          }
          className={btnSecondary}
        >
          <Download className="h-3.5 w-3.5" /> Export HSN CSV
        </button>
      </div>

      {reportTab === 'hsn' ? (
        <DataTable
          data={hsnData}
          searchFields={['hsn', 'description']}
          columns={[
            { key: 'hsn', label: 'HSN / SAC', render: (r) => <span className="font-mono font-semibold">{r.hsn}</span> },
            { key: 'description', label: 'Description' },
            { key: 'uqc', label: 'Unit' },
            { key: 'qty', label: 'Total Qty', align: 'right' },
            { key: 'gstRate', label: 'GST %', align: 'right', render: (r) => `${r.gstRate}%` },
            { key: 'taxableValue', label: 'Taxable Value', align: 'right', render: (r) => formatINR(r.taxableValue) },
            { key: 'cgst', label: 'CGST', align: 'right', render: (r) => formatINR(r.cgst) },
            { key: 'sgst', label: 'SGST', align: 'right', render: (r) => formatINR(r.sgst) },
            { key: 'igst', label: 'IGST', align: 'right', render: (r) => formatINR(r.igst) },
            { key: 'totalTax', label: 'Total GST', align: 'right', render: (r) => <span className="font-semibold">{formatINR(r.totalTax)}</span> },
          ]}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Tax Head</th>
                <th className="px-3 py-2.5 text-right">Output Liability</th>
                <th className="px-3 py-2.5 text-right">Eligible Input ITC</th>
                <th className="px-3 py-2.5 text-right">Est. Net Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2.5 font-medium">CGST (Central GST)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(gstSummary.outCgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{formatINR(gstSummary.inCgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatINR(gstSummary.netCgst)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium">SGST / UTGST (State GST)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(gstSummary.outSgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{formatINR(gstSummary.inSgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatINR(gstSummary.netSgst)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-medium">IGST (Integrated GST)</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatINR(gstSummary.outIgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{formatINR(gstSummary.inIgst)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatINR(gstSummary.netIgst)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const GSTReportsPage = () => {
  const { selectedFY, notify } = useApp();
  return (
    <div id="gst-reports-sheet" className="space-y-5">
      <PageHeader
        title="GST Reports & HSN/SAC Summary"
        subtitle={`Tax liability summary, ITC offset breakup, and HSN/SAC outward register (FY ${selectedFY})`}
        breadcrumbs={['GST Management', 'GST Reports']}
        actions={
          <button
            type="button"
            onClick={() =>
              printElement({
                elementId: 'gst-reports-sheet',
                title: 'GST & HSN Summary Report',
                fileName: `gst-reports-${selectedFY}.html`,
                onNotify: notify,
              })
            }
            className={`${btnSecondary} no-print`}
          >
            <Printer className="h-3.5 w-3.5" /> Print Report
          </button>
        }
      />
      <DemoTaxNotice />
      <GSTReportsContent />
    </div>
  );
};

export const HSNSummaryPage = () => <GSTReportsPage />;

export const GSTCalendarPage = () => {
  const { state, updateStateWithAudit, notify } = useApp();

  const markPrepared = (cal) => {
    updateStateWithAudit(
      (prev) => ({
        ...prev,
        gstCalendar: prev.gstCalendar.map((c) =>
          c.id === cal.id ? { ...c, prepStatus: 'Ready', filingStatus: 'Demo Prepared' } : c
        ),
      }),
      { action: 'Updated GST Calendar Status', module: 'GST', recordRef: `${cal.returnType} ${cal.period}`, prevValue: cal.filingStatus, newValue: 'Demo Prepared' }
    );
    notify(`${cal.returnType} (${cal.period}) marked as Demo Prepared`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="GST Filing Calendar"
        subtitle="Track monthly GSTR-1, GSTR-2B reconciliation, and GSTR-3B statutory due dates"
        breadcrumbs={['GST Management', 'Filing Calendar']}
      />
      <DemoTaxNotice />
      <DataTable
        data={state.gstCalendar}
        columns={[
          { key: 'period', label: 'Return Period', render: (r) => <span className="font-semibold text-slate-900">{r.period}</span> },
          { key: 'returnType', label: 'Return Type', render: (r) => <span className="font-mono font-semibold text-indigo-700">{r.returnType}</span> },
          { key: 'dueDate', label: 'Statutory Due Date', render: (r) => <span className="font-mono text-xs">{formatDateIN(r.dueDate)}</span> },
          { key: 'prepStatus', label: 'Preparation', render: (r) => <StatusLabel status={r.prepStatus} /> },
          { key: 'filingStatus', label: 'Status', render: (r) => <StatusLabel status={r.filingStatus} /> },
          {
            key: 'actions',
            label: 'Action',
            render: (r) =>
              r.filingStatus !== 'Demo Prepared' ? (
                <button type="button" onClick={() => markPrepared(r)} className="text-xs font-medium text-indigo-600 hover:underline">
                  Mark Demo Prepared
                </button>
              ) : (
                <span className="text-xs text-emerald-700">Ready for Export</span>
              ),
          },
        ]}
      />
    </div>
  );
};
