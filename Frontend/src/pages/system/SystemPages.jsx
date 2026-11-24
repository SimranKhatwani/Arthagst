import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCheck,
  Trash2,
  Plus,
  Edit3,
  Download,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ROLES_CONFIG, INDIAN_STATES, FINANCIAL_YEARS } from '../../data/constants';
import { exportAppDataJSON } from '../../services/storageService';
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
  btnDanger,
} from '../../components/common/UI';

export const NotificationsPage = () => {
  const { state, setState, notify } = useApp();
  const [catFilter, setCatFilter] = useState('All');

  const categories = ['All', 'Low Stock', 'Expiry', 'Payment', 'GST', 'Integration', 'Subscription'];
  const filtered = (state.notifications || []).filter(
    (n) => catFilter === 'All' || n.category === catFilter
  );

  const markAllRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
    notify('All notifications marked as read');
  };

  const toggleRead = (id) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read: !n.read } : n
      ),
    }));
  };

  const deleteNotif = (id) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.filter((n) => n.id !== id),
    }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notification Centre"
        subtitle="Low stock alerts, batch expiry warnings, overdue invoices, and GST filing reminders"
        breadcrumbs={['Retail & System', 'Notifications']}
        actions={
          <button type="button" onClick={markAllRead} className={btnSecondary}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
          </button>
        }
      />

      <SegmentedTabs activeTab={catFilter} onChange={setCatFilter} tabs={categories} />

      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No notifications in this category.</div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
                n.read ? 'bg-white' : 'bg-indigo-50/30'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-indigo-700">{n.category}</span>
                  <span>·</span>
                  <span className="font-mono">{n.date}</span>
                  {!n.read && <span className="font-semibold text-amber-700">· Unread</span>}
                </div>
                <div className="text-sm font-medium text-slate-900">{n.title}</div>
                <p className="text-xs text-slate-600">{n.message}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => toggleRead(n.id)} className={btnSecondary}>
                  {n.read ? 'Mark Unread' : 'Mark Read'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteNotif(n.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const AuditLogsPage = () => {
  const { state } = useApp();
  const [modFilter, setModFilter] = useState('All');
  const modules = ['All', ...Array.from(new Set((state.auditLogs || []).map((a) => a.module)))];
  const filtered = (state.auditLogs || []).filter((a) => modFilter === 'All' || a.module === modFilter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Trail & Activity Logs"
        subtitle="Immutable chronological record of CRUD actions, invoice cancellations, and tax changes"
        breadcrumbs={['Retail & System', 'Audit Logs']}
      />
      <DataTable
        data={filtered}
        searchFields={['user', 'action', 'module', 'recordRef', 'newValue']}
        filters={
          <select value={modFilter} onChange={(e) => setModFilter(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        }
        columns={[
          { key: 'timestamp', label: 'Timestamp', render: (r) => <span className="font-mono text-xs">{r.timestamp}</span> },
          { key: 'user', label: 'User' },
          { key: 'module', label: 'Module' },
          { key: 'action', label: 'Action', render: (r) => <span className="font-medium text-slate-900">{r.action}</span> },
          { key: 'recordRef', label: 'Record Ref', render: (r) => <span className="font-mono text-xs text-indigo-700">{r.recordRef}</span> },
          { key: 'prevValue', label: 'Previous Value' },
          { key: 'newValue', label: 'Updated Value' },
        ]}
      />
    </div>
  );
};

export const UsersRolesPage = () => {
  const { state, upsertRecord, notify } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', mobile: '', role: 'Billing Clerk', status: 'Active' });

  const openModal = (u = null) => {
    setEditing(u);
    setForm(u ? { ...u } : { name: '', email: '', mobile: '', role: 'Billing Clerk', status: 'Active' });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      notify('Name and email are required', 'error');
      return;
    }
    upsertRecord(
      'users',
      {
        ...form,
        id: editing ? editing.id : `usr-${Date.now()}`,
        lastLogin: editing?.lastLogin || 'Never',
      },
      'User',
      'name'
    );
    setModalOpen(false);
  };

  const toggleStatus = (u) => {
    upsertRecord(
      'users',
      { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' },
      'User',
      'name'
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Management"
        subtitle="Manage team members, role-based access permissions, and login activity"
        breadcrumbs={['Retail & System', 'User Management']}
        actions={
          <button type="button" onClick={() => openModal()} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" /> Add User
          </button>
        }
      />

      <DataTable
        data={state.users}
        searchFields={['name', 'email', 'role']}
        columns={[
          { key: 'name', label: 'User Name', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
          { key: 'email', label: 'Email' },
          { key: 'mobile', label: 'Mobile', render: (r) => <span className="font-mono text-xs">{r.mobile}</span> },
          { key: 'role', label: 'Role' },
          { key: 'lastLogin', label: 'Last Login', render: (r) => <span className="font-mono text-xs">{r.lastLogin}</span> },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => openModal(r)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><Edit3 className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => toggleStatus(r)} className="text-xs font-medium text-indigo-600 hover:underline">
                  {r.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* Role Permission Matrix */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Role Permissions Matrix</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(ROLES_CONFIG).map(([roleKey, cfg]) => (
            <div key={roleKey} className="rounded-md border border-slate-200 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-slate-900">{cfg.label}</div>
              <p className="text-slate-500">{cfg.description}</p>
              <div className="pt-1 font-mono text-[11px] text-indigo-700">
                Modules: {cfg.permissions.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit User — ${editing.name}` : 'Add Team User'}
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="usr-form" className={btnPrimary}>Save User</button>
          </>
        }
      >
        <form id="usr-form" onSubmit={handleSave} className="space-y-3">
          <InputField label="Full Name" required><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Email" required><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Mobile"><input type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Role">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
              {Object.keys(ROLES_CONFIG).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </InputField>
        </form>
      </Modal>
    </div>
  );
};

const normalizeSettingsTab = (tab) => {
  if (tab === 'business' || tab === 'gst') return 'business-tax';
  if (tab === 'invoice' || tab === 'financial') return 'invoice-financial';
  return tab || 'business-tax';
};

export const SettingsPage = ({ defaultTab = 'business-tax' }) => {
  const { state, updateBusinessAndSettings, confirmAction } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => normalizeSettingsTab(defaultTab));
  const [biz, setBiz] = useState(state.business);
  const [cfg, setCfg] = useState(state.settings);

  useEffect(() => {
    setTab(normalizeSettingsTab(defaultTab));
  }, [defaultTab]);

  useEffect(() => {
    setBiz(state.business);
    setCfg(state.settings);
  }, [state.business, state.settings]);

  const tabs = [
    { id: 'business-tax', label: 'Business & Tax' },
    { id: 'invoice-financial', label: 'Invoice & Financial' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'users', label: 'Users & Permissions' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'backup', label: 'Data & Backup' },
    { id: 'subscription', label: 'Subscription' },
  ];

  const handleSaveAll = (e) => {
    e.preventDefault();
    updateBusinessAndSettings(biz, cfg);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={tab === 'subscription' ? 'Subscription & Billing' : 'Workspace Settings'}
        subtitle={
          tab === 'subscription'
            ? 'Manage your active ArthaGST plan, user seat allocation, and billing details'
            : 'Configure business & tax profile, invoicing, inventory rules, integrations, and demo backup'
        }
        breadcrumbs={['Retail & System', tab === 'subscription' ? 'Subscription & Billing' : 'Settings']}
      />

      <SegmentedTabs activeTab={tab} onChange={setTab} tabs={tabs} />

      <form onSubmit={handleSaveAll} className="rounded-lg border border-slate-200 bg-white p-6 space-y-6">
        {tab === 'business-tax' && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Business Profile
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="Business Name"><input type="text" value={biz.businessName} onChange={(e) => setBiz({ ...biz, businessName: e.target.value })} className={inputClass} /></InputField>
                <InputField label="Legal Name"><input type="text" value={biz.legalName} onChange={(e) => setBiz({ ...biz, legalName: e.target.value })} className={inputClass} /></InputField>
                <InputField label="Email"><input type="email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} className={inputClass} /></InputField>
                <InputField label="Phone"><input type="text" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} className={inputClass} /></InputField>
                <InputField label="Address"><input type="text" value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} className={inputClass} /></InputField>
                <InputField label="City"><input type="text" value={biz.city} onChange={(e) => setBiz({ ...biz, city: e.target.value })} className={inputClass} /></InputField>
                <InputField label="State">
                  <select value={biz.state} onChange={(e) => setBiz({ ...biz, state: e.target.value })} className={inputClass}>
                    {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                  </select>
                </InputField>
                <InputField label="PIN Code"><input type="text" value={biz.pincode} onChange={(e) => setBiz({ ...biz, pincode: e.target.value })} className={inputClass} /></InputField>
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Tax &amp; GST Configuration
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="GSTIN (Demo)"><input type="text" value={biz.gstin} onChange={(e) => setBiz({ ...biz, gstin: e.target.value })} className={`${inputClass} font-mono`} /></InputField>
                <InputField label="PAN (Demo)"><input type="text" value={biz.pan} onChange={(e) => setBiz({ ...biz, pan: e.target.value })} className={`${inputClass} font-mono`} /></InputField>
                <InputField label="E-Way Bill Threshold (₹)"><input type="number" value={cfg.gst.eWayBillThreshold} onChange={(e) => setCfg({ ...cfg, gst: { ...cfg.gst, eWayBillThreshold: Number(e.target.value) } })} className={inputClass} /></InputField>
                <div className="space-y-2 pt-4 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.gst.priceInclusiveDefault} onChange={(e) => setCfg({ ...cfg, gst: { ...cfg.gst, priceInclusiveDefault: e.target.checked } })} /> Default rates are GST-inclusive</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.gst.autoPlaceOfSupply} onChange={(e) => setCfg({ ...cfg, gst: { ...cfg.gst, autoPlaceOfSupply: e.target.checked } })} /> Auto-detect Place of Supply from customer state</label>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'invoice-financial' && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Invoice Preferences &amp; Print Layout
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="Invoice Prefix"><input type="text" value={cfg.invoice.prefix} onChange={(e) => setCfg({ ...cfg, invoice: { ...cfg.invoice, prefix: e.target.value } })} className={`${inputClass} font-mono`} /></InputField>
                <InputField label="Default Credit Days"><input type="number" value={cfg.invoice.defaultDueDays} onChange={(e) => setCfg({ ...cfg, invoice: { ...cfg.invoice, defaultDueDays: Number(e.target.value) } })} className={inputClass} /></InputField>
                <InputField label="Invoice Template">
                  <select value={cfg.invoice.template} onChange={(e) => setCfg({ ...cfg, invoice: { ...cfg.invoice, template: e.target.value } })} className={inputClass}>
                    {['Classic GST Pro', 'Thermal 80mm', 'Minimal Modern'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </InputField>
                <div className="space-y-2 pt-4 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.invoice.roundOffEnabled} onChange={(e) => setCfg({ ...cfg, invoice: { ...cfg.invoice, roundOffEnabled: e.target.checked } })} /> Auto Round-Off invoice totals</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.invoice.showBankDetails} onChange={(e) => setCfg({ ...cfg, invoice: { ...cfg.invoice, showBankDetails: e.target.checked } })} /> Print Bank &amp; UPI details</label>
                </div>
                <div className="sm:col-span-2">
                  <InputField label="Invoice Terms & Conditions">
                    <textarea rows={3} value={biz.terms} onChange={(e) => setBiz({ ...biz, terms: e.target.value })} className={inputClass} />
                  </InputField>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Financial Year &amp; Accounting Locks
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InputField label="Active Financial Year">
                  <select value={cfg.financial.financialYear} onChange={(e) => setCfg({ ...cfg, financial: { ...cfg.financial, financialYear: e.target.value } })} className={inputClass}>
                    {FINANCIAL_YEARS.map((fy) => <option key={fy} value={fy}>FY {fy}</option>)}
                  </select>
                </InputField>
                <InputField label="Books Beginning From"><input type="date" value={cfg.financial.booksBeginDate} onChange={(e) => setCfg({ ...cfg, financial: { ...cfg.financial, booksBeginDate: e.target.value } })} className={inputClass} /></InputField>
                <InputField label="Period Lock Date"><input type="date" value={cfg.financial.lockBeforeDate} onChange={(e) => setCfg({ ...cfg, financial: { ...cfg.financial, lockBeforeDate: e.target.value } })} className={inputClass} /></InputField>
              </div>
            </div>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <InputField label="Stock Valuation Method">
              <select value={cfg.inventory.valuationMethod} onChange={(e) => setCfg({ ...cfg, inventory: { ...cfg.inventory, valuationMethod: e.target.value } })} className={inputClass}>
                <option value="Weighted Average">Weighted Average Cost</option>
                <option value="FIFO">First In First Out (FIFO)</option>
              </select>
            </InputField>
            <InputField label="Expiry Warning Window (Days)">
              <input type="number" value={cfg.inventory.lowStockAlertDays} onChange={(e) => setCfg({ ...cfg, inventory: { ...cfg.inventory, lowStockAlertDays: Number(e.target.value) } })} className={inputClass} />
            </InputField>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.inventory.trackBatches} onChange={(e) => setCfg({ ...cfg, inventory: { ...cfg.inventory, trackBatches: e.target.checked } })} /> Enable Batch &amp; Expiry Tracking</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.inventory.allowNegativeStock} onChange={(e) => setCfg({ ...cfg, inventory: { ...cfg.inventory, allowNegativeStock: e.target.checked } })} /> Allow Negative Stock Billing</label>
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-4 text-xs text-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3.5">
              <div>
                <div className="font-semibold text-slate-900">Team Access &amp; Role Permissions</div>
                <p className="mt-0.5 text-slate-500">
                  Active workspace roles: Owner, Accountant, Billing Clerk, Warehouse Manager, Viewer.
                </p>
              </div>
              <button type="button" onClick={() => navigate('/users')} className={btnPrimary}>
                Open User Management
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(ROLES_CONFIG).map(([roleKey, roleCfg]) => (
                <div key={roleKey} className="rounded-md border border-slate-200 p-3 space-y-1">
                  <div className="font-semibold text-slate-900">{roleCfg.label}</div>
                  <p className="text-slate-500">{roleCfg.description}</p>
                  <div className="pt-1 font-mono text-[11px] text-indigo-700">
                    Modules: {roleCfg.permissions.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'integrations' && (
          <div className="space-y-3 text-xs">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              Prototype Sandbox: External IRP, E-Way Bill, and UPI QR integrations run in simulated local demo mode.
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.integrations.irpSandboxMode} onChange={(e) => setCfg({ ...cfg, integrations: { ...cfg.integrations, irpSandboxMode: e.target.checked } })} /> IRP E-Invoice Sandbox Simulation</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.integrations.ewayBillSandboxMode} onChange={(e) => setCfg({ ...cfg, integrations: { ...cfg.integrations, ewayBillSandboxMode: e.target.checked } })} /> E-Way Bill NIC Sandbox Simulation</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.integrations.upiStaticQrEnabled} onChange={(e) => setCfg({ ...cfg, integrations: { ...cfg.integrations, upiStaticQrEnabled: e.target.checked } })} /> Show Business UPI Payment Details on Invoices</label>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-2.5 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.notifications.lowStockEmail} onChange={(e) => setCfg({ ...cfg, notifications: { ...cfg.notifications, lowStockEmail: e.target.checked } })} /> Generate Low Stock Alerts automatically on invoice creation</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.notifications.expiryAlerts} onChange={(e) => setCfg({ ...cfg, notifications: { ...cfg.notifications, expiryAlerts: e.target.checked } })} /> Enable Batch Expiry Reminders</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.notifications.gstDueReminders} onChange={(e) => setCfg({ ...cfg, notifications: { ...cfg.notifications, gstDueReminders: e.target.checked } })} /> Show GSTR-1 / GSTR-3B Due Date Reminders</label>
          </div>
        )}

        {tab === 'backup' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Export your organization business data as a JSON snapshot for local backups and audit records.
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => exportAppDataJSON(state)} className={btnSecondary}>
                <Download className="h-3.5 w-3.5" /> Export Data Snapshot (JSON)
              </button>
            </div>
          </div>
        )}

        {tab === 'subscription' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-md border border-indigo-200 bg-indigo-50/50 p-4">
              <div>
                <div className="font-display text-sm font-semibold text-indigo-950">Growth Plan (Annual · Demo)</div>
                <div className="text-indigo-700">₹19,990 / year · Active until 31 Mar 2027 · 5 of 10 user seats used</div>
              </div>
              <StatusLabel status="Active" />
            </div>
          </div>
        )}

        {tab !== 'backup' && tab !== 'subscription' && tab !== 'users' && (
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button type="submit" className={btnPrimary}>
              <Save className="h-3.5 w-3.5" /> Save Settings
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export const SubscriptionPage = () => <SettingsPage defaultTab="subscription" />;
