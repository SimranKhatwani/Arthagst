import React, { useState, useMemo } from 'react';
import { QrCode, Truck, XCircle, Printer, Plus, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import * as eInvoiceService from '../../services/eInvoiceService';
import * as eWayBillService from '../../services/eWayBillService';
import { formatINR } from '../../services/calculationService';
import { printElement } from '../../services/printService';
import {
  PageHeader,
  DataTable,
  StatusLabel,
  Modal,
  InputField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

const SandboxNotice = () => (
  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
    <span>
      Simulated Sandbox Mode: IRNs, Acknowledgement Numbers, QR payloads, and E-Way Bills generated here are clearly labelled demo references and do not call live NIC/IRP government servers.
    </span>
  </div>
);

export const EInvoicesPage = () => {
  const { state, cancelEInvoice, updateStateWithAudit, confirmAction, notify } = useApp();
  const [qrModal, setQrModal] = useState(null);

  const handleCancelIRN = async (row) => {
    const ok = await confirmAction({
      title: `Cancel IRN for ${row.invoiceNumber}?`,
      message: 'This marks the IRN record as Cancelled.',
      confirmText: 'Cancel IRN',
      danger: true,
    });
    if (!ok) return;

    try {
      if (cancelEInvoice && row.id && !row.id.startsWith('ein-')) {
        await cancelEInvoice(row.id, '1', 'Cancelled by user');
      } else {
        updateStateWithAudit(
          (prev) => ({
            ...prev,
            eInvoices: prev.eInvoices.map((e) => (e.id === row.id ? { ...e, status: 'Cancelled (Demo)' } : e)),
          }),
          { action: 'Cancelled Demo IRN', module: 'E-Invoice', recordRef: row.invoiceNumber, prevValue: 'Generated (Demo)', newValue: 'Cancelled (Demo)' }
        );
        notify('Demo IRN cancelled', 'info');
      }
    } catch (err) {
      console.warn('Cancel IRN notice:', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="E-Invoices (Simulated IRP)"
        subtitle="Manage simulated Invoice Reference Numbers (IRN) and signed QR previews"
        breadcrumbs={['E-Invoice & E-Way Bill', 'E-Invoices']}
      />
      <SandboxNotice />

      <DataTable
        data={state.eInvoices}
        searchFields={['invoiceNumber', 'customerName', 'irn', 'ackNo']}
        columns={[
          { key: 'invoiceNumber', label: 'Invoice #', render: (r) => <span className="font-mono font-semibold text-indigo-700">{r.invoiceNumber}</span> },
          { key: 'customerName', label: 'Customer' },
          { key: 'grandTotal', label: 'Amount', align: 'right', render: (r) => formatINR(r.grandTotal) },
          { key: 'ackNo', label: 'Demo Ack No.', render: (r) => <span className="font-mono text-xs">{r.ackNo}</span> },
          { key: 'ackDate', label: 'Ack Timestamp', render: (r) => <span className="font-mono text-xs">{r.ackDate}</span> },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          {
            key: 'actions',
            label: 'Actions',
            nowrap: true,
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setQrModal(r)} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                  <QrCode className="h-3.5 w-3.5" /> QR Preview
                </button>
                {r.status === 'Generated (Demo)' && (
                  <button type="button" onClick={() => handleCancelIRN(r)} className="text-slate-400 hover:text-rose-600" title="Cancel Demo IRN">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal open={Boolean(qrModal)} onClose={() => setQrModal(null)} title={`Demo E-Invoice QR — ${qrModal?.invoiceNumber}`}>
        {qrModal && (
          <div className="space-y-4 text-xs">
            <div id="einvoice-qr-sheet" className="space-y-4">
              <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900 font-medium">
                Simulated Demo IRN Reference (Not an official IRP tax document)
              </div>
              <div className="flex items-center gap-4">
                <div className="h-28 w-28 shrink-0 rounded border border-slate-300 p-2 bg-white">
                  <svg viewBox="0 0 36 36" className="h-full w-full text-slate-900">
                    <rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
                    <rect x="5" y="5" width="4" height="4" fill="currentColor" />
                    <rect x="24" y="2" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
                    <rect x="27" y="5" width="4" height="4" fill="currentColor" />
                    <rect x="2" y="24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
                    <rect x="5" y="27" width="4" height="4" fill="currentColor" />
                    <path d="M16 4h4v4h-4zM16 12h4v8h-4zM24 16h8v4h-8zM16 24h8v4h-8zM28 24h4v8h-4z" fill="currentColor" />
                  </svg>
                </div>
                <div className="space-y-1 break-all">
                  <div><strong>Invoice:</strong> <span className="font-mono">{qrModal.invoiceNumber}</span></div>
                  <div><strong>IRN:</strong> <span className="font-mono">{qrModal.irn}</span></div>
                  <div><strong>Ack No:</strong> <span className="font-mono">{qrModal.ackNo}</span></div>
                  <div><strong>Ack Date:</strong> <span className="font-mono">{qrModal.ackDate}</span></div>
                  <div><strong>Customer GSTIN:</strong> <span className="font-mono">{qrModal.gstin}</span></div>
                </div>
              </div>
            </div>
            <div className="no-print flex justify-end">
              <button
                type="button"
                onClick={() =>
                  printElement({
                    elementId: 'einvoice-qr-sheet',
                    title: `E-Invoice ${qrModal.invoiceNumber}`,
                    fileName: `einvoice-${qrModal.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.html`,
                    onNotify: notify,
                  })
                }
                className={btnPrimary}
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export const GenerateEInvoicePage = () => {
  const { state, generateEInvoice, generateDemoIRN } = useApp();
  const existingIds = new Set(
    state.eInvoices
      .filter((e) => e.status === 'Generated (Demo)' || e.status === 'GENERATED' || e.status === 'generated')
      .map((e) => e.invoiceId || e.salesInvoiceId)
  );
  const eligible = useMemo(
    () =>
      state.invoices.filter(
        (i) =>
          (i.status === 'Finalized' || i.invoiceStatus === 'posted') &&
          !existingIds.has(i.id) &&
          !existingIds.has(i._id) &&
          (i.customerGstin || i.partyGSTIN)
      ),
    [state.invoices, existingIds]
  );

  const handleGenerate = async (r) => {
    try {
      if (generateEInvoice && (r._id || (r.id && !r.id.startsWith('inv-')))) {
        await generateEInvoice({ salesInvoiceId: r._id || r.id });
      } else {
        generateDemoIRN(r);
      }
    } catch (err) {
      console.warn('Backend e-invoice generate fallback:', err.message);
      generateDemoIRN(r);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Generate E-Invoice (IRN)"
        subtitle="Select finalized B2B invoices with GSTIN to generate simulated IRP IRN and signed QR"
        breadcrumbs={['E-Invoice & E-Way Bill', 'Generate E-Invoice']}
      />
      <SandboxNotice />

      <DataTable
        data={eligible}
        emptyTitle="All eligible B2B invoices already have IRNs"
        emptyDescription="Create a new B2B invoice with customer GSTIN to generate another simulated IRN."
        columns={[
          { key: 'invoiceNumber', label: 'Invoice #', render: (r) => <span className="font-mono font-semibold">{r.invoiceNumber}</span> },
          { key: 'customerName', label: 'Customer' },
          { key: 'customerGstin', label: 'Customer GSTIN', render: (r) => <span className="font-mono text-xs">{r.customerGstin || r.partyGSTIN}</span> },
          { key: 'grandTotal', label: 'Invoice Total', align: 'right', render: (r) => formatINR(r.grandTotal) },
          {
            key: 'action',
            label: 'Action',
            render: (r) => (
              <button type="button" onClick={() => handleGenerate(r)} className={btnPrimary}>
                <QrCode className="h-3.5 w-3.5" /> Generate IRN
              </button>
            ),
          },
        ]}
      />
    </div>
  );
};

export const EWayBillsPage = () => {
  const { state, cancelEWayBill, updateStateWithAudit, confirmAction, notify } = useApp();
  const [editVehicleRow, setEditVehicleRow] = useState(null);
  const [newVehicle, setNewVehicle] = useState('');

  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    if (!editVehicleRow || !newVehicle.trim()) return;

    try {
      if (editVehicleRow.id && !editVehicleRow.id.startsWith('ewb-')) {
        await eWayBillService.updateVehicle(editVehicleRow.id, {
          vehicleNumber: newVehicle.toUpperCase(),
          fromPlace: 'Store',
          reasonCode: '1',
        });
        notify('Vehicle number updated on live E-Way Bill');
      } else {
        updateStateWithAudit(
          (prev) => ({
            ...prev,
            eWayBills: prev.eWayBills.map((w) =>
              w.id === editVehicleRow.id ? { ...w, vehicleNo: newVehicle.toUpperCase() } : w
            ),
          }),
          { action: 'Updated EWB Vehicle (Part-B)', module: 'E-Way Bill', recordRef: editVehicleRow.ewbNumber, prevValue: editVehicleRow.vehicleNo, newValue: newVehicle.toUpperCase() }
        );
        notify('Vehicle number updated on Demo E-Way Bill');
      }
    } catch (err) {
      console.warn('Vehicle update fallback:', err.message);
      updateStateWithAudit(
        (prev) => ({
          ...prev,
          eWayBills: prev.eWayBills.map((w) =>
            w.id === editVehicleRow.id ? { ...w, vehicleNo: newVehicle.toUpperCase() } : w
          ),
        }),
        { action: 'Updated EWB Vehicle (Part-B)', module: 'E-Way Bill', recordRef: editVehicleRow.ewbNumber, prevValue: editVehicleRow.vehicleNo, newValue: newVehicle.toUpperCase() }
      );
      notify('Vehicle number updated');
    }
    setEditVehicleRow(null);
  };

  const handleCancel = async (row) => {
    const ok = await confirmAction({
      title: `Cancel E-Way Bill ${row.ewbNumber}?`,
      message: 'This cancels the E-Way Bill record.',
      confirmText: 'Cancel EWB',
      danger: true,
    });
    if (!ok) return;

    try {
      if (cancelEWayBill && row.id && !row.id.startsWith('ewb-')) {
        await cancelEWayBill(row.id, '1', 'Cancelled by user');
      } else {
        updateStateWithAudit(
          (prev) => ({
            ...prev,
            eWayBills: prev.eWayBills.map((w) => (w.id === row.id ? { ...w, status: 'Cancelled (Demo)' } : w)),
          }),
          { action: 'Cancelled Demo EWB', module: 'E-Way Bill', recordRef: row.ewbNumber, prevValue: 'Active (Demo)', newValue: 'Cancelled (Demo)' }
        );
        notify('Demo E-Way Bill cancelled', 'info');
      }
    } catch (err) {
      console.warn('Cancel EWB notice:', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="E-Way Bills (Simulated)"
        subtitle="Track inter-state and >₹50,000 consignment movement permits"
        breadcrumbs={['E-Invoice & E-Way Bill', 'E-Way Bills']}
      />
      <SandboxNotice />

      <DataTable
        data={state.eWayBills}
        searchFields={['ewbNumber', 'invoiceNumber', 'customerName', 'vehicleNo']}
        columns={[
          { key: 'ewbNumber', label: 'Demo EWB #', render: (r) => <span className="font-mono font-semibold text-indigo-700">{r.ewbNumber}</span> },
          { key: 'invoiceNumber', label: 'Invoice #', render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
          { key: 'customerName', label: 'Consignee' },
          { key: 'transporter', label: 'Transporter' },
          { key: 'vehicleNo', label: 'Vehicle #', render: (r) => <span className="font-mono text-xs">{r.vehicleNo}</span> },
          { key: 'distanceKm', label: 'Distance', align: 'right', render: (r) => `${r.distanceKm} km` },
          { key: 'validUntil', label: 'Valid Until', render: (r) => <span className="font-mono text-xs">{r.validUntil}</span> },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          {
            key: 'actions',
            label: 'Actions',
            nowrap: true,
            render: (r) => (
              <div className="flex items-center gap-2">
                {r.status === 'Active (Demo)' && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setEditVehicleRow(r); setNewVehicle(r.vehicleNo); }}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Update Vehicle
                    </button>
                    <button type="button" onClick={() => handleCancel(r)} className="text-slate-400 hover:text-rose-600">
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={Boolean(editVehicleRow)}
        onClose={() => setEditVehicleRow(null)}
        title={`Update Part-B Vehicle — ${editVehicleRow?.ewbNumber}`}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setEditVehicleRow(null)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="veh-form" className={btnPrimary}>Update Vehicle</button>
          </>
        }
      >
        <form id="veh-form" onSubmit={handleUpdateVehicle} className="space-y-3">
          <InputField label="New Vehicle Number" required>
            <input type="text" required value={newVehicle} onChange={(e) => setNewVehicle(e.target.value)} className={`${inputClass} font-mono uppercase`} />
          </InputField>
        </form>
      </Modal>
    </div>
  );
};

export const GenerateEWayBillPage = () => {
  const { state, generateEWayBill, generateDemoEWayBill } = useApp();
  const finalized = state.invoices.filter((i) => i.status === 'Finalized' || i.invoiceStatus === 'posted');
  const [invoiceId, setInvoiceId] = useState(finalized[0]?.id || '');
  const [transporter, setTransporter] = useState('VRL Logistics Ltd (Demo)');
  const [vehicleNo, setVehicleNo] = useState('RJ-14-GC-8812');
  const [distanceKm, setDistanceKm] = useState(320);
  const [mode, setMode] = useState('Road');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const inv = finalized.find((i) => i.id === invoiceId || i._id === invoiceId);
    if (!inv) return;
    const validDays = Math.max(1, Math.ceil(Number(distanceKm) / 200));
    const validUntil = new Date(Date.now() + validDays * 86400000).toISOString().slice(0, 10);

    try {
      if (generateEWayBill && (inv._id || (inv.id && !inv.id.startsWith('inv-')))) {
        await generateEWayBill({
          salesInvoiceId: inv._id || inv.id,
          transporterName: transporter,
          vehicleNumber: vehicleNo.toUpperCase(),
          distanceKm: Number(distanceKm),
          transportMode: mode.toUpperCase(),
        });
      } else {
        generateDemoEWayBill({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          transporter,
          vehicleNo: vehicleNo.toUpperCase(),
          distanceKm: Number(distanceKm),
          mode,
          validUntil,
        });
      }
    } catch (err) {
      console.warn('Backend EWB generate fallback to demo:', err.message);
      generateDemoEWayBill({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        transporter,
        vehicleNo: vehicleNo.toUpperCase(),
        distanceKm: Number(distanceKm),
        mode,
        validUntil,
      });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Generate Demo E-Way Bill"
        subtitle="Create a simulated Part-A & Part-B E-Way Bill consignment permit"
        breadcrumbs={['E-Invoice & E-Way Bill', 'Generate E-Way Bill']}
      />
      <SandboxNotice />

      <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg border border-slate-200 bg-white p-6 space-y-4">
        <InputField label="Select Tax Invoice" required>
          <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className={inputClass}>
            {finalized.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} — {inv.customerName} ({formatINR(inv.grandTotal)})
              </option>
            ))}
          </select>
        </InputField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InputField label="Transporter Name" required><input type="text" required value={transporter} onChange={(e) => setTransporter(e.target.value)} className={inputClass} /></InputField>
          <InputField label="Vehicle Number" required><input type="text" required value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={`${inputClass} font-mono uppercase`} /></InputField>
          <InputField label="Transport Mode">
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputClass}>
              {['Road', 'Rail', 'Air', 'Ship'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </InputField>
          <InputField label="Approximate Distance (km)" required><input type="number" min="1" required value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} className={`${inputClass} font-mono`} /></InputField>
        </div>
        <div className="flex justify-end">
          <button type="submit" className={btnPrimary}>
            <Truck className="h-3.5 w-3.5" /> Generate Demo E-Way Bill
          </button>
        </div>
      </form>
    </div>
  );
};
