import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft, Building2, ShieldCheck } from 'lucide-react';
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
  const { login, notify } = useApp();
  const navigate = useNavigate();
  const [tenantCode, setTenantCode] = useState(
    () => localStorage.getItem('arthagst_last_tenant_code') || ''
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors = {};
    if (!tenantCode.trim()) errors.tenantCode = 'Tenant code is required';
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

      if (remember) {
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
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-display text-base font-bold">
            A
          </div>
          <span className="font-display text-xl font-semibold">ArthaGST</span>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="font-display text-3xl font-semibold leading-tight">
            GST billing, inventory, and accounting built for Indian businesses.
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Manage CGST/SGST/IGST invoicing, GSTR-1 &amp; GSTR-3B summaries, multi-warehouse stock,
            and supplier payables in one structured workspace.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-4 text-xs text-slate-300">
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <div className="font-semibold text-white">Multi-Tenant Cloud</div>
              <div className="mt-1 text-slate-400">Strict organization data isolation</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
              <div className="font-semibold text-white">Real-Time GST Engine</div>
              <div className="mt-1 text-slate-400">Automated CGST/SGST/IGST compliance</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          Enterprise Multi-Tenant GST SaaS · Connected to ArthaGST Backend
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-slate-900">Sign in to ArthaGST</h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter your organization tenant code and credentials.
          </p>

          {error && (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <div className="font-semibold">Authentication Failed</div>
              <div className="mt-0.5">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <InputField label="Tenant / Organization Code" required error={fieldErrors.tenantCode}>
              <input
                type="text"
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value.toUpperCase())}
                className={inputClass}
                placeholder="e.g. ST001 or ORGCODE"
                autoComplete="organization"
              />
            </InputField>

            <InputField label="Email Address" required error={fieldErrors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </InputField>

            <InputField label="Password" required error={fieldErrors.password}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </InputField>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                Remember tenant code
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`${btnPrimary} w-full py-2.5 cursor-pointer disabled:opacity-50`}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-600">
            New business?{' '}
            <Link to="/register" className="font-medium text-indigo-600 hover:underline">
              Register New Organization
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
    if (!form.mobile.trim()) errors.mobile = 'Mobile number is required';
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-display text-sm font-bold text-white">
            A
          </div>
          <span className="font-display text-lg font-semibold text-slate-900">ArthaGST</span>
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold text-slate-900">
          Create your business account
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Set up your organization and initial owner account.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <div className="font-semibold">Registration Error</div>
            <div className="mt-0.5">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <InputField label="Trade / Business Name" required error={fieldErrors.businessName}>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              className={inputClass}
              placeholder="e.g. Acme Enterprises"
            />
          </InputField>

          <InputField label="Custom Tenant Code (Optional)" error={fieldErrors.tenantCode}>
            <input
              type="text"
              value={form.tenantCode}
              onChange={(e) => setForm({ ...form, tenantCode: e.target.value.toUpperCase() })}
              className={inputClass}
              placeholder="e.g. ACME (auto-generated if empty)"
            />
          </InputField>

          <InputField label="Owner Full Name" required error={fieldErrors.ownerName}>
            <input
              type="text"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              className={inputClass}
              placeholder="e.g. Rajesh Sharma"
            />
          </InputField>

          <InputField label="Business Email" required error={fieldErrors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
              placeholder="accounts@company.in"
            />
          </InputField>

          <InputField label="Mobile Number (+91)" required error={fieldErrors.mobile}>
            <input
              type="tel"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              className={inputClass}
              placeholder="9829011223"
            />
          </InputField>

          <InputField label="State / Union Territory" required error={fieldErrors.state}>
            <select
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className={inputClass}
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </InputField>

          <InputField label="Password" required error={fieldErrors.password}>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputClass}
              placeholder="Minimum 6 characters"
            />
          </InputField>

          <InputField label="Confirm Password" required error={fieldErrors.confirmPassword}>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className={inputClass}
              placeholder="Re-enter password"
            />
          </InputField>

          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} w-full py-2.5 cursor-pointer disabled:opacity-50`}
          >
            {loading ? 'Creating Account...' : 'Continue to Business Setup'}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-600">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Sign In
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
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                step === s.num
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
                        className={`rounded-md border p-2.5 text-center text-xs font-medium ${
                          form.invoiceTemplate === tpl
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
