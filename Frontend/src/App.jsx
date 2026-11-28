import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { getToken } from './services/api';
import { getFirstAllowedPath, getModuleInfoFromPath } from './utils/permissionUtils';
import { ToastContainer, ConfirmDialog } from './components/common/UI';
import { AppLayout } from './components/layout/AppLayout';
import { SuperAdminLayout } from './components/layout/SuperAdminLayout';

// Auth & Onboarding
import {
  LoginPage,
  RegisterPage,
  OnboardingWizardPage,
  SuperAdminLoginPage,
} from './pages/auth/AuthPages';
import { LandingPage } from './pages/landing/LandingPage';

// Dashboard
import { DashboardPage } from './pages/dashboard/DashboardPage';

// Sales
import { InvoicesPage } from './pages/sales/InvoicesPage';
import { CreateInvoicePage } from './pages/sales/CreateInvoicePage';
import {
  QuotationsPage,
  SalesOrdersPage,
  DeliveryChallansPage,
  SalesReturnsPage,
  CreditDebitNotesPage,
  CreditNotesPage,
  DebitNotesPage,
} from './pages/sales/SalesDocumentsPages';

// Purchases
import {
  PurchasesPage,
  AddPurchasePage,
  PurchaseReturnsPage,
  GRNPage,
  PurchasePaymentsPage,
} from './pages/purchases/PurchasesPages';

// Inventory
import {
  ProductsPage,
  CategoriesPage,
  UnitsPage,
  StockOverviewPage,
  StockManagementPage,
  StockTransfersPage,
  WarehousesPage,
  BatchExpiryPage,
} from './pages/inventory/InventoryPages';

// Parties
import {
  CustomersPage,
  CustomerDetailPage,
  SuppliersPage,
  SupplierDetailPage,
} from './pages/parties/PartiesPages';

// Payments
import { PaymentsWorkspacePage } from './pages/payments/PaymentsPages';

// Expenses
import {
  ExpensesPage,
  AddExpensePage,
  ExpenseCategoriesPage,
} from './pages/expenses/ExpensesPages';

// GST
import {
  GSTDashboardPage,
  GSTReturnsPage,
  GSTR2BReconciliationPage,
  GSTSummaryPage,
  GSTReportsPage,
  HSNSummaryPage,
  GSTCalendarPage,
} from './pages/gst/GSTPages';

// E-Invoice & E-Way Bill
import {
  EInvoicesPage,
  GenerateEInvoicePage,
  EWayBillsPage,
  GenerateEWayBillPage,
} from './pages/einvoice/EInvoicePages';

// Accounting
import {
  ChartOfAccountsPage,
  GeneralLedgerPage,
  CustomerLedgerPage,
  SupplierLedgerPage,
  CashBookPage,
  BankBookPage,
  JournalEntriesPage,
  TrialBalancePage,
  ProfitLossPage,
  BalanceSheetPage,
} from './pages/accounting/AccountingPages';

// Reports
import { ReportsCenterPage } from './pages/reports/ReportsPages';

// POS
import { POSBillingPage } from './pages/pos/POSBillingPage';

// System
import {
  NotificationsPage,
  AuditLogsPage,
  UsersRolesPage,
  SettingsPage,
  SubscriptionPage,
} from './pages/system/SystemPages';

// Super Admin
import {
  SuperAdminDashboardPage,
  SuperAdminTenantsPage,
  SuperAdminPlansPage,
  SuperAdminSubSectionPage,
} from './pages/admin/SuperAdminPages';

const AuthLoadingScreen = ({ message = 'Verifying ArthaGST session...' }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50">
    <div className="text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent align-[-0.125em]" />
      <p className="mt-3 text-xs font-medium text-slate-500">{message}</p>
    </div>
  </div>
);

const AccessRestrictedView = ({ user, targetPath }) => {
  const navigate = useNavigate();
  const { logout } = useApp();
  const allowedPath = getFirstAllowedPath(user);
  const modInfo = getModuleInfoFromPath(targetPath);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm max-w-md w-full space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            You do not have authorization to view{' '}
            <span className="font-semibold text-slate-800">{modInfo.moduleId || targetPath}</span>.
            Your account permissions are restricted to your assigned role.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs text-left">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Current Session
          </div>
          <div className="font-medium text-slate-800">{user?.name}</div>
          <div className="text-slate-500 text-[11px]">
            Role: <span className="font-semibold text-indigo-700">{user?.role}</span> • {user?.email}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate(allowedPath, { replace: true })}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
          >
            Go to Your Workspace
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

