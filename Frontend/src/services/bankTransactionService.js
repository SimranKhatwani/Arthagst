import api from './api.js';

/**
 * Bank Transactions & Contra Transfers Service
 * Connects directly to Backend /api/banking/transfers and /api/banking/transactions
 */

export const transferFunds = async (data) => {
  const res = await api.post('/banking/transfers', data);
  return res.data;
};

export const createTransaction = async (data) => {
  const res = await api.post('/banking/transactions', data);
  return res.data;
};

export const getTransactions = async (params = {}) => {
  const res = await api.get('/banking/transactions', { params });
  return res.data; // { transactions: [...], pagination: { ... } }
};

export default {
  transferFunds,
  createTransaction,
  getTransactions,
};
