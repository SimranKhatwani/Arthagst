import api from './api.js';

/**
 * Delivery Challans API Service
 * Connects directly to Backend /api/sales/challans
 */

export const getDeliveryChallans = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/sales/challans', { params: query });
  return res.data; // { deliveryChallans: [...], pagination: { ... } }
};

export const getDeliveryChallanById = async (id) => {
  const res = await api.get(`/sales/challans/${id}`);
  return res.data;
};

export const createDeliveryChallan = async (data) => {
  const res = await api.post('/sales/challans', data);
  return res.data;
};

export const updateDeliveryChallan = async (id, data) => {
  const res = await api.put(`/sales/challans/${id}`, data);
  return res.data;
};

export const convertChallanToInvoice = async (id) => {
  const res = await api.post(`/sales/challans/${id}/convert-to-invoice`);
  return res.data;
};

export default {
  getDeliveryChallans,
  getDeliveryChallanById,
  createDeliveryChallan,
  updateDeliveryChallan,
  convertChallanToInvoice,
};
