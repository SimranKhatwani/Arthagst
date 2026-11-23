import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ToastContainer, ConfirmDialog } from './components/common/UI';
import { AppLayout } from './components/layout/AppLayout';
import { SuperAdminLayout } from './components/layout/SuperAdminLayout';

// Auth & Onboarding
import { LoginPage, RegisterPage, OnboardingWizardPage } from './pages/auth/AuthPages';

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

const ProtectedTenant = ({ children }) => {
  const { state } = useApp();
  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout>{children}</AppLayout>;
};

const ProtectedSuperAdmin = ({ children }) => {
  const { state } = useApp();
  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <SuperAdminLayout>{children}</SuperAdminLayout>;
};

const AppRoutes = () => {
  const { state, toasts, dismissToast, confirmState } = useApp();

  return (
    <>
      <Routes>
        {/* Public Auth & Setup */}
        <Route
          path="/login"
          element={state.isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={state.isAuthenticated ? <Navigate to="/onboarding" replace /> : <RegisterPage />}
        />
        <Route
          path="/onboarding"
          element={state.isAuthenticated ? <OnboardingWizardPage /> : <Navigate to="/login" replace />}
        />

        {/* Tenant App Routes */}
        <Route path="/" element={<Navigate to={state.isAuthenticated ? '/dashboard' : '/login'} replace />} />
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

        {/* Isolated Multi-Tenant Super Admin Console */}
        <Route path="/super-admin" element={<ProtectedSuperAdmin><SuperAdminDashboardPage /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/tenants" element={<ProtectedSuperAdmin><SuperAdminTenantsPage /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/users" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="users" /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/plans" element={<ProtectedSuperAdmin><SuperAdminPlansPage /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/subscriptions" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="subscriptions" /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/payments" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="payments" /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/analytics" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="analytics" /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/tickets" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="tickets" /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/announcements" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="announcements" /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/features" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="features" /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/settings" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="settings" /></ProtectedSuperAdmin>} />
        <Route path="/super-admin/audit" element={<ProtectedSuperAdmin><SuperAdminSubSectionPage section="audit" /></ProtectedSuperAdmin>} />

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
