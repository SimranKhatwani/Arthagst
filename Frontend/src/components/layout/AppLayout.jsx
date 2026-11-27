import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ShoppingBag,
  Package,
  Users,
  IndianRupee,
  Receipt,
  Percent,
  QrCode,
  BookOpen,
  BarChart3,
  MonitorSmartphone,
  Bell,
  History,
  ShieldCheck,
  Settings,
  CreditCard,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  HelpCircle,
  RotateCcw,
  LogOut,
  Building2,
  ShieldAlert,
  Menu,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FINANCIAL_YEARS } from '../../data/constants';
import { formatINR } from '../../services/calculationService';
import { Modal, btnPrimary, btnSecondary } from '../common/UI';

export const NAV_GROUPS = [
  {
    section: 'OPERATIONS DIRECTORY',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { id: 'pos', label: 'POS Billing', icon: MonitorSmartphone, path: '/pos' },
    ],
  },
  {
    section: 'Business Operations',
    items: [
      {
        id: 'sales',
        label: 'Sales',
        icon: FileText,
        children: [
          { label: 'All Invoices', path: '/sales/invoices' },
          { label: 'Create Invoice', path: '/sales/invoices/new' },
          { label: 'Quotations', path: '/sales/quotations' },
          { label: 'Sales Orders', path: '/sales/orders' },
          { label: 'Delivery Challans', path: '/sales/challans' },
          { label: 'Sales Returns', path: '/sales/returns' },
          {
            label: 'Credit/Debit Notes',
            path: '/sales/notes',
            matchPaths: ['/sales/notes', '/sales/credit-notes', '/sales/debit-notes'],
          },
        ],
      },
      {
        id: 'purchases',
        label: 'Purchases',
        icon: ShoppingBag,
        children: [
          { label: 'Purchase Invoices', path: '/purchases', matchPaths: ['/purchases', '/purchases/payments'] },
          { label: 'Add Purchase', path: '/purchases/new' },
          { label: 'Purchase Returns', path: '/purchases/returns' },
          { label: 'Goods Received Notes', path: '/purchases/grn' },
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory',
        icon: Package,
        children: [
          { label: 'Products', path: '/inventory/products' },
          { label: 'Categories', path: '/inventory/categories' },
          { label: 'Units', path: '/inventory/units' },
          { label: 'Stock Overview', path: '/inventory/stock-overview' },
          { label: 'Stock Movements', path: '/inventory/stock' },
          { label: 'Stock Transfers', path: '/inventory/transfers' },
          { label: 'Warehouses', path: '/inventory/warehouses' },
          { label: 'Batch & Expiry', path: '/inventory/batches' },
        ],
      },
      {
        id: 'parties',
        label: 'Parties',
        icon: Users,
        children: [
          { label: 'Customers', path: '/parties/customers', matchPaths: ['/parties/customers', '/accounting/customer-ledger'] },
          { label: 'Suppliers', path: '/parties/suppliers', matchPaths: ['/parties/suppliers', '/accounting/supplier-ledger'] },
        ],
      },
      {
        id: 'payments',
        label: 'Payments',
        icon: IndianRupee,
        children: [
          { label: 'All Transactions', path: '/payments', matchPaths: ['/payments', '/payments/history'] },
          { label: 'Money In', path: '/payments/in' },
          { label: 'Money Out', path: '/payments/out' },
          {
            label: 'Cash & Bank',
            path: '/payments/cash-bank',
            matchPaths: ['/payments/cash-bank', '/payments/cash-book', '/payments/bank-book', '/accounting/cash-book', '/accounting/bank-book'],
          },
          { label: 'Bank Reconciliation', path: '/payments/reconciliation' },
        ],
      },
      {
        id: 'expenses',
        label: 'Expenses',
        icon: Receipt,
        children: [
          { label: 'All Expenses', path: '/expenses', matchPaths: ['/expenses', '/expenses/new'] },
          { label: 'Expense Categories', path: '/expenses/categories' },
        ],
      },
    ],
  },
  {
    section: 'Tax & Accounting',
    items: [
      {
        id: 'gst',
        label: 'GST Management',
        icon: Percent,
        children: [
          { label: 'GST Dashboard', path: '/gst', matchPaths: ['/gst', '/gst/summary'] },
          {
            id: 'gst-returns',
            label: 'Returns',
            children: [
              { label: 'GSTR-1', path: '/gst/gstr-1' },
              { label: 'GSTR-3B', path: '/gst/gstr-3b' },
            ],
          },
          { label: 'GSTR-2B Reconciliation', path: '/gst/gstr-2b' },
          { label: 'GST Reports', path: '/gst/reports', matchPaths: ['/gst/reports', '/gst/hsn'] },
          { label: 'Filing Calendar', path: '/gst/calendar' },
        ],
      },
      {
        id: 'einvoice',
        label: 'E-Invoice & E-Way Bill',
        icon: QrCode,
        children: [
          { label: 'E-Invoices', path: '/einvoice/list' },
          { label: 'Generate E-Invoice', path: '/einvoice/generate' },
          { label: 'E-Way Bills', path: '/einvoice/eway-bills' },
          { label: 'Generate E-Way Bill', path: '/einvoice/eway-generate' },
        ],
      },
      {
        id: 'accounting',
        label: 'Accounting',
        icon: BookOpen,
        children: [
          { label: 'Chart of Accounts', path: '/accounting/coa' },
          { label: 'General Ledger', path: '/accounting/general-ledger' },
          { label: 'Journal Entries', path: '/accounting/journals' },
          { label: 'Trial Balance', path: '/accounting/trial-balance' },
          { label: 'Profit & Loss', path: '/accounting/pnl' },
          { label: 'Balance Sheet', path: '/accounting/balance-sheet' },
        ],
      },
      {
        id: 'reports',
        label: 'Reports & Analytics',
        icon: BarChart3,
        children: [
          { label: 'Sales Reports', path: '/reports/sales' },
          { label: 'Purchase Reports', path: '/reports/purchases' },
          { label: 'Inventory Reports', path: '/reports/inventory' },
          { label: 'GST Reports', path: '/reports/gst' },
          { label: 'Financial Reports', path: '/reports/financial' },
          { label: 'Expense Reports', path: '/reports/expenses' },
          { label: 'Receivables & Payables', path: '/reports/receivables-payables' },
          { label: 'Business Analytics', path: '/reports/analytics' },
        ],
      },
    ],
  },
  {
    section: 'Retail & System',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell, path: '/notifications' },
      { id: 'audit', label: 'Audit Logs', icon: History, path: '/audit-logs' },
      { id: 'users', label: 'User Management', icon: ShieldCheck, path: '/users' },
      { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', matchPaths: ['/settings', '/onboarding'] },
      { id: 'subscription', label: 'Subscription & Billing', icon: CreditCard, path: '/subscription' },
    ],
  },
];

