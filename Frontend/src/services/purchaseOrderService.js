import api from './api.js';

/**
 * Purchase Orders API Service
 * Connects directly to Backend /api/purchases/orders
 */

export const getPurchaseOrders = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/purchases/orders', { params: query });
  return res.data; // { purchaseOrders: [...], pagination: { ... } }
};

export const getPurchaseOrderById = async (id) => {
  const res = await api.get(`/purchases/orders/${id}`);
  return res.data;
};

export const createPurchaseOrder = async (data) => {
  const res = await api.post('/purchases/orders', data);
  return res.data;
};

export const updatePurchaseOrder = async (id, data) => {
  const res = await api.put(`/purchases/orders/${id}`, data);
  return res.data;
};

export const approvePurchaseOrder = async (id) => {
  const res = await api.post(`/purchases/orders/${id}/approve`);
  return res.data;
};

export const cancelPurchaseOrder = async (id) => {
  const res = await api.post(`/purchases/orders/${id}/cancel`);
  return res.data;
};

export default {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
};
