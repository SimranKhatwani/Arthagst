import mongoose from 'mongoose';
import PurchaseOrder from '../models/purchaseOrder.model.js';
import GRN from '../models/grn.model.js';
import PurchaseBill from '../models/purchaseBill.model.js';
import DebitNote from '../models/debitNote.model.js';
import Party from '../models/party.model.js';
import Warehouse from '../models/warehouse.model.js';
import Product from '../models/product.model.js';
import Tenant from '../models/tenant.model.js';
import Inventory from '../models/inventory.model.js';
import StockMovement from '../models/stockMovement.model.js';
import purchasesCalculator from './purchases.calculator.js';
import {
  postPurchaseBillJournal,
  reversePurchaseBillJournal,
  postDebitNoteJournal,
} from './accounting.integration.js';
import * as notificationService from './notification.service.js';
import * as auditLogService from './auditLog.service.js';

/**
 * Transaction helper with retry on write conflicts
 */
const runTransaction = async (operation, maxRetries = 10) => {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        session.startTransaction();
        const result = await operation(session);
        await session.commitTransaction();
        return result;
      } catch (error) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        const isTransient =
          error.hasErrorLabel?.('TransientTransactionError') ||
          error.code === 112 ||
          error.codeName === 'WriteConflict';

        if (isTransient && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 40 * attempt + Math.random() * 40));
          continue;
        }
        throw error;
      }
    }
  } finally {
    session.endSession();
  }
};

/**
 * Validate Supplier, Warehouse, and Products for a purchase document
 */
const validatePurchaseContext = async (
  tenantId,
  { supplierId, warehouseId, placeOfSupply, items, paidAmount = 0 },
  session = null
) => {
  if (!mongoose.isValidObjectId(supplierId)) {
    const error = new Error('Invalid supplier ID format');
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.isValidObjectId(warehouseId)) {
    const error = new Error('Invalid warehouse ID format');
    error.statusCode = 400;
    throw error;
  }

  // 1. Validate Tenant
  const tenantQuery = Tenant.findById(tenantId);
  if (session) tenantQuery.session(session);
  const tenant = await tenantQuery;
  if (!tenant) {
    const error = new Error('Tenant organization not found');
    error.statusCode = 404;
    throw error;
  }

  // 2. Validate Supplier Party
  const partyQuery = Party.findOne({
    _id: supplierId,
    tenantId,
    isDeleted: false,
  });
  if (session) partyQuery.session(session);
  const party = await partyQuery;

  if (!party) {
    const error = new Error('Supplier party not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  if (!party.isActive) {
    const error = new Error(`Supplier '${party.name}' is currently inactive`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate Warehouse
  const warehouseQuery = Warehouse.findOne({
    _id: warehouseId,
    tenantId,
    isDeleted: false,
  });
  if (session) warehouseQuery.session(session);
  const warehouse = await warehouseQuery;

  if (!warehouse) {
    const error = new Error('Warehouse not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  if (!warehouse.isActive) {
    const error = new Error(`Warehouse '${warehouse.warehouseName}' is currently inactive`);
    error.statusCode = 400;
    throw error;
  }

  // Place of Supply is destination warehouse/tenant location
  const supplierStateCode = party.stateCode || (party.GSTIN ? party.GSTIN.substring(0, 2) : '27');
  const resolvedPOS =
    placeOfSupply ||
    warehouse.state ||
    warehouse.city ||
    tenant.stateCode ||
    '27';

  // 4. Validate and snapshot each line item
  const resolvedItems = [];
  for (const rawItem of items) {
    if (!mongoose.isValidObjectId(rawItem.productId)) {
      const error = new Error(`Invalid product ID format: ${rawItem.productId}`);
      error.statusCode = 400;
      throw error;
    }

    const prodQuery = Product.findOne({
      _id: rawItem.productId,
      tenantId,
      isDeleted: false,
    }).populate('unitId', 'name shortName');
    if (session) prodQuery.session(session);
    const product = await prodQuery;

    if (!product) {
      const error = new Error(`Product not found in your organization: ${rawItem.productId}`);
      error.statusCode = 404;
      throw error;
    }

    if (!product.isActive) {
      const error = new Error(`Product '${product.name}' is inactive and cannot be ordered`);
      error.statusCode = 400;
      throw error;
    }

    const unitPrice =
      rawItem.unitPrice !== undefined
        ? Number(rawItem.unitPrice)
        : product.purchasePrice || 0;
    const discount = Number(rawItem.discount) || 0;

    resolvedItems.push({
      productId: product._id,
      productName: product.name,
      description: rawItem.description || product.description || '',
      HSN: product.HSN || '',
      SAC: product.SAC || '',
      quantity: Number(rawItem.quantity),
      unitId: product.unitId?._id || null,
      unitName: product.unitId?.shortName || product.unitId?.name || 'PCS',
      unitPrice,
      discount,
      gstRate: product.gstRate,
      cessRate: product.cessRate,
      productType: product.productType,
      trackInventory: product.trackInventory,
    });
  }

  // 5. Compute GST, taxes, and totals
  const calculation = purchasesCalculator.calculatePurchaseDocument({
    supplierStateCode,
    placeOfSupply: resolvedPOS,
    items: resolvedItems,
    paidAmount,
  });

  return {
    tenant,
    party,
    warehouse,
    calculation,
    resolvedPOS,
  };
};

/**
 * ========================================================
 * 1. PURCHASE ORDERS
 * ========================================================
 */
export const createPurchaseOrder = async (tenantId, userId, data) => {
  const { party, warehouse, calculation, resolvedPOS } = await validatePurchaseContext(tenantId, {
    supplierId: data.partyId,
    warehouseId: data.warehouseId,
    placeOfSupply: data.placeOfSupply,
    items: data.items,
  });

  const orderDate = data.orderDate ? new Date(data.orderDate) : new Date();
  const { documentNumber, financialYear } = await purchasesCalculator.generatePurchaseDocumentNumber(
    tenantId,
    'purchase_order',
    orderDate
  );

  const po = new PurchaseOrder({
    tenantId,
    purchaseOrderNumber: documentNumber,
    financialYear,
    partyId: party._id,
    partyName: party.name,
    partyGSTIN: party.GSTIN || null,
    partyPAN: party.PAN || null,
    warehouseId: warehouse._id,
    warehouseName: warehouse.warehouseName,
    orderDate,
    expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
    placeOfSupply: resolvedPOS,
    placeOfSupplyCode: calculation.placeOfSupplyCode,
    supplierStateCode: calculation.supplierStateCode,
    isInterState: calculation.isInterState,
    items: calculation.items,
    subtotal: calculation.subtotal,
    discountTotal: calculation.discountTotal,
    taxableAmount: calculation.taxableAmount,
    cgstTotal: calculation.cgstTotal,
    sgstTotal: calculation.sgstTotal,
    igstTotal: calculation.igstTotal,
    cessTotal: calculation.cessTotal,
    roundOff: calculation.roundOff,
    grandTotal: calculation.grandTotal,
    status: 'draft',
    notes: data.notes || '',
    createdBy: userId,
  });

  await po.save();
  return po;
};

export const getPurchaseOrders = async (tenantId, options = {}) => {
  const { page = 1, limit = 10, search, partyId, status } = options;
  const query = { tenantId };

  if (partyId && mongoose.isValidObjectId(partyId)) query.partyId = partyId;
  if (status) query.status = status;

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ purchaseOrderNumber: searchRegex }, { partyName: searchRegex }];
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    PurchaseOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    PurchaseOrder.countDocuments(query),
  ]);

  return {
    orders,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
};

export const getPurchaseOrderById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid purchase order ID');
    error.statusCode = 400;
    throw error;
  }

  const po = await PurchaseOrder.findOne({ _id: id, tenantId })
    .populate('partyId', 'name phone email GSTIN PAN')
    .populate('warehouseId', 'warehouseName warehouseCode city state');

  if (!po) {
    const error = new Error('Purchase order not found');
    error.statusCode = 404;
    throw error;
  }

  return po;
};

