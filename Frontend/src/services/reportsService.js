import api from './api.js';

/**
 * Operational & Financial Reports Service
 * Connects directly to Backend /api/reports
 */

// A. Sales Reports
export const getSalesSummary = async (params = {}) => {
  const res = await api.get('/reports/sales/summary', { params });
  return res.data;
};

export const getSalesRegister = async (params = {}) => {
  const res = await api.get('/reports/sales/register', { params });
  return res.data;
};

export const getSalesByCustomer = async (params = {}) => {
  const res = await api.get('/reports/sales/by-customer', { params });
  return res.data;
};

export const getSalesByProduct = async (params = {}) => {
  const res = await api.get('/reports/sales/by-product', { params });
  return res.data;
};

export const getSalesByStatus = async (params = {}) => {
  const res = await api.get('/reports/sales/by-status', { params });
  return res.data;
};

export const getSalesReturnSummary = async (params = {}) => {
  const res = await api.get('/reports/sales/returns', { params });
  return res.data;
};

// B. Purchase Reports
export const getPurchaseSummary = async (params = {}) => {
  const res = await api.get('/reports/purchases/summary', { params });
  return res.data;
};

export const getPurchaseRegister = async (params = {}) => {
  const res = await api.get('/reports/purchases/register', { params });
  return res.data;
};

export const getPurchaseBySupplier = async (params = {}) => {
  const res = await api.get('/reports/purchases/by-supplier', { params });
  return res.data;
};

export const getPurchaseByProduct = async (params = {}) => {
  const res = await api.get('/reports/purchases/by-product', { params });
  return res.data;
};

export const getPurchaseReturnSummary = async (params = {}) => {
  const res = await api.get('/reports/purchases/returns', { params });
  return res.data;
};

// C. Inventory Reports
export const getCurrentStockReport = async (params = {}) => {
  const res = await api.get('/reports/inventory/current-stock', { params });
  return res.data;
};

export const getLowStockReport = async (params = {}) => {
  const res = await api.get('/reports/inventory/low-stock', { params });
  return res.data;
};

export const getOutOfStockReport = async () => {
  const res = await api.get('/reports/inventory/out-of-stock');
  return res.data;
};

export const getStockValuationReport = async () => {
  const res = await api.get('/reports/inventory/valuation');
  return res.data;
};

export const getStockMovementReport = async (params = {}) => {
  const res = await api.get('/reports/inventory/movements', { params });
  return res.data;
};

export const getWarehouseWiseStockReport = async () => {
  const res = await api.get('/reports/inventory/by-warehouse');
  return res.data;
};

export const getProductWiseStockReport = async (params = {}) => {
  const res = await api.get('/reports/inventory/by-product', { params });
  return res.data;
};

// D. Party Reports
export const getCustomerOutstandingReport = async () => {
  const res = await api.get('/reports/parties/customer-outstanding');
  return res.data;
};

export const getSupplierOutstandingReport = async () => {
  const res = await api.get('/reports/parties/supplier-outstanding');
  return res.data;
};

export const getCustomerLedger = async (partyId, params = {}) => {
  const res = await api.get(`/reports/parties/customer-ledger/${partyId}`, { params });
  return res.data;
};

export const getSupplierLedger = async (partyId, params = {}) => {
  const res = await api.get(`/reports/parties/supplier-ledger/${partyId}`, { params });
  return res.data;
};

export const getPartyTransactionHistory = async (partyId, params = {}) => {
  const res = await api.get(`/reports/parties/history/${partyId}`, { params });
  return res.data;
};

// E. Payment Reports
export const getMoneyInReport = async (params = {}) => {
  const res = await api.get('/reports/payments/money-in', { params });
  return res.data;
};

export const getMoneyOutReport = async (params = {}) => {
  const res = await api.get('/reports/payments/money-out', { params });
  return res.data;
};

export const getPaymentModeSummary = async (params = {}) => {
  const res = await api.get('/reports/payments/by-mode', { params });
  return res.data;
};

export const getUnallocatedPaymentsReport = async () => {
  const res = await api.get('/reports/payments/unallocated');
  return res.data;
};

export const getReceivablesAndPayablesSummary = async () => {
  const res = await api.get('/reports/payments/receivables-payables');
  return res.data;
};

// F. Expense Reports
export const getExpenseSummary = async (params = {}) => {
  const res = await api.get('/reports/expenses/summary', { params });
  return res.data;
};

export const getCategoryWiseExpenseReport = async (params = {}) => {
  const res = await api.get('/reports/expenses/by-category', { params });
  return res.data;
};

export const getMonthlyExpenseReport = async (params = {}) => {
  const res = await api.get('/reports/expenses/monthly', { params });
  return res.data;
};

export default {
  getSalesSummary,
  getSalesRegister,
  getSalesByCustomer,
  getSalesByProduct,
  getSalesByStatus,
  getSalesReturnSummary,
  getPurchaseSummary,
  getPurchaseRegister,
  getPurchaseBySupplier,
  getPurchaseByProduct,
  getPurchaseReturnSummary,
  getCurrentStockReport,
  getLowStockReport,
  getOutOfStockReport,
  getStockValuationReport,
  getStockMovementReport,
  getWarehouseWiseStockReport,
  getProductWiseStockReport,
  getCustomerOutstandingReport,
  getSupplierOutstandingReport,
  getCustomerLedger,
  getSupplierLedger,
  getPartyTransactionHistory,
  getMoneyInReport,
  getMoneyOutReport,
  getPaymentModeSummary,
  getUnallocatedPaymentsReport,
  getReceivablesAndPayablesSummary,
  getExpenseSummary,
  getCategoryWiseExpenseReport,
  getMonthlyExpenseReport,
};
