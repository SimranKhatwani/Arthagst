import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  Layers,
  FileText,
  BarChart3,
  Boxes,
  Sparkles,
  ChevronRight,
  Receipt,
  Check,
  Menu,
  X,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { state } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('billing');

  const handleLaunch = () => {
    if (state.isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const previewTabs = [
    {
      id: 'billing',
      label: 'GST & POS Billing',
      icon: Receipt,
      title: 'Automated GST Calculation & Split-Second POS',
      description:
        'Instant Place of Supply (POS) detection, CGST/SGST/IGST breakdown, thermal receipt printing, and e-way bill readiness built for retail and enterprise scale.',
      badges: ['Thermal 80mm & 58mm', 'Real-time Tax Breakdown', 'Instant Customer Lookup'],
      stats: [
        { label: 'Avg Checkout Time', value: '< 1.8s' },
        { label: 'Tax Accuracy', value: '100%' },
        { label: 'Daily Capacity', value: '50k+ Bills' },
      ],
    },
    {
      id: 'inventory',
      label: 'Stock & Godowns',
      icon: Boxes,
      title: 'Multi-Godown Real-Time Inventory Control',
      description:
        'Automatic stock deductions on billing, real-time inward adjustments on purchase GRNs, low stock alerts, and batch/serial tracking across all store branches.',
      badges: ['Batch & SKU Sync', 'Multi-Warehouse', 'Low-Stock Alerts'],
      stats: [
        { label: 'Stock Sync Latency', value: 'Live (<100ms)' },
        { label: 'Inventory Audits', value: 'Automated' },
        { label: 'Discrepancy Rate', value: '0.00%' },
      ],
    },
    {
      id: 'multitenant',
      label: 'Multi-Tenant Engine',
      icon: Layers,
      title: 'Strict Cryptographic Organization Isolation',
      description:
        'Run multiple brands, independent branches, or franchisees under one master platform. Every tenant enjoys physically partitioned operational data and isolated ledger storage.',
      badges: ['Zero Data Leakage', 'Unique Tenant Codes', 'Independent Ledgers'],
      stats: [
        { label: 'Isolation Level', value: '100% Partitioned' },
        { label: 'Tenants Supported', value: 'Unlimited' },
        { label: 'Role Profiles', value: 'Fine-Grained' },
      ],
    },
    {
      id: 'compliance',
      label: 'Tax & Compliance',
      icon: Shield,
      title: 'Frictionless GSTR-1, 3B & E-Invoicing',
      description:
        'Automatically compile outward taxable turnover, inward ITC credits, HSN/SAC summaries, and generate government-ready JSON/CSV returns with zero manual tallying.',
      badges: ['GSTR-1 & 3B Ready', 'HSN/SAC Reports', 'Automated ITC Ledger'],
      stats: [
        { label: 'Report Generation', value: 'Instant' },
        { label: 'Audit Trail', value: 'Tamper-evident' },
        { label: 'Filing Errors', value: '0%' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/20 selection:text-blue-900">
      {/* Top Notification Bar */}
      <div className="bg-slate-900 text-slate-300 px-4 py-2.5 text-xs text-center font-medium tracking-wide">
        <span>Unified Multi-Tenant Commerce &amp; GST Business Suite for Indian Enterprises</span>
        <span className="mx-2 opacity-50">|</span>
        <button
          onClick={handleLaunch}
          className="underline font-bold text-white hover:text-blue-300 transition-colors cursor-pointer"
        >
          {state.isAuthenticated ? 'Go to Live Workspace →' : 'Sign in to Console →'}
        </button>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-serif text-xl font-bold shadow-md shadow-blue-600/25">
              A
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg tracking-[0.22em] font-bold text-slate-900 uppercase">
                A R T H A
              </span>
              <span className="text-[9px] tracking-[0.28em] font-semibold text-blue-600 uppercase">
                COMMERCE OS
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-[13px] font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">
              Key Features
            </a>
            <a href="#preview" className="hover:text-blue-600 transition-colors">
              Platform Preview
            </a>
            <a href="#multitenant" className="hover:text-blue-600 transition-colors">
              Multi-Tenant Engine
            </a>
            <a href="#security" className="hover:text-blue-600 transition-colors">
              Security &amp; RBAC
            </a>
            <a href="#about" className="hover:text-blue-600 transition-colors">
              About
            </a>
          </nav>

          {/* Action Button */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={handleLaunch}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold tracking-wider uppercase transition-all shadow-md shadow-blue-600/25 hover:shadow-lg active:scale-95 cursor-pointer"
            >
              <span>{state.isAuthenticated ? 'ENTER CONSOLE' : 'SIGN IN'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-3">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700"
            >
              Key Features
            </a>
            <a
              href="#preview"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700"
            >
              Platform Preview
            </a>
            <a
              href="#multitenant"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700"
            >
              Multi-Tenant Engine
            </a>
            <a
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700"
            >
              Security &amp; RBAC
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700"
            >
              About
            </a>
            <div className="pt-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLaunch();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold tracking-wider uppercase shadow-md shadow-blue-600/25"
              >
                <span>{state.isAuthenticated ? 'GO TO WORKSPACE' : 'SIGN IN TO CONSOLE'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-blue-50/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-200 bg-blue-50/90 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-8 shadow-xs">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>ONE PLATFORM. MULTIPLE STORES. UNIFIED CONTROL.</span>
          </div>

          {/* Hero Headline */}
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-normal tracking-tight text-slate-900 leading-[1.12] mb-7">
            Everything You Need to Build, Manage &amp; Scale Your Online Store.
          </h1>

          {/* Subtitle */}
          <p className="max-w-3xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed mb-10 font-normal">
            ARTHA is a unified multi-tenant commerce management platform designed to simplify store
            operations. Manage products, inventory, orders, customers, payments and business performance
            through one powerful workspace.
          </p>

          {/* Action Button */}
          <div className="flex items-center justify-center mb-16">
            <button
              onClick={handleLaunch}
              className="inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold tracking-wide transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl active:scale-95 cursor-pointer"
            >
              <span>Launch Your Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Trust Badges - Row from Image 3 */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-6 text-left sm:text-center">
            <div className="flex items-center sm:justify-center gap-2.5 text-xs font-semibold text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>100% Tenant Data Isolation</span>
            </div>
            <div className="flex items-center sm:justify-center gap-2.5 text-xs font-semibold text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Centralised Store Management</span>
            </div>
            <div className="flex items-center sm:justify-center gap-2.5 text-xs font-semibold text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Role-Based Access Control</span>
            </div>
            <div className="flex items-center sm:justify-center gap-2.5 text-xs font-semibold text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Real-Time Order &amp; Stock Sync</span>
            </div>
          </div>
        </div>

        {/* Ambient subtle blue glow background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-blue-100/50 via-indigo-100/40 to-transparent rounded-full blur-3xl pointer-events-none -z-0" />
      </section>

      {/* Platform Preview Interactive Section */}
      <section id="preview" className="py-20 bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>INTERACTIVE PLATFORM TOUR</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl text-slate-900 font-normal tracking-tight">
              A high-precision engine engineered for modern retail &amp; commerce.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Explore how Artha streamlines every phase of retail and distribution—from quick POS transactions to full statutory compliance.
            </p>
          </div>

          {/* Preview Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-10">
            {previewTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  <TabIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Preview Card */}
          {(() => {
            const current = previewTabs.find((t) => t.id === activeTab) || previewTabs[0];
            return (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xl shadow-slate-200/50">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div className="lg:col-span-6 space-y-6">
                    <div className="flex flex-wrap gap-2">
                      {current.badges.map((b) => (
                        <span
                          key={b}
                          className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-100"
                        >
                          {b}
                        </span>
                      ))}
                    </div>

                    <h3 className="font-serif text-2xl sm:text-3xl text-slate-900 font-normal leading-snug">
                      {current.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed">
                      {current.description}
                    </p>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                      {current.stats.map((s) => (
                        <div key={s.label}>
                          <div className="text-lg sm:text-xl font-serif font-bold text-slate-900">
                            {s.value}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {s.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleLaunch}
                        className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors group cursor-pointer"
                      >
                        <span>Experience in Console</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>

                  {/* Visual Interface Mockup */}
                  <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-inner space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-200" />
                        <span className="text-xs font-mono font-medium text-slate-500 ml-2">
                          artha.app / {current.id}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[10px] font-bold text-blue-700 border border-blue-100">
                        PRODUCTION VERIFIED
                      </span>
                    </div>

                    {/* Interactive UI snippet inside the mockup */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Taxable Invoice #INV/2026-27/0001</div>
                          <div className="text-[11px] text-slate-500">Customer: Ratan Retails · Inter-state IGST 5%</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                          Paid ₹21,000
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Inventory Ledgers &amp; Stock Sync</div>
                          <div className="text-[11px] text-slate-500">Automatic reservation &amp; ledger reconciliation</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                          Sync Active
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Multi-Tenant Isolation Protocol</div>
                          <div className="text-[11px] text-slate-500">Tenant Org: ARTHA TECH ENTERPRISES</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">
                          100% Isolated
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Key Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl text-slate-900 font-normal tracking-tight">
              Engineered with depth for every layer of your enterprise.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Replace fragmented billing tools, spreadsheets, and manual filing with a coherent operating system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-xs hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-normal text-slate-900 mb-3">
                Smart GST Billing &amp; Invoicing
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Full support for B2B tax invoices, B2C retail memos, reverse charge, place of supply rules, and export documentation in compliant Indian formats.
              </p>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600" /> Auto CGST + SGST or IGST bifurcation
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600" /> 80mm POS Thermal Receipt Generation
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600" /> PDF download &amp; customer email dispatch
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-xs hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-6">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-normal text-slate-900 mb-3">
                Multi-Godown Inventory Sync
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Monitor real-time warehouse stock, purchase GRNs, debit/credit return adjustments, and automatic inventory decrements directly on sale.
              </p>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600" /> Purchase invoice automatic stock inwarding
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600" /> POS retail instant decrementing
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600" /> Reorder level notifications
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-xs hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-normal text-slate-900 mb-3">
                GST Reports &amp; HSN Registers
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Generate live GSTR-1 outward registers, GSTR-3B tax offset computations, ITC balance ledgers, and exportable HSN summaries.
              </p>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600" /> HSN / SAC outward aggregate reports
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600" /> Input Tax Credit vs Liability offset
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-600" /> 1-click CSV and print-ready formats
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Tenant & Security Section */}
      <section id="multitenant" className="py-20 bg-slate-900 text-slate-100 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-300 text-xs font-semibold tracking-wider uppercase border border-white/15">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                <span>ENTERPRISE ARCHITECTURE</span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-tight text-white">
                Architected for strict multi-tenant isolation and granular RBAC.
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Whether powering a franchised retail network or holding company with multiple corporate entities, each tenant operates in complete cryptographic seclusion.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-sm font-bold text-white mb-1">Tenant Scoped Storage</div>
                  <div className="text-xs text-slate-400">Every database query validates organization identifiers before retrieval.</div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-sm font-bold text-white mb-1">Role-Based Access</div>
                  <div className="text-xs text-slate-400">Tailored view and write permissions for Admins, Cashiers, Accountants, and Auditors.</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/70 rounded-3xl border border-slate-800 p-8 space-y-6">
              <div className="text-xs font-mono text-blue-400 tracking-wider uppercase">
                // Multi-Tenant Isolation Matrix
              </div>
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between border border-white/5">
                  <span className="text-slate-300">TENANT_ID: ORG_ARTHA_01</span>
                  <span className="text-emerald-400 font-bold">ISOLATED [OK]</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between border border-white/5">
                  <span className="text-slate-300">LEDGER_PARTITION: SHA-256</span>
                  <span className="text-emerald-400 font-bold">ENCRYPTED [OK]</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between border border-white/5">
                  <span className="text-slate-300">CROSS_TENANT_LEAKAGE</span>
                  <span className="text-rose-400 font-bold">0.00% [BLOCKED]</span>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Ready to deploy your organization?</span>
                <button
                  onClick={handleLaunch}
                  className="px-5 py-2 rounded-full bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-10 sm:p-14 shadow-md">
            <h2 className="font-serif text-3xl sm:text-4xl text-slate-900 font-normal mb-4">
              Ready to streamline your billing &amp; GST compliance?
            </h2>
            <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 mb-8">
              Access the administrative dashboard, generate tax-compliant bills, track inventory, and file GST returns with zero friction.
            </p>
            <div className="flex items-center justify-center">
              <button
                onClick={handleLaunch}
                className="inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-600/25 cursor-pointer"
              >
                <span>{state.isAuthenticated ? 'Launch Workspace' : 'Sign In to Admin Console'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer with exact attribution requested in Image 3 */}
      <footer id="about" className="border-t border-slate-200 bg-white py-12 text-slate-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-serif text-base font-bold shadow-xs">
                A
              </div>
              <span className="font-serif text-base tracking-[0.2em] font-bold text-slate-900 uppercase">
                ARTHA COMMERCE OS
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs font-medium text-slate-600">
              <a href="#features" className="hover:text-blue-600 transition-colors">
                Features
              </a>
              <a href="#preview" className="hover:text-blue-600 transition-colors">
                Preview
              </a>
              <a href="#multitenant" className="hover:text-blue-600 transition-colors">
                Multi-Tenant
              </a>
              <button onClick={handleLaunch} className="hover:text-blue-600 transition-colors cursor-pointer">
                Admin Console
              </button>
            </div>
          </div>

          {/* Attribution matching Image 3 */}
          <div className="pt-8 text-center text-xs text-slate-500 space-y-2">
            <div>
              Designed &amp; Developed by <span className="text-rose-500">❤️</span>{' '}
              <a
                href="https://requinsolutions.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline underline underline-offset-4 decoration-blue-500/50"
              >
                Requin Solutions Pvt. Ltd
              </a>
            </div>
            <div className="text-[11px] text-slate-400">
              &copy; {new Date().getFullYear()} Artha Commerce OS &amp; GST Suite. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