export const updatePurchaseOrder = async (tenantId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid purchase order ID');
    error.statusCode = 400;
    throw error;
  }

  const po = await PurchaseOrder.findOne({ _id: id, tenantId });
  if (!po) {
    const error = new Error('Purchase order not found');
    error.statusCode = 404;
    throw error;
  }

  if (po.status !== 'draft') {
    const error = new Error(`Cannot modify a ${po.status} purchase order. Only draft orders can be updated.`);
    error.statusCode = 400;
    throw error;
  }

  const { party, warehouse, calculation, resolvedPOS } = await validatePurchaseContext(tenantId, {
    supplierId: data.partyId || po.partyId,
    warehouseId: data.warehouseId || po.warehouseId,
    placeOfSupply: data.placeOfSupply || po.placeOfSupply,
    items: data.items || po.items,
  });

  po.partyId = party._id;
  po.partyName = party.name;
  po.partyGSTIN = party.GSTIN || null;
  po.partyPAN = party.PAN || null;
  po.warehouseId = warehouse._id;
  po.warehouseName = warehouse.warehouseName;
  if (data.orderDate) po.orderDate = new Date(data.orderDate);
  if (data.expectedDeliveryDate !== undefined)
    po.expectedDeliveryDate = data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null;
  po.placeOfSupply = resolvedPOS;
  po.placeOfSupplyCode = calculation.placeOfSupplyCode;
  po.supplierStateCode = calculation.supplierStateCode;
  po.isInterState = calculation.isInterState;
  po.items = calculation.items;
  po.subtotal = calculation.subtotal;
  po.discountTotal = calculation.discountTotal;
  po.taxableAmount = calculation.taxableAmount;
  po.cgstTotal = calculation.cgstTotal;
  po.sgstTotal = calculation.sgstTotal;
  po.igstTotal = calculation.igstTotal;
  po.cessTotal = calculation.cessTotal;
  po.roundOff = calculation.roundOff;
  po.grandTotal = calculation.grandTotal;
  if (data.notes !== undefined) po.notes = data.notes;

  await po.save();
  return po;
};

export const approvePurchaseOrder = async (tenantId, id) => {
  const po = await PurchaseOrder.findOne({ _id: id, tenantId });
  if (!po) {
    const error = new Error('Purchase order not found');
    error.statusCode = 404;
    throw error;
  }

  if (po.status !== 'draft') {
    const error = new Error(`Cannot approve purchase order with status '${po.status}'`);
    error.statusCode = 400;
    throw error;
  }

  po.status = 'approved';
  await po.save();
  return po;
};

export const cancelPurchaseOrder = async (tenantId, id) => {
  const po = await PurchaseOrder.findOne({ _id: id, tenantId });
  if (!po) {
    const error = new Error('Purchase order not found');
    error.statusCode = 404;
    throw error;
  }

  if (['received', 'cancelled'].includes(po.status)) {
    const error = new Error(`Cannot cancel a purchase order with status '${po.status}'`);
    error.statusCode = 400;
    throw error;
  }

  po.status = 'cancelled';
  await po.save();
  return po;
};

