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
} from 'lucide-react';

/**
 * Complete Hierarchical System Modules & Sub-modules
 */
export const SYSTEM_MODULE_GROUPS = [
  {
    section: 'OPERATIONS DIRECTORY',
    modules: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        desc: 'Executive summary, revenue metrics, recent transactions & stock alerts',
        icon: LayoutDashboard,
        path: '/dashboard',
        submodules: [
          { id: 'dashboard:view', label: 'View Dashboard Metrics', path: '/dashboard' },
        ],
      },
      {
        id: 'pos',
        label: 'POS Billing',
        desc: 'Retail counter checkout, barcode scanning and thermal receipt printing',
        icon: MonitorSmartphone,
        path: '/pos',
        submodules: [
          { id: 'pos:checkout', label: 'Counter Checkout & Billing', path: '/pos' },
        ],
      },
    ],
  },
  {
    section: 'Business Operations',
    modules: [
      {
        id: 'sales',
        label: 'Sales & Invoicing',
        desc: 'GST tax invoices, quotations, orders, delivery challans, and credit notes',
        icon: FileText,
        path: '/sales/invoices',
        submodules: [
          { id: 'sales:invoices', label: 'All Invoices', path: '/sales/invoices' },
          { id: 'sales:create', label: 'Create Invoice', path: '/sales/invoices/new' },
          { id: 'sales:quotations', label: 'Quotations & Estimates', path: '/sales/quotations' },
          { id: 'sales:orders', label: 'Sales Orders', path: '/sales/orders' },
          { id: 'sales:challans', label: 'Delivery Challans', path: '/sales/challans' },
          { id: 'sales:returns', label: 'Sales Returns', path: '/sales/returns' },
          { id: 'sales:notes', label: 'Credit / Debit Notes', path: '/sales/notes' },
        ],
      },
      {
        id: 'purchases',
        label: 'Purchases & Bills',
        desc: 'Supplier purchase bills, inward GST claims, GRNs, and debit notes',
        icon: ShoppingBag,
        path: '/purchases',
        submodules: [
          { id: 'purchases:invoices', label: 'Purchase Invoices', path: '/purchases' },
          { id: 'purchases:create', label: 'Add Purchase Entry', path: '/purchases/new' },
          { id: 'purchases:returns', label: 'Purchase Returns', path: '/purchases/returns' },
          { id: 'purchases:grn', label: 'Goods Received Notes (GRN)', path: '/purchases/grn' },
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory & Godowns',
        desc: 'Stock movements, catalog SKUs, warehouses, godowns, and batch tracking',
        icon: Package,
        path: '/inventory/products',
        submodules: [
          { id: 'inventory:products', label: 'Products & SKUs', path: '/inventory/products' },
          { id: 'inventory:categories', label: 'Categories', path: '/inventory/categories' },
          { id: 'inventory:units', label: 'Units of Measure', path: '/inventory/units' },
          { id: 'inventory:stock-overview', label: 'Stock Valuation Overview', path: '/inventory/stock-overview' },
          { id: 'inventory:stock', label: 'Stock Movements & Ledger', path: '/inventory/stock' },
          { id: 'inventory:transfers', label: 'Godown Transfers', path: '/inventory/transfers' },
          { id: 'inventory:warehouses', label: 'Warehouses & Godowns', path: '/inventory/warehouses' },
          { id: 'inventory:batches', label: 'Batch & Expiry Management', path: '/inventory/batches' },
        ],
      },
      {
        id: 'parties',
        label: 'Parties & CRM',
        desc: 'Customer directory, supplier profiles, GSTIN validation, and ledgers',
        icon: Users,
        path: '/parties/customers',
        submodules: [
          { id: 'parties:customers', label: 'Customers & Balances', path: '/parties/customers' },
          { id: 'parties:suppliers', label: 'Suppliers & Payables', path: '/parties/suppliers' },
        ],
      },
      {
        id: 'payments',
        label: 'Banking & Payments',
        desc: 'Money in (receipts), money out (vouchers), bank ledgers & reconciliation',
        icon: IndianRupee,
        path: '/payments',
        submodules: [
          { id: 'payments:transactions', label: 'All Transactions', path: '/payments' },
          { id: 'payments:in', label: 'Money In (Customer Receipts)', path: '/payments/in' },
          { id: 'payments:out', label: 'Money Out (Supplier Payments)', path: '/payments/out' },
          { id: 'payments:cash-bank', label: 'Cash & Bank Books', path: '/payments/cash-bank' },
          { id: 'payments:reconciliation', label: 'Bank Statement Reconciliation', path: '/payments/reconciliation' },
        ],
      },
      {
        id: 'expenses',
        label: 'Expenses & Overheads',
        desc: 'Expense vouchers, overhead categories, recurring bills, and input tax',
        icon: Receipt,
        path: '/expenses',
        submodules: [
          { id: 'expenses:all', label: 'All Expenses', path: '/expenses' },
          { id: 'expenses:categories', label: 'Expense Categories', path: '/expenses/categories' },
        ],
      },
    ],
  },
  {
    section: 'Tax & Accounting',
    modules: [
      {
        id: 'gst',
        label: 'GST Management',
        desc: 'GSTR-1, GSTR-3B preparation, GSTR-2B reconciliation, and filing calendar',
        icon: Percent,
        path: '/gst',
        submodules: [
          { id: 'gst:dashboard', label: 'GST Summary Dashboard', path: '/gst' },
          { id: 'gst:gstr-1', label: 'GSTR-1 (Outward Supplies)', path: '/gst/gstr-1' },
          { id: 'gst:gstr-3b', label: 'GSTR-3B (Summary Return)', path: '/gst/gstr-3b' },
          { id: 'gst:gstr-2b', label: 'GSTR-2B Reconciliation', path: '/gst/gstr-2b' },
          { id: 'gst:reports', label: 'GST Audit Reports & HSN Summary', path: '/gst/reports' },
          { id: 'gst:calendar', label: 'GST Filing Calendar & Deadlines', path: '/gst/calendar' },
        ],
      },
      {
        id: 'einvoice',
        label: 'E-Invoice & E-Way Bill',
        desc: 'IRN generation, QR code embedding, NIC e-way bill generation & cancellation',
        icon: QrCode,
        path: '/einvoice/list',
        submodules: [
          { id: 'einvoice:invoices', label: 'E-Invoices Registry', path: '/einvoice/list' },
          { id: 'einvoice:generate', label: 'Generate IRN / E-Invoice', path: '/einvoice/generate' },
          { id: 'einvoice:eway-bills', label: 'E-Way Bills Registry', path: '/einvoice/eway-bills' },
          { id: 'einvoice:eway-generate', label: 'Generate E-Way Bill', path: '/einvoice/eway-generate' },
        ],
      },
      {
        id: 'accounting',
        label: 'Accounting & Ledgers',
        desc: 'Double-entry general ledger, chart of accounts, trial balance, and balance sheet',
        icon: BookOpen,
        path: '/accounting/coa',
        submodules: [
          { id: 'accounting:coa', label: 'Chart of Accounts', path: '/accounting/coa' },
          { id: 'accounting:general-ledger', label: 'General Ledger', path: '/accounting/general-ledger' },
          { id: 'accounting:journals', label: 'Journal Entries & Adjustments', path: '/accounting/journals' },
          { id: 'accounting:trial-balance', label: 'Trial Balance', path: '/accounting/trial-balance' },
          { id: 'accounting:pnl', label: 'Profit & Loss Statement', path: '/accounting/pnl' },
          { id: 'accounting:balance-sheet', label: 'Balance Sheet', path: '/accounting/balance-sheet' },
        ],
      },
      {
        id: 'reports',
        label: 'Reports & Analytics',
        desc: 'Sales registers, stock valuation, tax summaries, and aging analyses',
        icon: BarChart3,
        path: '/reports/sales',
        submodules: [
          { id: 'reports:sales', label: 'Sales Reports & Registers', path: '/reports/sales' },
          { id: 'reports:purchases', label: 'Purchase & ITC Reports', path: '/reports/purchases' },
          { id: 'reports:inventory', label: 'Inventory Stock Reports', path: '/reports/inventory' },
          { id: 'reports:gst', label: 'GST Statutory Reports', path: '/reports/gst' },
          { id: 'reports:financial', label: 'Financial Audit Reports', path: '/reports/financial' },
          { id: 'reports:expenses', label: 'Expense Analysis Reports', path: '/reports/expenses' },
          { id: 'reports:receivables-payables', label: 'Receivables & Payables Aging', path: '/reports/receivables-payables' },
          { id: 'reports:analytics', label: 'Business Growth Analytics', path: '/reports/analytics' },
        ],
      },
    ],
  },
  {
    section: 'Retail & System',
    modules: [
      {
        id: 'notifications',
        label: 'Notifications',
        desc: 'Tax alerts, low stock warnings, filing notifications and system announcements',
        icon: Bell,
        path: '/notifications',
        submodules: [
          { id: 'notifications:view', label: 'View & Dismiss Alerts', path: '/notifications' },
        ],
      },
      {
        id: 'audit',
        label: 'Audit Logs',
        desc: 'Immutable security log of operations, document posts, logins, and edits',
        icon: History,
        path: '/audit-logs',
        submodules: [
          { id: 'audit:view', label: 'View Audit Trail', path: '/audit-logs' },
        ],
      },
      {
        id: 'users',
        label: 'User Management',
        desc: 'Staff members, role authorizations, permission matrix, and access delegation',
        icon: ShieldCheck,
        path: '/users',
        submodules: [
          { id: 'users:view', label: 'Staff Directory', path: '/users' },
          { id: 'users:permissions', label: 'Permissions Matrix', path: '/users' },
        ],
      },
      {
        id: 'settings',
        label: 'Business Settings',
        desc: 'Business profile, GSTIN configuration, invoice numbering and bank setup',
        icon: Settings,
        path: '/settings',
        submodules: [
          { id: 'settings:general', label: 'Company Profile & Addresses', path: '/settings' },
          { id: 'settings:invoicing', label: 'Invoice Prefixes & Templates', path: '/settings' },
        ],
      },
      {
        id: 'subscription',
        label: 'Subscription & Billing',
        desc: 'SaaS plan details, payment history, feature licenses, and invoices',
        icon: CreditCard,
        path: '/subscription',
        submodules: [
          { id: 'subscription:view', label: 'Subscription & Invoices', path: '/subscription' },
        ],
      },
    ],
  },
];