const SidebarContent = ({
  isMobile = false,
  collapsed,
  setCollapsed,
  setMobileOpen,
  expandedGroups,
  toggleGroup,
  isGroupActive,
  isSubItemActive,
  unreadCount,
  navScrollRef,
  savedScrollTopRef,
  navigate,
  currentUser,
  onLogout,
}) => {
  const userName =
    currentUser?.name ||
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'John Doe');
  const userRole = (currentUser?.role || 'Guest').toUpperCase();

  const getInitials = (str) => {
    if (!str) return 'JD';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return str.slice(0, 2).toUpperCase();
  };
  const initials = getInitials(userName);

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      {/* Brand */}
    <div
      className={`flex h-16 shrink-0 items-center ${
        collapsed && !isMobile ? 'justify-center px-2' : 'justify-between px-4'
      } border-b border-slate-800`}
    >
      {collapsed && !isMobile ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar (ArthaGST)"
          className="group relative flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 font-display text-sm font-bold text-white shadow-md shadow-indigo-600/30 group-hover:scale-95 transition-transform">
            A
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-800/90 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
            <PanelLeftOpen className="h-4 w-4" />
          </div>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-3 overflow-hidden text-left group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 font-display text-sm font-bold text-white shadow-md shadow-indigo-600/30">
              A
            </div>
            <div className="flex flex-col">
              <span className="truncate font-display text-base font-bold tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                ArthaGST
              </span>
              <span className="text-[10px] font-medium text-indigo-400 tracking-wide uppercase">
                Business Suite
              </span>
            </div>
          </button>
          {!isMobile && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>

    {/* Navigation */}
    <div
      ref={!isMobile ? navScrollRef : undefined}
      onScroll={
        !isMobile
          ? (e) => {
              savedScrollTopRef.current = e.currentTarget.scrollTop;
            }
          : undefined
      }
      className="no-scrollbar flex-1 overflow-y-auto px-3 py-3.5 space-y-6"
    >
      {/* Attribution Card matching theme */}
      {(!collapsed || isMobile) ? (
        <a
          href="https://requinsolutions.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group block mx-1 mb-4 rounded-xl border border-slate-800 bg-slate-800/60 p-3 shadow-xs hover:border-indigo-500/50 hover:bg-slate-800/90 transition-all cursor-pointer"
        >
          <div className="text-[11px] font-medium text-slate-400 tracking-tight group-hover:text-slate-300 transition-colors">
            Designed &amp; Developed by
          </div>
          <div className="mt-0.5 text-xs font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1.5 transition-colors underline underline-offset-2 decoration-indigo-500/40 group-hover:decoration-indigo-400">
            <span className="text-sm no-underline">💻</span> Requin Solutions Pvt. Ltd
          </div>
        </a>
      ) : (
        <a
          href="https://requinsolutions.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/80 text-sm shadow-xs text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 hover:bg-slate-800 transition-all cursor-pointer"
          title="Designed & Developed by Requin Solutions Pvt. Ltd"
        >
          💻
        </a>
      )}

      {NAV_GROUPS.map((group) => (
        <div key={group.section}>
          {(!collapsed || isMobile) && (
            <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400/90">
              {group.section}
            </div>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isGroupActive(item);
              const expanded = Boolean(expandedGroups[item.id] || active);

              if (item.path) {
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    onClick={() => isMobile && setMobileOpen(false)}
                    title={collapsed && !isMobile ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-lg px-3 py-2.5 text-[14px] font-medium transition-all duration-150 ${
                        isActive || active
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-900/50'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <span className="flex items-center gap-3 truncate">
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                    </span>
                    {(!collapsed || isMobile) && item.id === 'notifications' && unreadCount > 0 && (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow-xs">
                        {unreadCount}
                      </span>
                    )}
                  </NavLink>
                );
              }

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.id)}
                    title={collapsed && !isMobile ? item.label : undefined}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[14px] font-medium transition-all duration-150 ${
                      active
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3 truncate">
                      <Icon className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                      {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                    </span>
                    {(!collapsed || isMobile) &&
                      (expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      ))}
                  </button>
                  {expanded && (!collapsed || isMobile) && (
                    <div className="mt-1 ml-4 space-y-1 border-l-2 border-slate-800 pl-3">
                      {item.children.map((sub) => {
                        if (sub.children) {
                          const subActive = isSubItemActive(sub);
                          const subExpanded = Boolean(expandedGroups[sub.id] || subActive);
                          return (
                            <div key={sub.id}>
                              <button
                                type="button"
                                onClick={() => toggleGroup(sub.id)}
                                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                                  subActive
                                    ? 'bg-indigo-600/20 font-semibold text-indigo-300'
                                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                                }`}
                              >
                                <span>{sub.label}</span>
                                {subExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                )}
                              </button>
                              {subExpanded && (
                                <div className="mt-1 ml-3 space-y-0.5 border-l border-slate-800 pl-2.5">
                                  {sub.children.map((leaf) => (
                                    <NavLink
                                      key={leaf.path}
                                      to={leaf.path}
                                      end
                                      onClick={() => isMobile && setMobileOpen(false)}
                                      className={({ isActive }) =>
                                        `block rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                                          isActive
                                            ? 'bg-indigo-600/25 font-semibold text-indigo-300'
                                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                        }`
                                      }
                                    >
                                      {leaf.label}
                                    </NavLink>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        const matched = isSubItemActive(sub);
                        return (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            end
                            onClick={() => isMobile && setMobileOpen(false)}
                            className={({ isActive }) =>
                              `block rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                                isActive || matched
                                  ? 'bg-indigo-600/20 text-indigo-300 font-semibold shadow-2xs'
                                  : 'text-slate-300/90 hover:bg-slate-800/70 hover:text-white'
                              }`
                            }
                          >
                            {sub.label}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>

    {/* Sticky User Profile & Sign Out Footer */}
    <div
      className={`shrink-0 border-t border-slate-800/80 bg-slate-900/95 p-3 ${
        collapsed && !isMobile ? 'flex justify-center' : ''
      }`}
    >
      {collapsed && !isMobile ? (
        <button
          type="button"
          onClick={onLogout}
          title={`Sign Out (${userName})`}
          className="group relative flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 font-bold text-xs group-hover:opacity-0 transition-opacity">
            {initials}
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <LogOut className="h-4 w-4" />
          </div>
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-xl hover:bg-slate-800/60 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 font-bold text-xs shadow-xs">
              {initials}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-semibold text-white leading-tight">
                {userName}
              </span>
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-indigo-400 mt-0.5">
                {userRole} • ACTIVE
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Sign Out"
            className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  </div>
  );
};

export const AppLayout = ({ children }) => {
  const {
    state,
    selectedFY,
    setSelectedFY,
    confirmAction,
    logout,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({ sales: true, gst: false, 'gst-returns': false });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const navScrollRef = useRef(null);
  const savedScrollTopRef = useRef(0);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  // Close profile and search dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Auto-scroll sidebar so active menu item is visible on navigation
  useEffect(() => {
    if (!navScrollRef.current) return;
    const timer = setTimeout(() => {
      if (!navScrollRef.current) return;
      const targetPath = location.pathname === '/onboarding' ? '/settings' : location.pathname;
      const activeLink = navScrollRef.current.querySelector(
        `a[href="${targetPath}"], a.bg-indigo-600`
      );
      if (activeLink) {
        activeLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
        savedScrollTopRef.current = navScrollRef.current.scrollTop;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const unreadCount = (state.notifications || []).filter((n) => !n.read).length;

  const isPathMatch = (targetPath, exact = false) => {
    if (!targetPath) return false;
    if (exact) return location.pathname === targetPath;
    return location.pathname === targetPath || location.pathname.startsWith(targetPath + '/');
  };

  const isSubItemActive = (sub) => {
    if (sub.children) {
      return sub.children.some((leaf) => isSubItemActive(leaf)) || location.pathname === '/gst/returns';
    }
    // Prevent parent/list items from remaining highlighted when on a dedicated "Create/New" sub-route
    if (sub.path === '/sales/invoices' && (location.pathname === '/sales/invoices/new' || location.pathname.startsWith('/sales/invoices/new/'))) {
      return false;
    }
    if (sub.path === '/purchases' && (location.pathname === '/purchases/new' || location.pathname.startsWith('/purchases/new/'))) {
      return false;
    }
    if (sub.matchPaths) {
      return sub.matchPaths.some((mp) => isPathMatch(mp, mp === '/purchases' || mp === '/payments' || mp === '/gst' || mp === '/expenses'));
    }
    return isPathMatch(sub.path, sub.path === '/purchases' || sub.path === '/payments' || sub.path === '/gst' || sub.path === '/expenses');
  };

  const isGroupActive = (item) => {
    if (item.path) {
      if (item.matchPaths) {
        return item.matchPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));
      }
      return location.pathname === item.path;
    }
    return item.children?.some((c) => isSubItemActive(c));
  };

  const toggleGroup = (id) => {
    if (collapsed) {
      setCollapsed(false);
      setExpandedGroups((prev) => ({ ...prev, [id]: true }));
      return;
    }
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    (state.invoices || []).slice(0, 30).forEach((inv) => {
      if (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q)
      ) {
        results.push({
          type: 'Invoice',
          title: `${inv.invoiceNumber} — ${inv.customerName}`,
          meta: `${formatINR(inv.grandTotal)} · ${inv.paymentStatus}`,
          path: '/sales/invoices',
        });
      }
    });
    (state.customers || []).forEach((c) => {
      if (c.name.toLowerCase().includes(q) || (c.gstin || '').toLowerCase().includes(q)) {
        results.push({
          type: 'Customer',
          title: c.name,
          meta: `${c.city || c.state} · ${c.registrationType}`,
          path: `/parties/customers/${c.id}`,
        });
      }
    });
    (state.products || []).forEach((p) => {
      if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.hsn.includes(q)) {
        results.push({
          type: 'Product',
          title: p.name,
          meta: `${p.sku} · HSN ${p.hsn} · Stock ${p.stock} ${p.unit}`,
          path: '/inventory/products',
        });
      }
    });
    return results.slice(0, 8);
  }, [searchQuery, state.invoices, state.customers, state.products]);

  const handleLogout = async () => {
    const ok = await confirmAction({
      title: 'Sign Out?',
      message: 'Are you sure you want to sign out of your session?',
      confirmText: 'Sign Out',
      danger: true,
    });
    if (ok) {
      logout();
      navigate('/login');
    }
  };

  const sidebarProps = {
    collapsed,
    setCollapsed,
    setMobileOpen,
    expandedGroups,
    toggleGroup,
    isGroupActive,
    isSubItemActive,
    unreadCount,
    navScrollRef,
    savedScrollTopRef,
    navigate,
    currentUser: state.currentUser,
    onLogout: handleLogout,
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside
        className={`no-print hidden shrink-0 lg:block transition-all duration-150 ${
          collapsed ? 'w-[72px]' : 'w-[276px]'
        }`}
      >
        <div className="sticky top-0 h-screen">
          <SidebarContent {...sidebarProps} />
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-[286px]">
            <SidebarContent {...sidebarProps} isMobile />
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>

            <div className="hidden sm:flex items-center gap-2.5 rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 text-xs shadow-2xs">
              <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="font-semibold text-slate-900 whitespace-nowrap">
                {state.business?.businessName || state.currentTenant?.businessName || 'Organization'}
              </span>
            </div>

            {/* Global Search */}
            <div ref={searchRef} className="relative w-48 sm:w-72 md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Search invoices, customers, SKUs..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-8.5 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
              {searchOpen && searchQuery.trim() && (
                <div className="absolute left-0 right-0 top-full z-40 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-xl">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500">No matching records found.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {searchResults.map((res, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            navigate(res.path);
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-900">{res.title}</div>
                            <div className="truncate text-[11px] text-slate-500">{res.meta}</div>
                          </div>
                          <span className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                            {res.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Financial Year */}
            <select
              value={FINANCIAL_YEARS.includes(selectedFY) ? selectedFY : FINANCIAL_YEARS[0]}
              onChange={(e) => setSelectedFY(e.target.value)}
              aria-label="Financial Year"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-indigo-600 focus:outline-none shadow-2xs cursor-pointer"
            >
              {FINANCIAL_YEARS.map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy}
                </option>
              ))}
            </select>

            {/* Notifications */}
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              title="Notifications"
              className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 font-mono text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </button>


            {/* User Profile */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((p) => !p)}
                className="flex items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-left hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
                  {(state.currentUser?.name || 'A')[0].toUpperCase()}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-semibold text-slate-900 whitespace-nowrap leading-tight">
                    {state.currentUser?.name || 'Platform Administrator'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {state.currentUser?.role || 'Admin'}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <div className="text-xs font-semibold text-slate-900">
                      {state.currentUser?.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {state.currentUser?.role} · {state.currentUser?.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Business Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/onboarding');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Business Setup Wizard
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                      navigate('/login');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {/* Help Modal */}
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="ArthaGST Guide"
        subtitle="Indian GST Billing, Inventory & Business Management"
        footer={
          <button type="button" onClick={() => setHelpOpen(false)} className={btnPrimary}>
            Close
          </button>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            You are managing business operations in ArthaGST for{' '}
            <strong className="text-slate-900">Sharma Traders (Jaipur, Rajasthan)</strong> for FY 2026-27.
          </p>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            <div className="font-semibold text-slate-800">Key Connected Workflows to Try:</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Create a Sales Invoice (Intra-state Rajasthan computes CGST+SGST; Inter-state computes IGST).</li>
              <li>Finalizing an invoice automatically reduces inventory stock and updates customer receivables.</li>
              <li>Record a Payment In against any Unpaid/Partial invoice to update ledger and cash/bank balances.</li>
              <li>Issue a Sales Return / Credit Note or record a Purchase Bill and see GSTR-1 / GSTR-3B update live.</li>
              <li>Use POS Billing for fast retail checkout with barcode search and split payments.</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
};
