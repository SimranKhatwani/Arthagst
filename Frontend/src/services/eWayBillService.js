import api from './api.js';

/**
 * E-Way Bill Service
 * Connects directly to Backend /api/e-way-bills
 */

export const getEWayBills = async (params = {}) => {
  const res = await api.get('/e-way-bills', { params });
  return res.data; // { eWayBills: [...], pagination: { ... } }
};

export const getEWayBillById = async (id) => {
  const res = await api.get(`/e-way-bills/${id}`);
  return res.data;
};

export const getEWayBillByInvoiceId = async (salesInvoiceId) => {
  const res = await api.get(`/e-way-bills/invoice/${salesInvoiceId}`);
  return res.data;
};

export const generateEWayBill = async (data) => {
  const res = await api.post('/e-way-bills/generate', data);
  return res.data;
};

export const updateVehicle = async (id, data) => {
  const res = await api.patch(`/e-way-bills/${id}/vehicle`, data);
  return res.data;
};

export const updateTransporter = async (id, data) => {
  const res = await api.patch(`/e-way-bills/${id}/transporter`, data);
  return res.data;
};

export const extendValidity = async (id, data) => {
  const res = await api.post(`/e-way-bills/${id}/extend`, data);
  return res.data;
};

export const cancelEWayBill = async (id, data) => {
  const res = await api.post(`/e-way-bills/${id}/cancel`, data);
  return res.data;
};

export default {
  getEWayBills,
  getEWayBillById,
  getEWayBillByInvoiceId,
  generateEWayBill,
  updateVehicle,
  updateTransporter,
  extendValidity,
  cancelEWayBill,
};
