import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit3,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  Shield,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../services/calculationService';
import { INDIAN_STATES } from '../../data/constants';
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
  const { state, notify } = useApp();
  const [tenantsList, setTenantsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Password visibility toggles
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [selectedTenantDetails, setSelectedTenantDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add Form
  const [addForm, setAddForm] = useState({
    tenantCode: '',
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    state: 'Maharashtra',
    businessAddress: '',
    planName: 'Growth',
  });

  // Edit Form
  const [editForm, setEditForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    businessAddress: '',
    GSTIN: '',
    PAN: '',
    isActive: true,
    subscriptionStatus: 'active',
  });

  // Password Reset Form
  const [newPassword, setNewPassword] = useState('');

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await superAdminService.getTenants({ limit: 100 });
      const list = res?.tenants || res?.data?.tenants || [];
      if (Array.isArray(list) && list.length > 0) {
        setTenantsList(list);
      } else if (state.superAdmin?.tenants) {
        setTenantsList(state.superAdmin.tenants);
      }
    } catch (err) {
      console.warn('Failed to load tenants from server:', err.message);
      if (state.superAdmin?.tenants) {
        setTenantsList(state.superAdmin.tenants);
      }
    } finally {
      setLoading(false);
    }
  }, [state.superAdmin?.tenants]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // Open View Modal and load live users / usage details
  const handleOpenView = async (t) => {
    setSelectedTenant(t);
    setSelectedTenantDetails(null);
    setViewModalOpen(true);
    const tenantId = t._id || t.id || t.tenantCode;
    if (tenantId && !String(tenantId).startsWith('ten-')) {
      try {
        setDetailsLoading(true);
        const details = await superAdminService.getTenantDetails(tenantId);
        setSelectedTenantDetails(details);
      } catch (err) {
        console.warn('Failed to fetch tenant details:', err.message);
      } finally {
        setDetailsLoading(false);
      }
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (t) => {
    setSelectedTenant(t);
    setEditForm({
      businessName: t.businessName || '',
      ownerName: t.ownerName || t.owner || '',
      email: t.email || '',
      phone: t.phone || '',
      city: t.city || '',
      state: t.state || 'Maharashtra',
      businessAddress: t.businessAddress || '',
      GSTIN: t.GSTIN || '',
      PAN: t.PAN || '',
      isActive: t.isActive !== false,
      subscriptionStatus: t.subscriptionStatus || (t.status === 'Expired' ? 'suspended' : 'active'),
    });
    setEditModalOpen(true);
  };

  // Open Add Tenant Modal (cleans state and disables autofill)
  const handleOpenAdd = () => {
    setAddForm({
      tenantCode: '',
      businessName: '',
      ownerName: '',
      email: '',
      password: '',
      phone: '',
      city: '',
      state: 'Maharashtra',
      businessAddress: '',
      planName: 'Growth',
    });
    setShowAddPassword(false);
    setAddModalOpen(true);
  };

  // Open Password Reset Modal
  const handleOpenPassword = (t) => {
    setSelectedTenant(t);
    setNewPassword('');
    setShowResetPassword(false);
    setPasswordModalOpen(true);
  };

  // Open Delete Confirmation Modal
  const handleOpenDelete = (t) => {
    setTenantToDelete(t);
    setDeleteModalOpen(true);
  };

  // Add Tenant Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.tenantCode.trim() || !addForm.businessName.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      notify?.('Please fill all required fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        tenantCode: addForm.tenantCode.toUpperCase().trim(),
        businessName: addForm.businessName.trim(),
        ownerName: addForm.ownerName.trim(),
        email: addForm.email.toLowerCase().trim(),
        password: addForm.password,
        phone: addForm.phone.trim() || '9876543210',
        city: addForm.city.trim(),
        state: addForm.state.trim(),
        businessAddress: addForm.businessAddress.trim(),
        planName: addForm.planName,
      };

      const res = await superAdminService.createTenant(payload);
      
      // Optimistic instant table update
      const createdTenant = res?.tenant || res?.data?.tenant || {
        ...payload,
        _id: res?.data?.tenant?._id || `t-${Date.now()}`,
        isActive: true,
        subscriptionStatus: 'active',
        subscription: { planName: payload.planName, status: 'active' },
      };
      setTenantsList((prev) => [createdTenant, ...prev.filter((item) => (item.tenantCode || item.code) !== payload.tenantCode)]);

      notify?.(`Tenant '${payload.tenantCode}' and owner account created successfully in MongoDB!`, 'success');
      setAddModalOpen(false);
      setAddForm({
        tenantCode: '',
        businessName: '',
        ownerName: '',
        email: '',
        password: '',
        phone: '',
        city: '',
        state: 'Maharashtra',
        businessAddress: '',
        planName: 'Growth',
      });
      fetchTenants();
    } catch (err) {
      notify?.(err.message || 'Failed to create tenant', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Tenant Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const tenantId = selectedTenant?._id || selectedTenant?.id || selectedTenant?.tenantCode;
    if (!tenantId) return;

    try {
      setSubmitting(true);
      await superAdminService.updateTenant(tenantId, editForm);
      
      // Optimistic instant table update
      setTenantsList((prev) =>
        prev.map((item) =>
          (item._id || item.id) === tenantId || (item.tenantCode || item.code) === (selectedTenant.tenantCode || selectedTenant.code)
            ? { ...item, ...editForm }
            : item
        )
      );

      notify?.(`Tenant '${editForm.businessName}' updated successfully!`, 'success');
      setEditModalOpen(false);
      fetchTenants();
    } catch (err) {
      notify?.(err.message || 'Failed to update tenant', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Password Reset Submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const tenantId = selectedTenant?._id || selectedTenant?.id || selectedTenant?.tenantCode;
    if (!tenantId || !newPassword) return;

    try {
      setSubmitting(true);
      const res = await superAdminService.resetTenantPassword(tenantId, newPassword);
      notify?.(res?.message || 'Password reset successfully!', 'success');
      setPasswordModalOpen(false);
      setNewPassword('');
    } catch (err) {
      notify?.(err.message || 'Failed to reset password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Suspend / Activate
  const toggleTenantStatus = async (t) => {
    const isActivating = t.isActive === false || t.subscriptionStatus === 'suspended' || t.status === 'Expired';
    const tenantId = t._id || t.id || t.tenantCode;

    // Immediate optimistic update
    setTenantsList((prev) =>
      prev.map((item) =>
        (item._id || item.id) === tenantId || (item.tenantCode || item.code) === (t.tenantCode || t.code)
          ? {
              ...item,
              isActive: isActivating,
              subscriptionStatus: isActivating ? 'active' : 'suspended',
            }
          : item
      )
    );

    try {
      if (isActivating) {
        await superAdminService.activateTenant(tenantId, 'Console activation');
        notify?.(`Tenant ${t.businessName} activated successfully.`, 'success');
      } else {
        await superAdminService.suspendTenant(tenantId, 'Console suspension');
        notify?.(`Tenant ${t.businessName} suspended.`, 'warning');
      }
      fetchTenants();
    } catch (err) {
      fetchTenants();
      notify?.(err.message || 'Failed to toggle tenant status', 'error');
    }
  };

  // Delete Tenant Confirmation Handler
  const handleDeleteConfirm = async () => {
    if (!tenantToDelete) return;
    const tenantId = tenantToDelete._id || tenantToDelete.id || tenantToDelete.tenantCode;
    try {
      setDeleting(true);
      await superAdminService.deleteTenant(tenantId);

      // Immediate optimistic update: remove row instantaneously from table
      setTenantsList((prev) =>
        prev.filter(
          (t) =>
            (t._id || t.id) !== tenantId &&
            (t.tenantCode || t.code) !== (tenantToDelete.tenantCode || tenantToDelete.code)
        )
      );

      notify?.(`Tenant '${tenantToDelete.businessName}' deleted permanently from MongoDB.`, 'success');
      setDeleteModalOpen(false);
      setTenantToDelete(null);

      fetchTenants();
    } catch (err) {
      notify?.(err.message || 'Failed to delete tenant', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Business / Tenant Management"
        subtitle="Provision live tenants, manage user credentials, inspect data, and control platform access"
        breadcrumbs={['Super Admin', 'Tenants']}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchTenants}
              title="Refresh Tenants"
              className={btnSecondary}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              type="button"
              onClick={handleOpenAdd}
              className={btnPrimary}
            >
              <Plus className="h-3.5 w-3.5" /> Add Tenant
            </button>
          </div>
        }
      />

      <DataTable
        data={tenantsList}
        searchFields={['tenantCode', 'businessName', 'ownerName', 'owner', 'email', 'city']}
        columns={[
          {
            key: 'tenantCode',
            label: 'Tenant Code',
            render: (r) => (
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {r.tenantCode || r.code || (r._id ? String(r._id).slice(-6).toUpperCase() : 'AGST')}
              </span>
            ),
          },
          {
            key: 'businessName',
            label: 'Business & Contact',
            render: (r) => (
              <div>
                <div className="font-semibold text-slate-900">{r.businessName}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3 w-3 text-slate-400" />
                  <span>{r.email || '—'}</span>
                  {r.phone && <span>· {r.phone}</span>}
                </div>
              </div>
            ),
          },
          {
            key: 'ownerName',
            label: 'Owner',
            render: (r) => (
              <div className="text-xs text-slate-700 flex items-center gap-1">
                <User className="h-3 w-3 text-slate-400" />
                <span>{r.ownerName || r.owner || '—'}</span>
              </div>
            ),
          },
          {
            key: 'location',
            label: 'Location',
            render: (r) => (
              <span className="text-xs text-slate-600">
                {r.city || r.state ? `${r.city || ''}${r.city && r.state ? ', ' : ''}${r.state || ''}` : 'India'}
              </span>
            ),
          },
          {
            key: 'plan',
            label: 'Plan',
            render: (r) => (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {r.subscription?.planName || r.plan || 'Growth'}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => {
              const raw = r.subscriptionStatus || (r.isActive !== false ? 'active' : 'suspended');
              const display = raw === 'active' ? 'Active' : (raw === 'suspended' ? 'Suspended' : (raw === 'trial' ? 'Trial' : raw));
              return <StatusLabel status={display} />;
            },
          },
          {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            render: (r) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenView(r)}
                  title="View Tenant & Users"
                  className="rounded p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(r)}
                  title="Edit Tenant Details"
                  className="rounded p-1 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPassword(r)}
                  title="Reset Admin Password"
                  className="rounded p-1 text-slate-500 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleTenantStatus(r)}
                  title={r.isActive !== false ? 'Suspend Tenant' : 'Activate Tenant'}
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                    r.isActive !== false && r.subscriptionStatus !== 'suspended'
                      ? 'text-rose-600 hover:bg-rose-50'
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {r.isActive !== false && r.subscriptionStatus !== 'suspended' ? 'Suspend' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDelete(r)}
                  title="Delete Tenant"
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* 1. Provision New Tenant Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Provision New SaaS Tenant & Owner User"
        footer={
          <>
            <button type="button" onClick={() => setAddModalOpen(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="add-tenant-form" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Creating in Database...' : 'Create Tenant & User'}
            </button>
          </>
        }
      >
        <form id="add-tenant-form" onSubmit={handleAddSubmit} autoComplete="off" className="space-y-4">
          {/* Hidden dummy fields to consume browser credential autofill */}
          <input type="text" name="dummy_username" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
          <input type="password" name="dummy_password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />

          <div className="rounded-lg bg-indigo-50/70 p-3 text-xs text-indigo-900 border border-indigo-100">
            <strong>Automatic Provisioning:</strong> This creates the organization partition in MongoDB, initializes the initial <strong>Owner User</strong> account with the specified credentials, and activates their subscription.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Tenant Code (Unique Login Code)" required>
              <input
                type="text"
                required
                placeholder="e.g. EKUM"
                value={addForm.tenantCode}
                onChange={(e) => setAddForm({ ...addForm, tenantCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                className={`${inputClass} font-mono uppercase font-bold`}
              />
            </InputField>
            <InputField label="Business / Company Name" required>
              <input
                type="text"
                required
                placeholder="e.g. EKUM Retail Enterprises"
                value={addForm.businessName}
                onChange={(e) => setAddForm({ ...addForm, businessName: e.target.value })}
                className={inputClass}
              />
            </InputField>
            <InputField label="Owner / Admin Full Name" required>
              <input
                type="text"
                required
                placeholder="e.g. Ekum Admin"
                value={addForm.ownerName}
                onChange={(e) => setAddForm({ ...addForm, ownerName: e.target.value })}
                className={inputClass}
              />
            </InputField>
            <InputField label="Admin Email (Login ID)" required>
              <input
                type="email"
                name="new_tenant_owner_email"
                id="new_tenant_owner_email"
                autoComplete="new-password"
                required
                placeholder="e.g. admin@ekum.com"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                className={inputClass}
              />
            </InputField>
            <InputField label="Initial Admin Password" required>
              <div className="relative">
                <input
                  type={showAddPassword ? 'text' : 'password'}
                  name="new_tenant_owner_password"
                  id="new_tenant_owner_password"
                  autoComplete="new-password"
                  required
                  placeholder="Minimum 6 characters"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowAddPassword((prev) => !prev)}
                  tabIndex={-1}
                  title={showAddPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </InputField>
            <InputField label="Phone Number" required>
              <input
                type="text"
                required
                placeholder="e.g. 9876543210"
                value={addForm.phone}
                onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                className={inputClass}
              />
            </InputField>
            <InputField label="City">
              <input
                type="text"
                placeholder="e.g. Mumbai"
                value={addForm.city}
                onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                className={inputClass}
              />
            </InputField>
            <InputField label="State">
              <select
                value={addForm.state}
                onChange={(e) => setAddForm({ ...addForm, state: e.target.value })}
                className={inputClass}
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </InputField>
          </div>

          <InputField label="Subscription Plan Tier">
            <select
              value={addForm.planName}
              onChange={(e) => setAddForm({ ...addForm, planName: e.target.value })}
              className={inputClass}
            >
              <option value="Starter">Starter (₹799/mo · 5 Users · 500 Invoices)</option>
              <option value="Growth">Growth (₹1,999/mo · 15 Users · Unlimited)</option>
              <option value="Enterprise">Enterprise (₹4,999/mo · Unlimited · Full E-Invoice)</option>
            </select>
          </InputField>
        </form>
      </Modal>

      {/* 2. View Tenant & Users Modal */}
      <Modal
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={selectedTenant ? `${selectedTenant.businessName} (${selectedTenant.tenantCode || selectedTenant.code})` : 'Tenant Details'}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setViewModalOpen(false);
                  handleOpenPassword(selectedTenant);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline"
              >
                <KeyRound className="h-3.5 w-3.5" /> Reset Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewModalOpen(false);
                  handleOpenEdit(selectedTenant);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:underline"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit Details
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewModalOpen(false);
                  handleOpenDelete(selectedTenant);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Tenant
              </button>
            </div>
            <button type="button" onClick={() => setViewModalOpen(false)} className={btnSecondary}>
              Close
            </button>
          </div>
        }
      >
        {selectedTenant && (
          <div className="space-y-4">
            {/* Overview Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Tenant Code</span>
                <span className="font-mono font-bold text-indigo-700">{selectedTenant.tenantCode || selectedTenant.code}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Owner</span>
                <span className="font-semibold text-slate-800">{selectedTenant.ownerName || selectedTenant.owner || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Email</span>
                <span className="text-slate-800 truncate block">{selectedTenant.email || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Phone</span>
                <span className="text-slate-800">{selectedTenant.phone || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">City / State</span>
                <span className="text-slate-800">{selectedTenant.city || '—'}, {selectedTenant.state || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">GSTIN</span>
                <span className="font-mono text-slate-800">{selectedTenant.GSTIN || 'Not registered'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Subscription</span>
                <span className="font-semibold text-indigo-600">{selectedTenant.subscription?.planName || selectedTenant.plan || 'Growth'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Account Status</span>
                <span className={`font-semibold ${selectedTenant.isActive !== false ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedTenant.isActive !== false ? 'Active' : 'Suspended'}
                </span>
              </div>
            </div>

            {/* Usage Telemetry */}
            {selectedTenantDetails?.usage && (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <div className="text-lg font-bold text-slate-900">{selectedTenantDetails.usage.users}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Staff Users</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <div className="text-lg font-bold text-slate-900">{selectedTenantDetails.usage.invoices}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Invoices Issued</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <div className="text-lg font-bold text-slate-900">{selectedTenantDetails.usage.products}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Catalog SKUs</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-2.5">
                  <div className="text-lg font-bold text-slate-900">{selectedTenantDetails.usage.warehouses}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Warehouses</div>
                </div>
              </div>
            )}

            {/* Tenant Users List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-600" /> Organization Users & Credentials
                </h4>
                {detailsLoading && <span className="text-[11px] text-slate-400 animate-pulse">Loading live users...</span>}
              </div>

              {selectedTenantDetails?.users && selectedTenantDetails.users.length > 0 ? (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email (Login ID)</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Last Login</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedTenantDetails.users.map((u) => (
                        <tr key={u._id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 font-medium text-slate-900">{u.name}</td>
                          <td className="px-3 py-2 font-mono text-indigo-700">{u.email}</td>
                          <td className="px-3 py-2 capitalize">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {u.role}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[11px] font-medium ${u.isActive !== false ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {u.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-[11px]">
                            {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                  {detailsLoading ? 'Fetching users from MongoDB...' : `Primary Owner Account: ${selectedTenant.email}`}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Edit Tenant Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Tenant: ${selectedTenant?.businessName}`}
        footer={
          <>
            <button type="button" onClick={() => setEditModalOpen(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="edit-tenant-form" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form id="edit-tenant-form" onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Business Name" required>
            <input
              type="text"
              required
              value={editForm.businessName}
              onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
              className={inputClass}
            />
          </InputField>
          <InputField label="Owner Name" required>
            <input
              type="text"
              required
              value={editForm.ownerName}
              onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
              className={inputClass}
            />
          </InputField>
          <InputField label="Business Email" required>
            <input
              type="email"
              required
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className={inputClass}
            />
          </InputField>
          <InputField label="Phone Number" required>
            <input
              type="text"
              required
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className={inputClass}
            />
          </InputField>
          <InputField label="City">
            <input
              type="text"
              value={editForm.city}
              onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              className={inputClass}
            />
          </InputField>
          <InputField label="State">
            <select
              value={editForm.state}
              onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
              className={inputClass}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </InputField>
          <InputField label="GSTIN">
            <input
              type="text"
              placeholder="e.g. 27AAPFU0939F1ZV"
              value={editForm.GSTIN}
              onChange={(e) => setEditForm({ ...editForm, GSTIN: e.target.value.toUpperCase() })}
              className={`${inputClass} uppercase`}
            />
          </InputField>
          <InputField label="PAN">
            <input
              type="text"
              placeholder="e.g. AAPFU0939F"
              value={editForm.PAN}
              onChange={(e) => setEditForm({ ...editForm, PAN: e.target.value.toUpperCase() })}
              className={`${inputClass} uppercase`}
            />
          </InputField>
          <div className="sm:col-span-2">
            <InputField label="Business Address">
              <input
                type="text"
                value={editForm.businessAddress}
                onChange={(e) => setEditForm({ ...editForm, businessAddress: e.target.value })}
                className={inputClass}
              />
            </InputField>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={editForm.isActive}
              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="isActiveCheck" className="text-xs font-semibold text-slate-800">
              Account Active & Enabled
            </label>
          </div>
        </form>
      </Modal>

      {/* 4. Reset Admin Password Modal */}
      <Modal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title={`Reset Password for ${selectedTenant?.businessName}`}
        footer={
          <>
            <button type="button" onClick={() => setPasswordModalOpen(false)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="reset-pwd-form" disabled={submitting} className={btnPrimary}>
              {submitting ? 'Updating Password...' : 'Set New Password'}
            </button>
          </>
        }
      >
        <form id="reset-pwd-form" onSubmit={handlePasswordSubmit} className="space-y-3">
          <div className="text-xs text-slate-600">
            This will immediately change the login password for the primary administrator account under{' '}
            <strong className="text-slate-900">{selectedTenant?.businessName}</strong> (Tenant Code:{' '}
            <strong className="text-indigo-600">{selectedTenant?.tenantCode || selectedTenant?.code}</strong>).
          </div>
          <InputField label="New Password" required>
            <div className="relative">
              <input
                type={showResetPassword ? 'text' : 'password'}
                name="reset_tenant_owner_password"
                id="reset_tenant_owner_password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Enter at least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowResetPassword((prev) => !prev)}
                tabIndex={-1}
                title={showResetPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </InputField>
        </form>
      </Modal>

      {/* 5. Delete Tenant Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        title="Delete Tenant Organization"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteModalOpen(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteConfirm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Deleting from MongoDB...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" /> Permanently Delete Tenant
                </>
              )}
            </button>
          </div>
        }
      >
        {tenantToDelete && (
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900">
              <div className="font-semibold text-rose-800 flex items-center gap-1.5 mb-1 text-sm">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Permanent Deletion Warning</span>
              </div>
              <p>
                You are about to permanently delete <strong>{tenantToDelete.businessName}</strong>. This action will immediately remove the tenant organization partition, owner login credentials, staff users, subscriptions, products, and invoices from MongoDB Atlas.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Tenant Code:</span>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {tenantToDelete.tenantCode || tenantToDelete.code}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Business Name:</span>
                <span className="font-semibold text-slate-900">{tenantToDelete.businessName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Owner Email:</span>
                <span className="text-slate-700 font-mono">{tenantToDelete.email || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Plan:</span>
                <span className="text-slate-700 font-medium">{tenantToDelete.subscription?.planName || tenantToDelete.plan || 'Growth'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Click <strong>Permanently Delete Tenant</strong> below to confirm and remove this organization completely.
            </p>
          </div>
        )}
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
