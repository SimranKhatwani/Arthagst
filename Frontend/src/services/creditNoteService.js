import api from './api.js';

/**
 * Credit Notes API Service
 * Connects directly to Backend /api/sales/credit-notes
 */

export const getCreditNotes = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/sales/credit-notes', { params: query });
  return res.data; // { creditNotes: [...], pagination: { ... } }
};

export const getCreditNoteById = async (id) => {
  const res = await api.get(`/sales/credit-notes/${id}`);
  return res.data;
};

export const createCreditNote = async (data) => {
  const res = await api.post('/sales/credit-notes', data);
  return res.data;
};

export const postCreditNote = async (id) => {
  const res = await api.post(`/sales/credit-notes/${id}/post`);
  return res.data;
};

export default {
  getCreditNotes,
  getCreditNoteById,
  createCreditNote,
  postCreditNote,
};
