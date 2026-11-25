import api from './api.js';

/**
 * Product Categories API Service
 * Connects directly to Backend /api/categories
 */

export const getCategories = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/categories', { params: query });
  return res.data; // { categories: [...], pagination: { ... } }
};

export const getCategoryById = async (id) => {
  const res = await api.get(`/categories/${id}`);
  return res.data;
};

export const createCategory = async (data) => {
  const payload = {
    name: (data.name || '').trim(),
    description: (data.description || '').trim(),
    parentCategory: data.parentCategory || null,
    isActive: data.isActive !== false,
  };
  const res = await api.post('/categories', payload);
  return res.data;
};

export const updateCategory = async (id, data) => {
  const payload = {
    name: data.name ? data.name.trim() : undefined,
    description: data.description !== undefined ? data.description.trim() : undefined,
    parentCategory: data.parentCategory !== undefined ? (data.parentCategory || null) : undefined,
    isActive: data.isActive,
  };
  const res = await api.put(`/categories/${id}`, payload);
  return res.data;
};

export const updateCategoryStatus = async (id, isActive) => {
  const res = await api.patch(`/categories/${id}/status`, { isActive });
  return res.data;
};

export const deleteCategory = async (id) => {
  const res = await api.delete(`/categories/${id}`);
  return res.data;
};

export default {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
};
