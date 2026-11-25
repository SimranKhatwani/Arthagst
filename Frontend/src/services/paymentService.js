import api from './api.js';

/**
 * Payment API Service
 * Connects directly to Backend /api/payment
 */

export const getPayments = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/payment', { params: query });
  return res.data; // { payments: [...], pagination: { ... } }
};

export const getPaymentById = async (id) => {
  const res = await api.get(`/payment/${id}`);
  return res.data;
};

export const createPayment = async (data) => {
  const res = await api.post('/payment', data);
  return res.data;
};

export const cancelPayment = async (id, cancellationReason = 'Cancelled by user') => {
  const res = await api.post(`/payment/${id}/cancel`, { cancellationReason });
  return res.data;
};

export default {
  getPayments,
  getPaymentById,
  createPayment,
  cancelPayment,
};