const ProtectedTenant = ({ children }) => {
  const { state, authLoading, canAccess } = useApp();
  const location = useLocation();

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  if (!state.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if current user has permission to this path
  const isAllowed = canAccess ? canAccess(location.pathname, 'read') : true;

  if (!isAllowed) {
    // If user lands on /dashboard by default but doesn't have dashboard access, auto-redirect to first allowed path!
    if (location.pathname === '/dashboard') {
      const allowedPath = getFirstAllowedPath(state.currentUser);
      return <Navigate to={allowedPath} replace />;
    }

    return (
      <AppLayout>
        <AccessRestrictedView user={state.currentUser} targetPath={location.pathname} />
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
};

const ProtectedSuperAdmin = ({ children }) => {
  const { state, authLoading } = useApp();
  const location = useLocation();

  if (authLoading) {
    return <AuthLoadingScreen message="Verifying Super Admin access..." />;
  }

  // If unauthenticated or not a super admin, redirect to dedicated super admin login
  if (!state.isAuthenticated || (state.currentUser?.role !== 'super_admin' && !state.currentUser?.isSuperAdmin)) {
    return <Navigate to="/sd/login" state={{ from: location }} replace />;
  }

  return <SuperAdminLayout>{children}</SuperAdminLayout>;
};

const PublicAuthRoute = ({ children }) => {
  const { state, authLoading } = useApp();

  if (authLoading && getToken()) {
    return <AuthLoadingScreen message="Loading..." />;
  }

  if (state.isAuthenticated) {
    if (state.currentUser?.role === 'super_admin' || state.currentUser?.isSuperAdmin) {
      return <Navigate to="/sd" replace />;
    }
    const targetPath = getFirstAllowedPath(state.currentUser);
    return <Navigate to={targetPath} replace />;
  }

  return children;
};

const PublicSuperAdminAuthRoute = ({ children }) => {
  const { state, authLoading } = useApp();

  if (authLoading && getToken()) {
    return <AuthLoadingScreen message="Loading..." />;
  }

  if (state.isAuthenticated && (state.currentUser?.role === 'super_admin' || state.currentUser?.isSuperAdmin)) {
    return <Navigate to="/sd" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { state, toasts, dismissToast, confirmState } = useApp();

  return (
    <>
      <Routes>
        {/* Public Auth & Setup */}
        <Route
          path="/login"
          element={
            <PublicAuthRoute>
              <LoginPage />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicAuthRoute>
              <RegisterPage />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedTenant>
              <OnboardingWizardPage />
            </ProtectedTenant>
          }
        />

        {/* Landing & Tenant App Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<ProtectedTenant><DashboardPage /></ProtectedTenant>} />

        {/* Sales */}
        <Route path="/sales/invoices" element={<ProtectedTenant><InvoicesPage /></ProtectedTenant>} />
        <Route path="/sales/invoices/new" element={<ProtectedTenant><CreateInvoicePage /></ProtectedTenant>} />
        <Route path="/sales/invoices/edit/:id" element={<ProtectedTenant><CreateInvoicePage /></ProtectedTenant>} />
        <Route path="/sales/quotations" element={<ProtectedTenant><QuotationsPage /></ProtectedTenant>} />
        <Route path="/sales/orders" element={<ProtectedTenant><SalesOrdersPage /></ProtectedTenant>} />
        <Route path="/sales/challans" element={<ProtectedTenant><DeliveryChallansPage /></ProtectedTenant>} />
        <Route path="/sales/returns" element={<ProtectedTenant><SalesReturnsPage /></ProtectedTenant>} />
        <Route path="/sales/notes" element={<ProtectedTenant><CreditDebitNotesPage /></ProtectedTenant>} />
        <Route path="/sales/credit-notes" element={<ProtectedTenant><CreditNotesPage /></ProtectedTenant>} />
        <Route path="/sales/debit-notes" element={<ProtectedTenant><DebitNotesPage /></ProtectedTenant>} />

        {/* Purchases */}
        <Route path="/purchases" element={<ProtectedTenant><PurchasesPage /></ProtectedTenant>} />
        <Route path="/purchases/new" element={<ProtectedTenant><AddPurchasePage /></ProtectedTenant>} />
        <Route path="/purchases/returns" element={<ProtectedTenant><PurchaseReturnsPage /></ProtectedTenant>} />
        <Route path="/purchases/grn" element={<ProtectedTenant><GRNPage /></ProtectedTenant>} />
        <Route path="/purchases/payments" element={<ProtectedTenant><PurchasePaymentsPage /></ProtectedTenant>} />

        {/* Inventory */}
        <Route path="/inventory/products" element={<ProtectedTenant><ProductsPage /></ProtectedTenant>} />
        <Route path="/inventory/categories" element={<ProtectedTenant><CategoriesPage /></ProtectedTenant>} />
        <Route path="/inventory/units" element={<ProtectedTenant><UnitsPage /></ProtectedTenant>} />
        <Route path="/inventory/stock-overview" element={<ProtectedTenant><StockOverviewPage /></ProtectedTenant>} />
        <Route path="/inventory/stock" element={<ProtectedTenant><StockManagementPage /></ProtectedTenant>} />
        <Route path="/inventory/transfers" element={<ProtectedTenant><StockTransfersPage /></ProtectedTenant>} />
        <Route path="/inventory/warehouses" element={<ProtectedTenant><WarehousesPage /></ProtectedTenant>} />
        <Route path="/inventory/batches" element={<ProtectedTenant><BatchExpiryPage /></ProtectedTenant>} />

        {/* Parties */}
        <Route path="/parties/customers" element={<ProtectedTenant><CustomersPage /></ProtectedTenant>} />
        <Route path="/parties/customers/:id" element={<ProtectedTenant><CustomerDetailPage /></ProtectedTenant>} />
        <Route path="/parties/suppliers" element={<ProtectedTenant><SuppliersPage /></ProtectedTenant>} />
        <Route path="/parties/suppliers/:id" element={<ProtectedTenant><SupplierDetailPage /></ProtectedTenant>} />

        {/* Payments (Unified Workspace + Cash/Bank Books) */}
        <Route path="/payments" element={<ProtectedTenant><PaymentsWorkspacePage defaultTab="all" /></ProtectedTenant>} />
        <Route path="/payments/in" element={<ProtectedTenant><PaymentsWorkspacePage defaultTab="in" /></ProtectedTenant>} />
        <Route path="/payments/out" element={<ProtectedTenant><PaymentsWorkspacePage defaultTab="out" /></ProtectedTenant>} />
        <Route path="/payments/cash-bank" element={<ProtectedTenant><PaymentsWorkspacePage defaultTab="cash-bank" /></ProtectedTenant>} />
        <Route path="/payments/cash-book" element={<ProtectedTenant><PaymentsWorkspacePage defaultTab="cash-book" /></ProtectedTenant>} />
        <Route path="/payments/bank-book" element={<ProtectedTenant><PaymentsWorkspacePage defaultTab="bank-book" /></ProtectedTenant>} />
        <Route path="/payments/history" element={<ProtectedTenant><PaymentsWorkspacePage defaultTab="all" /></ProtectedTenant>} />
        <Route path="/payments/reconciliation" element={<ProtectedTenant><PaymentsWorkspacePage defaultTab="reconciliation" /></ProtectedTenant>} />

        {/* Expenses */}
        <Route path="/expenses" element={<ProtectedTenant><ExpensesPage /></ProtectedTenant>} />
        <Route path="/expenses/new" element={<ProtectedTenant><AddExpensePage /></ProtectedTenant>} />
        <Route path="/expenses/categories" element={<ProtectedTenant><ExpenseCategoriesPage /></ProtectedTenant>} />

        {/* GST Management */}
        <Route path="/gst" element={<ProtectedTenant><GSTDashboardPage /></ProtectedTenant>} />
        <Route path="/gst/returns" element={<ProtectedTenant><GSTReturnsPage defaultTab="gstr1" /></ProtectedTenant>} />
        <Route path="/gst/gstr-1" element={<ProtectedTenant><GSTReturnsPage defaultTab="gstr1" /></ProtectedTenant>} />
        <Route path="/gst/gstr-3b" element={<ProtectedTenant><GSTReturnsPage defaultTab="gstr3b" /></ProtectedTenant>} />
        <Route path="/gst/gstr-2b" element={<ProtectedTenant><GSTR2BReconciliationPage /></ProtectedTenant>} />
        <Route path="/gst/summary" element={<ProtectedTenant><GSTSummaryPage /></ProtectedTenant>} />
        <Route path="/gst/reports" element={<ProtectedTenant><GSTReportsPage /></ProtectedTenant>} />
        <Route path="/gst/hsn" element={<ProtectedTenant><HSNSummaryPage /></ProtectedTenant>} />
        <Route path="/gst/calendar" element={<ProtectedTenant><GSTCalendarPage /></ProtectedTenant>} />

        {/* E-Invoice & E-Way Bill */}
        <Route path="/einvoice/list" element={<ProtectedTenant><EInvoicesPage /></ProtectedTenant>} />
        <Route path="/einvoice/generate" element={<ProtectedTenant><GenerateEInvoicePage /></ProtectedTenant>} />
        <Route path="/einvoice/eway-bills" element={<ProtectedTenant><EWayBillsPage /></ProtectedTenant>} />
        <Route path="/einvoice/eway-generate" element={<ProtectedTenant><GenerateEWayBillPage /></ProtectedTenant>} />

        {/* Accounting (core statements + compatible legacy routes for party/cash/bank books) */}
        <Route path="/accounting/coa" element={<ProtectedTenant><ChartOfAccountsPage /></ProtectedTenant>} />
        <Route path="/accounting/general-ledger" element={<ProtectedTenant><GeneralLedgerPage /></ProtectedTenant>} />
        <Route path="/accounting/customer-ledger" element={<ProtectedTenant><CustomerLedgerPage /></ProtectedTenant>} />
        <Route path="/accounting/supplier-ledger" element={<ProtectedTenant><SupplierLedgerPage /></ProtectedTenant>} />
        <Route path="/accounting/cash-book" element={<ProtectedTenant><CashBookPage /></ProtectedTenant>} />
        <Route path="/accounting/bank-book" element={<ProtectedTenant><BankBookPage /></ProtectedTenant>} />
        <Route path="/accounting/journals" element={<ProtectedTenant><JournalEntriesPage /></ProtectedTenant>} />
        <Route path="/accounting/trial-balance" element={<ProtectedTenant><TrialBalancePage /></ProtectedTenant>} />
        <Route path="/accounting/pnl" element={<ProtectedTenant><ProfitLossPage /></ProtectedTenant>} />
        <Route path="/accounting/balance-sheet" element={<ProtectedTenant><BalanceSheetPage /></ProtectedTenant>} />

        {/* Reports Center */}
        <Route path="/reports/sales" element={<ProtectedTenant><ReportsCenterPage category="sales" /></ProtectedTenant>} />
        <Route path="/reports/purchases" element={<ProtectedTenant><ReportsCenterPage category="purchases" /></ProtectedTenant>} />
        <Route path="/reports/inventory" element={<ProtectedTenant><ReportsCenterPage category="inventory" /></ProtectedTenant>} />
        <Route path="/reports/gst" element={<ProtectedTenant><ReportsCenterPage category="gst" /></ProtectedTenant>} />
        <Route path="/reports/financial" element={<ProtectedTenant><ReportsCenterPage category="financial" /></ProtectedTenant>} />
        <Route path="/reports/expenses" element={<ProtectedTenant><ReportsCenterPage category="expenses" /></ProtectedTenant>} />
        <Route path="/reports/receivables-payables" element={<ProtectedTenant><ReportsCenterPage category="receivables-payables" /></ProtectedTenant>} />
        <Route path="/reports/analytics" element={<ProtectedTenant><ReportsCenterPage category="analytics" /></ProtectedTenant>} />

        {/* POS & System */}
        <Route path="/pos" element={<ProtectedTenant><POSBillingPage /></ProtectedTenant>} />
        <Route path="/notifications" element={<ProtectedTenant><NotificationsPage /></ProtectedTenant>} />
        <Route path="/audit-logs" element={<ProtectedTenant><AuditLogsPage /></ProtectedTenant>} />
        <Route path="/users" element={<ProtectedTenant><UsersRolesPage /></ProtectedTenant>} />
        <Route path="/settings" element={<ProtectedTenant><SettingsPage defaultTab="business-tax" /></ProtectedTenant>} />
        <Route path="/subscription" element={<ProtectedTenant><SubscriptionPage /></ProtectedTenant>} />

        {/* Dedicated Super Admin Login (/sd/login) */}
        <Route
          path="/sd/login"
          element={
            <PublicSuperAdminAuthRoute>
              <SuperAdminLoginPage />
            </PublicSuperAdminAuthRoute>
          }
        />

        {/* Super Admin Console (/sd and essential modules) */}
        <Route path="/sd" element={<ProtectedSuperAdmin><SuperAdminDashboardPage /></ProtectedSuperAdmin>} />
        <Route path="/sd/dashboard" element={<Navigate to="/sd" replace />} />
        <Route path="/sd/tenants" element={<ProtectedSuperAdmin><SuperAdminTenantsPage /></ProtectedSuperAdmin>} />
        <Route path="/sd/users" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="users" /></ProtectedSuperAdmin>} />
        <Route path="/sd/plans" element={<ProtectedSuperAdmin><SuperAdminPlansPage /></ProtectedSuperAdmin>} />
        <Route path="/sd/subscriptions" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="subscriptions" /></ProtectedSuperAdmin>} />
        <Route path="/sd/payments" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="payments" /></ProtectedSuperAdmin>} />
        <Route path="/sd/analytics" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="analytics" /></ProtectedSuperAdmin>} />
        <Route path="/sd/tickets" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="tickets" /></ProtectedSuperAdmin>} />
        <Route path="/sd/announcements" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="announcements" /></ProtectedSuperAdmin>} />
        <Route path="/sd/features" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="features" /></ProtectedSuperAdmin>} />
        <Route path="/sd/settings" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="settings" /></ProtectedSuperAdmin>} />
        <Route path="/sd/audit" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="audit" /></ProtectedSuperAdmin>} />

        {/* Backward compatibility for /super-admin */}
        <Route path="/super-admin" element={<Navigate to="/sd" replace />} />
        <Route path="/super-admin/*" element={<Navigate to="/sd" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog confirmState={confirmState} />
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
