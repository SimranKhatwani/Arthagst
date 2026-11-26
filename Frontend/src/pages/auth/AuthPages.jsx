import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Building2,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  AlertCircle,
  Layers,
  User,
  Phone,
  MapPin,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  INDIAN_STATES,
  BUSINESS_TYPES,
  CONSTITUTION_TYPES,
  REGISTRATION_TYPES,
  FINANCIAL_YEARS,
} from '../../data/constants';
import { InputField, inputClass, btnPrimary, btnSecondary } from '../../components/common/UI';

export const LoginPage = () => {
  const { login } = useApp();
  const navigate = useNavigate();

  const [tenantCode, setTenantCode] = useState(
    () => localStorage.getItem('arthagst_last_tenant_code') || ''
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors = {};
    if (!tenantCode.trim()) errors.tenantCode = 'Organization code is required';
    if (!email.trim()) errors.email = 'Email address is required';
    if (!password) errors.password = 'Password is required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await login({
        tenantCode: tenantCode.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (remember && tenantCode.trim()) {
        localStorage.setItem('arthagst_last_tenant_code', tenantCode.trim().toUpperCase());
      }

      navigate('/dashboard');
    } catch (err) {
      if (err.errors && Array.isArray(err.errors)) {
        const mapped = {};
        err.errors.forEach((fe) => {
          mapped[fe.field] = fe.message;
        });
        setFieldErrors(mapped);
      }
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-slate-900">
      {/* LEFT HERO / VALUE PROPOSITION PANEL */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-8 xl:p-12 text-white relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 h-full">
        {/* Ambient Glow Elements */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 font-display text-lg font-bold text-white shadow-lg shadow-indigo-500/30">
              A
            </div>
            <div>
              <div className="font-display text-xl font-bold tracking-tight text-white">ArthaGST</div>
              <div className="text-[11px] text-slate-400 font-medium">Enterprise GST &amp; ERP Suite</div>
            </div>
          </div>
        </div>

        {/* Pitch & Value Props */}
        <div className="relative z-10 max-w-lg space-y-4 my-auto py-2 xl:py-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Built for Modern Indian Commerce
            </div>
            <h1 className="font-display text-2xl xl:text-3xl font-extrabold tracking-tight text-white leading-tight">
              GST billing, inventory &amp; compliance in one structured workspace.
            </h1>
            <p className="text-xs xl:text-sm leading-relaxed text-slate-300">
              Automated CGST/SGST/IGST invoicing, GSTR-1 &amp; GSTR-3B return generation, multi-warehouse stock ledgers, and supplier payables with strict multi-tenant isolation.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-start gap-3 p-2.5 xl:p-3 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Multi-Tenant Cryptographic Isolation</div>
                <div className="mt-0.5 text-[11px] text-slate-400 leading-normal">
                  Each organization’s data is strictly partitioned by unique tenant codes with zero cross-tenant leakage.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 xl:p-3 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Real-Time GST Calculation Engine</div>
                <div className="mt-0.5 text-[11px] text-slate-400 leading-normal">
                  Automated place-of-supply tax logic, reverse charge mechanism, and exportable GSTR-1 &amp; 3B filing summaries.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 xl:p-3 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Multi-Warehouse Inventory &amp; Banking</div>
                <div className="mt-0.5 text-[11px] text-slate-400 leading-normal">
                  Track stock across multiple godowns, record bank statements, and maintain double-entry audit logs.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT AUTH CARD PANEL */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 bg-slate-50 relative h-full overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

        <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative z-10">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 font-display text-base font-bold text-white shadow-md shadow-indigo-500/30">
              A
            </div>
            <div>
              <div className="font-display text-lg font-bold text-slate-900">ArthaGST</div>
              <div className="text-[10px] text-slate-500 font-medium">Enterprise GST Suite</div>
            </div>
          </div>

          <div className="mb-4 sm:mb-5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Organization Portal
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Sign in to ArthaGST
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Enter your organization tenant code and staff credentials.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Authentication Failed</div>
                <div className="mt-0.5 text-rose-700 leading-relaxed">{error}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Tenant Code Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  Organization / Tenant Code <span className="text-rose-500">*</span>
                </label>

              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={tenantCode}
                  onChange={(e) => setTenantCode(e.target.value.toUpperCase())}
                  className={`w-full rounded-xl border ${fieldErrors.tenantCode ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } bg-white py-2.5 pl-9 pr-3 text-sm font-mono uppercase tracking-wider text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all`}
                  placeholder="Enter Organization Code"
                  autoComplete="organization"
                />
              </div>
              {fieldErrors.tenantCode && (
                <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.tenantCode}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-xl border ${fieldErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all`}
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Password <span className="text-rose-500">*</span>
                </label>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-xl border ${fieldErrors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.password}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Remember organization code
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white font-semibold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/35 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <span>Sign In to Organization</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>


        </div>
      </div>
    </div>
  );
};

/**
 * Super Admin Dedicated Login Page (/sd/login)
 * Strictly for SaaS Platform Master Administrators
 */
export const SuperAdminLoginPage = () => {
  const { login } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors = {};
    if (!email.trim()) errors.email = 'Admin email is required';
    if (!password) errors.password = 'Password is required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
        isSuperAdmin: true,
      });

      navigate('/sd');
    } catch (err) {
      if (err.errors && Array.isArray(err.errors)) {
        const mapped = {};
        err.errors.forEach((fe) => {
          mapped[fe.field] = fe.message;
        });
        setFieldErrors(mapped);
      }
      setError(err.message || 'Super Admin authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden flex bg-white font-sans antialiased">
      {/* LEFT HERO PANEL (Matches ArthaGST Main Login Aesthetic) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-950 p-8 xl:p-12 text-white relative overflow-hidden border-r border-slate-800 h-full">
        {/* Glow ambient effects */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 font-display text-base font-bold text-white shadow-lg shadow-indigo-500/30">
            A
          </div>
          <div>
            <div className="font-display text-xl font-bold tracking-tight text-white">ArthaGST Control</div>
            <div className="text-xs text-indigo-400 font-medium">Master Platform Console</div>
          </div>
        </div>

        {/* Center Telemetry & Value Pillars */}
        <div className="relative z-10 my-auto py-8">


          <h1 className="font-display text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            Multi-tenant fleet, SaaS billing, and platform governance.
          </h1>

          <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-lg">
            Supervise organization tenants, manage subscription plans, monitor system telemetry, and govern platform-wide security from one centralized control plane.
          </p>

          <div className="mt-8 space-y-3 max-w-lg">
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Tenant Fleet Orchestration</div>
                <div className="mt-0.5 text-xs text-slate-400 leading-normal">
                  Provision, suspend, or configure businesses with strictly isolated database schemas and dedicated settings.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">SaaS Subscription &amp; Billing Engine</div>
                <div className="mt-0.5 text-xs text-slate-400 leading-normal">
                  Manage pricing tiers, trial lifecycles, plan feature quotas, and recurring subscription renewals.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Master Security &amp; Audit Governance</div>
                <div className="mt-0.5 text-xs text-slate-400 leading-normal">
                  Track cross-tenant actions, immutable audit logs, administrative logins, and critical security events.
                </div>
              </div>
            </div>
          </div>
        </div>



      </div>

      {/* RIGHT AUTH CARD PANEL */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 bg-slate-50 relative h-full overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

        <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative z-10">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 font-display text-base font-bold text-white shadow-md shadow-indigo-500/30">
              A
            </div>
            <div>
              <div className="font-display text-lg font-bold text-slate-900">ArthaGST Control</div>
              <div className="text-[10px] text-indigo-600 font-medium">Master Console (/sd)</div>
            </div>
          </div>

          <div className="mb-4 sm:mb-5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Platform Super Admin Portal (/sd)
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Super Admin Sign In
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Enter master platform administrator credentials to manage tenants and SaaS billing.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Super Admin Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-xl border ${fieldErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all`}
                  placeholder="superadmin@artha.com"
                  autoComplete="email"
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Master Password <span className="text-rose-500">*</span>
                </label>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-xl border ${fieldErrors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                    } bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white font-medium text-sm bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying Master Credentials...
                </>
              ) : (
                <>
                  <span>Access Super Admin Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
            Organization Staff?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
              Go to Business Login &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage = () => {
  const { register, notify } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: '',
    tenantCode: '',
    ownerName: '',
    email: '',
    mobile: '',
    state: 'Maharashtra',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors = {};
    if (!form.businessName.trim()) errors.businessName = 'Business name is required';
    if (!form.ownerName.trim()) errors.ownerName = 'Owner name is required';
    if (!form.email.trim()) errors.email = 'Email address is required';
    if (!form.mobile.trim()) {
      errors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      errors.mobile = 'Please enter a valid 10-digit mobile number';
    }
    if (!form.password) errors.password = 'Password is required';
    else if (form.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await register({
        businessName: form.businessName.trim(),
        ...(form.tenantCode.trim() && { tenantCode: form.tenantCode.trim().toUpperCase() }),
        ownerName: form.ownerName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.mobile.trim(),
        state: form.state,
        password: form.password,
      });

      navigate('/onboarding');
    } catch (err) {
      if (err.errors && Array.isArray(err.errors)) {
        const mapped = {};
        err.errors.forEach((fe) => {
          const key = fe.field === 'phone' ? 'mobile' : fe.field;
          mapped[key] = fe.message;
        });
        setFieldErrors(mapped);
      }
      setError(err.message || 'Registration failed. Please check form inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900/95 p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-9 shadow-2xl relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 font-display text-base font-bold text-white shadow-md shadow-indigo-500/30">
              A
            </div>
            <span className="font-display text-xl font-bold text-slate-900">ArthaGST</span>
          </div>
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
            New Organization
          </span>
        </div>

        <div className="mt-5 mb-5">
          <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Create Business Workspace
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Set up your organization and initial owner administrator credentials.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Registration Error</div>
              <div className="mt-0.5 text-rose-700 leading-relaxed">{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InputField label="Trade / Business Name" required error={fieldErrors.businessName}>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="e.g. Acme Enterprises"
                />
              </div>
            </InputField>

            <InputField label="Custom Tenant Code" error={fieldErrors.tenantCode}>
              <div className="relative">
                <input
                  type="text"
                  value={form.tenantCode}
                  onChange={(e) => setForm({ ...form, tenantCode: e.target.value.toUpperCase() })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-mono uppercase tracking-wider text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="Auto-generated if empty"
                />
              </div>
            </InputField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InputField label="Owner Full Name" required error={fieldErrors.ownerName}>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="e.g. Rajesh Sharma"
                />
              </div>
            </InputField>

            <InputField label="Mobile Number" required error={fieldErrors.mobile}>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[6-9][0-9]{9}"
                  maxLength={10}
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="10-digit mobile number"
                />
              </div>
            </InputField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InputField label="Business Email" required error={fieldErrors.email}>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="accounts@company.in"
                />
              </div>
            </InputField>

            <InputField label="State / UT" required error={fieldErrors.state}>
              <div className="relative">
                <select
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </InputField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InputField label="Password" required error={fieldErrors.password}>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="Min 6 chars"
                />
              </div>
            </InputField>

            <InputField label="Confirm Password" required error={fieldErrors.confirmPassword}>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="Re-enter password"
                />
              </div>
            </InputField>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-semibold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/35 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Organization Account...
              </>
            ) : (
              <>
                <span>Continue to Business Setup</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-200 text-center text-xs text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
            Sign In &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};

export const OnboardingWizardPage = () => {
  const { state, completeOnboarding } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    businessName: state.currentTenant?.businessName || state.business?.businessName || '',
    legalName: state.business?.legalName || state.currentTenant?.businessName || '',
    businessType: state.business?.businessType || 'Wholesale & Retail',
    constitution: state.business?.constitution || 'Proprietorship',
    gstRegistered: Boolean(state.currentTenant?.GSTIN || state.business?.gstRegistered),
    gstin: state.currentTenant?.GSTIN || state.business?.gstin || '',
    registrationType: state.business?.registrationType || 'Regular',
    state: state.currentTenant?.state || state.business?.state || 'Maharashtra',
    pan: state.currentTenant?.PAN || state.business?.pan || '',
    address: state.currentTenant?.businessAddress || state.business?.address || '',
    city: state.currentTenant?.city || state.business?.city || '',
    pincode: state.currentTenant?.pincode || state.business?.pincode || '',
    financialYear: state.business?.financialYear || '2026-27',
    currency: 'INR',
    invoicePrefix: state.business?.invoicePrefix || 'INV/26-27/',
    priceInclusiveDefault: state.settings?.gst?.priceInclusiveDefault || false,
    invoiceTemplate: state.business?.invoiceTemplate || 'Classic GST Pro',
    logoName: 'brand-mark.svg',
  });

  const steps = [
    { num: 1, label: 'Business Info' },
    { num: 2, label: 'GST Details' },
    { num: 3, label: 'Address' },
    { num: 4, label: 'Financials' },
    { num: 5, label: 'Branding' },
  ];

  const handleFinish = () => {
    completeOnboarding(form);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-indigo-600" />
            <div>
              <h1 className="font-display text-xl font-semibold text-slate-900">
                Business Onboarding Wizard
              </h1>
              <p className="text-xs text-slate-500">
                Configure your Indian GST billing profile and invoice defaults
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className={btnSecondary}
          >
            Skip to Dashboard
          </button>
        </div>

        {/* Stepper */}
        <div className="mb-6 grid grid-cols-5 gap-2">
          {steps.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${step === s.num
                ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-900'
                : step > s.num
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-500'
                }`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold border border-current">
                {step > s.num ? <Check className="h-3 w-3" /> : s.num}
              </span>
              <span className="hidden sm:inline truncate">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Step 1: Business Information
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="Trade / Business Name" required>
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    className={inputClass}
                  />
                </InputField>
                <InputField label="Legal Entity Name" required>
                  <input
                    type="text"
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                    className={inputClass}
                  />
                </InputField>
                <InputField label="Business Type">
                  <select
                    value={form.businessType}
                    onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                    className={inputClass}
                  >
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </InputField>
                <InputField label="Constitution of Business">
                  <select
                    value={form.constitution}
                    onChange={(e) => setForm({ ...form, constitution: e.target.value })}
                    className={inputClass}
                  >
                    {CONSTITUTION_TYPES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </InputField>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Step 2: GST Information
              </h2>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.gstRegistered}
                  onChange={(e) => setForm({ ...form, gstRegistered: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600"
                />
                Business is GST Registered
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="GSTIN (Demo Format)">
                  <input
                    type="text"
                    disabled={!form.gstRegistered}
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                    className={inputClass}
                  />
                </InputField>
                <InputField label="Registration Type">
                  <select
                    disabled={!form.gstRegistered}
                    value={form.registrationType}
                    onChange={(e) => setForm({ ...form, registrationType: e.target.value })}
                    className={inputClass}
                  >
                    {REGISTRATION_TYPES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </InputField>
                <InputField label="Registered State">
                  <select
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className={inputClass}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </InputField>
                <InputField label="PAN Number (Demo)">
                  <input
                    type="text"
                    value={form.pan}
                    onChange={(e) => setForm({ ...form, pan: e.target.value })}
                    className={inputClass}
                  />
                </InputField>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Step 3: Registered Business Address
              </h2>
              <InputField label="Street Address" required>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={inputClass}
                />
              </InputField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InputField label="City" required>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className={inputClass}
                  />
                </InputField>
                <InputField label="State">
                  <select
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className={inputClass}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </InputField>
                <InputField label="PIN Code" required>
                  <input
                    type="text"
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    className={inputClass}
                  />
                </InputField>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Step 4: Financial &amp; GST Configuration
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InputField label="Financial Year">
                  <select
                    value={form.financialYear}
                    onChange={(e) => setForm({ ...form, financialYear: e.target.value })}
                    className={inputClass}
                  >
                    {FINANCIAL_YEARS.map((fy) => (
                      <option key={fy} value={fy}>FY {fy}</option>
                    ))}
                  </select>
                </InputField>
                <InputField label="Base Currency">
                  <input type="text" disabled value="INR (₹)" className={inputClass} />
                </InputField>
                <InputField label="Invoice Number Prefix">
                  <input
                    type="text"
                    value={form.invoicePrefix}
                    onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                    className={inputClass}
                  />
                </InputField>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 pt-2">
                <input
                  type="checkbox"
                  checked={form.priceInclusiveDefault}
                  onChange={(e) => setForm({ ...form, priceInclusiveDefault: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600"
                />
                Default product selling prices are GST-inclusive
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Step 5: Branding &amp; Invoice Template
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="Business Logo (Demo Upload)">
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-indigo-600 font-display text-sm font-bold text-white">
                      {form.businessName[0] || 'S'}
                    </div>
                    <div className="text-xs">
                      <div className="font-medium text-slate-800">{form.logoName}</div>
                      <label className="cursor-pointer text-indigo-600 hover:underline">
                        Change file
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setForm({ ...form, logoName: e.target.files[0].name });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </InputField>
                <InputField label="Invoice Print Template">
                  <div className="grid grid-cols-3 gap-2">
                    {['Classic GST Pro', 'Thermal 80mm', 'Minimal Modern'].map((tpl) => (
                      <button
                        key={tpl}
                        type="button"
                        onClick={() => setForm({ ...form, invoiceTemplate: tpl })}
                        className={`rounded-md border p-2.5 text-center text-xs font-medium ${form.invoiceTemplate === tpl
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </InputField>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Ready to launch {form.businessName} for FY {form.financialYear}.</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={step <= 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className={btnSecondary}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                className={btnPrimary}
              >
                Next Step
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button type="button" onClick={handleFinish} className={btnPrimary}>
                Save &amp; Go to Dashboard
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