/**
 * ========================================================
 * 2. GOODS RECEIPT NOTES (GRN)
 * ========================================================
 */
export const createGRN = async (tenantId, userId, data) => {
  if (!mongoose.isValidObjectId(data.supplierId)) {
    const error = new Error('Invalid supplier ID format');
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.isValidObjectId(data.warehouseId)) {
    const error = new Error('Invalid warehouse ID format');
    error.statusCode = 400;
    throw error;
  }

  const supplier = await Party.findOne({ _id: data.supplierId, tenantId, isDeleted: false });
  if (!supplier) {
    const error = new Error('Supplier not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  const warehouse = await Warehouse.findOne({ _id: data.warehouseId, tenantId, isDeleted: false });
  if (!warehouse) {
    const error = new Error('Warehouse not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  let po = null;
  if (data.purchaseOrderId) {
    if (!mongoose.isValidObjectId(data.purchaseOrderId)) {
      const error = new Error('Invalid purchase order ID format');
      error.statusCode = 400;
      throw error;
    }

    po = await PurchaseOrder.findOne({ _id: data.purchaseOrderId, tenantId });
    if (!po) {
      const error = new Error('Linked purchase order not found');
      error.statusCode = 404;
      throw error;
    }

    if (['draft', 'cancelled'].includes(po.status)) {
      const error = new Error(`Cannot receive goods for a purchase order with status '${po.status}'`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Validate items
  const resolvedItems = [];
  for (const rawItem of data.items) {
    const product = await Product.findOne({
      _id: rawItem.productId,
      tenantId,
      isDeleted: false,
    }).populate('unitId', 'name shortName');

    if (!product) {
      const error = new Error(`Product not found: ${rawItem.productId}`);
      error.statusCode = 404;
      throw error;
    }

    let orderedQty = 0;
    if (po) {
      const poLine = po.items.find((item) => item.productId.equals(product._id));
      if (poLine) {
        orderedQty = poLine.quantity;
        const remainingToReceive = poLine.quantity - (poLine.receivedQuantity || 0);
        if (rawItem.receivedQuantity > remainingToReceive) {
          const error = new Error(
            `Received quantity (${rawItem.receivedQuantity}) exceeds remaining ordered quantity (${remainingToReceive}) for item '${product.name}'.`
          );
          error.statusCode = 400;
          throw error;
        }
      }
    }

    resolvedItems.push({
      productId: product._id,
      productName: product.name,
      orderedQuantity: orderedQty,
      receivedQuantity: rawItem.receivedQuantity,
      acceptedQuantity: rawItem.acceptedQuantity,
      rejectedQuantity: rawItem.rejectedQuantity || 0,
      unitId: product.unitId?._id || null,
      unitName: product.unitId?.shortName || 'PCS',
      unitPrice: product.purchasePrice || 0,
      remarks: rawItem.remarks || '',
    });
  }

  const receiptDate = data.receiptDate ? new Date(data.receiptDate) : new Date();
  const { documentNumber, financialYear } = await purchasesCalculator.generatePurchaseDocumentNumber(
    tenantId,
    'grn',
    receiptDate
  );

  const grn = new GRN({
    tenantId,
    grnNumber: documentNumber,
    financialYear,
    purchaseOrderId: po ? po._id : null,
    supplierId: supplier._id,
    supplierName: supplier.name,
    supplierGSTIN: supplier.GSTIN || null,
    warehouseId: warehouse._id,
    warehouseName: warehouse.warehouseName,
    receiptDate,
    supplierChallanNumber: data.supplierChallanNumber || '',
    items: resolvedItems,
    receivedBy: data.receivedBy || '',
    status: 'draft',
    stockUpdated: false,
    remarks: data.remarks || '',
    createdBy: userId,
  });

  await grn.save();
  return grn;
};

export const getGRNs = async (tenantId, options = {}) => {
  const { page = 1, limit = 10, search, supplierId, warehouseId, status } = options;
  const query = { tenantId };

  if (supplierId && mongoose.isValidObjectId(supplierId)) query.supplierId = supplierId;
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) query.warehouseId = warehouseId;
  if (status) query.status = status;

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ grnNumber: searchRegex }, { supplierName: searchRegex }];
  }

  const skip = (page - 1) * limit;
  const [grns, total] = await Promise.all([
    GRN.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    GRN.countDocuments(query),
  ]);

  return {
    grns,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
};

export const getGRNById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid GRN ID format');
    error.statusCode = 400;
    throw error;
  }

  const grn = await GRN.findOne({ _id: id, tenantId })
    .populate('supplierId', 'name phone email GSTIN')
    .populate('warehouseId', 'warehouseName warehouseCode city state');

  if (!grn) {
    const error = new Error('GRN not found');
    error.statusCode = 404;
    throw error;
  }

  return grn;
};

/**
 * Post GRN: Updates warehouse inventory and logs append-only purchase movement atomically
 */
export const postGRN = async (tenantId, userId, grnId) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(grnId)) {
      const error = new Error('Invalid GRN ID format');
      error.statusCode = 400;
      throw error;
    }

    const grn = await GRN.findOne({ _id: grnId, tenantId }).session(session);
    if (!grn) {
      const error = new Error('GRN not found');
      error.statusCode = 404;
      throw error;
    }

    if (grn.status === 'posted') {
      const error = new Error('GRN is already posted.');
      error.statusCode = 400;
      throw error;
    }

    if (grn.status === 'cancelled') {
      const error = new Error('Cannot post a cancelled GRN.');
      error.statusCode = 400;
      throw error;
    }

    // Add accepted stock to warehouse
    for (const item of grn.items) {
      if (item.acceptedQuantity > 0) {
        const product = await Product.findOne({
          _id: item.productId,
          tenantId,
        }).session(session);

        if (product && product.productType === 'goods' && product.trackInventory) {
          let inventory = await Inventory.findOne({
            tenantId,
            productId: product._id,
            warehouseId: grn.warehouseId,
          }).session(session);

          const prevStock = inventory ? inventory.quantity : 0;
          const newStock = prevStock + item.acceptedQuantity;

          if (!inventory) {
            inventory = new Inventory({
              tenantId,
              productId: product._id,
              warehouseId: grn.warehouseId,
              quantity: newStock,
              reservedQuantity: 0,
              availableQuantity: newStock,
            });
          } else {
            inventory.quantity = newStock;
            inventory.availableQuantity = newStock - inventory.reservedQuantity;
          }
          await inventory.save({ session });

          product.stock = (product.stock || 0) + item.acceptedQuantity;
          await product.save({ session });

          // Record append-only stock movement
          const movement = new StockMovement({
            tenantId,
            productId: product._id,
            warehouseId: grn.warehouseId,
            movementType: 'purchase',
            quantity: item.acceptedQuantity,
            referenceType: 'grn',
            referenceId: grn._id,
            previousStock: prevStock,
            newStock,
            remarks: `GRN ${grn.grnNumber} posted for supplier ${grn.supplierName}`,
            createdBy: userId,
          });
          await movement.save({ session });
        }
      }
    }

    // If linked to PO, update PO line items' receivedQuantity
    if (grn.purchaseOrderId) {
      const po = await PurchaseOrder.findOne({
        _id: grn.purchaseOrderId,
        tenantId,
      }).session(session);

      if (po) {
        let allCompleted = true;
        let anyReceived = false;

        for (const grnLine of grn.items) {
          const poLine = po.items.find((item) => item.productId.equals(grnLine.productId));
          if (poLine) {
            poLine.receivedQuantity = (poLine.receivedQuantity || 0) + grnLine.acceptedQuantity;
          }
        }

        for (const poLine of po.items) {
          if (poLine.receivedQuantity > 0) anyReceived = true;
          if (poLine.receivedQuantity < poLine.quantity) allCompleted = false;
        }

        po.status = allCompleted ? 'received' : (anyReceived ? 'partially_received' : po.status);
        await po.save({ session });
      }
    }

    grn.status = 'posted';
    grn.stockUpdated = true;
    grn.postedAt = new Date();
    await grn.save({ session });

    return grn;
  });
};