/**
 * Flat list of all 17 root modules
 */
export const ALL_SYSTEM_MODULES = SYSTEM_MODULE_GROUPS.flatMap((g) => g.modules);

/**
 * Map a route path to its corresponding parent moduleId and subModuleId
 */
export const getModuleInfoFromPath = (path) => {
  if (!path) return { moduleId: '', subModuleId: '' };
  const p = path.toLowerCase().split('?')[0].split('#')[0];

  // Dashboard & POS
  if (p === '/dashboard' || p.startsWith('/dashboard/')) return { moduleId: 'dashboard', subModuleId: 'dashboard:view' };
  if (p === '/pos' || p.startsWith('/pos/')) return { moduleId: 'pos', subModuleId: 'pos:checkout' };

  // Sales
  if (p === '/sales/invoices/new') return { moduleId: 'sales', subModuleId: 'sales:create' };
  if (p === '/sales/invoices' || p.startsWith('/sales/invoices/')) return { moduleId: 'sales', subModuleId: 'sales:invoices' };
  if (p.startsWith('/sales/quotations')) return { moduleId: 'sales', subModuleId: 'sales:quotations' };
  if (p.startsWith('/sales/orders')) return { moduleId: 'sales', subModuleId: 'sales:orders' };
  if (p.startsWith('/sales/challans')) return { moduleId: 'sales', subModuleId: 'sales:challans' };
  if (p.startsWith('/sales/returns')) return { moduleId: 'sales', subModuleId: 'sales:returns' };
  if (p.startsWith('/sales/notes') || p.startsWith('/sales/credit-notes') || p.startsWith('/sales/debit-notes')) {
    return { moduleId: 'sales', subModuleId: 'sales:notes' };
  }
  if (p.startsWith('/sales')) return { moduleId: 'sales', subModuleId: 'sales:invoices' };

  // Purchases
  if (p === '/purchases/new') return { moduleId: 'purchases', subModuleId: 'purchases:create' };
  if (p.startsWith('/purchases/returns')) return { moduleId: 'purchases', subModuleId: 'purchases:returns' };
  if (p.startsWith('/purchases/grn')) return { moduleId: 'purchases', subModuleId: 'purchases:grn' };
  if (p.startsWith('/purchases')) return { moduleId: 'purchases', subModuleId: 'purchases:invoices' };

  // Inventory
  if (p.startsWith('/inventory/products')) return { moduleId: 'inventory', subModuleId: 'inventory:products' };
  if (p.startsWith('/inventory/categories')) return { moduleId: 'inventory', subModuleId: 'inventory:categories' };
  if (p.startsWith('/inventory/units')) return { moduleId: 'inventory', subModuleId: 'inventory:units' };
  if (p.startsWith('/inventory/stock-overview')) return { moduleId: 'inventory', subModuleId: 'inventory:stock-overview' };
  if (p.startsWith('/inventory/stock')) return { moduleId: 'inventory', subModuleId: 'inventory:stock' };
  if (p.startsWith('/inventory/transfers')) return { moduleId: 'inventory', subModuleId: 'inventory:transfers' };
  if (p.startsWith('/inventory/warehouses')) return { moduleId: 'inventory', subModuleId: 'inventory:warehouses' };
  if (p.startsWith('/inventory/batches')) return { moduleId: 'inventory', subModuleId: 'inventory:batches' };
  if (p.startsWith('/inventory')) return { moduleId: 'inventory', subModuleId: 'inventory:products' };

  // Parties
  if (p.startsWith('/parties/customers') || p.startsWith('/accounting/customer-ledger')) return { moduleId: 'parties', subModuleId: 'parties:customers' };
  if (p.startsWith('/parties/suppliers') || p.startsWith('/accounting/supplier-ledger')) return { moduleId: 'parties', subModuleId: 'parties:suppliers' };
  if (p.startsWith('/parties')) return { moduleId: 'parties', subModuleId: 'parties:customers' };

  // Payments
  if (p === '/payments/in') return { moduleId: 'payments', subModuleId: 'payments:in' };
  if (p === '/payments/out') return { moduleId: 'payments', subModuleId: 'payments:out' };
  if (
    p.startsWith('/payments/cash-bank') ||
    p.startsWith('/payments/cash-book') ||
    p.startsWith('/payments/bank-book') ||
    p.startsWith('/accounting/cash-book') ||
    p.startsWith('/accounting/bank-book')
  ) {
    return { moduleId: 'payments', subModuleId: 'payments:cash-bank' };
  }
  if (p.startsWith('/payments/reconciliation')) return { moduleId: 'payments', subModuleId: 'payments:reconciliation' };
  if (p.startsWith('/payments')) return { moduleId: 'payments', subModuleId: 'payments:transactions' };

  // Expenses
  if (p.startsWith('/expenses/categories')) return { moduleId: 'expenses', subModuleId: 'expenses:categories' };
  if (p.startsWith('/expenses')) return { moduleId: 'expenses', subModuleId: 'expenses:all' };

  // GST
  if (p === '/gst/gstr-1') return { moduleId: 'gst', subModuleId: 'gst:gstr-1' };
  if (p === '/gst/gstr-3b') return { moduleId: 'gst', subModuleId: 'gst:gstr-3b' };
  if (p.startsWith('/gst/gstr-2b')) return { moduleId: 'gst', subModuleId: 'gst:gstr-2b' };
  if (p.startsWith('/gst/reports') || p.startsWith('/gst/hsn')) return { moduleId: 'gst', subModuleId: 'gst:reports' };
  if (p.startsWith('/gst/calendar')) return { moduleId: 'gst', subModuleId: 'gst:calendar' };
  if (p.startsWith('/gst')) return { moduleId: 'gst', subModuleId: 'gst:dashboard' };

  // E-Invoice
  if (p === '/einvoice/generate') return { moduleId: 'einvoice', subModuleId: 'einvoice:generate' };
  if (p === '/einvoice/eway-generate') return { moduleId: 'einvoice', subModuleId: 'einvoice:eway-generate' };
  if (p.startsWith('/einvoice/eway-bills')) return { moduleId: 'einvoice', subModuleId: 'einvoice:eway-bills' };
  if (p.startsWith('/einvoice')) return { moduleId: 'einvoice', subModuleId: 'einvoice:invoices' };

  // Accounting
  if (p.startsWith('/accounting/coa')) return { moduleId: 'accounting', subModuleId: 'accounting:coa' };
  if (p.startsWith('/accounting/general-ledger')) return { moduleId: 'accounting', subModuleId: 'accounting:general-ledger' };
  if (p.startsWith('/accounting/journals')) return { moduleId: 'accounting', subModuleId: 'accounting:journals' };
  if (p.startsWith('/accounting/trial-balance')) return { moduleId: 'accounting', subModuleId: 'accounting:trial-balance' };
  if (p.startsWith('/accounting/pnl')) return { moduleId: 'accounting', subModuleId: 'accounting:pnl' };
  if (p.startsWith('/accounting/balance-sheet')) return { moduleId: 'accounting', subModuleId: 'accounting:balance-sheet' };
  if (p.startsWith('/accounting')) return { moduleId: 'accounting', subModuleId: 'accounting:coa' };

  // Reports
  if (p.startsWith('/reports/sales')) return { moduleId: 'reports', subModuleId: 'reports:sales' };
  if (p.startsWith('/reports/purchases')) return { moduleId: 'reports', subModuleId: 'reports:purchases' };
  if (p.startsWith('/reports/inventory')) return { moduleId: 'reports', subModuleId: 'reports:inventory' };
  if (p.startsWith('/reports/gst')) return { moduleId: 'reports', subModuleId: 'reports:gst' };
  if (p.startsWith('/reports/financial')) return { moduleId: 'reports', subModuleId: 'reports:financial' };
  if (p.startsWith('/reports/expenses')) return { moduleId: 'reports', subModuleId: 'reports:expenses' };
  if (p.startsWith('/reports/receivables-payables')) return { moduleId: 'reports', subModuleId: 'reports:receivables-payables' };
  if (p.startsWith('/reports/analytics')) return { moduleId: 'reports', subModuleId: 'reports:analytics' };
  if (p.startsWith('/reports')) return { moduleId: 'reports', subModuleId: 'reports:sales' };

  // System
  if (p.startsWith('/notifications')) return { moduleId: 'notifications', subModuleId: 'notifications:view' };
  if (p.startsWith('/audit-logs')) return { moduleId: 'audit', subModuleId: 'audit:view' };
  if (p.startsWith('/users')) return { moduleId: 'users', subModuleId: 'users:view' };
  if (p.startsWith('/settings') || p.startsWith('/onboarding')) return { moduleId: 'settings', subModuleId: 'settings:general' };
  if (p.startsWith('/subscription')) return { moduleId: 'subscription', subModuleId: 'subscription:view' };

  return { moduleId: '', subModuleId: '' };
};

