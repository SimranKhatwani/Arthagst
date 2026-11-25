import api from './api.js';

/**
 * Super Admin Service
 * Provides complete API integration for ArthaGST Platform SuperAdmin console (/sd)
 */

export const getDashboard = async () => {
  const res = await api.get('/super-admin/dashboard');
  return res.data;
};

export const getTenants = async (params = {}) => {
  const res = await api.get('/super-admin/tenants', { params });
  return res.data;
};

export const getTenantDetails = async (id) => {
  const res = await api.get(`/super-admin/tenants/${id}`);
  return res.data;
};

export const activateTenant = async (id, reason = '') => {
  const res = await api.post(`/super-admin/tenants/${id}/activate`, { reason });
  return res.data;
};

export const suspendTenant = async (id, reason = '') => {
  const res = await api.post(`/super-admin/tenants/${id}/suspend`, { reason });
  return res.data;
};

export const assignSubscription = async (id, data) => {
  const res = await api.post(`/super-admin/tenants/${id}/subscription`, data);
  return res.data;
};

export const getPlans = async (params = {}) => {
  const res = await api.get('/super-admin/plans', { params });
  return res.data;
};

export const createPlan = async (data) => {
  const res = await api.post('/super-admin/plans', data);
  return res.data;
};

export const updatePlan = async (id, data) => {
  const res = await api.put(`/super-admin/plans/${id}`, data);
  return res.data;
};

export const togglePlanStatus = async (id, isActive) => {
  const res = await api.patch(`/super-admin/plans/${id}/status`, { isActive });
  return res.data;
};

export const getUsers = async (params = {}) => {
  const res = await api.get('/super-admin/users', { params });
  return res.data;
};

export const toggleUserStatus = async (id, isActive) => {
  const res = await api.patch(`/super-admin/users/${id}/status`, { isActive });
  return res.data;
};

export const getSubscriptions = async (params = {}) => {
  const res = await api.get('/super-admin/subscriptions', { params });
  return res.data;
};

export const getInvoices = async (params = {}) => {
  const res = await api.get('/super-admin/invoices', { params });
  return res.data;
};

export const getRevenueReport = async (params = {}) => {
  const res = await api.get('/super-admin/reports/revenue', { params });
  return res.data;
};

export const getUsageStatistics = async () => {
  const res = await api.get('/super-admin/reports/usage');
  return res.data;
};

export const getAuditLogs = async (params = {}) => {
  const res = await api.get('/super-admin/audit-logs', { params });
  return res.data;
};

export const getTickets = async (params = {}) => {
  const res = await api.get('/super-admin/tickets', { params });
  return res.data;
};

export const createTicket = async (data) => {
  const res = await api.post('/super-admin/tickets', data);
  return res.data;
};

export const resolveTicket = async (id) => {
  const res = await api.patch(`/super-admin/tickets/${id}/status`, { status: 'Resolved' });
  return res.data;
};

export const updateTicketStatus = async (id, status) => {
  const res = await api.patch(`/super-admin/tickets/${id}/status`, { status });
  return res.data;
};

export const getAnnouncements = async (params = {}) => {
  const res = await api.get('/super-admin/announcements', { params });
  return res.data;
};

export const createAnnouncement = async (data) => {
  const res = await api.post('/super-admin/announcements', data);
  return res.data;
};

export const updateAnnouncementStatus = async (id, status) => {
  const res = await api.patch(`/super-admin/announcements/${id}/status`, { status });
  return res.data;
};

export const getFeatureFlags = async () => {
  const res = await api.get('/super-admin/features');
  return res.data;
};

export const toggleFeatureFlag = async (idOrKey, enabled) => {
  const res = await api.patch(`/super-admin/features/${idOrKey}/toggle`, { enabled });
  return res.data;
};

export const getPlatformSettings = async () => {
  const res = await api.get('/super-admin/settings');
  return res.data;
};

export const updatePlatformSettings = async (data) => {
  const res = await api.put('/super-admin/settings', data);
  return res.data;
};

export default {
  getDashboard,
  getTenants,
  getTenantDetails,
  activateTenant,
  suspendTenant,
  assignSubscription,
  getPlans,
  createPlan,
  updatePlan,
  togglePlanStatus,
  getUsers,
  toggleUserStatus,
  getSubscriptions,
  getInvoices,
  getRevenueReport,
  getUsageStatistics,
  getAuditLogs,
  getTickets,
  createTicket,
  resolveTicket,
  updateTicketStatus,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncementStatus,
  getFeatureFlags,
  toggleFeatureFlag,
  getPlatformSettings,
  updatePlatformSettings,
};
