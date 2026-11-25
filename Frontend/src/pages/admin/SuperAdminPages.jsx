import React, { useState, useEffect } from 'react';
import { Plus, Edit3, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../services/calculationService';
import * as superAdminService from '../../services/superAdminService';
import {
  PageHeader,
  DataTable,
  StatCard,
  StatusLabel,
  Modal,
  InputField,
  inputClass,
  btnPrimary,
  btnSecondary,
} from '../../components/common/UI';

export const SuperAdminDashboardPage = () => {
  const { state } = useApp();
  const sa = state.superAdmin;
  const [telemetry, setTelemetry] = useState(null);

  useEffect(() => {
    let isMounted = true;
    superAdminService
      .getDashboard()
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data || res;
        setTelemetry(data);
      })
      .catch((err) => console.warn('Platform telemetry fetch error:', err.message));
    return () => {
      isMounted = false;
    };
  }, []);

  const totalBusinesses = telemetry?.tenants?.total ?? sa.tenants.length;
  const activeBusinesses = telemetry?.tenants?.active ?? sa.tenants.filter((t) => t.status === 'Active').length;
  const trialBusinesses = telemetry?.subscriptions?.trial ?? sa.tenants.filter((t) => t.status === 'Trial').length;
  const expiredBusinesses =
    telemetry
      ? (telemetry.subscriptions?.expired || 0) + (telemetry.subscriptions?.suspended || 0)
      : sa.tenants.filter((t) => t.status === 'Expired').length;
  const mrr = telemetry?.financials?.mrr ?? sa.tenants.reduce((s, t) => s + (Number(t.mrr) || 0), 0);

  const regChart = [
    { month: 'Jun', signups: 14 },
    { month: 'Jul', signups: 19 },
    { month: 'Aug', signups: 24 },
    { month: 'Sep', signups: 31 },
    { month: 'Oct', signups: 38 },
    { month: 'Nov', signups: 44 },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform Overview"
        subtitle="Multi-tenant SaaS telemetry across businesses, subscriptions, and recurring revenue (Isolated Demo Data)"
        breadcrumbs={['Super Admin', 'Overview']}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Businesses" value={totalBusinesses} />
        <StatCard label="Active Tenants" value={activeBusinesses} tone="success" />
        <StatCard label="Trial Accounts" value={trialBusinesses} tone="warning" />
        <StatCard label="Expired Subscriptions" value={expiredBusinesses} tone="danger" />
        <StatCard label="Monthly Recurring Rev." value={formatINR(mrr, false)} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-slate-900">Monthly Tenant Registrations (Demo)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="signups" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export const SuperAdminTenantsPage = () => {
  const { state, updateSuperAdmin } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ businessName: '', owner: '', city: '', state: 'Rajasthan', plan: 'Growth', status: 'Active' });

  const handleAdd = (e) => {
    e.preventDefault();
    const mrrMap = { Starter: 799, Growth: 1999, Enterprise: 4999 };
    const newTen = {
      id: `ten-${Date.now()}`,
      ...form,
      users: 1,
      invoicesCount: 0,
      mrr: form.status === 'Active' ? mrrMap[form.plan] || 1999 : 0,
      joinedDate: new Date().toISOString().slice(0, 10),
      renewalDate: '2027-11-20',
    };
    updateSuperAdmin((sa) => ({ ...sa, tenants: [newTen, ...sa.tenants] }), 'Tenant created');
    setModalOpen(false);
  };

  const toggleTenantStatus = async (t) => {
    const isActivating = t.status !== 'Active';
    try {
      if (isActivating) {
        await superAdminService.activateTenant(t.id, 'SuperAdmin console activation');
      } else {
        await superAdminService.suspendTenant(t.id, 'SuperAdmin console suspension');
      }
    } catch (err) {
      console.warn('Tenant status update API error:', err.message);
    }
    const nextStatus = isActivating ? 'Active' : 'Expired';
    updateSuperAdmin(
      (sa) => ({
        ...sa,
        tenants: sa.tenants.map((item) => (item.id === t.id ? { ...item, status: nextStatus } : item)),
      }),
      `Tenant ${t.businessName} set to ${nextStatus}`
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Business / Tenant Management"
        subtitle="Onboard, suspend, or inspect tenant organizations on the SaaS platform"
        breadcrumbs={['Super Admin', 'Tenants']}
        actions={
          <button type="button" onClick={() => setModalOpen(true)} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" /> Add Tenant
          </button>
        }
      />
      <DataTable
        data={state.superAdmin.tenants}
        searchFields={['businessName', 'owner', 'city', 'plan']}
        columns={[
          { key: 'businessName', label: 'Business Name', render: (r) => <span className="font-semibold text-slate-900">{r.businessName}</span> },
          { key: 'owner', label: 'Owner' },
          { key: 'city', label: 'Location', render: (r) => `${r.city}, ${r.state}` },
          { key: 'plan', label: 'Plan' },
          { key: 'users', label: 'Users', align: 'right' },
          { key: 'invoicesCount', label: 'Invoices', align: 'right' },
          { key: 'mrr', label: 'MRR', align: 'right', render: (r) => formatINR(r.mrr, false) },
          { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          {
            key: 'action',
            label: 'Action',
            render: (r) => (
              <button type="button" onClick={() => toggleTenantStatus(r)} className="text-xs font-medium text-indigo-600 hover:underline">
                {r.status === 'Active' ? 'Suspend' : 'Activate'}
              </button>
            ),
          },
        ]}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Provision New SaaS Tenant"
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="ten-form" className={btnPrimary}>Create Tenant</button>
          </>
        }
      >
        <form id="ten-form" onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
          <InputField label="Business Name" required><input type="text" required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Owner Name" required><input type="text" required value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={inputClass} /></InputField>
          <InputField label="City"><input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Plan">
            <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className={inputClass}>
              {state.superAdmin.plans.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </InputField>
        </form>
      </Modal>
    </div>
  );
};

export const SuperAdminPlansPage = () => {
  const { state, updateSuperAdmin } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', audience: '', monthlyPrice: 999, annualPrice: 9990, maxUsers: 5, maxInvoices: 500, maxWarehouses: 2 });

  const openModal = (p = null) => {
    setEditing(p);
    setForm(p ? { ...p } : { name: '', audience: '', monthlyPrice: 999, annualPrice: 9990, maxUsers: 5, maxInvoices: 500, maxWarehouses: 2 });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      id: editing ? editing.id : `plan-${Date.now()}`,
      monthlyPrice: Number(form.monthlyPrice),
      annualPrice: Number(form.annualPrice),
      maxUsers: Number(form.maxUsers),
      maxInvoices: Number(form.maxInvoices),
      maxWarehouses: Number(form.maxWarehouses),
      features: editing?.features || ['GST Invoicing', 'Inventory & Ledgers'],
    };
    try {
      if (editing && !String(editing.id).startsWith('plan-')) {
        await superAdminService.updatePlan(editing.id, {
          name: payload.name,
          description: payload.audience,
          price: payload.monthlyPrice,
          annualPrice: payload.annualPrice,
          limits: {
            maxUsers: payload.maxUsers,
            maxInvoices: payload.maxInvoices,
            maxWarehouses: payload.maxWarehouses,
          },
          features: payload.features,
        });
      } else {
        await superAdminService.createPlan({
          name: payload.name,
          code: payload.name.toUpperCase().replace(/\s+/g, '_'),
          description: payload.audience,
          price: payload.monthlyPrice,
          annualPrice: payload.annualPrice,
          limits: {
            maxUsers: payload.maxUsers,
            maxInvoices: payload.maxInvoices,
            maxWarehouses: payload.maxWarehouses,
          },
          features: payload.features,
        });
      }
    } catch (err) {
      console.warn('Plan API call error:', err.message);
    }
    updateSuperAdmin(
      (sa) => ({
        ...sa,
        plans: editing
          ? sa.plans.map((p) => (p.id === payload.id ? payload : p))
          : [...sa.plans, payload],
      }),
      'Subscription plan saved'
    );
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscription Plans"
        subtitle="Configure SaaS pricing tiers, user seats, and warehouse limits"
        breadcrumbs={['Super Admin', 'Subscription Plans']}
        actions={
          <button type="button" onClick={() => openModal()} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" /> Add Plan
          </button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {state.superAdmin.plans.map((plan) => (
          <div key={plan.id} className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-slate-900">{plan.name}</h3>
                <button type="button" onClick={() => openModal(plan)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-500">{plan.audience}</p>
              <div className="mt-3 font-mono text-2xl font-bold text-slate-900">
                {formatINR(plan.monthlyPrice, false)}
                <span className="text-xs font-normal text-slate-500"> / mo</span>
              </div>
              <div className="text-xs text-slate-500">Annual: {formatINR(plan.annualPrice, false)} / yr</div>
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div>Up to <strong>{plan.maxUsers}</strong> users</div>
                <div>Up to <strong>{plan.maxInvoices.toLocaleString('en-IN')}</strong> invoices / yr</div>
                <div>Up to <strong>{plan.maxWarehouses}</strong> warehouses</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Plan — ${editing.name}` : 'Create Subscription Plan'}
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" form="plan-form" className={btnPrimary}>Save Plan</button>
          </>
        }
      >
        <form id="plan-form" onSubmit={handleSave} className="grid grid-cols-2 gap-3">
          <InputField label="Plan Name" required><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Target Audience"><input type="text" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Monthly Price (₹)"><input type="number" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Annual Price (₹)"><input type="number" value={form.annualPrice} onChange={(e) => setForm({ ...form, annualPrice: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Max Users"><input type="number" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} className={inputClass} /></InputField>
          <InputField label="Max Warehouses"><input type="number" value={form.maxWarehouses} onChange={(e) => setForm({ ...form, maxWarehouses: e.target.value })} className={inputClass} /></InputField>
        </form>
      </Modal>
    </div>
  );
};

export const SuperAdminSubSectionPage = ({ section }) => {
  const { state, updateSuperAdmin } = useApp();
  const sa = state.superAdmin;
  const [annTitle, setAnnTitle] = useState('');
  const [trialDays, setTrialDays] = useState(14);
  const [supportEmail, setSupportEmail] = useState('support@arthagst.demo');

  useEffect(() => {
    let isMounted = true;
    if (section === 'settings') {
      superAdminService
        .getPlatformSettings()
        .then((res) => {
          if (!isMounted) return;
          const data = res?.data || res;
          if (data?.defaultTrialDays) setTrialDays(data.defaultTrialDays);
          if (data?.supportEmail) setSupportEmail(data.supportEmail);
        })
        .catch((err) => console.warn('Load settings error:', err.message));
    }
    return () => {
      isMounted = false;
    };
  }, [section]);

  const handleResolveTicket = async (r) => {
    try {
      await superAdminService.resolveTicket(r.id);
    } catch (err) {
      console.warn('Resolve ticket error:', err.message);
    }
    updateSuperAdmin(
      (prev) => ({ ...prev, tickets: prev.tickets.map((t) => (t.id === r.id ? { ...t, status: 'Resolved' } : t)) }),
      `Ticket ${r.ticketNo} marked Resolved`
    );
  };

  const handlePublishAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle.trim()) return;
    try {
      await superAdminService.createAnnouncement({
        title: annTitle,
        targetAudience: 'All Active Tenants',
        status: 'Published',
      });
    } catch (err) {
      console.warn('Announcement API error:', err.message);
    }
    updateSuperAdmin(
      (prev) => ({
        ...prev,
        announcements: [{ id: `ann-${Date.now()}`, title: annTitle, target: 'All Active Tenants', date: new Date().toISOString().slice(0, 10), status: 'Published' }, ...prev.announcements],
      }),
      'Announcement published'
    );
    setAnnTitle('');
  };

  const handleToggleFeature = async (ff) => {
    const nextState = !ff.enabled;
    try {
      await superAdminService.toggleFeatureFlag(ff.id || ff.key, nextState);
    } catch (err) {
      console.warn('Feature flag API error:', err.message);
    }
    updateSuperAdmin(
      (prev) => ({
        ...prev,
        featureFlags: prev.featureFlags.map((f) => (f.id === ff.id ? { ...f, enabled: nextState } : f)),
      }),
      `${ff.name} ${nextState ? 'enabled' : 'disabled'}`
    );
  };

  const handleSaveSettings = async () => {
    try {
      await superAdminService.updatePlatformSettings({
        defaultTrialDays: Number(trialDays),
        supportEmail,
        sandboxMode: true,
      });
    } catch (err) {
      console.warn('Save settings error:', err.message);
    }
    updateSuperAdmin((s) => s, 'Platform settings saved');
  };

  if (section === 'users') {
    return (
      <div className="space-y-5">
        <PageHeader title="Platform Tenant Owners & Users" subtitle="Directory of primary business owners across all tenants" breadcrumbs={['Super Admin', 'Users']} />
        <DataTable
          data={sa.tenants}
          columns={[
            { key: 'owner', label: 'Owner Name', render: (r) => <span className="font-semibold">{r.owner}</span> },
            { key: 'businessName', label: 'Tenant Organization' },
            { key: 'plan', label: 'Plan' },
            { key: 'joinedDate', label: 'Joined', render: (r) => <span className="font-mono text-xs">{r.joinedDate}</span> },
            { key: 'status', label: 'Account Status', render: (r) => <StatusLabel status={r.status} /> },
          ]}
        />
      </div>
    );
  }

  if (section === 'subscriptions') {
    return (
      <div className="space-y-5">
        <PageHeader title="Subscription Management" subtitle="Track active renewals, trials, and expired tenant subscriptions" breadcrumbs={['Super Admin', 'Subscriptions']} />
        <DataTable
          data={sa.tenants}
          columns={[
            { key: 'businessName', label: 'Tenant' },
            { key: 'plan', label: 'Current Plan' },
            { key: 'mrr', label: 'Monthly Fee', align: 'right', render: (r) => formatINR(r.mrr, false) },
            { key: 'renewalDate', label: 'Next Renewal', render: (r) => <span className="font-mono text-xs">{r.renewalDate}</span> },
            { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          ]}
        />
      </div>
    );
  }

  if (section === 'payments') {
    return (
      <div className="space-y-5">
        <PageHeader title="Platform Subscription Payments" subtitle="SaaS billing collections and gateway settlement logs" breadcrumbs={['Super Admin', 'Payments']} />
        <DataTable
          data={sa.platformPayments}
          columns={[
            { key: 'txnId', label: 'Txn ID', render: (r) => <span className="font-mono font-semibold">{r.txnId}</span> },
            { key: 'tenant', label: 'Tenant' },
            { key: 'plan', label: 'Plan' },
            { key: 'cycle', label: 'Cycle' },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{r.date}</span> },
            { key: 'method', label: 'Method' },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatINR(r.amount, false) },
            { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          ]}
        />
      </div>
    );
  }

  if (section === 'tickets') {
    return (
      <div className="space-y-5">
        <PageHeader title="Support Tickets" subtitle="Resolve tenant GST and billing support requests" breadcrumbs={['Super Admin', 'Support Tickets']} />
        <DataTable
          data={sa.tickets}
          columns={[
            { key: 'ticketNo', label: 'Ticket #', render: (r) => <span className="font-mono font-semibold">{r.ticketNo}</span> },
            { key: 'tenant', label: 'Tenant' },
            { key: 'subject', label: 'Subject' },
            { key: 'priority', label: 'Priority', render: (r) => <StatusLabel status={r.priority} /> },
            { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
            {
              key: 'resolve',
              label: 'Action',
              render: (r) =>
                r.status !== 'Resolved' ? (
                  <button
                    type="button"
                    onClick={() => handleResolveTicket(r)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Closed</span>
                ),
            },
          ]}
        />
      </div>
    );
  }

  if (section === 'announcements') {
    return (
      <div className="space-y-5">
        <PageHeader title="Platform Announcements" subtitle="Broadcast compliance updates and maintenance windows to tenants" breadcrumbs={['Super Admin', 'Announcements']} />
        <form
          onSubmit={handlePublishAnnouncement}
          className="flex gap-2 rounded-lg border border-slate-200 bg-white p-4"
        >
          <input type="text" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Write announcement headline..." className={inputClass} />
          <button type="submit" className={btnPrimary}>Publish</button>
        </form>
        <DataTable
          data={sa.announcements}
          columns={[
            { key: 'title', label: 'Announcement' },
            { key: 'target', label: 'Audience' },
            { key: 'date', label: 'Date', render: (r) => <span className="font-mono text-xs">{r.date}</span> },
            { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
          ]}
        />
      </div>
    );
  }

  if (section === 'features') {
    return (
      <div className="space-y-5">
        <PageHeader title="Feature Flag Management" subtitle="Enable or disable SaaS capabilities across tenants" breadcrumbs={['Super Admin', 'Feature Flags']} />
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {sa.featureFlags.map((ff) => (
            <div key={ff.id} className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">{ff.name}</div>
                <div className="text-xs text-slate-500">
                  <span className="font-mono text-indigo-700">{ff.key}</span> · {ff.description}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleFeature(ff)}
                className={ff.enabled ? btnPrimary : btnSecondary}
              >
                {ff.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'settings') {
    return (
      <div className="space-y-5">
        <PageHeader title="Platform System Settings" subtitle="Global SaaS defaults for trial duration, GST rules, and support email" breadcrumbs={['Super Admin', 'System Settings']} />
        <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-xs">
          <InputField label="Default Trial Period (Days)">
            <input
              type="number"
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              className={inputClass}
            />
          </InputField>
          <InputField label="Platform Support Email">
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className={inputClass}
            />
          </InputField>
          <InputField label="Default GST Portal Sandbox Mode">
            <input type="text" disabled value="Enabled (Demo Prototype)" className={inputClass} />
          </InputField>
          <button type="button" onClick={handleSaveSettings} className={btnPrimary}>
            Save System Settings
          </button>
        </div>
      </div>
    );
  }

  if (section === 'audit') {
    return (
      <div className="space-y-5">
        <PageHeader title="Platform Audit Logs" subtitle="Administrative actions across tenant lifecycle and feature controls" breadcrumbs={['Super Admin', 'Audit Logs']} />
        <DataTable
          data={sa.platformAuditLogs}
          columns={[
            { key: 'timestamp', label: 'Timestamp', render: (r) => <span className="font-mono text-xs">{r.timestamp}</span> },
            { key: 'actor', label: 'Actor' },
            { key: 'action', label: 'Action' },
            { key: 'target', label: 'Target' },
            { key: 'detail', label: 'Detail' },
          ]}
        />
      </div>
    );
  }

  // Platform Analytics fallback
  const planRev = sa.plans.map((p) => ({
    plan: p.name,
    MRR: sa.tenants.filter((t) => t.plan === p.name).reduce((s, t) => s + t.mrr, 0),
  }));
  return (
    <div className="space-y-5">
      <PageHeader title="Platform Analytics" subtitle="MRR distribution by subscription tier" breadcrumbs={['Super Admin', 'Analytics']} />
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={planRev}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="plan" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val) => formatINR(val, false)} />
              <Bar dataKey="MRR" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
