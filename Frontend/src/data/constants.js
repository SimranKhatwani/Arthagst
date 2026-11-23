export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];

export const GST_RATES = [0, 5, 12, 18, 28];

export const PAYMENT_METHODS = ['UPI', 'NEFT', 'IMPS', 'Cash', 'Card', 'Cheque', 'Credit'];

export const REGISTRATION_TYPES = [
  'Regular',
  'Composition',
  'Unregistered / Consumer',
  'SEZ Unit / Developer',
  'Overseas / Export',
];

export const BUSINESS_TYPES = [
  'Wholesale & Retail',
  'Retail Store',
  'Distributor / Stockist',
  'Manufacturer',
  'Service Provider',
  'E-Commerce Seller',
];

export const CONSTITUTION_TYPES = [
  'Proprietorship',
  'Partnership Firm',
  'Limited Liability Partnership (LLP)',
  'Private Limited Company',
  'Hindu Undivided Family (HUF)',
];

export const FINANCIAL_YEARS = ['2026-27', '2025-26', '2024-25'];

export const EXPENSE_CATEGORIES = [
  { id: 'expcat-1', name: 'Rent & Warehouse Lease', hsn: '997212', defaultGst: 18, description: 'Shop, office and godown rentals' },
  { id: 'expcat-2', name: 'Electricity & Utilities', hsn: '9986', defaultGst: 0, description: 'Power, water and utility bills' },
  { id: 'expcat-3', name: 'Staff Salaries & Wages', hsn: '9985', defaultGst: 0, description: 'Monthly payroll and staff allowances' },
  { id: 'expcat-4', name: 'Freight & Logistics', hsn: '996511', defaultGst: 5, description: 'Goods transport, courier and loading' },
  { id: 'expcat-5', name: 'Office & Packaging Supplies', hsn: '4819', defaultGst: 12, description: 'Stationery, tapes and consumables' },
  { id: 'expcat-6', name: 'Software & Telecom', hsn: '9984', defaultGst: 18, description: 'Internet, mobile and SaaS subscriptions' },
  { id: 'expcat-7', name: 'Marketing & Promotion', hsn: '998361', defaultGst: 18, description: 'Local advertising, catalogues and banners' },
  { id: 'expcat-8', name: 'Repairs & Maintenance', hsn: '9987', defaultGst: 18, description: 'Equipment servicing and upkeep' },
  { id: 'expcat-9', name: 'Professional & CA Fees', hsn: '998221', defaultGst: 18, description: 'Audit, GST compliance and legal retainers' },
  { id: 'expcat-10', name: 'Bank & Payment Charges', hsn: '9971', defaultGst: 18, description: 'POS MDR, NEFT/RTGS and bank fees' },
];

export const CHART_OF_ACCOUNTS = [
  { code: '1001', name: 'Cash in Hand', group: 'Current Assets', type: 'Asset', normalBalance: 'Debit', openingBalance: 145000 },
  { code: '1002', name: 'HDFC Bank Current A/c', group: 'Bank Accounts', type: 'Asset', normalBalance: 'Debit', openingBalance: 1285000 },
  { code: '1003', name: 'ICICI Business Banking', group: 'Bank Accounts', type: 'Asset', normalBalance: 'Debit', openingBalance: 420000 },
  { code: '1004', name: 'Business UPI Wallet', group: 'Cash & Equivalents', type: 'Asset', normalBalance: 'Debit', openingBalance: 64500 },
  { code: '1100', name: 'Accounts Receivable (Sundry Debtors)', group: 'Current Assets', type: 'Asset', normalBalance: 'Debit', openingBalance: 0 },
  { code: '1200', name: 'Inventory / Stock-in-Trade', group: 'Current Assets', type: 'Asset', normalBalance: 'Debit', openingBalance: 0 },
  { code: '1300', name: 'Input Tax Credit (CGST/SGST/IGST)', group: 'Duties & Taxes', type: 'Asset', normalBalance: 'Debit', openingBalance: 42000 },
  { code: '1500', name: 'Furniture, Fixtures & Computers', group: 'Fixed Assets', type: 'Asset', normalBalance: 'Debit', openingBalance: 485000 },
  { code: '2001', name: 'Accounts Payable (Sundry Creditors)', group: 'Current Liabilities', type: 'Liability', normalBalance: 'Credit', openingBalance: 0 },
  { code: '2100', name: 'Output GST Payable (CGST/SGST/IGST)', group: 'Duties & Taxes', type: 'Liability', normalBalance: 'Credit', openingBalance: 38500 },
  { code: '2200', name: 'TDS & Statutory Payables', group: 'Current Liabilities', type: 'Liability', normalBalance: 'Credit', openingBalance: 18000 },
  { code: '3001', name: 'Proprietor Capital Account', group: 'Capital & Reserves', type: 'Equity', normalBalance: 'Credit', openingBalance: 2150000 },
  { code: '3002', name: 'Retained Earnings', group: 'Capital & Reserves', type: 'Equity', normalBalance: 'Credit', openingBalance: 640000 },
  { code: '4001', name: 'Sales Revenue (Taxable Goods)', group: 'Direct Income', type: 'Income', normalBalance: 'Credit', openingBalance: 0 },
  { code: '4002', name: 'Shipping & Packing Recovery', group: 'Indirect Income', type: 'Income', normalBalance: 'Credit', openingBalance: 0 },
  { code: '5001', name: 'Cost of Goods Purchased', group: 'Direct Expenses', type: 'Expense', normalBalance: 'Debit', openingBalance: 0 },
  { code: '5100', name: 'Operating & Administrative Expenses', group: 'Indirect Expenses', type: 'Expense', normalBalance: 'Debit', openingBalance: 0 },
];

export const ROLES_CONFIG = {
  Owner: {
    label: 'Business Owner',
    description: 'Full access across all billing, GST, accounting, and settings modules.',
    permissions: ['sales', 'purchases', 'inventory', 'parties', 'payments', 'expenses', 'gst', 'accounting', 'reports', 'pos', 'users', 'settings'],
  },
  Accountant: {
    label: 'Chartered Accountant / Accounts',
    description: 'Access to invoices, purchases, GST returns, accounting ledgers, and financial reports.',
    permissions: ['sales', 'purchases', 'parties', 'payments', 'expenses', 'gst', 'accounting', 'reports'],
  },
  'Billing Clerk': {
    label: 'Billing & POS Executive',
    description: 'Create invoices, quotations, POS bills, and record customer payments.',
    permissions: ['sales', 'parties', 'payments', 'pos'],
  },
  'Warehouse Manager': {
    label: 'Inventory & Warehouse Manager',
    description: 'Manage products, stock adjustments, transfers, batches, and GRNs.',
    permissions: ['purchases', 'inventory'],
  },
  Viewer: {
    label: 'Auditor / Read-Only Viewer',
    description: 'View-only access to reports, ledgers, and transaction registers.',
    permissions: ['reports', 'gst', 'accounting'],
  },
};

export const getStateCode = (stateName) => {
  const found = INDIAN_STATES.find(
    (s) => s.name.toLowerCase() === String(stateName || '').trim().toLowerCase()
  );
  return found ? found.code : '08';
};
