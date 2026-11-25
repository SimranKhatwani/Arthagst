import api from './api.js';

/**
 * E-Invoice (IRN) Service
 * Connects directly to Backend /api/e-invoices
 */

export const getEInvoices = async (params = {}) => {
  const res = await api.get('/e-invoices', { params });
  return res.data; // { eInvoices: [...], pagination: { ... } }
};

export const getEInvoiceById = async (id) => {
  const res = await api.get(`/e-invoices/${id}`);
  return res.data;
};

export const getEInvoiceByInvoiceId = async (salesInvoiceId) => {
  const res = await api.get(`/e-invoices/invoice/${salesInvoiceId}`);
  return res.data;
};

export const checkEligibility = async (salesInvoiceId) => {
  const res = await api.get(`/e-invoices/invoice/${salesInvoiceId}/eligibility`);
  return res.data; // { isEligible, reasons, invoice, tenant, existingEInvoice }
};

export const generateEInvoice = async (data) => {
  const res = await api.post('/e-invoices/generate', data);
  return res.data;
};

export const cancelEInvoice = async (id, data) => {
  const res = await api.post(`/e-invoices/${id}/cancel`, data);
  return res.data;
};

export default {
  getEInvoices,
  getEInvoiceById,
  getEInvoiceByInvoiceId,
  checkEligibility,
  generateEInvoice,
  cancelEInvoice,
};