export const cancelGRN = async (tenantId, userId, grnId) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(grnId)) {
      const error = new Error('Invalid GRN ID format');
      error.statusCode = 400;
      throw error;
    }

    const grn = await GRN.findOne({ _id: grnId, tenantId }).session(session);
    if (!grn) {
      const error = new Error('GRN not found');
      error.statusCode = 404;
      throw error;
    }

    if (grn.status === 'cancelled') {
      const error = new Error('GRN is already cancelled.');
      error.statusCode = 400;
      throw error;
    }

    // If stock was added, reverse it
    if (grn.stockUpdated && grn.status === 'posted') {
      for (const item of grn.items) {
        if (item.acceptedQuantity > 0) {
          const product = await Product.findOne({ _id: item.productId, tenantId }).session(session);
          if (product && product.productType === 'goods' && product.trackInventory) {
            const inventory = await Inventory.findOne({
              tenantId,
              productId: product._id,
              warehouseId: grn.warehouseId,
            }).session(session);

            if (inventory) {
              const prevStock = inventory.quantity;
              const newStock = prevStock - item.acceptedQuantity;
              inventory.quantity = newStock;
              inventory.availableQuantity = newStock - inventory.reservedQuantity;
              await inventory.save({ session });

              product.stock = Math.max(0, (product.stock || 0) - item.acceptedQuantity);
              await product.save({ session });

              const movement = new StockMovement({
                tenantId,
                productId: product._id,
                warehouseId: grn.warehouseId,
                movementType: 'purchase_return',
                quantity: item.acceptedQuantity,
                referenceType: 'grn_cancellation',
                referenceId: grn._id,
                previousStock: prevStock,
                newStock,
                remarks: `Cancelled GRN ${grn.grnNumber}`,
                createdBy: userId,
              });
              await movement.save({ session });
            }
          }
        }
      }

      // Revert PO received quantities if linked
      if (grn.purchaseOrderId) {
        const po = await PurchaseOrder.findOne({ _id: grn.purchaseOrderId, tenantId }).session(session);
        if (po) {
          for (const grnLine of grn.items) {
            const poLine = po.items.find((item) => item.productId.equals(grnLine.productId));
            if (poLine) {
              poLine.receivedQuantity = Math.max(0, (poLine.receivedQuantity || 0) - grnLine.acceptedQuantity);
            }
          }
          po.status = 'approved';
          await po.save({ session });
        }
      }
    }

    grn.status = 'cancelled';
    grn.cancelledAt = new Date();
    await grn.save({ session });

    return grn;
  });
};

/**
 * ========================================================
 * 3. PURCHASE BILLS
 * ========================================================
 */
