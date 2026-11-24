import api from './api.js';

/**
 * Authentication API Service
 * Interacts with actual backend /api/auth endpoints
 */

export const login = async ({ tenantCode, email, password }) => {
  const res = await api.post('/auth/login', {
    tenantCode: tenantCode.trim().toUpperCase(),
    email: email.trim().toLowerCase(),
    password,
  });
  return res.data;
};

export const register = async (registrationData) => {
  const res = await api.post('/auth/register', registrationData);
  return res.data;
};

export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } catch {
    // Non-blocking logout call
  }
};

export default {
  login,
  register,
  getMe,
  logout,
};
