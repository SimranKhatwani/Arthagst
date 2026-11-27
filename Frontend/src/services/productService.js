import api from './api.js';

/**
 * Products & SKUs API Service
 * Connects directly to Backend /api/products
 */

export const getProducts = async (params = {}) => {
  const query = {
    limit: 100,
    ...params,
  };
  const res = await api.get('/products', { params: query });
  return res.data; // { products: [...], pagination: { ... } }
};

export const getProductById = async (id) => {
  const res = await api.get(`/products/${id}`);
  return res.data;
};

export const createProduct = async (data) => {
  const qty = Number(data.stock !== undefined ? data.stock : (data.openingStock !== undefined ? data.openingStock : 0)) || 0;
  const payload = {
    name: (data.name || '').trim(),
    productType: data.productType || 'goods',
    categoryId: data.categoryId || null,
    unitId: data.unitId,
    SKU: (data.SKU || data.sku || '').trim().toUpperCase(),
    barcode: data.barcode && data.barcode.trim() ? data.barcode.trim() : null,
    description: (data.description || '').trim(),
    HSN: data.HSN || data.hsn ? (data.HSN || data.hsn).trim() : null,
    SAC: data.SAC || data.sac ? (data.SAC || data.sac).trim() : null,
    gstRate: Number(data.gstRate) || 0,
    cessRate: Number(data.cessRate) || 0,
    purchasePrice: Number(data.purchasePrice) || 0,
    sellingPrice: Number(data.sellingPrice) || 0,
    mrp: Number(data.mrp) || 0,
    openingStock: qty,
    stock: qty,
    lowStockAlert: Number(data.lowStockAlert || data.minStock) || 0,
    trackInventory: data.trackInventory !== false,
    isActive: data.isActive !== false && !data.archived,
  };

  const res = await api.post('/products', payload);
  return res.data;
};

export const updateProduct = async (id, data) => {
  const payload = { ...data };
  const cleanSKU = (payload.sku || payload.SKU || '').trim().toUpperCase();
  if (cleanSKU) {
    payload.SKU = cleanSKU;
    payload.sku = cleanSKU;
  }
  const cleanHSN = (payload.hsn || payload.HSN || '').trim();
  if (cleanHSN) {
    payload.HSN = cleanHSN;
    payload.hsn = cleanHSN;
  }
  if (payload.stock !== undefined || payload.openingStock !== undefined) {
    const qty = Number(payload.stock !== undefined ? payload.stock : payload.openingStock) || 0;
    payload.stock = qty;
    payload.openingStock = qty;
  }
  if (payload.minStock && !payload.lowStockAlert) payload.lowStockAlert = payload.minStock;
  if (payload.barcode === '') payload.barcode = null;
  if (payload.HSN === '') payload.HSN = null;
  if (payload.SAC === '') payload.SAC = null;
  if (payload.categoryId === '') payload.categoryId = null;

  const res = await api.put(`/products/${id}`, payload);
  return res.data;
};

export const updateProductStatus = async (id, isActive) => {
  const res = await api.patch(`/products/${id}/status`, { isActive });
  return res.data;
};

export const deleteProduct = async (id) => {
  const res = await api.delete(`/products/${id}`);
  return res.data;
};

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
};