export const createPurchaseBill = async (tenantId, userId, data) => {
  const { party, warehouse, calculation, resolvedPOS } = await validatePurchaseContext(tenantId, {
    supplierId: data.supplierId,
    warehouseId: data.warehouseId,
    placeOfSupply: data.placeOfSupply,
    items: data.items,
    paidAmount: data.paidAmount,
  });

  const billDate = data.billDate ? new Date(data.billDate) : new Date();
  const { documentNumber, financialYear } = await purchasesCalculator.generatePurchaseDocumentNumber(
    tenantId,
    'bill',
    billDate
  );

  const bill = new PurchaseBill({
    tenantId,
    billNumber: documentNumber,
    supplierInvoiceNumber: data.supplierInvoiceNumber.trim(),
    financialYear,
    supplierId: party._id,
    supplierName: party.name,
    supplierGSTIN: party.GSTIN || null,
    supplierPAN: party.PAN || null,
    purchaseOrderId: data.purchaseOrderId || null,
    grnIds: data.grnIds || [],
    billDate,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    placeOfSupply: resolvedPOS,
    placeOfSupplyCode: calculation.placeOfSupplyCode,
    supplierStateCode: calculation.supplierStateCode,
    isInterState: calculation.isInterState,
    isReverseCharge: data.isReverseCharge || false,
    isITCClaimable: data.isITCClaimable !== undefined ? Boolean(data.isITCClaimable) : true,
    warehouseId: warehouse._id,
    warehouseName: warehouse.warehouseName,
    items: calculation.items,
    subtotal: calculation.subtotal,
    discountTotal: calculation.discountTotal,
    taxableAmount: calculation.taxableAmount,
    cgstTotal: calculation.cgstTotal,
    sgstTotal: calculation.sgstTotal,
    igstTotal: calculation.igstTotal,
    cessTotal: calculation.cessTotal,
    roundOff: calculation.roundOff,
    grandTotal: calculation.grandTotal,
    paidAmount: calculation.paidAmount,
    balanceAmount: calculation.balanceAmount,
    paymentStatus: calculation.paymentStatus,
    billStatus: 'draft',
    stockAdded: false,
    notes: data.notes || '',
    createdBy: userId,
  });

  await bill.save();
  return bill;
};

export const getPurchaseBills = async (tenantId, options = {}) => {
  const { page = 1, limit = 10, search, supplierId, status, paymentStatus } = options;
  const query = { tenantId };

  if (supplierId && mongoose.isValidObjectId(supplierId)) query.supplierId = supplierId;
  if (status) query.billStatus = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { billNumber: searchRegex },
      { supplierInvoiceNumber: searchRegex },
      { supplierName: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const [bills, total] = await Promise.all([
    PurchaseBill.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    PurchaseBill.countDocuments(query),
  ]);

  return {
    bills,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
};

export const getPurchaseBillById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid purchase bill ID format');
    error.statusCode = 400;
    throw error;
  }

  const bill = await PurchaseBill.findOne({ _id: id, tenantId })
    .populate('supplierId', 'name phone email GSTIN PAN')
    .populate('warehouseId', 'warehouseName warehouseCode city state');

  if (!bill) {
    const error = new Error('Purchase bill not found');
    error.statusCode = 404;
    throw error;
  }

  return bill;
};

export const updatePurchaseBill = async (tenantId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid bill ID');
    error.statusCode = 400;
    throw error;
  }

  const bill = await PurchaseBill.findOne({ _id: id, tenantId });
  if (!bill) {
    const error = new Error('Purchase bill not found');
    error.statusCode = 404;
    throw error;
  }

  if (bill.billStatus !== 'draft') {
    const error = new Error(`Cannot modify a ${bill.billStatus} purchase bill. Only draft bills can be updated.`);
    error.statusCode = 400;
    throw error;
  }

  const { party, warehouse, calculation, resolvedPOS } = await validatePurchaseContext(tenantId, {
    supplierId: data.supplierId || bill.supplierId,
    warehouseId: data.warehouseId || bill.warehouseId,
    placeOfSupply: data.placeOfSupply || bill.placeOfSupply,
    items: data.items || bill.items,
    paidAmount: data.paidAmount !== undefined ? data.paidAmount : bill.paidAmount,
  });

  bill.supplierId = party._id;
  bill.supplierName = party.name;
  bill.supplierGSTIN = party.GSTIN || null;
  bill.supplierPAN = party.PAN || null;
  if (data.supplierInvoiceNumber) bill.supplierInvoiceNumber = data.supplierInvoiceNumber.trim();
  bill.warehouseId = warehouse._id;
  bill.warehouseName = warehouse.warehouseName;
  if (data.billDate) bill.billDate = new Date(data.billDate);
  if (data.dueDate !== undefined) bill.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  bill.placeOfSupply = resolvedPOS;
  bill.placeOfSupplyCode = calculation.placeOfSupplyCode;
  bill.supplierStateCode = calculation.supplierStateCode;
  bill.isInterState = calculation.isInterState;
  if (data.isReverseCharge !== undefined) bill.isReverseCharge = data.isReverseCharge;
  bill.items = calculation.items;
  bill.subtotal = calculation.subtotal;
  bill.discountTotal = calculation.discountTotal;
  bill.taxableAmount = calculation.taxableAmount;
  bill.cgstTotal = calculation.cgstTotal;
  bill.sgstTotal = calculation.sgstTotal;
  bill.igstTotal = calculation.igstTotal;
  bill.cessTotal = calculation.cessTotal;
  bill.roundOff = calculation.roundOff;
  bill.grandTotal = calculation.grandTotal;
  bill.paidAmount = calculation.paidAmount;
  bill.balanceAmount = calculation.balanceAmount;
  bill.paymentStatus = calculation.paymentStatus;
  if (data.notes !== undefined) bill.notes = data.notes;

  await bill.save();
  return bill;
};

