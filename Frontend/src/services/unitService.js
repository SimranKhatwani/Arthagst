import api from './api.js';

/**
 * Units of Measurement API Service
 * Connects directly to Backend /api/units
 */

export const getUnits = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/units', { params: query });
  return res.data; // { units: [...], pagination: { ... } }
};

export const getUnitById = async (id) => {
  const res = await api.get(`/units/${id}`);
  return res.data;
};

export const createUnit = async (data) => {
  const payload = {
    name: (data.name || '').trim(),
    shortName: (data.shortName || '').trim().toUpperCase(),
    unitType: data.unitType || 'quantity',
    gstUqcCode: (data.gstUqcCode || data.uqc || 'PCS-PIECES').trim().toUpperCase(),
    allowDecimal: data.allowDecimal !== false,
    isActive: data.isActive !== false,
  };
  const res = await api.post('/units', payload);
  return res.data;
};

export const updateUnit = async (id, data) => {
  const payload = { ...data };
  if (payload.uqc && !payload.gstUqcCode) payload.gstUqcCode = payload.uqc;
  if (payload.gstUqcCode) payload.gstUqcCode = payload.gstUqcCode.trim().toUpperCase();
  if (payload.shortName) payload.shortName = payload.shortName.trim().toUpperCase();

  const res = await api.put(`/units/${id}`, payload);
  return res.data;
};

export const updateUnitStatus = async (id, isActive) => {
  const res = await api.patch(`/units/${id}/status`, { isActive });
  return res.data;
};

export const deleteUnit = async (id) => {
  const res = await api.delete(`/units/${id}`);
  return res.data;
};

export default {
  getUnits,
  getUnitById,
  createUnit,
  updateUnit,
  updateUnitStatus,
  deleteUnit,
};
