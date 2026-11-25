import api from './api.js';

/**
 * Tenant Profile & Settings API Service
 */

export const getTenantProfile = async () => {
  const res = await api.get('/tenants/me');
  return res.data;
};

export const updateTenantProfile = async (payload) => {
  const res = await api.put('/tenants/me', payload);
  return res.data;
};

export const getSettings = async () => {
  const res = await api.get('/settings');
  return res.data;
};

export const updateSettings = async (payload) => {
  const res = await api.put('/settings', payload);
  return res.data;
};

export default {
  getTenantProfile,
  updateTenantProfile,
  getSettings,
  updateSettings,
};
