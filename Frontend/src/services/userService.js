import api from './api.js';

/**
 * Tenant Users & Staff API Service
 * Connects directly to Backend /api/users
 */

export const getUsers = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/users', { params: query });
  return res.data;
};

export const getUserById = async (id) => {
  const res = await api.get(`/users/${id}`);
  return res.data;
};

export const createUser = async (data) => {
  const payload = {
    name: (data.name || '').trim(),
    email: (data.email || '').trim().toLowerCase(),
    phone: data.mobile || data.phone ? String(data.mobile || data.phone).trim() : '',
    role: (data.role || 'Billing Clerk').trim(),
    password: data.password || 'Password@123',
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };

  const res = await api.post('/users', payload);
  return res.data;
};

export const updateUser = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.phone !== undefined || data.mobile !== undefined) {
    payload.phone = String(data.phone || data.mobile || '').trim();
  }
  if (data.role !== undefined) payload.role = data.role.trim();
  if (data.permissions !== undefined) payload.permissions = data.permissions;
  if (data.password) payload.password = data.password;

  const res = await api.patch(`/users/${id}`, payload);
  return res.data;
};

export const updateUserStatus = async (id, isActive) => {
  const res = await api.patch(`/users/${id}/status`, { isActive });
  return res.data;
};

export const deleteUser = async (id) => {
  const res = await api.delete(`/users/${id}`);
  return res.data;
};

export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
};
