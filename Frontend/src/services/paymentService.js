import api from './api.js';

/**
 * Payment API Service
 * Connects directly to Backend /api/payments
 */

export const getPayments = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/payments', { params: query });
  return res.data; // { payments: [...], pagination: { ... } }
};

export const getPaymentById = async (id) => {
  const res = await api.get(`/payments/${id}`);
  return res.data;
};

export const createPayment = async (data) => {
  const res = await api.post('/payments', data);
  return res.data;
};

export const cancelPayment = async (id, cancellationReason = 'Cancelled by user') => {
  const res = await api.post(`/payments/${id}/cancel`, { cancellationReason });
  return res.data;
};

export const allocatePayment = async (id, allocations) => {
  const res = await api.post(`/payments/${id}/allocate`, { allocations });
  return res.data;
};

export default {
  getPayments,
  getPaymentById,
  createPayment,
  cancelPayment,
  allocatePayment,
};
