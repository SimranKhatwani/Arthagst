import React, { useState, useEffect, useMemo } from 'react';
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
  FileText,
  ShoppingBag,
  Package,
  IndianRupee,
  Receipt,
  MonitorSmartphone,
  Percent,
  BookOpen,
  BarChart3,
  ShieldCheck,
  Settings,
  LayoutGrid,
  List,
  Search,
  X,
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
    permissions: [],
  });
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [showModuleSelectorInUserModal, setShowModuleSelectorInUserModal] = useState(false);

  // User Permissions Matrix State
  const [editingUserPerms, setEditingUserPerms] = useState(null);
  const [userPermsForm, setUserPermsForm] = useState({
    userId: '',
    userName: '',
    userRole: '',
    userEmail: '',
    permissions: [],
  });
  const [savingUserPerms, setSavingUserPerms] = useState(false);
  const [permSearch, setPermSearch] = useState('');
  const [permViewMode, setPermViewMode] = useState('cards'); // 'cards' | 'table'

  const ALL_MODULES = [
    { id: 'sales', label: 'Sales & Invoicing', desc: 'Invoices, Quotations, Orders, Challans, Credit Notes', icon: FileText },
    { id: 'purchases', label: 'Purchases & Bills', desc: 'Purchase Bills, Orders, GRNs, Debit Notes', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory & Godowns', desc: 'Stock movements, Items, Warehouses, Batches', icon: Package },
    { id: 'parties', label: 'Parties & CRM', desc: 'Customer & Supplier directory and ledgers', icon: Users },
    { id: 'payments', label: 'Banking & Payments', desc: 'Bank accounts, payment in/out, settlements', icon: IndianRupee },
    { id: 'expenses', label: 'Expenses & Overheads', desc: 'Vouchers, recurring expenses, ITC claims', icon: Receipt },
    { id: 'pos', label: 'POS Billing', desc: 'Retail counter checkout and thermal receipts', icon: MonitorSmartphone },
    { id: 'gst', label: 'GST Returns', desc: 'GSTR-1, GSTR-3B, GSTR-2B reconciliation', icon: Percent },
    { id: 'accounting', label: 'Accounting & Ledgers', desc: 'Chart of accounts, journals, P&L, balance sheet', icon: BookOpen },
    { id: 'reports', label: 'Reports & Analytics', desc: 'Business dashboards and financial registers', icon: BarChart3 },
    { id: 'users', label: 'User Management', desc: 'Manage team staff and permissions', icon: ShieldCheck },
    { id: 'settings', label: 'Business Settings', desc: 'Company profile, tax rates, invoice templates', icon: Settings },
  ];

  const hasModulePermission = (perms, modId, level = 'read') => {
    if (!Array.isArray(perms)) return false;
    if (perms.includes('all') || perms.includes('*')) return true;
    if (perms.includes(modId)) return true;
    if (level === 'read') {
      return perms.includes(`${modId}:read`) || perms.includes(`${modId}:edit`) || perms.includes(`${modId}:write`);
    }
    if (level === 'edit') {
      return perms.includes(`${modId}:edit`) || perms.includes(`${modId}:write`);
    }
    return false;
  };

  const getDefaultPermissionsForRole = (role) => {
    const r = (role || '').toLowerCase();
    if (r === 'owner' || r === 'admin') {
      return ALL_MODULES.flatMap((m) => [`${m.id}:read`, `${m.id}:edit`]);
    }
    if (r.includes('bill') || r.includes('pos')) {
      return [
        'sales:read', 'sales:edit',
        'parties:read', 'parties:edit',
        'payments:read', 'payments:edit',
        'pos:read', 'pos:edit',
        'inventory:read',
      ];
    }
    if (r.includes('account') || r.includes('ca')) {
      return [
        'sales:read', 'sales:edit',
        'purchases:read', 'purchases:edit',
        'parties:read', 'parties:edit',
        'payments:read', 'payments:edit',
        'expenses:read', 'expenses:edit',
        'gst:read', 'gst:edit',
        'accounting:read', 'accounting:edit',
        'reports:read', 'reports:edit',
        'inventory:read',
      ];
    }
    if (r.includes('ware') || r.includes('stock') || r.includes('inven')) {
      return [
        'inventory:read', 'inventory:edit',
        'purchases:read', 'purchases:edit',
        'sales:read',
        'parties:read',
      ];
    }
    if (r.includes('view') || r.includes('audit')) {
      return [
        'sales:read',
        'purchases:read',
        'inventory:read',
        'parties:read',
        'payments:read',
        'expenses:read',
        'gst:read',
        'accounting:read',
        'reports:read',
      ];
    }
    return ALL_MODULES.flatMap((m) => [`${m.id}:read`, `${m.id}:edit`]);
  };

  const normalizeUserPermissions = (perms, role) => {
    if (!Array.isArray(perms) || perms.length === 0) {
      return getDefaultPermissionsForRole(role);
    }
    const result = new Set();
    perms.forEach((p) => {
      if (p === 'all' || p === '*') {
        ALL_MODULES.forEach((m) => {
          result.add(`${m.id}:read`);
          result.add(`${m.id}:edit`);
        });
      } else if (p.includes(':')) {
        result.add(p);
      } else {
        // Legacy module key without colon: grant both read & edit
        result.add(`${p}:read`);
        result.add(`${p}:edit`);
      }
    });
    return Array.from(result);
  };

  const getUserPermissions = (u) => {
    return normalizeUserPermissions(u?.permissions, u?.role);
  };

  const openModal = (u = null) => {
    setEditing(u);
    setShowModuleSelectorInUserModal(false);
    if (u) {
      const isKnown = Object.keys(ROLES_CONFIG).includes(u.role);
      setIsCustomRole(!isKnown);
      setForm({
        name: u.name || '',
        email: u.email || '',
        mobile: u.mobile || u.phone || '',
        role: u.role || 'Billing Clerk',
        password: '',
        status: u.status || (u.isActive ? 'Active' : 'Inactive'),
        permissions: getUserPermissions(u),
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
        permissions: getDefaultPermissionsForRole('Billing Clerk'),
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
    let createdId = null;
    try {
      if (editing && editing.id && !String(editing.id).startsWith('usr-') && !String(editing.id).startsWith('owner-')) {
        // Backend update
        await userService.updateUser(editing.id, {
          name: form.name.trim(),
          phone: form.mobile.trim(),
          role: form.role.trim(),
          permissions: form.permissions,
          ...(form.password ? { password: form.password } : {}),
        });
      } else if (!editing) {
        // Backend create
        try {
          const res = await userService.createUser({
            name: form.name.trim(),
            email: form.email.trim(),
            mobile: form.mobile.trim(),
            role: form.role.trim(),
            password: form.password || 'Password@123',
            permissions: form.permissions || [],
          });
          const createdObj = res?.data || res?.user || res;
          if (createdObj?._id || createdObj?.id) {
            createdId = String(createdObj._id || createdObj.id);
          }
        } catch (apiErr) {
          console.warn('Backend user create note:', apiErr.message);
        }
      }

      // Update frontend state
      const targetId = editing ? editing.id : (createdId || `user-${Date.now()}`);
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
          permissions: form.permissions || getUserPermissions({ role: form.role }),
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

  // Open Edit Permissions Modal for a specific user
  const handleOpenEditUserPermissions = (u) => {
    const currentPerms = getUserPermissions(u);
    setEditingUserPerms(u);
    setUserPermsForm({
      userId: u.id,
      userName: u.name,
      userRole: u.role,
      userEmail: u.email,
      permissions: [...currentPerms],
    });
  };

  const handleToggleUserModuleLevel = (modId, level) => {
    setUserPermsForm((prev) => {
      const cur = Array.isArray(prev.permissions) ? prev.permissions : [];
      const readKey = `${modId}:read`;
      const editKey = `${modId}:edit`;
      const hasRead = cur.includes(readKey) || cur.includes(modId);
      const hasEdit = cur.includes(editKey) || cur.includes(modId);

      // Filter out existing keys for this module
      let next = cur.filter((p) => p !== readKey && p !== editKey && p !== modId);

      if (level === 'read') {
        if (hasRead) {
          // Unchecking read turns off both read and edit
        } else {
          // Checking read
          next.push(readKey);
          if (hasEdit) next.push(editKey);
        }
      } else if (level === 'edit') {
        if (hasEdit) {
          // Unchecking edit keeps read active
          next.push(readKey);
        } else {
          // Checking edit automatically activates read too
          next.push(readKey);
          next.push(editKey);
        }
      }

      return { ...prev, permissions: next };
    });
  };

  const handleSelectAllReadAndEdit = () => {
    setUserPermsForm((prev) => ({
      ...prev,
      permissions: ALL_MODULES.flatMap((m) => [`${m.id}:read`, `${m.id}:edit`]),
    }));
  };

  const handleSelectAllReadOnly = () => {
    setUserPermsForm((prev) => ({
      ...prev,
      permissions: ALL_MODULES.map((m) => `${m.id}:read`),
    }));
  };

  const handleClearAllUserModules = () => {
    setUserPermsForm((prev) => ({
      ...prev,
      permissions: [],
    }));
  };

  const handleResetUserToRoleDefaults = () => {
    const defaults = getDefaultPermissionsForRole(userPermsForm.userRole);
    setUserPermsForm((prev) => ({
      ...prev,
      permissions: defaults,
    }));
  };

  const handleSaveUserPermissions = async (e) => {
    e.preventDefault();
    if (!editingUserPerms) return;
    setSavingUserPerms(true);
    try {
      const targetId = editingUserPerms.id;
      if (targetId && !String(targetId).startsWith('usr-') && !String(targetId).startsWith('owner-')) {
        await userService.updateUser(targetId, {
          permissions: userPermsForm.permissions,
        });
      }

      setState((prev) => ({
        ...prev,
        users: (prev.users || []).map((u) =>
          u.id === targetId ? { ...u, permissions: userPermsForm.permissions } : u
        ),
      }));

      notify(`Permissions for '${editingUserPerms.name}' (${editingUserPerms.role}) updated successfully!`);
      setEditingUserPerms(null);
    } catch (err) {
      notify(err.message || 'Failed to update user permissions', 'error');
    } finally {
      setSavingUserPerms(false);
    }
  };

  // Filter users for Permissions Tab
  const filteredPermUsers = useMemo(() => {
    const list = state.users || [];
    if (!permSearch.trim()) return list;
    const q = permSearch.toLowerCase().trim();
    return list.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [state.users, permSearch]);

  const categories = [
    { id: 'users', label: 'Team Users', count: state.users?.length || 0 },
    { id: 'permissions', label: 'PERMISSIONS', count: state.users?.length || 0 },
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
                    <button
                      type="button"
                      onClick={() => handleOpenEditUserPermissions(r)}
                      title="Edit Module Permissions"
                      className="rounded p-1 text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <ShieldCheck className="h-4 w-4" />
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

      {/* CATEGORY 2: PERMISSIONS (USER PERMISSIONS MATRIX) */}
      {activeCategory === 'permissions' && (
        <div className="space-y-4">
          {/* Header & Controls Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">User Permissions Matrix</h3>
              <p className="text-xs text-slate-500">
                Active authorization matrix: View and edit permitted modules for every user and their assigned role
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search Filter */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user name, email, role..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="h-8.5 rounded-md border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {permSearch && (
                  <button
                    type="button"
                    onClick={() => setPermSearch('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* View Switch: Cards / Table */}
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setPermViewMode('cards')}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    permViewMode === 'cards' ? 'bg-white text-indigo-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPermViewMode('table')}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    permViewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Matrix Table View"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Quick Add User button */}
              <button type="button" onClick={() => openModal()} className={btnPrimary}>
                <Plus className="h-3.5 w-3.5" /> Add User
              </button>
            </div>
          </div>

          {filteredPermUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <h4 className="mt-2 text-sm font-semibold text-slate-800">No users found</h4>
              <p className="mt-1 text-xs text-slate-500">
                {permSearch ? 'Try clearing your search query' : 'Add team users to manage their module permissions'}
              </p>
              {!permSearch && (
                <button type="button" onClick={() => openModal()} className={`${btnPrimary} mt-3`}>
                  <Plus className="h-3.5 w-3.5" /> Add First User
                </button>
              )}
            </div>
          ) : permViewMode === 'cards' ? (
            /* CARDS VIEW */
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPermUsers.map((u) => {
                const userPerms = getUserPermissions(u);
                const isOwner = u.role?.toLowerCase() === 'owner';
                const readModules = ALL_MODULES.filter((m) => hasModulePermission(userPerms, m.id, 'read'));
                const editModules = ALL_MODULES.filter((m) => hasModulePermission(userPerms, m.id, 'edit'));
                const readOnlyCount = readModules.length - editModules.length;
                const isFullAccess = editModules.length === ALL_MODULES.length;

                return (
                  <div
                    key={u.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4.5 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all"
                  >
                    <div>
                      {/* Card Header: Avatar, Name, Role, Status & Edit Button */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 border border-indigo-200">
                            {u.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm truncate">{u.name}</span>
                              {isOwner && (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                  Owner
                                </span>
                              )}
                            </div>
                            <span className="inline-block mt-0.5 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                              Role: <strong>{u.role}</strong>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenEditUserPermissions(u)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50/80 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </button>
                      </div>

                      {/* User Contact Details */}
                      <div className="mt-2.5 space-y-0.5 text-[11px] text-slate-500">
                        <div className="truncate">✉️ {u.email}</div>
                        {u.mobile || u.phone ? <div>📞 {u.mobile || u.phone}</div> : null}
                      </div>

                      {/* Access Count Banner */}
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-700">
                          Module Access Level
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isFullAccess
                              ? 'bg-emerald-100 text-emerald-800'
                              : readModules.length > 0
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {editModules.length} Edit • {readOnlyCount} Read
                        </span>
                      </div>
                    </div>

                    {/* Permitted Module Badges */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex flex-wrap gap-1">
                        {readModules.length > 0 ? (
                          readModules.map((m) => {
                            const hasEdit = hasModulePermission(userPerms, m.id, 'edit');
                            const Icon = m.icon || Shield;
                            return (
                              <span
                                key={m.id}
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border ${
                                  hasEdit
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                <Icon className="h-2.5 w-2.5" />
                                <span>{m.label.split(' ')[0]}</span>
                                <span
                                  className={`rounded px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider ${
                                    hasEdit ? 'bg-indigo-200/70 text-indigo-800' : 'bg-amber-200/70 text-amber-900'
                                  }`}
                                >
                                  {hasEdit ? 'Edit' : 'Read'}
                                </span>
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[11px] text-rose-500 italic">No modules granted (Restricted Access)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* MATRIX TABLE VIEW */
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="py-3 px-3 text-left font-semibold sticky left-0 bg-slate-50 z-10">User & Assigned Role</th>
                    {ALL_MODULES.map((m) => (
                      <th key={m.id} className="py-3 px-2 text-center font-semibold whitespace-nowrap" title={m.desc}>
                        {m.label.split(' ')[0]}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center font-semibold">Privileges</th>
                    <th className="py-3 px-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPermUsers.map((u) => {
                    const userPerms = getUserPermissions(u);
                    const readCount = ALL_MODULES.filter((m) => hasModulePermission(userPerms, m.id, 'read')).length;
                    const editCount = ALL_MODULES.filter((m) => hasModulePermission(userPerms, m.id, 'edit')).length;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap sticky left-0 bg-white z-10">
                          <div className="font-semibold text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-500">{u.role} • {u.email}</div>
                        </td>
                        {ALL_MODULES.map((m) => {
                          const hasRead = hasModulePermission(userPerms, m.id, 'read');
                          const hasEdit = hasModulePermission(userPerms, m.id, 'edit');
                          return (
                            <td key={m.id} className="py-2.5 px-2 text-center">
                              {hasEdit ? (
                                <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                                  Edit
                                </span>
                              ) : hasRead ? (
                                <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                  Read
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-center font-semibold text-[11px] whitespace-nowrap">
                          <span className="text-indigo-700 font-mono">{editCount}E</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="text-amber-700 font-mono">{readCount - editCount}R</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEditUserPermissions(u)}
                            className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-700 font-semibold">Granted Module Permissions:</span>
                <button
                  type="button"
                  onClick={() => {
                    const u = viewingUser;
                    setViewingUser(null);
                    handleOpenEditUserPermissions(u);
                  }}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  <Edit3 className="h-3 w-3" /> Edit Permissions
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ALL_MODULES.filter((m) => hasModulePermission(getUserPermissions(viewingUser), m.id, 'read')).map((mod) => {
                  const hasEdit = hasModulePermission(getUserPermissions(viewingUser), mod.id, 'edit');
                  return (
                    <span
                      key={mod.id}
                      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium border ${
                        hasEdit
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <span>{mod.label}</span>
                      <span className={`text-[9px] font-bold px-1 rounded uppercase tracking-wider ${
                        hasEdit ? 'bg-indigo-200/70 text-indigo-800' : 'bg-amber-200/70 text-amber-900'
                      }`}>
                        {hasEdit ? 'Read & Edit' : 'Read'}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: ADD / EDIT USER WITH DROPDOWN + MANUAL ROLE ENTRY + MODULE SELECTOR */}
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
                  const nextCustom = !isCustomRole;
                  setIsCustomRole(nextCustom);
                  if (nextCustom) {
                    setForm({ ...form, role: '', permissions: ALL_MODULES.map((m) => m.id) });
                  } else {
                    setForm({
                      ...form,
                      role: 'Billing Clerk',
                      permissions: getDefaultPermissionsForRole('Billing Clerk'),
                    });
                  }
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
                  const val = e.target.value;
                  if (val === '__custom__') {
                    setIsCustomRole(true);
                    setForm({ ...form, role: '', permissions: ALL_MODULES.map((m) => m.id) });
                  } else {
                    setForm({
                      ...form,
                      role: val,
                      permissions: getDefaultPermissionsForRole(val),
                    });
                  }
                }}
                className={inputClass}
                required
              >
                {Object.keys(ROLES_CONFIG).map((r) => (
                  <option key={r} value={r}>
                    {ROLES_CONFIG[r]?.label || r}
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
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value,
                      permissions: form.permissions?.length > 0 ? form.permissions : ALL_MODULES.map((m) => m.id),
                    })
                  }
                  className={inputClass}
                  autoFocus
                />
                <p className="text-[11px] text-slate-500">
                  Custom role will be saved and displayed in the Permissions Matrix.
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

          {/* Expandable Module Permissions in Add/Edit User Modal */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowModuleSelectorInUserModal(!showModuleSelectorInUserModal)}
              className="flex w-full items-center justify-between py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800"
            >
              <span>
                ⚙️ Customize Initial Module Permissions (
                {ALL_MODULES.filter((m) => hasModulePermission(form.permissions, m.id, 'read')).length} enabled)
              </span>
              <span>{showModuleSelectorInUserModal ? '▲ Hide' : '▼ View / Edit'}</span>
            </button>

            {showModuleSelectorInUserModal && (
              <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200">
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-slate-600">Select Read/Edit permissions per module:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          permissions: ALL_MODULES.flatMap((m) => [`${m.id}:read`, `${m.id}:edit`]),
                        })
                      }
                      className="text-indigo-600 hover:underline font-medium"
                    >
                      All Read & Edit
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          permissions: ALL_MODULES.map((m) => `${m.id}:read`),
                        })
                      }
                      className="text-amber-700 hover:underline font-medium"
                    >
                      All Read-Only
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, permissions: [] })}
                      className="text-slate-500 hover:underline font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                  {ALL_MODULES.map((mod) => {
                    const hasRead = hasModulePermission(form.permissions, mod.id, 'read');
                    const hasEdit = hasModulePermission(form.permissions, mod.id, 'edit');

                    return (
                      <div
                        key={mod.id}
                        className={`flex items-center justify-between rounded p-2 border text-xs transition-colors ${
                          hasEdit
                            ? 'border-indigo-300 bg-white'
                            : hasRead
                            ? 'border-amber-300 bg-amber-50/40'
                            : 'border-slate-200 bg-slate-100/50'
                        }`}
                      >
                        <span className="font-medium text-slate-800 text-[11px] truncate">{mod.label}</span>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] font-medium text-slate-600">
                            <input
                              type="checkbox"
                              checked={hasRead}
                              onChange={() => {
                                const cur = form.permissions || [];
                                const readKey = `${mod.id}:read`;
                                const editKey = `${mod.id}:edit`;
                                let next = cur.filter((p) => p !== readKey && p !== editKey && p !== mod.id);
                                if (!hasRead) {
                                  next.push(readKey);
                                  if (hasEdit) next.push(editKey);
                                }
                                setForm({ ...form, permissions: next });
                              }}
                              className="h-3.5 w-3.5 rounded text-indigo-600"
                            />
                            <span>Read</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer text-[11px] font-medium text-slate-600">
                            <input
                              type="checkbox"
                              checked={hasEdit}
                              onChange={() => {
                                const cur = form.permissions || [];
                                const readKey = `${mod.id}:read`;
                                const editKey = `${mod.id}:edit`;
                                let next = cur.filter((p) => p !== readKey && p !== editKey && p !== mod.id);
                                if (!hasEdit) {
                                  next.push(readKey);
                                  next.push(editKey);
                                } else {
                                  next.push(readKey);
                                }
                                setForm({ ...form, permissions: next });
                              }}
                              className="h-3.5 w-3.5 rounded text-indigo-600"
                            />
                            <span>Edit</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* MODAL 3: EDIT USER PERMISSIONS (READ/EDIT OPTIONS FOR ALL 12 MODULES) */}
      <Modal
        open={Boolean(editingUserPerms)}
        onClose={() => setEditingUserPerms(null)}
        title={`Edit Module Permissions — ${userPermsForm.userName}`}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingUserPerms(null)}
              className={btnSecondary}
              disabled={savingUserPerms}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="user-perm-form"
              className={btnPrimary}
              disabled={savingUserPerms}
            >
              {savingUserPerms ? 'Saving Permissions...' : 'Save Permissions'}
            </button>
          </>
        }
      >
        {editingUserPerms && (
          <form id="user-perm-form" onSubmit={handleSaveUserPermissions} className="space-y-4">
            {/* User Header Summary in Modal */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-lg bg-slate-50 p-3 border border-slate-200">
              <div>
                <div className="font-semibold text-sm text-slate-900">{userPermsForm.userName}</div>
                <div className="text-xs text-slate-500">
                  Role: <span className="font-semibold text-indigo-700">{userPermsForm.userRole}</span> • {userPermsForm.userEmail}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectAllReadAndEdit}
                  className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                >
                  All Read & Edit (12)
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllReadOnly}
                  className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
                >
                  All Read-Only
                </button>
                <button
                  type="button"
                  onClick={handleClearAllUserModules}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={handleResetUserToRoleDefaults}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                >
                  Reset Defaults
                </button>
              </div>
            </div>

            {/* 12 Modules to Select From */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-800">
                  Configure Read / Edit Privileges per Module:
                </label>
                <span className="text-[11px] font-semibold text-indigo-700">
                  {ALL_MODULES.filter((m) => hasModulePermission(userPermsForm.permissions, m.id, 'read')).length} of {ALL_MODULES.length} modules granted (
                  {ALL_MODULES.filter((m) => hasModulePermission(userPermsForm.permissions, m.id, 'edit')).length} Read & Edit)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
                {ALL_MODULES.map((mod) => {
                  const hasRead = hasModulePermission(userPermsForm.permissions, mod.id, 'read');
                  const hasEdit = hasModulePermission(userPermsForm.permissions, mod.id, 'edit');
                  const Icon = mod.icon || Shield;

                  return (
                    <div
                      key={mod.id}
                      className={`rounded-xl border p-3 text-xs transition-all ${
                        hasEdit
                          ? 'border-indigo-300 bg-indigo-50/50 shadow-2xs ring-1 ring-indigo-300/30'
                          : hasRead
                          ? 'border-amber-300 bg-amber-50/40 shadow-2xs ring-1 ring-amber-300/30'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Module Title & Status Pill */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              hasEdit
                                ? 'bg-indigo-100 text-indigo-700'
                                : hasRead
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 text-xs truncate">{mod.label}</div>
                            <p className="text-[10px] text-slate-500 leading-tight truncate">{mod.desc}</p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                            hasEdit
                              ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                              : hasRead
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          {hasEdit ? 'Read & Edit' : hasRead ? 'Read Only' : 'No Access'}
                        </span>
                      </div>

                      {/* Read & Edit Checkbox Selectors */}
                      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-medium text-slate-600">Permissions:</span>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 hover:text-indigo-600 select-none">
                            <input
                              type="checkbox"
                              checked={hasRead}
                              onChange={() => handleToggleUserModuleLevel(mod.id, 'read')}
                              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>Read</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 hover:text-indigo-600 select-none">
                            <input
                              type="checkbox"
                              checked={hasEdit}
                              onChange={() => handleToggleUserModuleLevel(mod.id, 'edit')}
                              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>Edit</span>
                          </label>
                        </div>
                      </div>
                    </div>
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
