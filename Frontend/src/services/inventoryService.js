import { round2 } from './calculationService';

export const createStockMovementRecord = ({
  productId,
  productName,
  sku,
  warehouseId = 'wh-1',
  warehouseName = 'Jaipur Main Godown',
  type, // 'Sale' | 'Purchase' | 'Return In' | 'Return Out' | 'Adjustment' | 'Transfer Out' | 'Transfer In' | 'Damaged' | 'Opening'
  qtyChange,
  reference,
  date,
  notes = '',
}) => ({
  id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  productId,
  productName,
  sku,
  warehouseId,
  warehouseName,
  type,
  qtyChange: Number(qtyChange) || 0,
  reference,
  date: date || new Date().toISOString().slice(0, 10),
  notes,
  createdAt: new Date().toISOString(),
});

export const applyProductStockUpdates = (products = [], movements = [], existingMovements = []) => {
  const existingKeys = new Set(
    existingMovements.map((m) => `${m.reference}::${m.productId}::${m.type}`)
  );

  const newMovements = [];
  const deltaByProduct = new Map();

  movements.forEach((m) => {
    const dedupeKey = `${m.reference}::${m.productId}::${m.type}`;
    if (m.reference && existingKeys.has(dedupeKey) && m.type !== 'Adjustment') {
      return;
    }
    const prev = deltaByProduct.get(m.productId) || 0;
    deltaByProduct.set(m.productId, round2(prev + (Number(m.qtyChange) || 0)));
    newMovements.push(m);
  });

  const updatedProducts = products.map((p) => {
    if (!deltaByProduct.has(p.id)) return p;
    const delta = deltaByProduct.get(p.id);
    const nextStock = Math.max(0, round2((Number(p.stock) || 0) + delta));
    return {
      ...p,
      stock: nextStock,
    };
  });

  return {
    updatedProducts,
    addedMovements: newMovements,
  };
};

export const getStockValuationSummary = (products = []) => {
  const active = products.filter((p) => !p.archived);
  const totalUnits = active.reduce((s, p) => s + Math.max(0, Number(p.stock) || 0), 0);
  const costValuation = active.reduce(
    (s, p) => s + Math.max(0, Number(p.stock) || 0) * (Number(p.purchasePrice) || 0),
    0
  );
  const retailValuation = active.reduce(
    (s, p) => s + Math.max(0, Number(p.stock) || 0) * (Number(p.sellingPrice) || 0),
    0
  );
  const lowStock = active.filter((p) => p.stock > 0 && p.stock <= (p.minStock || 5));
  const outOfStock = active.filter((p) => (p.stock || 0) <= 0);

  return {
    totalSkus: active.length,
    totalUnits,
    costValuation: round2(costValuation),
    retailValuation: round2(retailValuation),
    potentialMargin: round2(retailValuation - costValuation),
    lowStock,
    outOfStock,
  };
};
