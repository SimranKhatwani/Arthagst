import React from 'react';
import { Printer, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatINR, formatDateIN, amountInWordsINR } from '../../services/calculationService';
import { getStateCode } from '../../data/constants';
import { printElement, downloadPrintableHtml } from '../../services/printService';
import { btnPrimary, btnSecondary } from '../common/UI';

export const TaxInvoicePreview = ({ invoice, business, eInvoice = null }) => {
  const { notify } = useApp();
  if (!invoice) return null;

  const sellerCode = getStateCode(business?.state);
  const posCode = getStateCode(invoice.placeOfSupply || invoice.customerState);
  const safeFile = `invoice-${String(invoice.invoiceNumber || 'draft').replace(/[^a-zA-Z0-9-]/g, '_')}.html`;

  const handlePrint = () => {
    printElement({
      elementId: 'tax-invoice-sheet',
      title: `Tax Invoice ${invoice.invoiceNumber}`,
      fileName: safeFile,
      onNotify: notify,
    });
  };

  const handleDownloadBill = () => {
    downloadPrintableHtml('tax-invoice-sheet', safeFile, `Tax Invoice ${invoice.invoiceNumber}`);
    notify('Printable Tax Invoice downloaded (.html)');
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="text-xs text-slate-600">
          Tax Invoice Preview · <span className="font-mono font-medium text-slate-900">{invoice.invoiceNumber}</span>
          {invoice.status === 'Draft' && ' · DRAFT PREVIEW'}
          {invoice.status === 'Cancelled' && ' · CANCELLED'}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleDownloadBill} className={btnSecondary}>
            <Download className="h-3.5 w-3.5" />
            Download Bill / PDF
          </button>
          <button type="button" onClick={handlePrint} className={btnPrimary}>
            <Printer className="h-3.5 w-3.5" />
            Print Invoice
          </button>
        </div>
      </div>

      <div id="tax-invoice-sheet" className="mx-auto max-w-4xl rounded-lg border border-slate-300 bg-white p-6 text-slate-900 print:border-0 print:p-0">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-300 pb-4 sm:flex-row">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              {invoice.invoiceType || 'Tax Invoice'}
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
              {business?.businessName}
            </h2>
            <p className="text-xs text-slate-600">
              {business?.address}, {business?.city}, {business?.state} - {business?.pincode}
            </p>
            <p className="mt-1 text-xs text-slate-700">
              <span className="font-medium">GSTIN:</span>{' '}
              <span className="font-mono">{business?.gstin}</span> ·{' '}
              <span className="font-medium">State Code:</span> {sellerCode}
            </p>
            <p className="text-xs text-slate-600">
              Phone: {business?.phone} · Email: {business?.email}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-500">Invoice Number</div>
            <div className="font-mono text-base font-bold text-slate-900">{invoice.invoiceNumber}</div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:text-right">
              <span className="text-slate-500">Invoice Date:</span>
              <span className="font-mono font-medium">{formatDateIN(invoice.date)}</span>
              <span className="text-slate-500">Due Date:</span>
              <span className="font-mono font-medium">{formatDateIN(invoice.dueDate)}</span>
              <span className="text-slate-500">Place of Supply:</span>
              <span className="font-medium">
                {posCode} - {invoice.placeOfSupply}
              </span>
            </div>
          </div>
        </div>

        {/* E-Invoice Simulated IRN Banner if generated */}
        {eInvoice && (
          <div className="mt-3 flex flex-col items-start justify-between gap-3 rounded border border-indigo-200 bg-indigo-50/50 p-3 text-xs sm:flex-row sm:items-center">
            <div className="space-y-0.5">
              <div className="font-semibold text-indigo-900">
                E-Invoice Reference
              </div>
              <div className="font-mono text-[11px] text-slate-700 break-all">
                IRN: {eInvoice.irn}
              </div>
              <div className="text-slate-600">
                Ack No: <span className="font-mono">{eInvoice.ackNo}</span> · Ack Date: {eInvoice.ackDate}
              </div>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-slate-300 bg-white p-1">
              <svg viewBox="0 0 36 36" className="h-full w-full text-slate-800">
                <rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="5" y="5" width="4" height="4" fill="currentColor" />
                <rect x="24" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="27" y="5" width="4" height="4" fill="currentColor" />
                <rect x="2" y="24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="5" y="27" width="4" height="4" fill="currentColor" />
                <path d="M16 4h4v4h-4zM16 12h4v8h-4zM24 16h8v4h-8zM16 24h8v4h-8zM28 24h4v8h-4z" fill="currentColor" />
              </svg>
            </div>
          </div>
        )}

        {/* Billing & Shipping */}
        <div className="mt-4 grid grid-cols-1 gap-4 border-b border-slate-200 pb-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Billed To
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{invoice.customerName}</div>
            <div className="text-xs text-slate-600">{invoice.billingAddress}</div>
            <div className="mt-1 text-xs text-slate-700">
              State: {invoice.customerState} ({posCode}) · Reg: {invoice.registrationType || 'Regular'}
            </div>
            {invoice.customerGstin && (
              <div className="text-xs text-slate-700">
                GSTIN: <span className="font-mono">{invoice.customerGstin}</span>
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Shipped To
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{invoice.customerName}</div>
            <div className="text-xs text-slate-600">
              {invoice.shippingAddress || invoice.billingAddress}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Supply Type: {invoice.isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-50 text-slate-700">
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Item Description</th>
                <th className="px-2 py-2 text-left">HSN/SAC</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-2 py-2 text-right">Disc%</th>
                <th className="px-2 py-2 text-right">Taxable</th>
                <th className="px-2 py-2 text-right">GST%</th>
                {invoice.isIntraState ? (
                  <>
                    <th className="px-2 py-2 text-right">CGST</th>
                    <th className="px-2 py-2 text-right">SGST</th>
                  </>
                ) : (
                  <th className="px-2 py-2 text-right">IGST</th>
                )}
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(invoice.items || []).map((item, i) => (
                <tr key={i}>
                  <td className="px-2 py-2 font-mono">{i + 1}</td>
                  <td className="px-2 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-2 py-2 font-mono text-slate-600">{item.hsn}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {item.qty} {item.unit}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {formatINR(item.rate)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {item.discountPct || 0}%
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {formatINR(item.taxableAmount)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{item.gstRate}%</td>
                  {invoice.isIntraState ? (
                    <>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatINR(item.cgst)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatINR(item.sgst)}
                      </td>
                    </>
                  ) : (
                    <td className="px-2 py-2 text-right font-mono tabular-nums">
                      {formatINR(item.igst)}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {formatINR(item.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary & Totals */}
        <div className="mt-5 grid grid-cols-1 gap-6 border-t border-slate-300 pt-4 sm:grid-cols-2">
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-semibold text-slate-700">Invoice Total (In Words)</div>
              <div className="mt-0.5 italic text-slate-800">{amountInWordsINR(invoice.grandTotal)}</div>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="font-semibold text-slate-800">Bank &amp; UPI Payment Details</div>
              <div className="mt-1 space-y-0.5 text-slate-600">
                <div>Bank: {business?.bankName} ({business?.branchName})</div>
                <div>
                  A/c No: <span className="font-mono">{business?.accountNumber}</span> · IFSC:{' '}
                  <span className="font-mono">{business?.ifscCode}</span>
                </div>
                <div>
                  UPI ID: <span className="font-mono">{business?.upiId}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-700">Terms &amp; Conditions</div>
              <p className="mt-0.5 whitespace-pre-line text-[11px] text-slate-500">
                {business?.terms}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatINR(invoice.subtotal)}</span>
            </div>
            {invoice.totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span className="font-mono tabular-nums">- {formatINR(invoice.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium text-slate-800">
              <span>Taxable Value</span>
              <span className="font-mono tabular-nums">{formatINR(invoice.taxableValue)}</span>
            </div>
            {invoice.isIntraState ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>CGST</span>
                  <span className="font-mono tabular-nums">{formatINR(invoice.cgst)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST / UTGST</span>
                  <span className="font-mono tabular-nums">{formatINR(invoice.sgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-600">
                <span>IGST</span>
                <span className="font-mono tabular-nums">{formatINR(invoice.igst)}</span>
              </div>
            )}
            {invoice.shipping > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Shipping / Freight</span>
                <span className="font-mono tabular-nums">{formatINR(invoice.shipping)}</span>
              </div>
            )}
            {invoice.otherCharges > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Other Charges</span>
                <span className="font-mono tabular-nums">{formatINR(invoice.otherCharges)}</span>
              </div>
            )}
            {invoice.roundOff !== 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Round Off</span>
                <span className="font-mono tabular-nums">{formatINR(invoice.roundOff)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-slate-900">
              <span>Grand Total</span>
              <span className="font-mono tabular-nums">{formatINR(invoice.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Amount Paid</span>
              <span className="font-mono tabular-nums">{formatINR(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-900">
              <span>Balance Due</span>
              <span className="font-mono tabular-nums">
                {formatINR(Math.max(0, (invoice.grandTotal || 0) - (invoice.amountPaid || 0)))}
              </span>
            </div>

            <div className="pt-8 text-right">
              <div className="text-[11px] font-medium text-slate-700">
                For {business?.businessName}
              </div>
              <div className="mt-8 inline-block border-t border-slate-400 pt-1 text-[11px] text-slate-500">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