/**
 * Post Purchase Bill:
 * If it is a direct purchase bill without GRN, adds stock to warehouse atomically.
 * If linked to a GRN, stock was already increased by GRN, so stockAdded remains false (no double counting).
 */
export const postPurchaseBill = async (tenantId, userId, billId) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(billId)) {
      const error = new Error('Invalid purchase bill ID');
      error.statusCode = 400;
      throw error;
    }

    const bill = await PurchaseBill.findOne({ _id: billId, tenantId }).session(session);
    if (!bill) {
      const error = new Error('Purchase bill not found');
      error.statusCode = 404;
      throw error;
    }

    if (bill.billStatus === 'posted') {
      const error = new Error('Purchase bill is already posted.');
      error.statusCode = 400;
      throw error;
    }

    if (bill.billStatus === 'cancelled') {
      const error = new Error('Cannot post a cancelled purchase bill.');
      error.statusCode = 400;
      throw error;
    }

    // Direct purchase: if no GRN was posted for this bill, add stock directly
    const hasLinkedGRN = bill.grnIds && bill.grnIds.length > 0;

    if (!hasLinkedGRN) {
      for (const item of bill.items) {
        const product = await Product.findOne({ _id: item.productId, tenantId }).session(session);
        if (product && product.productType === 'goods' && product.trackInventory) {
          let inventory = await Inventory.findOne({
            tenantId,
            productId: product._id,
            warehouseId: bill.warehouseId,
          }).session(session);

          const prevStock = inventory ? inventory.quantity : 0;
          const newStock = prevStock + item.quantity;

          if (!inventory) {
            inventory = new Inventory({
              tenantId,
              productId: product._id,
              warehouseId: bill.warehouseId,
              quantity: newStock,
              reservedQuantity: 0,
              availableQuantity: newStock,
            });
          } else {
            inventory.quantity = newStock;
            inventory.availableQuantity = newStock - inventory.reservedQuantity;
          }
          await inventory.save({ session });

          product.stock = (product.stock || 0) + item.quantity;
          await product.save({ session });

          const movement = new StockMovement({
            tenantId,
            productId: product._id,
            warehouseId: bill.warehouseId,
            movementType: 'purchase',
            quantity: item.quantity,
            referenceType: 'purchase_bill',
            referenceId: bill._id,
            previousStock: prevStock,
            newStock,
            remarks: `Direct Purchase Bill ${bill.billNumber} posted`,
            createdBy: userId,
          });
          await movement.save({ session });
        }
      }
      bill.stockAdded = true;
    } else {
      bill.stockAdded = false; // Stock was already added via GRN
    }

    bill.billStatus = 'posted';
    bill.postedAt = new Date();
    await bill.save({ session });

    // Automatic Accounting Journal Posting
    await postPurchaseBillJournal(tenantId, userId, bill, session);

    // Purchase Bill Notification
    await notificationService.createNotification({
      tenantId,
      title: 'Purchase Bill Posted',
      message: `Purchase bill ${bill.billNumber} from ${bill.supplierName} (₹${bill.grandTotal}) has been posted.`,
      notificationType: 'purchase_bill',
      referenceType: 'PurchaseBill',
      referenceId: bill._id,
      session,
    });

    // Record Audit Log for bill posting
    await auditLogService.logAuditAction({
      tenantId,
      userId,
      action: 'PURCHASE_BILL_POSTED',
      module: 'purchases',
      entityType: 'PurchaseBill',
      entityId: bill._id,
      targetName: bill.billNumber,
      description: `Posted purchase bill ${bill.billNumber} from ${bill.supplierName} for ₹${bill.grandTotal}`,
      changes: {
        billNumber: bill.billNumber,
        supplierName: bill.supplierName,
        grandTotal: bill.grandTotal,
      },
      session,
    });

    return bill;
  });
};

