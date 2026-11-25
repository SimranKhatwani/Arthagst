import api from './api.js';

/**
 * Goods Receipt Notes (GRN) API Service
 * Connects directly to Backend /api/purchases/grn
 */

export const getGRNs = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/purchases/grn', { params: query });
  return res.data; // { grns: [...], pagination: { ... } }
};

export const getGRNById = async (id) => {
  const res = await api.get(`/purchases/grn/${id}`);
  return res.data;
};

export const createGRN = async (data) => {
  const res = await api.post('/purchases/grn', data);
  return res.data;
};

export const postGRN = async (id) => {
  const res = await api.post(`/purchases/grn/${id}/post`);
  return res.data;
};

export const cancelGRN = async (id) => {
  const res = await api.post(`/purchases/grn/${id}/cancel`);
  return res.data;
};

export default {
  getGRNs,
  getGRNById,
  createGRN,
  postGRN,
  cancelGRN,
};
