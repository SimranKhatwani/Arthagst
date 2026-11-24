import Account from './account.model.js';

/**
 * Standard Default Indian Chart of Accounts (COA) Definition
 */
export const STANDARD_ACCOUNTS = [
  // 1000 - ASSETS
  {
    accountCode: '1010',
    accountName: 'Cash on Hand',
    accountType: 'asset',
    accountSubType: 'bank_and_cash',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Cash in physical register/petty cash',
  },
  {
    accountCode: '1020',
    accountName: 'Bank Accounts',
    accountType: 'asset',
    accountSubType: 'bank_and_cash',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Operating current and savings bank accounts',
  },
  {
    accountCode: '1100',
    accountName: 'Accounts Receivable (Debtors)',
    accountType: 'asset',
    accountSubType: 'accounts_receivable',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Money owed by customers for sales made on credit',
  },
  {
    accountCode: '1200',
    accountName: 'Stock in Hand (Inventory)',
    accountType: 'asset',
    accountSubType: 'inventory',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Value of raw materials, goods, and merchandise in inventory',
  },
  {
    accountCode: '1310',
    accountName: 'Input CGST',
    accountType: 'asset',
    accountSubType: 'duties_and_taxes',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Input Central GST credit on purchases and expenses',
  },
  {
    accountCode: '1320',
    accountName: 'Input SGST',
    accountType: 'asset',
    accountSubType: 'duties_and_taxes',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Input State GST credit on purchases and expenses',
  },
  {
    accountCode: '1330',
    accountName: 'Input IGST',
    accountType: 'asset',
    accountSubType: 'duties_and_taxes',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Input Integrated GST credit on inter-state purchases',
  },
  {
    accountCode: '1340',
    accountName: 'Input Cess',
    accountType: 'asset',
    accountSubType: 'duties_and_taxes',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Input Cess credit',
  },
  {
    accountCode: '1500',
    accountName: 'Property, Plant & Equipment',
    accountType: 'asset',
    accountSubType: 'fixed_asset',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Tangible fixed assets owned by the business',
  },

  // 2000 - LIABILITIES
  {
    accountCode: '2010',
    accountName: 'Accounts Payable (Creditors)',
    accountType: 'liability',
    accountSubType: 'accounts_payable',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'Money owed to suppliers and vendors for goods and services',
  },
  {
    accountCode: '2110',
    accountName: 'Output CGST',
    accountType: 'liability',
    accountSubType: 'duties_and_taxes',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'Central GST collected on sales',
  },
  {
    accountCode: '2120',
    accountName: 'Output SGST',
    accountType: 'liability',
    accountSubType: 'duties_and_taxes',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'State GST collected on sales',
  },
  {
    accountCode: '2130',
    accountName: 'Output IGST',
    accountType: 'liability',
    accountSubType: 'duties_and_taxes',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'Integrated GST collected on inter-state sales',
  },
  {
    accountCode: '2140',
    accountName: 'Output Cess',
    accountType: 'liability',
    accountSubType: 'duties_and_taxes',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'Cess collected on sales',
  },
  {
    accountCode: '2200',
    accountName: 'Short-term Borrowings',
    accountType: 'liability',
    accountSubType: 'current_liability',
    balanceType: 'credit',
    isSystemAccount: false,
    description: 'Bank overdrafts, cash credit, short-term debt',
  },
  {
    accountCode: '2500',
    accountName: 'Long-term Loans',
    accountType: 'liability',
    accountSubType: 'long_term_liability',
    balanceType: 'credit',
    isSystemAccount: false,
    description: 'Term loans and mortgages',
  },

  // 3000 - EQUITY
  {
    accountCode: '3010',
    accountName: "Owner's Capital",
    accountType: 'equity',
    accountSubType: 'owner_equity',
    balanceType: 'credit',
    isSystemAccount: true,
    description: "Capital invested by owner or partners/shareholders",
  },
  {
    accountCode: '3020',
    accountName: 'Retained Earnings',
    accountType: 'equity',
    accountSubType: 'retained_earnings',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'Accumulated profits or losses carried forward from previous years',
  },

  // 4000 - INCOME
  {
    accountCode: '4010',
    accountName: 'Sales Revenue',
    accountType: 'income',
    accountSubType: 'operating_revenue',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'Income from sale of goods and merchandise',
  },
  {
    accountCode: '4020',
    accountName: 'Service Revenue',
    accountType: 'income',
    accountSubType: 'operating_revenue',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'Income from professional and consulting services',
  },
  {
    accountCode: '4090',
    accountName: 'Sales Returns & Allowances',
    accountType: 'income',
    accountSubType: 'sales_returns',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Contra-revenue account for sales returns and credit notes',
  },
  {
    accountCode: '4200',
    accountName: 'Other Income',
    accountType: 'income',
    accountSubType: 'other_income',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'Interest, discounts received, and non-operating income',
  },

  // 5000 - COST OF GOODS SOLD / DIRECT EXPENSES
  {
    accountCode: '5010',
    accountName: 'Purchase Account',
    accountType: 'expense',
    accountSubType: 'cost_of_goods_sold',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Cost of merchandise and raw materials purchased for resale',
  },
  {
    accountCode: '5090',
    accountName: 'Purchase Returns',
    accountType: 'expense',
    accountSubType: 'purchase_returns',
    balanceType: 'credit',
    isSystemAccount: true,
    description: 'Contra-expense account for purchase returns and debit notes',
  },
  {
    accountCode: '5100',
    accountName: 'Direct Labor & Freight Inward',
    accountType: 'expense',
    accountSubType: 'direct_expense',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Direct freight, customs duty, and wages directly attributable to goods',
  },

  // 6000 - OPERATING & INDIRECT EXPENSES
  {
    accountCode: '6010',
    accountName: 'Salaries & Staff Welfare',
    accountType: 'expense',
    accountSubType: 'indirect_expense',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Staff salaries, wages, and employee benefits',
  },
  {
    accountCode: '6020',
    accountName: 'Rent & Office Facility',
    accountType: 'expense',
    accountSubType: 'indirect_expense',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Office, showroom and warehouse rent',
  },
  {
    accountCode: '6030',
    accountName: 'Utilities & Communication',
    accountType: 'expense',
    accountSubType: 'indirect_expense',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Electricity, water, telephone, internet and software subscriptions',
  },
  {
    accountCode: '6040',
    accountName: 'Professional & Legal Fees',
    accountType: 'expense',
    accountSubType: 'indirect_expense',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Auditor, accounting, legal and consulting charges',
  },
  {
    accountCode: '6050',
    accountName: 'General & Administrative Expenses',
    accountType: 'expense',
    accountSubType: 'indirect_expense',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Office supplies, printing, stationery, and miscellaneous expenses',
  },
  {
    accountCode: '6990',
    accountName: 'Round Off Differences',
    accountType: 'expense',
    accountSubType: 'indirect_expense',
    balanceType: 'debit',
    isSystemAccount: true,
    description: 'Fractional rounding differences on invoices and bills',
  },
];

/**
 * Ensure standard Chart of Accounts exists for a tenant
 * Idempotent: creates only missing accounts
 */
export const seedDefaultAccounts = async (tenantId, session = null) => {
  const existingAccounts = await Account.find({ tenantId, isDeleted: false }).session(session).lean();
  const existingCodes = new Set(existingAccounts.map((a) => a.accountCode));

  const accountsToInsert = STANDARD_ACCOUNTS.filter((a) => !existingCodes.has(a.accountCode)).map(
    (acc) => ({
      ...acc,
      tenantId,
      openingBalance: 0,
      isActive: true,
      isDeleted: false,
    })
  );

  if (accountsToInsert.length > 0) {
    if (session) {
      await Account.insertMany(accountsToInsert, { session });
    } else {
      await Account.insertMany(accountsToInsert);
    }
  }

  // Return full map of accounts by accountCode
  const allAccounts = await Account.find({ tenantId, isDeleted: false }).session(session).lean();
  return allAccounts.reduce((map, acc) => {
    map[acc.accountCode] = acc;
    return map;
  }, {});
};

export default {
  STANDARD_ACCOUNTS,
  seedDefaultAccounts,
};