/**
 * Check if granular sub-module keys exist for a given parent module in a permissions array
 */
export const hasGranularKeysForModule = (perms, moduleId) => {
  if (!Array.isArray(perms)) return false;
  return perms.some(
    (p) =>
      p.startsWith(`${moduleId}:`) &&
      p !== `${moduleId}:read` &&
      p !== `${moduleId}:edit` &&
      p !== `${moduleId}:write`
  );
};

/**
 * Determine the minimum privilege level required for a given URL path or route.
 * Creation, generation, and editing routes inherently require 'edit' access.
 */
export const getRequiredAccessLevelForPath = (path) => {
  if (!path) return 'read';
  const p = path.toLowerCase().split('?')[0].split('#')[0];
  if (
    p.endsWith('/new') ||
    p.includes('/edit') ||
    p === '/einvoice/generate' ||
    p === '/einvoice/eway-generate' ||
    p === '/onboarding'
  ) {
    return 'edit';
  }
  return 'read';
};

/**
 * Check if a user has access to a given module, submodule, or URL path.
 *
 * @param {Object} user - Current user object
 * @param {string} target - Module ID ('sales'), Submodule ID ('sales:invoices'), or Path ('/sales/invoices')
 * @param {'read'|'edit'} level - Required access level
 * @returns {boolean}
 */
