import api from './api.js';

/**
 * Parties API Service (Customers & Suppliers)
 * Connects directly to Backend /api/parties
 */

export const getParties = async (params = {}) => {
  const query = {
    limit: 100, // Fetch up to 100 by default for client-side table filtering
    ...params,
  };
  const res = await api.get('/parties', { params: query });
  return res.data; // { parties: [...], pagination: { ... } }
};

export const getPartyById = async (id) => {
  const res = await api.get(`/parties/${id}`);
  return res.data;
};

export const createParty = async (data) => {
  const payload = {
    partyType: data.partyType || 'customer',
    name: (data.name || '').trim(),
    businessName: (data.businessName || '').trim(),
    phone: (data.phone || data.mobile || '').trim(),
    alternatePhone: (data.alternatePhone || '').trim(),
    email: data.email && data.email.trim() ? data.email.trim() : null,
    GSTIN: data.GSTIN || data.gstin ? (data.GSTIN || data.gstin).trim().toUpperCase() : null,
    PAN: data.PAN || data.pan ? (data.PAN || data.pan).trim().toUpperCase() : null,
    billingAddress: (data.billingAddress || data.address || '').trim(),
    shippingAddress: (data.shippingAddress || data.billingAddress || data.address || '').trim(),
    city: (data.city || '').trim(),
    state: data.state || 'Rajasthan',
    stateCode: data.stateCode || '',
    pincode: (data.pincode || '').trim(),
    country: data.country || 'India',
    openingBalance: Number(data.openingBalance) || 0,
    balanceType: data.balanceType || (data.partyType === 'supplier' ? 'payable' : 'receivable'),
    creditLimit: Number(data.creditLimit) || 0,
    paymentTerms: data.paymentTerms || 'Net 15',
    notes: (data.notes || '').trim(),
    isActive: data.isActive !== false && data.status !== 'Inactive' && data.status !== 'Archived',
  };

  const res = await api.post('/parties', payload);
  return res.data;
};

export const updateParty = async (id, data) => {
  const payload = { ...data };
  if (payload.mobile && !payload.phone) payload.phone = payload.mobile;
  if (payload.gstin && !payload.GSTIN) payload.GSTIN = payload.gstin;
  if (payload.pan && !payload.PAN) payload.PAN = payload.pan;
  if (payload.GSTIN) payload.GSTIN = payload.GSTIN.trim().toUpperCase();
  if (payload.PAN) payload.PAN = payload.PAN.trim().toUpperCase();
  if (payload.email === '') payload.email = null;
  if (payload.GSTIN === '') payload.GSTIN = null;
  if (payload.PAN === '') payload.PAN = null;

  const res = await api.put(`/parties/${id}`, payload);
  return res.data;
};

export const updatePartyStatus = async (id, isActive) => {
  const res = await api.patch(`/parties/${id}/status`, { isActive });
  return res.data;
};

export const deleteParty = async (id) => {
  const res = await api.delete(`/parties/${id}`);
  return res.data;
};

export default {
  getParties,
  getPartyById,
  createParty,
  updateParty,
  updatePartyStatus,
  deleteParty,
};
