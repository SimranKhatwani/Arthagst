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
  Building2,
  Eye,
  Shield,
  Users,
  Lock,
  KeyRound,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ROLES_CONFIG, INDIAN_STATES, FINANCIAL_YEARS } from '../../data/constants';
import { exportAppDataJSON } from '../../services/storageService';
import * as userService from '../../services/userService';
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
  const { state, setState, notify, confirmAction } = useApp();
  const [activeCategory, setActiveCategory] = useState('users'); // 'users' | 'permissions'

  // Users State
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    role: 'Billing Clerk',
    password: '',
    status: 'Active',
  });
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  // Role Permissions State
  const [rolesConfig, setRolesConfig] = useState(() => ({ ...ROLES_CONFIG }));
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ label: '', description: '', permissions: [] });

  const ALL_MODULES = [
    { id: 'sales', label: 'Sales & Invoicing', desc: 'Invoices, Quotations, Orders, Challans, Credit Notes' },
    { id: 'purchases', label: 'Purchases & Bills', desc: 'Purchase Bills, Orders, GRNs, Debit Notes' },
    { id: 'inventory', label: 'Inventory & Godowns', desc: 'Stock movements, Items, Warehouses' },
    { id: 'parties', label: 'Parties & CRM', desc: 'Customer & Supplier directory and ledgers' },
    { id: 'payments', label: 'Banking & Payments', desc: 'Bank accounts, payment in/out, settlements' },
    { id: 'expenses', label: 'Expenses & Overheads', desc: 'Vouchers, recurring expenses, ITC claims' },
    { id: 'pos', label: 'POS Billing', desc: 'Retail counter checkout and thermal receipts' },
    { id: 'gst', label: 'GST Returns', desc: 'GSTR-1, GSTR-3B, GSTR-2B reconciliation' },
    { id: 'accounting', label: 'Accounting & Ledgers', desc: 'Chart of accounts, journals, P&L, balance sheet' },
    { id: 'reports', label: 'Reports & Analytics', desc: 'Business dashboards and financial registers' },
    { id: 'users', label: 'User Management', desc: 'Manage team staff and permissions' },
    { id: 'settings', label: 'Business Settings', desc: 'Company profile, tax rates, invoice templates' },
  ];

  const openModal = (u = null) => {
    setEditing(u);
    if (u) {
      const isKnown = Object.keys(rolesConfig).includes(u.role);
      setIsCustomRole(!isKnown);
      setForm({
        name: u.name || '',
        email: u.email || '',
        mobile: u.mobile || u.phone || '',
        role: u.role || 'Billing Clerk',
        password: '',
        status: u.status || (u.isActive ? 'Active' : 'Inactive'),
      });
    } else {
      setIsCustomRole(false);
      setForm({
        name: '',
        email: '',
        mobile: '',
        role: 'Billing Clerk',
        password: '',
        status: 'Active',
      });
    }
    setModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      notify('Name and email are required', 'error');
      return;
    }
    if (!form.role.trim()) {
      notify('Please select or enter a valid role', 'error');
      return;
    }
    if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      notify('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    setSavingUser(true);
    try {
      if (editing && editing.id && !String(editing.id).startsWith('usr-') && !String(editing.id).startsWith('owner-')) {
        // Backend update
        await userService.updateUser(editing.id, {
          name: form.name.trim(),
          phone: form.mobile.trim(),
          role: form.role.trim(),
          ...(form.password ? { password: form.password } : {}),
        });
      } else if (!editing) {
        // Backend create
        try {
          await userService.createUser({
            name: form.name.trim(),
            email: form.email.trim(),
            mobile: form.mobile.trim(),
            role: form.role.trim(),
            password: form.password || 'Password@123',
          });
        } catch (apiErr) {
          console.warn('Backend user create note:', apiErr.message);
        }
      }

      // Update frontend state
      const targetId = editing ? editing.id : `user-${Date.now()}`;
      setState((prev) => {
        const existingUsers = Array.isArray(prev.users) ? prev.users : [];
        const exists = existingUsers.some((u) => u.id === targetId);
        const updatedRecord = {
          id: targetId,
          name: form.name.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim(),
          phone: form.mobile.trim(),
          role: form.role.trim(),
          status: form.status,
          isActive: form.status === 'Active',
          lastLogin: editing?.lastLogin || 'Never',
          permissions: rolesConfig[form.role]?.permissions || ['sales'],
        };
        const nextUsers = exists
          ? existingUsers.map((u) => (u.id === targetId ? updatedRecord : u))
          : [updatedRecord, ...existingUsers];
        return { ...prev, users: nextUsers };
      });

      notify(editing ? `User '${form.name}' updated successfully` : `User '${form.name}' added to organization`);
      setModalOpen(false);
    } catch (err) {
      notify(err.message || 'Failed to save user', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const toggleStatus = async (u) => {
    const nextStatus = u.status === 'Active' ? 'Inactive' : 'Active';
    try {
      if (u.id && !String(u.id).startsWith('usr-') && !String(u.id).startsWith('owner-')) {
        await userService.updateUserStatus(u.id, nextStatus === 'Active');
      }
      setState((prev) => ({
        ...prev,
        users: (prev.users || []).map((user) =>
          user.id === u.id ? { ...user, status: nextStatus, isActive: nextStatus === 'Active' } : user
        ),
      }));
      notify(`User '${u.name}' ${nextStatus.toLowerCase()}d successfully`);
    } catch (err) {
      notify(err.message || 'Failed to change user status', 'error');
    }
  };

  const handleDeleteUser = (u) => {
    if (u.role === 'owner' || u.role === 'Owner') {
      notify('Cannot delete the organization Owner account', 'error');
      return;
    }
    confirmAction(
      `Remove User: ${u.name}`,
      `Are you sure you want to remove user '${u.name}' (${u.email}) from your team? They will immediately lose access.`,
      async () => {
        try {
          if (u.id && !String(u.id).startsWith('usr-')) {
            await userService.deleteUser(u.id);
          }
          setState((prev) => ({
            ...prev,
            users: (prev.users || []).filter((user) => user.id !== u.id),
          }));
          notify(`User '${u.name}' removed`);
        } catch (err) {
          notify(err.message || 'Failed to remove user', 'error');
        }
      }
    );
  };

  const handleOpenEditRole = (roleKey, cfg) => {
    setEditingRole(roleKey);
    setRoleForm({
      label: cfg.label || roleKey,
      description: cfg.description || '',
      permissions: Array.isArray(cfg.permissions) ? [...cfg.permissions] : [],
    });
  };

  const handleToggleModulePermission = (modId) => {
    setRoleForm((prev) => {
      const exists = prev.permissions.includes(modId);
      const next = exists ? prev.permissions.filter((p) => p !== modId) : [...prev.permissions, modId];
      return { ...prev, permissions: next };
    });
  };

  const handleSaveRolePermissions = (e) => {
    e.preventDefault();
    if (!editingRole) return;
    setRolesConfig((prev) => ({
      ...prev,
      [editingRole]: {
        ...prev[editingRole],
        label: roleForm.label,
        description: roleForm.description,
        permissions: roleForm.permissions,
      },
    }));
    notify(`Permissions for role '${roleForm.label}' updated successfully!`);
    setEditingRole(null);
  };

  const categories = [
    { id: 'users', label: 'Team Users', count: state.users?.length || 0 },
    { id: 'permissions', label: 'PERMISSIONS' },
  ];

  return (
    <div className="space-y-5">
      {/* Top Header & Category Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader
            title="User Management"
            subtitle="Manage team members, roles, authorization privileges, and access matrix"
            breadcrumbs={['Retail & System', 'User Management']}
          />
        </div>
        <div>
          <SegmentedTabs
            tabs={categories}
            activeTab={activeCategory}
            onChange={setActiveCategory}
          />
        </div>
      </div>

      {/* CATEGORY 1: TEAM USERS */}
      {activeCategory === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Active Team Members</h3>
              <p className="text-xs text-slate-500">Authorized personnel who can sign into this organization</p>
            </div>
            <button type="button" onClick={() => openModal()} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" /> Add User
            </button>
          </div>

          <DataTable
            data={state.users || []}
            searchFields={['name', 'email', 'role']}
            columns={[
              {
                key: 'name',
                label: 'User Name',
                render: (r) => (
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {r.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">{r.name}</span>
                      {r.role?.toLowerCase() === 'owner' && (
                        <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                          Owner
                        </span>
                      )}
                    </div>
                  </div>
                ),
              },
              { key: 'email', label: 'Email' },
              {
                key: 'mobile',
                label: 'Mobile',
                render: (r) => <span className="font-mono text-xs">{r.mobile || r.phone || '—'}</span>,
              },
              {
                key: 'role',
                label: 'Role',
                render: (r) => (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {r.role}
                  </span>
                ),
              },
              {
                key: 'lastLogin',
                label: 'Last Login',
                render: (r) => <span className="font-mono text-xs text-slate-600">{r.lastLogin || 'Never'}</span>,
              },
              { key: 'status', label: 'Status', render: (r) => <StatusLabel status={r.status} /> },
              {
                key: 'actions',
                label: 'Actions',
                align: 'center',
                render: (r) => (
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingUser(r)}
                      title="See Details"
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openModal(r)}
                      title="Edit Details"
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    {r.role?.toLowerCase() !== 'owner' && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleStatus(r)}
                          className={`text-xs font-semibold px-2 py-0.5 rounded border transition-colors ${
                            r.status === 'Active'
                              ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {r.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(r)}
                          title="Delete User"
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* CATEGORY 2: PERMISSIONS (ROLE PERMISSIONS MATRIX) */}
      {activeCategory === 'permissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Role Permissions Matrix</h3>
              <p className="text-xs text-slate-500">
                Manage operational and access privileges assigned to organizational roles
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(rolesConfig).map(([roleKey, cfg]) => (
              <div
                key={roleKey}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-200 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{cfg.label}</div>
                      <span className="inline-block mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 font-medium">
                        {roleKey}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenEditRole(roleKey, cfg)}
                      className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50/70 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{cfg.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="mb-1.5 text-[11px] font-semibold text-slate-700">Permitted Modules:</div>
                  <div className="flex flex-wrap gap-1">
                    {cfg.permissions && cfg.permissions.length > 0 ? (
                      cfg.permissions.map((p) => (
                        <span
                          key={p}
                          className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-indigo-700 border border-indigo-100"
                        >
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No modules granted</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: VIEW USER DETAILS */}
      <Modal
        open={Boolean(viewingUser)}
        onClose={() => setViewingUser(null)}
        title={`User Details — ${viewingUser?.name || ''}`}
        footer={
          <button type="button" onClick={() => setViewingUser(null)} className={btnSecondary}>
            Close
          </button>
        }
      >
        {viewingUser && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 font-bold text-white text-base">
                {viewingUser.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900">{viewingUser.name}</h4>
                <p className="text-slate-500">{viewingUser.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                    Role: {viewingUser.role}
                  </span>
                  <StatusLabel status={viewingUser.status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-slate-200 p-2.5">
                <span className="text-slate-500 block text-[11px]">Mobile Phone</span>
                <span className="font-mono font-medium text-slate-800">
                  {viewingUser.mobile || viewingUser.phone || 'Not provided'}
                </span>
              </div>
              <div className="rounded border border-slate-200 p-2.5">
                <span className="text-slate-500 block text-[11px]">Last Login</span>
                <span className="font-mono font-medium text-slate-800">{viewingUser.lastLogin || 'Never'}</span>
              </div>
            </div>

            <div className="rounded border border-slate-200 p-3 space-y-1.5">
              <span className="text-slate-600 font-semibold block">Assigned Permissions / Privileges:</span>
              <div className="flex flex-wrap gap-1 pt-1">
                {viewingUser.permissions && viewingUser.permissions.length > 0 ? (
                  viewingUser.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-700 border border-emerald-200"
                    >
                      {perm}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 italic">Default role permissions apply</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: ADD / EDIT USER WITH DROPDOWN + MANUAL ROLE ENTRY */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit User Details — ${editing.name}` : 'Add New Team Member'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className={btnSecondary}
              disabled={savingUser}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="usr-form"
              className={btnPrimary}
              disabled={savingUser}
            >
              {savingUser ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
            </button>
          </>
        }
      >
        <form id="usr-form" onSubmit={handleSaveUser} className="space-y-3">
          <InputField label="Full Name" required>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </InputField>

          <InputField label="Email Address (Login ID)" required>
            <input
              type="email"
              required
              disabled={Boolean(editing)}
              placeholder="user@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={`${inputClass} ${editing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
            />
          </InputField>

          <InputField label="10-Digit Mobile Number">
            <input
              type="tel"
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              className={inputClass}
            />
          </InputField>

          {!editing && (
            <InputField label="Initial Password (Optional)">
              <input
                type="text"
                placeholder="Default: Password@123"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
              />
            </InputField>
          )}

          {/* ROLE SELECTOR WITH DROPDOWN + MANUAL ENTRY */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-700">
                Assigned Role <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomRole(!isCustomRole);
                  if (!isCustomRole) setForm({ ...form, role: '' });
                  else setForm({ ...form, role: 'Billing Clerk' });
                }}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                {isCustomRole ? '← Choose from standard dropdown' : '✍️ Type custom role manually'}
              </button>
            </div>

            {!isCustomRole ? (
              <select
                value={form.role}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomRole(true);
                    setForm({ ...form, role: '' });
                  } else {
                    setForm({ ...form, role: e.target.value });
                  }
                }}
                className={inputClass}
                required
              >
                {Object.keys(rolesConfig).map((r) => (
                  <option key={r} value={r}>
                    {rolesConfig[r]?.label || r}
                  </option>
                ))}
                <option value="__custom__">➕ Manual / Custom Role Entry...</option>
              </select>
            ) : (
              <div className="space-y-1">
                <input
                  type="text"
                  required
                  placeholder="Type any custom role (e.g. Store Incharge, Senior Accountant)"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={inputClass}
                  autoFocus
                />
                <p className="text-[11px] text-slate-500">
                  Custom role will be assigned with operational privileges.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Account Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={inputClass}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: EDIT ROLE PERMISSIONS */}
      <Modal
        open={Boolean(editingRole)}
        onClose={() => setEditingRole(null)}
        title={`Edit Role Permissions — ${roleForm.label}`}
        footer={
          <>
            <button type="button" onClick={() => setEditingRole(null)} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" form="role-perm-form" className={btnPrimary}>
              Save Role Permissions
            </button>
          </>
        }
      >
        {editingRole && (
          <form id="role-perm-form" onSubmit={handleSaveRolePermissions} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Role Display Label" required>
                <input
                  type="text"
                  required
                  value={roleForm.label}
                  onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })}
                  className={inputClass}
                />
              </InputField>
              <InputField label="Role Identifier">
                <input
                  type="text"
                  disabled
                  value={editingRole}
                  className={`${inputClass} bg-slate-50 cursor-not-allowed font-mono text-xs`}
                />
              </InputField>
            </div>

            <InputField label="Role Description">
              <input
                type="text"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                className={inputClass}
              />
            </InputField>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-800">
                Granted Modules & Capabilities:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                {ALL_MODULES.map((mod) => {
                  const checked = roleForm.permissions.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer text-xs transition-colors ${
                        checked ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleModulePermission(mod.id)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-900">{mod.label}</div>
                        <p className="text-[11px] text-slate-500">{mod.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </form>
        )}
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

  const handleSaveAll = async (e) => {
    e.preventDefault();
    if (biz.phone && !/^[6-9]\d{9}$/.test(biz.phone.trim())) {
      notify('Please enter a valid 10-digit phone number', 'error');
      return;
    }
    try {
      await updateBusinessAndSettings(biz, cfg);
    } catch (err) {
      notify(err.message || 'Failed to save settings', 'error');
    }
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
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Business Profile
                </h3>
                <button
                  type="button"
                  onClick={() => navigate('/onboarding')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                  title="Open Step-by-Step Business Onboarding & Setup Wizard"
                >
                  <Building2 className="h-3.5 w-3.5" /> Launch Setup Wizard
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="Business Name"><input type="text" value={biz.businessName} onChange={(e) => setBiz({ ...biz, businessName: e.target.value })} className={inputClass} /></InputField>
                <InputField label="Legal Name"><input type="text" value={biz.legalName} onChange={(e) => setBiz({ ...biz, legalName: e.target.value })} className={inputClass} /></InputField>
                <InputField label="Email"><input type="email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} className={inputClass} /></InputField>
                <InputField label="Phone"><input type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit phone number" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={inputClass} /></InputField>
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
                <InputField label="GSTIN"><input type="text" value={biz.gstin} onChange={(e) => setBiz({ ...biz, gstin: e.target.value })} className={`${inputClass} font-mono`} /></InputField>
                <InputField label="PAN"><input type="text" value={biz.pan} onChange={(e) => setBiz({ ...biz, pan: e.target.value })} className={`${inputClass} font-mono`} /></InputField>
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
