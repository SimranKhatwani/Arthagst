import React, { useState, useRef, useLayoutEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Layers,
  CreditCard,
  IndianRupee,
  BarChart3,
  LifeBuoy,
  Megaphone,
  ToggleLeft,
  Sliders,
  History,
  ArrowLeft,
  Menu,
  X,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ADMIN_NAV_GROUPS = [
  {
    section: 'Overview & Telemetry',
    items: [
      { label: 'Platform Overview', path: '/sd', icon: LayoutDashboard },
      { label: 'Platform Analytics', path: '/sd/analytics', icon: BarChart3 },
    ],
  },
  {
    section: 'Tenant Fleet & Access',
    items: [
      { label: 'Businesses / Tenants', path: '/sd/tenants', icon: Building2 },
      { label: 'Platform Users', path: '/sd/users', icon: Users },
    ],
  },
  {
    section: 'SaaS & Subscriptions',
    items: [
      { label: 'Subscription Plans', path: '/sd/plans', icon: Layers },
      { label: 'Subscription Management', path: '/sd/subscriptions', icon: CreditCard },
      { label: 'Platform Payments', path: '/sd/payments', icon: IndianRupee },
    ],
  },
  {
    section: 'Platform Governance',
    items: [
      { label: 'Support Tickets', path: '/sd/tickets', icon: LifeBuoy },
      { label: 'Announcements', path: '/sd/announcements', icon: Megaphone },
      { label: 'Feature Management', path: '/sd/features', icon: ToggleLeft },
      { label: 'System Settings', path: '/sd/settings', icon: Sliders },
      { label: 'Platform Audit Logs', path: '/sd/audit', icon: History },
    ],
  },
];

const SuperAdminSidebar = ({ setMobileOpen, navigate, navScrollRef, savedScrollTopRef, isMobile = false }) => {
  const { logout, state } = useApp();

  const handleLogout = async () => {
    await logout();
    navigate('/sd/login');
  };

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300 border-r border-slate-800">
      {/* Brand Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-display text-xs font-bold text-white shadow-md shadow-indigo-500/20">
            SA
          </div>
          <div>
            <span className="font-display text-sm font-bold text-white block">
              ArthaGST Control
            </span>
            <span className="text-[10px] text-indigo-400 font-medium block">Master Platform (/sd)</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded p-1 text-slate-400 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav List with Grouping */}
      <div
        ref={!isMobile ? navScrollRef : undefined}
        onScroll={
          !isMobile
            ? (e) => {
                savedScrollTopRef.current = e.currentTarget.scrollTop;
              }
            : undefined
        }
        className="no-scrollbar flex-1 overflow-y-auto px-2.5 py-3 space-y-4"
      >
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.section}>
            <div className="mb-1.5 px-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {group.section}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/sd'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white font-medium shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Controls */}
      <div className="shrink-0 border-t border-slate-800 p-3 space-y-1.5">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Switch to Business App
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-900/30 bg-rose-950/20 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-900/40 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out Super Admin
        </button>
      </div>
    </div>
  );
};

export const SuperAdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, state } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navScrollRef = useRef(null);
  const savedScrollTopRef = useRef(0);

  useLayoutEffect(() => {
    if (navScrollRef.current && navScrollRef.current.scrollTop !== savedScrollTopRef.current) {
      navScrollRef.current.scrollTop = savedScrollTopRef.current;
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/sd/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="no-print hidden w-[256px] shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <SuperAdminSidebar
            setMobileOpen={setMobileOpen}
            navigate={navigate}
            navScrollRef={navScrollRef}
            savedScrollTopRef={savedScrollTopRef}
          />
        </div>
      </aside>

      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-[256px]">
            <SuperAdminSidebar
              setMobileOpen={setMobileOpen}
              navigate={navigate}
              navScrollRef={navScrollRef}
              savedScrollTopRef={savedScrollTopRef}
              isMobile
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm">
                Platform Super Admin Console
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                /sd
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Logged in as <strong className="text-slate-800">{state.currentUser?.email || 'admin@artha.com'}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
            >
              Business App &rarr;
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 shadow-sm transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
};