export const cancelPurchaseBill = async (tenantId, userId, billId) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(billId)) {
      const error = new Error('Invalid purchase bill ID');
      error.statusCode = 400;
      throw error;
    }

    const bill = await PurchaseBill.findOne({ _id: billId, tenantId }).session(session);
    if (!bill) {
      const error = new Error('Purchase bill not found');
      error.statusCode = 404;
      throw error;
    }

    if (bill.billStatus === 'cancelled') {
      const error = new Error('Purchase bill is already cancelled.');
      error.statusCode = 400;
      throw error;
    }

    // Check if debit notes exist
    const debitNoteExists = await DebitNote.exists({
      billId: bill._id,
      tenantId,
      status: { $ne: 'cancelled' },
    }).session(session);

    if (debitNoteExists) {
      const error = new Error('Cannot cancel purchase bill because active Debit Notes exist against it.');
      error.statusCode = 400;
      throw error;
    }

    // If direct purchase added stock, reverse it
    if (bill.stockAdded && bill.billStatus === 'posted') {
      for (const item of bill.items) {
        const product = await Product.findOne({ _id: item.productId, tenantId }).session(session);
        if (product && product.productType === 'goods' && product.trackInventory) {
          const inventory = await Inventory.findOne({
            tenantId,
            productId: product._id,
            warehouseId: bill.warehouseId,
          }).session(session);

          if (inventory) {
            const prevStock = inventory.quantity;
            const newStock = prevStock - item.quantity;
            inventory.quantity = newStock;
            inventory.availableQuantity = newStock - inventory.reservedQuantity;
            await inventory.save({ session });

            product.stock = Math.max(0, (product.stock || 0) - item.quantity);
            await product.save({ session });

            const movement = new StockMovement({
              tenantId,
              productId: product._id,
              warehouseId: bill.warehouseId,
              movementType: 'purchase_return',
              quantity: item.quantity,
              referenceType: 'purchase_bill_cancellation',
              referenceId: bill._id,
              previousStock: prevStock,
              newStock,
              remarks: `Cancelled Purchase Bill ${bill.billNumber}`,
              createdBy: userId,
            });
            await movement.save({ session });
          }
        }
      }
    }

    const wasPosted = bill.billStatus === 'posted';
    bill.billStatus = 'cancelled';
    bill.cancelledAt = new Date();
    await bill.save({ session });

    // Reverse accounting journal entry if bill was posted
    if (wasPosted) {
      await reversePurchaseBillJournal(tenantId, userId, bill, session);
    }

    // Record Audit Log for bill cancellation
    await auditLogService.logAuditAction({
      tenantId,
      userId,
      action: 'PURCHASE_BILL_CANCELLED',
      module: 'purchases',
      entityType: 'PurchaseBill',
      entityId: bill._id,
      targetName: bill.billNumber,
      description: `Cancelled purchase bill ${bill.billNumber}`,
      session,
    });

    return bill;
  });
};

/**
 * ========================================================
 * 4. PURCHASE RETURNS & DEBIT NOTES
 * ========================================================
 */
export const createPurchaseReturn = async (tenantId, userId, data) => {
  if (!mongoose.isValidObjectId(data.billId)) {
    const error = new Error('Invalid purchase bill ID format');
    error.statusCode = 400;
    throw error;
  }

  const bill = await PurchaseBill.findOne({ _id: data.billId, tenantId });
  if (!bill) {
    const error = new Error('Purchase bill not found');
    error.statusCode = 404;
    throw error;
  }

  if (bill.billStatus !== 'posted') {
    const error = new Error('Debit notes can only be issued against posted purchase bills.');
    error.statusCode = 400;
    throw error;
  }

  const returnItems = [];
  for (const itemInput of data.items) {
    const billItem = bill.items.id(itemInput.billItemId);
    if (!billItem) {
      const error = new Error(`Bill item ID '${itemInput.billItemId}' not found in purchase bill.`);
      error.statusCode = 404;
      throw error;
    }

    const availableToReturn = billItem.quantity - (billItem.returnedQuantity || 0);
    if (itemInput.returnedQuantity > availableToReturn) {
      const error = new Error(
        `Returned quantity (${itemInput.returnedQuantity}) exceeds remaining eligible quantity (${availableToReturn}) for item '${billItem.productName}'.`
      );
      error.statusCode = 400;
      throw error;
    }

    const returnRatio = itemInput.returnedQuantity / billItem.quantity;
    const taxableValue = purchasesCalculator.round2(billItem.taxableValue * returnRatio);
    const cgst = purchasesCalculator.round2(billItem.cgst * returnRatio);
    const sgst = purchasesCalculator.round2(billItem.sgst * returnRatio);
    const igst = purchasesCalculator.round2(billItem.igst * returnRatio);
    const cess = purchasesCalculator.round2(billItem.cess * returnRatio);
    const lineTotal = purchasesCalculator.round2(taxableValue + cgst + sgst + igst + cess);

    returnItems.push({
      billItemId: billItem._id,
      productId: billItem.productId,
      productName: billItem.productName,
      HSN: billItem.HSN,
      SAC: billItem.SAC,
      returnedQuantity: itemInput.returnedQuantity,
      unitId: billItem.unitId,
      unitName: billItem.unitName,
      unitPrice: billItem.unitPrice,
      discount: purchasesCalculator.round2((billItem.discount || 0) * returnRatio),
      taxableValue,
      gstRate: billItem.gstRate,
      cgst,
      sgst,
      igst,
      cess,
      lineTotal,
    });
  }

  const subtotal = purchasesCalculator.round2(returnItems.reduce((acc, i) => acc + i.unitPrice * i.returnedQuantity, 0));
  const discountTotal = purchasesCalculator.round2(returnItems.reduce((acc, i) => acc + i.discount, 0));
  const taxableAmount = purchasesCalculator.round2(returnItems.reduce((acc, i) => acc + i.taxableValue, 0));
  const cgstTotal = purchasesCalculator.round2(returnItems.reduce((acc, i) => acc + i.cgst, 0));
  const sgstTotal = purchasesCalculator.round2(returnItems.reduce((acc, i) => acc + i.sgst, 0));
  const igstTotal = purchasesCalculator.round2(returnItems.reduce((acc, i) => acc + i.igst, 0));
  const cessTotal = purchasesCalculator.round2(returnItems.reduce((acc, i) => acc + i.cess, 0));

  const unroundedTotal = purchasesCalculator.round2(taxableAmount + cgstTotal + sgstTotal + igstTotal + cessTotal);
  const grandTotal = Math.round(unroundedTotal);
  const roundOff = purchasesCalculator.round2(grandTotal - unroundedTotal);

  const { documentNumber, financialYear } = await purchasesCalculator.generatePurchaseDocumentNumber(
    tenantId,
    'debit_note',
    new Date()
  );

  const debitNote = new DebitNote({
    tenantId,
    debitNoteNumber: documentNumber,
    financialYear,
    billId: bill._id,
    billNumber: bill.billNumber,
    supplierInvoiceNumber: bill.supplierInvoiceNumber,
    billDate: bill.billDate,
    supplierId: bill.supplierId,
    supplierName: bill.supplierName,
    supplierGSTIN: bill.supplierGSTIN,
    warehouseId: bill.warehouseId,
    warehouseName: bill.warehouseName,
    debitNoteDate: data.debitNoteDate ? new Date(data.debitNoteDate) : new Date(),
    reason: data.reason || 'purchase_return',
    placeOfSupply: bill.placeOfSupply,
    placeOfSupplyCode: bill.placeOfSupplyCode,
    supplierStateCode: bill.supplierStateCode,
    isInterState: bill.isInterState,
    items: returnItems,
    subtotal,
    discountTotal,
    taxableAmount,
    cgstTotal,
    sgstTotal,
    igstTotal,
    cessTotal,
    roundOff,
    grandTotal,
    status: 'draft',
    stockReduced: false,
    remarks: data.remarks || '',
    createdBy: userId,
  });

  await debitNote.save();
  return debitNote;
};

