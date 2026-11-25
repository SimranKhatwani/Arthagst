import api from './api.js';

/**
 * Bank Accounts Service
 * Connects directly to Backend /api/banking/accounts
 */

export const getBankAccounts = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/banking/accounts', { params: query });
  return res.data; // { accounts: [...], pagination: { ... } }
};

export const getBankAccountById = async (id) => {
  const res = await api.get(`/banking/accounts/${id}`);
  return res.data;
};

export const createBankAccount = async (data) => {
  const res = await api.post('/banking/accounts', data);
  return res.data;
};

export const updateBankAccount = async (id, data) => {
  const res = await api.put(`/banking/accounts/${id}`, data);
  return res.data;
};

export const updateBankAccountStatus = async (id, isActive) => {
  const res = await api.patch(`/banking/accounts/${id}/status`, { isActive });
  return res.data;
};

export const deleteBankAccount = async (id) => {
  const res = await api.delete(`/banking/accounts/${id}`);
  return res.data;
};

export default {
  getAll: getBankAccounts,
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  updateBankAccountStatus,
  deleteBankAccount,
};
