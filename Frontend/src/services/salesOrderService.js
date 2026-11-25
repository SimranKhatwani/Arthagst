import api from './api.js';

/**
 * Sales Orders API Service
 * Connects directly to Backend /api/sales/orders
 */

export const getSalesOrders = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/sales/orders', { params: query });
  return res.data; // { salesOrders: [...], pagination: { ... } }
};

export const getSalesOrderById = async (id) => {
  const res = await api.get(`/sales/orders/${id}`);
  return res.data;
};

export const createSalesOrder = async (data) => {
  const res = await api.post('/sales/orders', data);
  return res.data;
};

export const updateSalesOrder = async (id, data) => {
  const res = await api.put(`/sales/orders/${id}`, data);
  return res.data;
};

export const cancelSalesOrder = async (id) => {
  const res = await api.post(`/sales/orders/${id}/cancel`);
  return res.data;
};

export const convertOrderToInvoice = async (id) => {
  const res = await api.post(`/sales/orders/${id}/convert-to-invoice`);
  return res.data;
};

export default {
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrder,
  cancelSalesOrder,
  convertOrderToInvoice,
};
