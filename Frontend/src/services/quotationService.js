import api from './api.js';

/**
 * Quotations API Service
 * Connects directly to Backend /api/sales/quotations
 */

export const getQuotations = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/sales/quotations', { params: query });
  return res.data; // { quotations: [...], pagination: { ... } }
};

export const getQuotationById = async (id) => {
  const res = await api.get(`/sales/quotations/${id}`);
  return res.data;
};

export const createQuotation = async (data) => {
  const res = await api.post('/sales/quotations', data);
  return res.data;
};

export const updateQuotation = async (id, data) => {
  const res = await api.put(`/sales/quotations/${id}`, data);
  return res.data;
};

export const deleteQuotation = async (id) => {
  const res = await api.delete(`/sales/quotations/${id}`);
  return res.data;
};

export const convertQuotationToOrder = async (id) => {
  const res = await api.post(`/sales/quotations/${id}/convert-to-order`);
  return res.data;
};

export const convertQuotationToInvoice = async (id) => {
  const res = await api.post(`/sales/quotations/${id}/convert-to-invoice`);
  return res.data;
};

export default {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToOrder,
  convertQuotationToInvoice,
};
