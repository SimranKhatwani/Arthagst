import api from './api.js';

/**
 * Purchase Bills API Service
 * Connects directly to Backend /api/purchases/bills
 */

export const getPurchaseBills = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/purchases/bills', { params: query });
  return res.data; // { bills: [...], pagination: { ... } }
};

export const getPurchaseBillById = async (id) => {
  const res = await api.get(`/purchases/bills/${id}`);
  return res.data;
};

export const createPurchaseBill = async (data) => {
  const res = await api.post('/purchases/bills', data);
  return res.data;
};

export const updatePurchaseBill = async (id, data) => {
  const res = await api.put(`/purchases/bills/${id}`, data);
  return res.data;
};

export const postPurchaseBill = async (id) => {
  const res = await api.post(`/purchases/bills/${id}/post`);
  return res.data;
};

export const cancelPurchaseBill = async (id) => {
  const res = await api.post(`/purchases/bills/${id}/cancel`);
  return res.data;
};

export default {
  getPurchaseBills,
  getPurchaseBillById,
  createPurchaseBill,
  updatePurchaseBill,
  postPurchaseBill,
  cancelPurchaseBill,
};
