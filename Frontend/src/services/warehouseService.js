import api from './api.js';

/**
 * Warehouses & Godowns API Service
 * Connects directly to Backend /api/warehouses
 */

export const getWarehouses = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/warehouses', { params: query });
  return res.data; // { warehouses: [...], pagination: { ... } }
};

export const getWarehouseById = async (id) => {
  const res = await api.get(`/warehouses/${id}`);
  return res.data;
};

export const createWarehouse = async (data) => {
  const payload = {
    warehouseName: (data.warehouseName || data.name || '').trim(),
    warehouseCode: (data.warehouseCode || data.code || '').trim().toUpperCase(),
    address: (data.address || '').trim(),
    city: (data.city || '').trim(),
    state: (data.state || '').trim(),
    pincode: (data.pincode || '').trim(),
    manager: (data.manager || '').trim(),
    capacity: (data.capacity || '').trim(),
    isDefault: Boolean(data.isDefault),
    isActive: data.isActive !== false,
  };

  const res = await api.post('/warehouses', payload);
  return res.data;
};

export const updateWarehouse = async (id, data) => {
  const payload = { ...data };
  if (payload.name && !payload.warehouseName) payload.warehouseName = payload.name;
  if (payload.code && !payload.warehouseCode) payload.warehouseCode = payload.code;
  if (payload.warehouseCode) payload.warehouseCode = payload.warehouseCode.trim().toUpperCase();
  if (payload.manager !== undefined) payload.manager = (payload.manager || '').trim();
  if (payload.capacity !== undefined) payload.capacity = (payload.capacity || '').trim();

  const res = await api.put(`/warehouses/${id}`, payload);
  return res.data;
};

export const updateWarehouseStatus = async (id, isActive) => {
  const res = await api.patch(`/warehouses/${id}/status`, { isActive });
  return res.data;
};

export const deleteWarehouse = async (id) => {
  const res = await api.delete(`/warehouses/${id}`);
  return res.data;
};

export default {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  updateWarehouseStatus,
  deleteWarehouse,
};
