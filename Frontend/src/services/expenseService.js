import api from './api.js';

/**
 * Expenses & Categories Service
 * Connects directly to Backend /api/expenses
 */

export const getExpenses = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/expenses', { params: query });
  return res.data; // { expenses: [...], pagination: { ... } }
};

export const getExpenseById = async (id) => {
  const res = await api.get(`/expenses/${id}`);
  return res.data;
};

export const createExpense = async (data) => {
  const res = await api.post('/expenses', data);
  return res.data;
};

export const updateExpense = async (id, data) => {
  const res = await api.put(`/expenses/${id}`, data);
  return res.data;
};

export const cancelExpense = async (id, cancellationReason = 'Cancelled by user') => {
  const res = await api.post(`/expenses/${id}/cancel`, { cancellationReason });
  return res.data;
};

export const deleteExpense = async (id) => {
  const res = await api.delete(`/expenses/${id}`);
  return res.data;
};

// Categories
export const getCategories = async (params = {}) => {
  const res = await api.get('/expenses/categories', { params });
  return res.data; // array of categories
};

export const createCategory = async (data) => {
  const res = await api.post('/expenses/categories', data);
  return res.data;
};

export const updateCategory = async (id, data) => {
  const res = await api.put(`/expenses/categories/${id}`, data);
  return res.data;
};

export const deleteCategory = async (id) => {
  const res = await api.delete(`/expenses/categories/${id}`);
  return res.data;
};

export default {
  getAll: getExpenses,
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  cancelExpense,
  deleteExpense,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