export const checkUserPermission = (user, target, level = 'read') => {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin' || user.isSuperAdmin || role === 'super_admin') {
    return true;
  }

  const perms = (Array.isArray(user.permissions) && user.permissions.length > 0)
    ? user.permissions
    : getDefaultPermissionsForRole(user.role);
  if (perms.includes('all') || perms.includes('*')) {
    return true;
  }

  // Resolve target identifier and effective required level
  let moduleId = target;
  let subModuleId = target;
  let requiredLevel = level;

  if (typeof target === 'string' && target.startsWith('/')) {
    const resolved = getModuleInfoFromPath(target);
    moduleId = resolved.moduleId;
    subModuleId = resolved.subModuleId;
    // If the path itself is intrinsically an action/create route, effective level is always 'edit'
    if (getRequiredAccessLevelForPath(target) === 'edit') {
      requiredLevel = 'edit';
    }
  } else if (typeof target === 'string' && target.includes(':')) {
    moduleId = target.split(':')[0];
    subModuleId = target;
    // Submodules like 'purchases:create', 'sales:create', 'einvoice:generate' represent creation actions
    if (
      subModuleId.endsWith(':create') ||
      subModuleId.endsWith(':generate') ||
      subModuleId.endsWith(':eway-generate')
    ) {
      requiredLevel = 'edit';
    }
  }

  // If unmapped public path, grant access
  if (!moduleId) return true;

  // 1. Check direct submodule match: e.g. "purchases:create:edit", "purchases:create:read", or "purchases:create"
  if (subModuleId && subModuleId !== moduleId) {
    if (requiredLevel === 'read') {
      if (
        perms.includes(`${subModuleId}:read`) ||
        perms.includes(`${subModuleId}:edit`) ||
        perms.includes(`${subModuleId}:write`) ||
        perms.includes(subModuleId)
      ) {
        return true;
      }
    } else if (requiredLevel === 'edit') {
      if (
        perms.includes(`${subModuleId}:edit`) ||
        perms.includes(`${subModuleId}:write`)
      ) {
        return true;
      }
    }
    // If granular permissions exist for this parent module, and this submodule didn't match, deny access
    if (hasGranularKeysForModule(perms, moduleId)) {
      return false;
    }
  }

  // 2. Check parent module match: e.g. "purchases:read", "purchases:edit"
  if (requiredLevel === 'read') {
    return (
      perms.includes(moduleId) ||
      perms.includes(`${moduleId}:read`) ||
      perms.includes(`${moduleId}:edit`) ||
      perms.includes(`${moduleId}:write`)
    );
  }
  if (requiredLevel === 'edit') {
    return (
      perms.includes(`${moduleId}:edit`) ||
      perms.includes(`${moduleId}:write`)
    );
  }

  return false;
};

