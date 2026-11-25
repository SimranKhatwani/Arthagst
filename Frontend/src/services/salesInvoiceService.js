import api from './api.js';

/**
 * Sales Invoices API Service
 * Connects directly to Backend /api/sales/invoices
 */

export const getInvoices = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/sales/invoices', { params: query });
  return res.data; // { invoices: [...], pagination: { ... } }
};

export const getInvoiceById = async (id) => {
  const res = await api.get(`/sales/invoices/${id}`);
  return res.data;
};

export const createInvoice = async (data) => {
  const res = await api.post('/sales/invoices', data);
  return res.data;
};

export const updateInvoice = async (id, data) => {
  const res = await api.put(`/sales/invoices/${id}`, data);
  return res.data;
};

export const postInvoice = async (id) => {
  const res = await api.post(`/sales/invoices/${id}/post`);
  return res.data;
};

export const cancelInvoice = async (id, cancellationReason = 'Cancelled by user') => {
  const res = await api.post(`/sales/invoices/${id}/cancel`, { cancellationReason });
  return res.data;
};

export const getInvoicePDF = async (id) => {
  return await api.get(`/sales/invoices/${id}/pdf`);
};

export const createSalesReturn = async (invoiceId, data) => {
  const res = await api.post(`/sales/invoices/${invoiceId}/returns`, data);
  return res.data;
};

export default {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  postInvoice,
  cancelInvoice,
  getInvoicePDF,
  createSalesReturn,
};
