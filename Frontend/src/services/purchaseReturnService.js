import api from './api.js';

/**
 * Purchase Returns / Debit Notes API Service
 * Connects directly to Backend /api/purchases/returns
 */

export const getPurchaseReturns = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/purchases/returns', { params: query });
  return res.data; // { debitNotes: [...], pagination: { ... } }
};

export const getPurchaseReturnById = async (id) => {
  const res = await api.get(`/purchases/returns/${id}`);
  return res.data;
};

export const createPurchaseReturn = async (data) => {
  const res = await api.post('/purchases/returns', data);
  return res.data;
};

export const postDebitNote = async (id) => {
  const res = await api.post(`/purchases/returns/${id}/post`);
  return res.data;
};

export default {
  getPurchaseReturns,
  getPurchaseReturnById,
  createPurchaseReturn,
  postDebitNote,
};
