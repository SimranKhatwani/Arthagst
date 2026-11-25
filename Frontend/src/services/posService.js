import api from './api.js';

/**
 * POS (Point of Sale) Service
 * Connects directly to Backend /api/pos
 */

export const getProducts = async (params = {}) => {
  const res = await api.get('/pos/products', { params });
  return res.data;
};

export const getCustomers = async (params = {}) => {
  const res = await api.get('/pos/customers', { params });
  return res.data;
};

export const createBill = async (data) => {
  const res = await api.post('/pos/bills', data);
  return res.data;
};

export const getBills = async (params = {}) => {
  const res = await api.get('/pos/bills', { params });
  return res.data;
};

export const getBillById = async (id) => {
  const res = await api.get(`/pos/bills/${id}`);
  return res.data;
};

export const finalizeBill = async (id, data = {}) => {
  const res = await api.post(`/pos/bills/${id}/finalize`, data);
  return res.data;
};

export const cancelBill = async (id, cancellationReason = 'Cancelled by cashier') => {
  const res = await api.post(`/pos/bills/${id}/cancel`, { cancellationReason });
  return res.data;
};

export const getReceipt = async (id) => {
  const res = await api.get(`/pos/bills/${id}/receipt`);
  return res.data;
};

export const getDailySummary = async (params = {}) => {
  const res = await api.get('/pos/daily-summary', { params });
  return res.data;
};

export const getCashierSummary = async (params = {}) => {
  const res = await api.get('/pos/cashier-summary', { params });
  return res.data;
};

export default {
  getProducts,
  getCustomers,
  createBill,
  getBills,
  getBillById,
  finalizeBill,
  cancelBill,
  getReceipt,
  getDailySummary,
  getCashierSummary,
};