/**
 * Get default permissions for a role
 */
export const getDefaultPermissionsForRole = (role) => {
  const r = (role || '').toLowerCase();
  if (r === 'owner' || r === 'admin') {
    return ['all'];
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
  return [
    'sales:read', 'sales:edit',
    'parties:read', 'parties:edit',
    'payments:read', 'payments:edit',
    'pos:read', 'pos:edit',
  ];
};

/**
 * Get the first accessible workspace route path for a user
 */
export const getFirstAllowedPath = (user) => {
  if (!user) return '/login';
  const role = (user.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin' || user.isSuperAdmin || role === 'super_admin') {
    return '/dashboard';
  }
  const perms = (Array.isArray(user.permissions) && user.permissions.length > 0)
    ? user.permissions
    : getDefaultPermissionsForRole(user.role);
  if (perms.includes('all') || perms.includes('*')) {
    return '/dashboard';
  }

  const safeUser = { ...user, permissions: perms };

  const preferredOrder = [
    { target: 'dashboard', path: '/dashboard' },
    { target: 'pos', path: '/pos' },
    { target: 'sales', path: '/sales/invoices' },
    { target: 'parties', path: '/parties/customers' },
    { target: 'purchases', path: '/purchases' },
    { target: 'inventory', path: '/inventory/products' },
    { target: 'payments', path: '/payments' },
    { target: 'expenses', path: '/expenses' },
    { target: 'gst', path: '/gst' },
    { target: 'einvoice', path: '/einvoice/list' },
    { target: 'accounting', path: '/accounting/coa' },
    { target: 'reports', path: '/reports/sales' },
    { target: 'notifications', path: '/notifications' },
    { target: 'audit', path: '/audit-logs' },
    { target: 'users', path: '/users' },
    { target: 'settings', path: '/settings' },
  ];

  for (const item of preferredOrder) {
    if (checkUserPermission(safeUser, item.target, 'read')) {
      return item.path;
    }
  }

  return '/pos';
};

