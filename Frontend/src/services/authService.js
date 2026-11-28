import api, { setToken } from './api.js';

/**
 * Authentication API Service
 * Interacts with actual backend /api/auth and /api/super-admin endpoints
 */

export const login = async ({ tenantCode, email, password }) => {
  const payload = {
    email: email.trim().toLowerCase(),
    password,
  };
  if (tenantCode && tenantCode.trim()) {
    payload.tenantCode = tenantCode.trim().toUpperCase();
  }
  const res = await api.post('/auth/login', payload);
  const data = res.data;
  if (data?.token) {
    setToken(data.token);
  }
  // If backend login payload did not supply complete permissions array,
  // query /api/auth/me using the stored token to get the full Mongoose user profile with permissions
  if (data?.user && (!Array.isArray(data.user.permissions) || data.user.permissions.length === 0)) {
    try {
      const meRes = await getMe();
      if (meRes?.user) {
        data.user = {
          ...data.user,
          ...meRes.user,
        };
      }
      if (meRes?.tenant) {
        data.tenant = {
          ...data.tenant,
          ...meRes.tenant,
        };
      }
    } catch {
      // Continue with whatever data was returned
    }
  }
  return data;
};

export const superAdminLogin = async ({ email, password }) => {
  // Correct backend route is POST /api/super-admin/login
  const res = await api.post('/super-admin/login', {
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
  superAdminLogin,
  register,
  getMe,
  logout,
};
