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
} from 'lucide-react';

const ADMIN_NAV = [
  { label: 'Platform Overview', path: '/super-admin', icon: LayoutDashboard },
  { label: 'Businesses / Tenants', path: '/super-admin/tenants', icon: Building2 },
  { label: 'Platform Users', path: '/super-admin/users', icon: Users },
  { label: 'Subscription Plans', path: '/super-admin/plans', icon: Layers },
  { label: 'Subscription Management', path: '/super-admin/subscriptions', icon: CreditCard },
  { label: 'Platform Payments', path: '/super-admin/payments', icon: IndianRupee },
  { label: 'Platform Analytics', path: '/super-admin/analytics', icon: BarChart3 },
  { label: 'Support Tickets', path: '/super-admin/tickets', icon: LifeBuoy },
  { label: 'Announcements', path: '/super-admin/announcements', icon: Megaphone },
  { label: 'Feature Management', path: '/super-admin/features', icon: ToggleLeft },
  { label: 'System Settings', path: '/super-admin/settings', icon: Sliders },
  { label: 'Platform Audit Logs', path: '/super-admin/audit', icon: History },
];

const SuperAdminSidebar = ({ setMobileOpen, navigate, navScrollRef, savedScrollTopRef, isMobile = false }) => (
  <div className="flex h-full flex-col bg-slate-950 text-slate-300">
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 font-display text-xs font-bold text-slate-950">
          SA
        </div>
        <span className="font-display text-sm font-semibold text-white">
          ArthaGST Control
        </span>
      </div>
      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        className="rounded p-1 text-slate-400 lg:hidden"
      >
        <X className="h-4 w-4" />
      </button>
    </div>

    <div
      ref={!isMobile ? navScrollRef : undefined}
      onScroll={
        !isMobile
          ? (e) => {
              savedScrollTopRef.current = e.currentTarget.scrollTop;
            }
          : undefined
      }
      className="no-scrollbar flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5"
    >
      {ADMIN_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/super-admin'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
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

    <div className="shrink-0 border-t border-slate-800 p-3">
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Business App
      </button>
    </div>
  </div>
);

export const SuperAdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navScrollRef = useRef(null);
  const savedScrollTopRef = useRef(0);

  useLayoutEffect(() => {
    if (navScrollRef.current && navScrollRef.current.scrollTop !== savedScrollTopRef.current) {
      navScrollRef.current.scrollTop = savedScrollTopRef.current;
    }
  }, [location.pathname]);

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
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm font-semibold text-slate-900">
              Platform Super Admin Console
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Isolated Multi-Tenant Demo Dataset</span>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Switch to Sharma Traders
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
};