export const postDebitNote = async (tenantId, userId, debitNoteId) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(debitNoteId)) {
      const error = new Error('Invalid debit note ID format');
      error.statusCode = 400;
      throw error;
    }

    const debitNote = await DebitNote.findOne({ _id: debitNoteId, tenantId }).session(session);
    if (!debitNote) {
      const error = new Error('Debit note not found');
      error.statusCode = 404;
      throw error;
    }

    if (debitNote.status === 'posted') {
      const error = new Error('Debit note is already posted.');
      error.statusCode = 400;
      throw error;
    }

    const bill = await PurchaseBill.findOne({ _id: debitNote.billId, tenantId }).session(session);
    if (!bill) {
      const error = new Error('Linked purchase bill no longer exists');
      error.statusCode = 404;
      throw error;
    }

    // Deduct stock from warehouse for returned goods
    for (const item of debitNote.items) {
      const product = await Product.findOne({ _id: item.productId, tenantId }).session(session);

      if (product && product.productType === 'goods' && product.trackInventory) {
        const inventory = await Inventory.findOne({
          tenantId,
          productId: product._id,
          warehouseId: debitNote.warehouseId,
        }).session(session);

        const available = inventory ? inventory.availableQuantity : 0;
        if (!inventory || available < item.returnedQuantity) {
          const error = new Error(
            `Insufficient stock for returning '${item.productName}' in warehouse '${debitNote.warehouseName}'. Available: ${available}, Required: ${item.returnedQuantity}`
          );
          error.statusCode = 400;
          throw error;
        }

        const prevStock = inventory.quantity;
        const newStock = prevStock - item.returnedQuantity;

        inventory.quantity = newStock;
        inventory.availableQuantity = newStock - inventory.reservedQuantity;
        await inventory.save({ session });

        product.stock = Math.max(0, (product.stock || 0) - item.returnedQuantity);
        await product.save({ session });

        const movement = new StockMovement({
          tenantId,
          productId: product._id,
          warehouseId: debitNote.warehouseId,
          movementType: 'purchase_return',
          quantity: item.returnedQuantity,
          referenceType: 'debit_note',
          referenceId: debitNote._id,
          previousStock: prevStock,
          newStock,
          remarks: `Debit Note ${debitNote.debitNoteNumber} posted for Bill ${debitNote.billNumber}`,
          createdBy: userId,
        });
        await movement.save({ session });
      }

      // Update original bill item's returnedQuantity
      const billLine = bill.items.id(item.billItemId);
      if (billLine) {
        billLine.returnedQuantity = (billLine.returnedQuantity || 0) + item.returnedQuantity;
      }
    }

    await bill.save({ session });

    debitNote.status = 'posted';
    debitNote.stockReduced = true;
    debitNote.postedAt = new Date();
    await debitNote.save({ session });

    // Automatic Accounting Journal Posting
    await postDebitNoteJournal(tenantId, userId, debitNote, session);

    return debitNote;
  });
};

export const getDebitNotes = async (tenantId, options = {}) => {
  const { page = 1, limit = 10, search, billId, status } = options;
  const query = { tenantId };

  if (billId && mongoose.isValidObjectId(billId)) query.billId = billId;
  if (status) query.status = status;

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ debitNoteNumber: searchRegex }, { supplierName: searchRegex }];
  }

  const skip = (page - 1) * limit;
  const [debitNotes, total] = await Promise.all([
    DebitNote.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    DebitNote.countDocuments(query),
  ]);

  return {
    debitNotes,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
};

export const getDebitNoteById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid debit note ID');
    error.statusCode = 400;
    throw error;
  }

  const debitNote = await DebitNote.findOne({ _id: id, tenantId });
  if (!debitNote) {
    const error = new Error('Debit note not found');
    error.statusCode = 404;
    throw error;
  }

  return debitNote;
};

export default {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createGRN,
  getGRNs,
  getGRNById,
  postGRN,
  cancelGRN,
  createPurchaseBill,
  getPurchaseBills,
  getPurchaseBillById,
  updatePurchaseBill,
  postPurchaseBill,
  cancelPurchaseBill,
  createPurchaseReturn,
  postDebitNote,
  getDebitNotes,
  getDebitNoteById,
};
