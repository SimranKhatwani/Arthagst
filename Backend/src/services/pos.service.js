import mongoose from 'mongoose';
import SalesInvoice from '../models/salesInvoice.model.js';
import Party from '../models/party.model.js';
import Warehouse from '../models/warehouse.model.js';
import Product from '../models/product.model.js';
import Tenant from '../models/tenant.model.js';
import Inventory from '../models/inventory.model.js';
import StockMovement from '../models/stockMovement.model.js';
import BankAccount from '../models/bankAccount.model.js';
import Payment from '../models/payment.model.js';
import salesCalculator, { round2, getFinancialYear } from './sales.calculator.js';
import { generatePaymentNumber } from './payment.service.js';
import {
  postSalesInvoiceJournal,
  reverseSalesInvoiceJournal,
  postPaymentJournal,
  reversePaymentJournal,
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
 * Find or create a default "Walk-in Customer" party for the tenant
 */
export const getOrCreateWalkInCustomer = async (tenantId, session = null) => {
  let partyQuery = Party.findOne({
    tenantId,
    $or: [{ isWalkIn: true }, { name: 'Walk-in Customer' }],
    isDeleted: false,
  });
  if (session) partyQuery.session(session);
  let party = await partyQuery;

  if (party) {
    return party;
  }

  // Get tenant to inherit state for tax determination
  let tenantQuery = Tenant.findById(tenantId);
  if (session) tenantQuery.session(session);
  const tenant = await tenantQuery;

  const stateCode = tenant?.stateCode || (tenant?.GSTIN ? tenant.GSTIN.substring(0, 2) : '27');
  const state = tenant?.state || 'Maharashtra';

  party = new Party({
    tenantId,
    name: 'Walk-in Customer',
    partyType: 'customer',
    phone: '',
    stateCode,
    state,
    city: tenant?.city || 'Local Store',
    address: 'Walk-in Store Customer',
    isWalkIn: true,
    isActive: true,
  });

  if (session) {
    await party.save({ session });
  } else {
    await party.save();
  }

  return party;
};

/**
 * Search POS Products with live inventory stock per warehouse
 */
export const searchPosProducts = async (tenantId, query = {}) => {
  const { warehouseId, search, barcode, SKU, categoryId, page = 1, limit = 50 } = query;

  const filter = {
    tenantId,
    isDeleted: false,
    isActive: true,
  };

  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    filter.categoryId = categoryId;
  }

  if (barcode && barcode.trim()) {
    filter.barcode = barcode.trim();
  } else if (SKU && SKU.trim()) {
    filter.SKU = SKU.trim().toUpperCase();
  } else if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { name: regex },
      { SKU: regex },
      { barcode: regex },
      { description: regex },
      { HSN: regex },
    ];
  }

  const skip = (Math.max(1, page) - 1) * Math.min(100, limit);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('categoryId', 'name')
      .populate('unitId', 'name shortName gstUqcCode allowDecimal')
      .sort({ name: 1 })
      .skip(skip)
      .limit(Math.min(100, limit))
      .lean(),
    Product.countDocuments(filter),
  ]);

  // If warehouseId is provided, fetch on-hand stock for all matched products
  const productIds = products.map((p) => p._id);
  const stockMap = new Map();

  if (warehouseId && mongoose.isValidObjectId(warehouseId) && productIds.length > 0) {
    const inventories = await Inventory.find({
      tenantId,
      warehouseId,
      productId: { $in: productIds },
    }).lean();

    for (const inv of inventories) {
      stockMap.set(inv.productId.toString(), {
        quantity: inv.quantity || 0,
        availableQuantity: inv.availableQuantity || 0,
      });
    }
  }

  const enrichedProducts = products.map((p) => {
    const stock = stockMap.get(p._id.toString()) || { quantity: 0, availableQuantity: 0 };
    const available = p.productType === 'service' || !p.trackInventory ? 999999 : stock.availableQuantity;
    const isOutOfStock = p.productType === 'goods' && p.trackInventory && available <= 0;
    const isLowStock =
      p.productType === 'goods' &&
      p.trackInventory &&
      p.lowStockAlert !== undefined &&
      available <= p.lowStockAlert &&
      available > 0;

    return {
      ...p,
      stockOnHand: stock.quantity,
      availableStock: available,
      isOutOfStock,
      isLowStock,
    };
  });

  return {
    products: enrichedProducts,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Search POS Customers with quick phone/name/GSTIN lookup
 */
export const searchPosCustomers = async (tenantId, query = {}) => {
  const { search, limit = 20 } = query;

  const filter = {
    tenantId,
    partyType: { $in: ['customer', 'both'] },
    isDeleted: false,
    isActive: true,
  };

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ name: regex }, { phone: regex }, { email: regex }, { GSTIN: regex }];
  }

  const customers = await Party.find(filter)
    .sort({ isWalkIn: -1, name: 1 })
    .limit(Math.min(50, limit))
    .lean();

  return { customers };
};

/**
 * Validate POS Bill Context (Tenant, Warehouse, Customer, Products, Prices)
 */
export const validatePosContext = async (tenantId, data, session = null) => {
  const { warehouseId, partyId, isWalkIn, customerName, customerPhone, items = [], placeOfSupply } = data;

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

  const supplierStateCode = tenant.stateCode || (tenant.GSTIN ? tenant.GSTIN.substring(0, 2) : '27');

  // 2. Validate Warehouse
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

  // 3. Resolve Party (Customer or Walk-in Customer)
  let party = null;
  if (partyId && mongoose.isValidObjectId(partyId)) {
    const pQuery = Party.findOne({
      _id: partyId,
      tenantId,
      isDeleted: false,
    });
    if (session) pQuery.session(session);
    party = await pQuery;
    if (!party) {
      const error = new Error('Customer party not found in your organization');
      error.statusCode = 404;
      throw error;
    }
  } else {
    // Default to Walk-in Customer
    party = await getOrCreateWalkInCustomer(tenantId, session);
  }

  const resolvedPOS = placeOfSupply || party.stateCode || party.state || supplierStateCode;

  // 4. Resolve and Validate Items
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('At least one item is required in a POS bill');
    error.statusCode = 400;
    throw error;
  }

  const resolvedItems = [];
  for (const item of items) {
    if (!mongoose.isValidObjectId(item.productId)) {
      const error = new Error(`Invalid productId '${item.productId}' format`);
      error.statusCode = 400;
      throw error;
    }

    const qty = Number(item.quantity);
    if (!qty || qty <= 0) {
      const error = new Error('Item quantity must be greater than zero');
      error.statusCode = 400;
      throw error;
    }

    const prodQuery = Product.findOne({
      _id: item.productId,
      tenantId,
      isDeleted: false,
    });
    if (session) prodQuery.session(session);
    const product = await prodQuery;

    if (!product) {
      const error = new Error(`Product ${item.productId} not found in your organization`);
      error.statusCode = 404;
      throw error;
    }

    if (!product.isActive) {
      const error = new Error(`Product '${product.name}' is inactive`);
      error.statusCode = 400;
      throw error;
    }

    // Default unit price to product sellingPrice if not supplied
    const unitPrice =
      item.unitPrice !== undefined && item.unitPrice !== null
        ? Number(item.unitPrice)
        : Number(product.sellingPrice || 0);

    if (unitPrice < 0) {
      const error = new Error(`Unit price for '${product.name}' cannot be negative`);
      error.statusCode = 400;
      throw error;
    }

    const discount = Number(item.discount || 0);
    if (discount < 0) {
      const error = new Error(`Discount for '${product.name}' cannot be negative`);
      error.statusCode = 400;
      throw error;
    }

    resolvedItems.push({
      productId: product._id,
      productName: product.name,
      description: item.description || product.description || '',
      HSN: product.HSN || '',
      SAC: product.SAC || '',
      quantity: qty,
      unitId: product.unitId,
      unitName: 'PCS',
      unitPrice,
      discount,
      gstRate: product.gstRate,
      cessRate: product.cessRate,
      productType: product.productType,
      trackInventory: product.trackInventory,
      lowStockAlert: product.lowStockAlert,
    });
  }

  // 5. Compute Taxes & Totals via existing salesCalculator
  const calculation = salesCalculator.calculateSalesDocument({
    supplierStateCode,
    placeOfSupply: resolvedPOS,
    items: resolvedItems,
    paidAmount: 0,
  });

  // Apply optional bill-level discount if present
  let finalSubtotal = calculation.subtotal;
  let finalTaxable = calculation.taxableAmount;
  let finalGrandTotal = calculation.grandTotal;
  let finalRoundOff = calculation.roundOff;
  let finalDiscountTotal = calculation.discountTotal;

  const billDiscount = Number(data.billDiscount || 0);
  if (billDiscount > 0) {
    finalDiscountTotal = round2(finalDiscountTotal + billDiscount);
    finalTaxable = Math.max(0, round2(finalTaxable - billDiscount));
    // Recalculate taxes based on adjusted taxable
    const taxFactor = finalTaxable / Math.max(1, calculation.taxableAmount);
    const newCgst = round2(calculation.cgstTotal * taxFactor);
    const newSgst = round2(calculation.sgstTotal * taxFactor);
    const newIgst = round2(calculation.igstTotal * taxFactor);
    const newCess = round2(calculation.cessTotal * taxFactor);
    const rawTotal = round2(finalTaxable + newCgst + newSgst + newIgst + newCess);
    finalGrandTotal = Math.round(rawTotal);
    finalRoundOff = round2(finalGrandTotal - rawTotal);
    calculation.cgstTotal = newCgst;
    calculation.sgstTotal = newSgst;
    calculation.igstTotal = newIgst;
    calculation.cessTotal = newCess;
    calculation.taxableAmount = finalTaxable;
    calculation.discountTotal = finalDiscountTotal;
    calculation.grandTotal = finalGrandTotal;
    calculation.roundOff = finalRoundOff;
  }

  return {
    tenant,
    party,
    warehouse,
    calculation,
    resolvedPOS,
    customerName: customerName || party.name,
    customerPhone: customerPhone || party.phone,
  };
};

/**
 * 1. Create POS Bill (Draft or Finalized with Split Payments)
 */
export const createPosBill = async (tenantId, user, data) => {
  return runTransaction(async (session) => {
    const { tenant, party, warehouse, calculation, resolvedPOS, customerName, customerPhone } =
      await validatePosContext(tenantId, data, session);

    const billDate = data.billDate ? new Date(data.billDate) : new Date();

    // Generate unique sequential POS bill number atomically (e.g. POS/2026-27/0001)
    const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
      tenantId,
      'pos',
      billDate,
      session
    );

    const isFinalize = Boolean(data.finalize || (Array.isArray(data.payments) && data.payments.length > 0));

    const bill = new SalesInvoice({
      tenantId,
      invoiceNumber: documentNumber,
      posBillNumber: documentNumber,
      financialYear,
      partyId: party._id,
      partyName: customerName || party.name,
      partyGSTIN: data.customerGSTIN || party.GSTIN || null,
      partyPAN: party.PAN || null,
      warehouseId: warehouse._id,
      warehouseName: warehouse.warehouseName,
      invoiceDate: billDate,
      dueDate: billDate,
      placeOfSupply: resolvedPOS,
      placeOfSupplyCode: calculation.placeOfSupplyCode,
      supplierStateCode: calculation.supplierStateCode,
      isInterState: calculation.isInterState,
      billingAddress: party.billingAddress || 'Store POS Checkout',
      shippingAddress: party.shippingAddress || party.billingAddress || 'Store POS Checkout',
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
      paidAmount: 0,
      balanceAmount: calculation.grandTotal,
      paymentStatus: 'unpaid',
      invoiceStatus: 'draft',
      stockDeducted: false,
      notes: data.notes || '',
      isPOS: true,
      isWalkIn: Boolean(data.isWalkIn || party.isWalkIn),
      cashierId: user?._id || user?.userId || null,
      cashierName: user?.name || user?.email || 'Cashier',
      createdBy: user?._id || user?.userId,
    });

    if (!isFinalize) {
      await bill.save({ session });

      await auditLogService.logAuditAction({
        tenantId,
        userId: user?._id || user?.userId,
        action: 'POS_BILL_CREATED',
        module: 'pos',
        entityType: 'SalesInvoice',
        entityId: bill._id,
        targetName: bill.invoiceNumber,
        description: `Created draft POS Bill ${bill.invoiceNumber} for ₹${bill.grandTotal}`,
        changes: { invoiceNumber: bill.invoiceNumber, grandTotal: bill.grandTotal },
        session,
      });

      return bill;
    }

    // Process Finalization within the same transaction
    await finalizeBillInternal(tenantId, user, bill, data.payments || [], session);

    return bill;
  });
};

/**
 * Internal helper to finalize a POS bill, deduct inventory, post journals, and record split payments
 */
const finalizeBillInternal = async (tenantId, user, bill, payments = [], session) => {
  if (bill.invoiceStatus === 'posted') {
    const error = new Error('POS bill is already finalized');
    error.statusCode = 400;
    throw error;
  }

  if (bill.invoiceStatus === 'cancelled') {
    const error = new Error('Cannot finalize a cancelled POS bill');
    error.statusCode = 400;
    throw error;
  }

  // 1. Inventory Check & Stock Deduction
  for (const item of bill.items) {
    const prodQuery = Product.findOne({ _id: item.productId, tenantId });
    if (session) prodQuery.session(session);
    const product = await prodQuery;

    if (product && product.productType === 'goods' && product.trackInventory) {
      let invQuery = Inventory.findOne({
        tenantId,
        productId: product._id,
        warehouseId: bill.warehouseId,
      });
      if (session) invQuery.session(session);
      let inventory = await invQuery;

      const available = inventory ? inventory.availableQuantity : 0;
      if (!inventory || available < item.quantity) {
        const error = new Error(
          `Insufficient stock for '${item.productName}' in warehouse '${bill.warehouseName}'. Available: ${available}, Required: ${item.quantity}`
        );
        error.statusCode = 400;
        throw error;
      }

      const prevStock = inventory.quantity;
      const newStock = prevStock - item.quantity;

      inventory.quantity = newStock;
      inventory.availableQuantity = newStock - inventory.reservedQuantity;
      await inventory.save({ session });

      product.stock = Math.max(0, (product.stock || 0) - item.quantity);
      await product.save({ session });

      // Record immutable stock movement
      const movement = new StockMovement({
        tenantId,
        productId: product._id,
        warehouseId: bill.warehouseId,
        movementType: 'sales',
        quantity: item.quantity,
        referenceType: 'sales_invoice',
        referenceId: bill._id,
        previousStock: prevStock,
        newStock,
        remarks: `POS Bill ${bill.invoiceNumber} finalized`,
        createdBy: user?._id || user?.userId,
      });
      await movement.save({ session });

      // Low stock notification
      if (
        product.lowStockAlert !== undefined &&
        product.lowStockAlert !== null &&
        newStock <= product.lowStockAlert
      ) {
        await notificationService.createNotification({
          tenantId,
          title: 'POS Low Stock Alert',
          message: `Product '${product.name}' is low on stock (${newStock} remaining) after POS sale.`,
          notificationType: 'low_stock',
          referenceType: 'Product',
          referenceId: product._id,
          session,
        });
      }
    }
  }

  bill.invoiceStatus = 'posted';
  bill.stockDeducted = true;
  bill.postedAt = new Date();

  // 2. Accounting Integration: Post Sales Journal Entry
  await postSalesInvoiceJournal(tenantId, user?._id || user?.userId, bill, session);

  // 3. Process Split Payments
  let totalPaidAmount = 0;
  const recordedPosPayments = [];

  if (Array.isArray(payments) && payments.length > 0) {
    for (const p of payments) {
      const amount = round2(Number(p.amount));
      if (amount <= 0) continue;

      totalPaidAmount = round2(totalPaidAmount + amount);

      // Validate Bank Account if supplied
      let resolvedBank = null;
      if (p.bankAccountId && mongoose.isValidObjectId(p.bankAccountId)) {
        resolvedBank = await BankAccount.findOne({
          _id: p.bankAccountId,
          tenantId,
          isDeleted: false,
        }).session(session);

        if (resolvedBank) {
          // Increment bank balance
          await BankAccount.findByIdAndUpdate(
            resolvedBank._id,
            { $inc: { currentBalance: amount } },
            { session }
          );
        }
      }

      // Generate sequential receipt document number
      const { documentNumber, financialYear } = await generatePaymentNumber(
        tenantId,
        'in',
        bill.invoiceDate,
        session
      );

      const normalizedMethod =
        (p.paymentMethod || 'cash').toLowerCase() === 'upi'
          ? 'UPI'
          : (p.paymentMethod || 'cash').toLowerCase();

      // Create Payment document
      const paymentDoc = new Payment({
        tenantId,
        paymentNumber: documentNumber,
        financialYear,
        direction: 'in',
        partyId: bill.partyId,
        partyName: bill.partyName,
        paymentDate: bill.invoiceDate,
        amount,
        unallocatedAmount: 0,
        paymentMethod: normalizedMethod,
        bankAccountId: resolvedBank ? resolvedBank._id : null,
        bankAccountName: resolvedBank ? (resolvedBank.accountName || '') : '',
        referenceNumber: p.referenceNumber || '',
        notes: `POS Bill ${bill.invoiceNumber} payment`,
        status: 'completed',
        allocations: [
          {
            salesInvoiceId: bill._id,
            purchaseBillId: null,
            documentNumber: bill.invoiceNumber,
            allocatedAmount: amount,
          },
        ],
        createdBy: user?._id || user?.userId,
      });
      await paymentDoc.save({ session });

      // Post Payment Journal Entry (Debit Bank/Cash, Credit AR)
      await postPaymentJournal(tenantId, user?._id || user?.userId, paymentDoc, session);

      recordedPosPayments.push({
        paymentId: paymentDoc._id,
        paymentMethod: p.paymentMethod || 'cash',
        amount,
        bankAccountId: resolvedBank ? resolvedBank._id : null,
        referenceNumber: p.referenceNumber || '',
      });
    }
  }

  // Calculate change returned and update balance
  const changeReturned = Math.max(0, round2(totalPaidAmount - bill.grandTotal));
  const effectivePaid = Math.min(bill.grandTotal, totalPaidAmount);
  const remainingBalance = Math.max(0, round2(bill.grandTotal - effectivePaid));

  bill.paidAmount = effectivePaid;
  bill.balanceAmount = remainingBalance;
  bill.changeReturned = changeReturned;
  bill.posPayments = recordedPosPayments;

  if (remainingBalance === 0) {
    bill.paymentStatus = 'paid';
  } else if (effectivePaid > 0) {
    bill.paymentStatus = 'partially_paid';
  } else {
    bill.paymentStatus = 'unpaid';
  }

  await bill.save({ session });

  // Record Audit Log
  await auditLogService.logAuditAction({
    tenantId,
    userId: user?._id || user?.userId,
    action: 'POS_BILL_FINALIZED',
    module: 'pos',
    entityType: 'SalesInvoice',
    entityId: bill._id,
    targetName: bill.invoiceNumber,
    description: `Finalized POS Bill ${bill.invoiceNumber} for ₹${bill.grandTotal} (Paid: ₹${bill.paidAmount})`,
    changes: {
      invoiceNumber: bill.invoiceNumber,
      grandTotal: bill.grandTotal,
      paidAmount: bill.paidAmount,
      balanceAmount: bill.balanceAmount,
      posPayments: recordedPosPayments,
    },
    session,
  });

  return bill;
};

/**
 * 2. Finalize an existing draft POS bill
 */
export const finalizePosBill = async (tenantId, user, billId, paymentData = {}) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(billId)) {
      const error = new Error('Invalid POS bill ID format');
      error.statusCode = 400;
      throw error;
    }

    const bill = await SalesInvoice.findOne({
      _id: billId,
      tenantId,
      isPOS: true,
    }).session(session);

    if (!bill) {
      const error = new Error('POS bill not found');
      error.statusCode = 404;
      throw error;
    }

    if (bill.invoiceStatus === 'posted') {
      const error = new Error('POS bill is already finalized');
      error.statusCode = 400;
      throw error;
    }

    if (bill.invoiceStatus === 'cancelled') {
      const error = new Error('Cannot finalize a cancelled POS bill');
      error.statusCode = 400;
      throw error;
    }

    await finalizeBillInternal(tenantId, user, bill, paymentData.payments || [], session);

    return bill;
  });
};

/**
 * 3. Get POS Bill by ID
 */
export const getPosBillById = async (tenantId, billId) => {
  if (!mongoose.isValidObjectId(billId)) {
    const error = new Error('Invalid POS bill ID format');
    error.statusCode = 400;
    throw error;
  }

  const bill = await SalesInvoice.findOne({
    _id: billId,
    tenantId,
    isPOS: true,
  })
    .populate('partyId', 'name phone email billingAddress GSTIN')
    .populate('warehouseId', 'warehouseName warehouseCode city state')
    .populate('cashierId', 'name email role')
    .populate('items.productId', 'name SKU barcode sellingPrice HSN productType')
    .populate('posPayments.bankAccountId', 'accountName bankName accountNumber')
    .populate('posPayments.paymentId', 'paymentNumber amount paymentMethod paymentDate');

  if (!bill) {
    const error = new Error('POS bill not found');
    error.statusCode = 404;
    throw error;
  }

  return bill;
};

/**
 * 4. List POS Bills with filters and pagination
 */
export const getPosBills = async (tenantId, query = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    paymentStatus,
    cashierId,
    warehouseId,
    partyId,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  const filter = {
    tenantId,
    isPOS: true,
  };

  if (status && status !== 'all') {
    filter.invoiceStatus = status;
  }
  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }
  if (cashierId && mongoose.isValidObjectId(cashierId)) {
    filter.cashierId = cashierId;
  }
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    filter.warehouseId = warehouseId;
  }
  if (partyId && mongoose.isValidObjectId(partyId)) {
    filter.partyId = partyId;
  }

  if (startDate || endDate) {
    filter.invoiceDate = {};
    if (startDate) filter.invoiceDate.$gte = new Date(startDate);
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      filter.invoiceDate.$lte = e;
    }
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { invoiceNumber: regex },
      { posBillNumber: regex },
      { partyName: regex },
      { 'items.productName': regex },
    ];
  }

  const skip = (Math.max(1, page) - 1) * Math.min(100, limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [bills, total, totalsAgg] = await Promise.all([
    SalesInvoice.find(filter)
      .populate('partyId', 'name phone')
      .populate('warehouseId', 'warehouseName')
      .populate('cashierId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(Math.min(100, limit))
      .lean(),
    SalesInvoice.countDocuments(filter),
    SalesInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          totalOutstanding: { $sum: '$balanceAmount' },
        },
      },
    ]),
  ]);

  const summary = totalsAgg[0] || {
    totalRevenue: 0,
    totalPaid: 0,
    totalOutstanding: 0,
  };

  return {
    bills,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit) || 1,
    },
    summary: {
      totalBills: total,
      totalRevenue: round2(summary.totalRevenue),
      totalPaid: round2(summary.totalPaid),
      totalOutstanding: round2(summary.totalOutstanding),
    },
  };
};

/**
 * 5. Update draft POS bill
 */
export const updateDraftPosBill = async (tenantId, user, billId, data) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(billId)) {
      const error = new Error('Invalid POS bill ID format');
      error.statusCode = 400;
      throw error;
    }

    const bill = await SalesInvoice.findOne({
      _id: billId,
      tenantId,
      isPOS: true,
    }).session(session);

    if (!bill) {
      const error = new Error('POS bill not found');
      error.statusCode = 404;
      throw error;
    }

    if (bill.invoiceStatus !== 'draft') {
      const error = new Error(`Cannot modify a ${bill.invoiceStatus} POS bill. Only draft bills can be updated.`);
      error.statusCode = 400;
      throw error;
    }

    const updatedWarehouseId = data.warehouseId || bill.warehouseId;
    const updatedPartyId = data.partyId !== undefined ? data.partyId : bill.partyId;
    const updatedItems = data.items || bill.items;
    const updatedPOS = data.placeOfSupply || bill.placeOfSupply;

    const { party, warehouse, calculation, customerName, customerPhone } = await validatePosContext(
      tenantId,
      {
        warehouseId: updatedWarehouseId,
        partyId: updatedPartyId,
        isWalkIn: data.isWalkIn !== undefined ? data.isWalkIn : bill.isWalkIn,
        customerName: data.customerName || bill.partyName,
        customerPhone: data.customerPhone,
        placeOfSupply: updatedPOS,
        items: updatedItems,
        billDiscount: data.billDiscount !== undefined ? data.billDiscount : 0,
      },
      session
    );

    bill.warehouseId = warehouse._id;
    bill.warehouseName = warehouse.warehouseName;
    bill.partyId = party._id;
    bill.partyName = customerName || party.name;
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
    bill.balanceAmount = calculation.grandTotal;
    if (data.notes !== undefined) bill.notes = data.notes;

    await bill.save({ session });

    await auditLogService.logAuditAction({
      tenantId,
      userId: user?._id || user?.userId,
      action: 'POS_BILL_UPDATED',
      module: 'pos',
      entityType: 'SalesInvoice',
      entityId: bill._id,
      targetName: bill.invoiceNumber,
      description: `Updated draft POS Bill ${bill.invoiceNumber}`,
      changes: data,
      session,
    });

    return bill;
  });
};

/**
 * 6. Cancel POS Bill with Stock, Payment and Journal Reversal
 */
export const cancelPosBill = async (tenantId, user, billId, cancellationReason) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(billId)) {
      const error = new Error('Invalid POS bill ID format');
      error.statusCode = 400;
      throw error;
    }

    const bill = await SalesInvoice.findOne({
      _id: billId,
      tenantId,
      isPOS: true,
    }).session(session);

    if (!bill) {
      const error = new Error('POS bill not found');
      error.statusCode = 404;
      throw error;
    }

    if (bill.invoiceStatus === 'cancelled') {
      const error = new Error('POS bill is already cancelled');
      error.statusCode = 400;
      throw error;
    }

    // 1. Restore Inventory Stock if bill was posted
    if (bill.stockDeducted && bill.invoiceStatus === 'posted') {
      for (const item of bill.items) {
        const prodQuery = Product.findOne({ _id: item.productId, tenantId });
        if (session) prodQuery.session(session);
        const product = await prodQuery;

        if (product && product.productType === 'goods' && product.trackInventory) {
          let invQuery = Inventory.findOne({
            tenantId,
            productId: product._id,
            warehouseId: bill.warehouseId,
          });
          if (session) invQuery.session(session);
          let inventory = await invQuery;

          const prevStock = inventory ? inventory.quantity : 0;
          const newStock = prevStock + item.quantity;

          if (inventory) {
            inventory.quantity = newStock;
            inventory.availableQuantity = newStock - inventory.reservedQuantity;
            await inventory.save({ session });
          } else {
            inventory = new Inventory({
              tenantId,
              productId: product._id,
              warehouseId: bill.warehouseId,
              quantity: newStock,
              availableQuantity: newStock,
            });
            await inventory.save({ session });

            product.stock = (product.stock || 0) + item.quantity;
            await product.save({ session });
          }

          // Record reversing stock movement
          const movement = new StockMovement({
            tenantId,
            productId: product._id,
            warehouseId: bill.warehouseId,
            movementType: 'sales_return',
            quantity: item.quantity,
            referenceType: 'sales_invoice',
            referenceId: bill._id,
            previousStock: prevStock,
            newStock,
            remarks: `Cancelled POS Bill ${bill.invoiceNumber}. Restored ${item.quantity} units.`,
            createdBy: user?._id || user?.userId,
          });
          await movement.save({ session });
        }
      }
    }

    // 2. Reverse Sales Invoice Journal Entry
    if (bill.invoiceStatus === 'posted') {
      await reverseSalesInvoiceJournal(tenantId, user?._id || user?.userId, bill, session);
    }

    // 3. Reverse Payments recorded on this POS Bill
    if (Array.isArray(bill.posPayments) && bill.posPayments.length > 0) {
      for (const p of bill.posPayments) {
        if (p.paymentId) {
          const paymentDoc = await Payment.findOne({
            _id: p.paymentId,
            tenantId,
          }).session(session);

          if (paymentDoc && paymentDoc.status !== 'cancelled') {
            // Reverse Bank Account balance if payment was linked to a bank
            if (paymentDoc.bankAccountId) {
              await BankAccount.findByIdAndUpdate(
                paymentDoc.bankAccountId,
                { $inc: { currentBalance: -paymentDoc.amount } },
                { session }
              );
            }

            paymentDoc.status = 'cancelled';
            paymentDoc.cancelledAt = new Date();
            paymentDoc.cancellationReason = `Cancelled along with POS Bill ${bill.invoiceNumber}: ${cancellationReason}`;
            await paymentDoc.save({ session });

            // Reverse Payment Journal Entry
            await reversePaymentJournal(tenantId, user?._id || user?.userId, paymentDoc, session);
          }
        }
      }
    }

    bill.invoiceStatus = 'cancelled';
    bill.cancelledAt = new Date();
    bill.cancellationReason = cancellationReason;
    await bill.save({ session });

    // Record Audit Log
    await auditLogService.logAuditAction({
      tenantId,
      userId: user?._id || user?.userId,
      action: 'POS_BILL_CANCELLED',
      module: 'pos',
      entityType: 'SalesInvoice',
      entityId: bill._id,
      targetName: bill.invoiceNumber,
      description: `Cancelled POS Bill ${bill.invoiceNumber}. Reason: ${cancellationReason}`,
      changes: { cancellationReason },
      session,
    });

    return bill;
  });
};

/**
 * 7. Get Formatted Thermal Receipt Data
 */
export const getPosReceiptData = async (tenantId, billId) => {
  const bill = await getPosBillById(tenantId, billId);
  const tenant = await Tenant.findById(tenantId).lean();

  const receipt = {
    store: {
      name: tenant?.businessName || tenant?.name || 'Retail Store',
      legalName: tenant?.legalName || tenant?.businessName || tenant?.name || '',
      GSTIN: tenant?.GSTIN || '',
      address: tenant?.address || '',
      city: tenant?.city || '',
      state: tenant?.state || '',
      pincode: tenant?.pincode || '',
      phone: tenant?.phone || '',
      email: tenant?.email || '',
    },
    bill: {
      billNumber: bill.posBillNumber || bill.invoiceNumber,
      date: bill.invoiceDate,
      time: new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      status: bill.invoiceStatus,
      paymentStatus: bill.paymentStatus,
      cashier: bill.cashierName || 'Cashier',
      warehouse: bill.warehouseName,
    },
    customer: {
      name: bill.partyName,
      phone: bill.partyId?.phone || '',
      GSTIN: bill.partyGSTIN || '',
      isWalkIn: bill.isWalkIn,
    },
    items: bill.items.map((i, idx) => ({
      sn: idx + 1,
      name: i.productName,
      HSN: i.HSN,
      quantity: i.quantity,
      unitPrice: round2(i.unitPrice),
      discount: round2(i.discount),
      taxableValue: round2(i.taxableValue),
      gstRate: i.gstRate,
      cgst: round2(i.cgst),
      sgst: round2(i.sgst),
      igst: round2(i.igst),
      lineTotal: round2(i.lineTotal),
    })),
    totals: {
      subtotal: round2(bill.subtotal),
      discountTotal: round2(bill.discountTotal),
      taxableAmount: round2(bill.taxableAmount),
      cgstTotal: round2(bill.cgstTotal),
      sgstTotal: round2(bill.sgstTotal),
      igstTotal: round2(bill.igstTotal),
      cessTotal: round2(bill.cessTotal),
      totalTax: round2(bill.cgstTotal + bill.sgstTotal + bill.igstTotal + bill.cessTotal),
      roundOff: round2(bill.roundOff),
      grandTotal: round2(bill.grandTotal),
      paidAmount: round2(bill.paidAmount),
      balanceAmount: round2(bill.balanceAmount),
      changeReturned: round2(bill.changeReturned || 0),
    },
    payments: (bill.posPayments || []).map((p) => ({
      method: p.paymentMethod,
      amount: round2(p.amount),
      referenceNumber: p.referenceNumber,
    })),
    footer: {
      message: 'Thank you for shopping with us! Visit again.',
      terms: 'Goods once sold cannot be returned without receipt.',
    },
  };

  return receipt;
};

/**
 * 8. Daily Sales Summary for POS Register
 */
export const getPosDailySummary = async (tenantId, query = {}) => {
  const targetDate = query.date ? new Date(query.date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const tId = new mongoose.Types.ObjectId(tenantId);
  const match = {
    tenantId: tId,
    isPOS: true,
    invoiceDate: { $gte: startOfDay, $lte: endOfDay },
  };

  if (query.warehouseId && mongoose.isValidObjectId(query.warehouseId)) {
    match.warehouseId = new mongoose.Types.ObjectId(query.warehouseId);
  }

  const [billsAgg, paymentsAgg] = await Promise.all([
    SalesInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          postedBills: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'posted'] }, 1, 0] },
          },
          draftBills: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'draft'] }, 1, 0] },
          },
          cancelledBills: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'cancelled'] }, 1, 0] },
          },
          grossSales: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'posted'] }, '$grandTotal', 0] },
          },
          taxableSales: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'posted'] }, '$taxableAmount', 0] },
          },
          cgstTotal: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'posted'] }, '$cgstTotal', 0] },
          },
          sgstTotal: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'posted'] }, '$sgstTotal', 0] },
          },
          igstTotal: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'posted'] }, '$igstTotal', 0] },
          },
          cessTotal: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'posted'] }, '$cessTotal', 0] },
          },
          totalPaid: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'posted'] }, '$paidAmount', 0] },
          },
          totalOutstanding: {
            $sum: { $cond: [{ $eq: ['$invoiceStatus', 'posted'] }, '$balanceAmount', 0] },
          },
        },
      },
    ]),
    SalesInvoice.aggregate([
      { $match: { ...match, invoiceStatus: 'posted' } },
      { $unwind: '$posPayments' },
      {
        $group: {
          _id: '$posPayments.paymentMethod',
          totalAmount: { $sum: '$posPayments.amount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const b = billsAgg[0] || {
    totalBills: 0,
    postedBills: 0,
    draftBills: 0,
    cancelledBills: 0,
    grossSales: 0,
    taxableSales: 0,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 0,
    cessTotal: 0,
    totalPaid: 0,
    totalOutstanding: 0,
  };

  const paymentBreakdown = {
    cash: 0,
    upi: 0,
    card: 0,
    bank: 0,
    other: 0,
  };

  for (const p of paymentsAgg) {
    if (p._id && paymentBreakdown[p._id] !== undefined) {
      paymentBreakdown[p._id] = round2(p.totalAmount);
    } else if (p._id) {
      paymentBreakdown.other = round2(paymentBreakdown.other + p.totalAmount);
    }
  }

  const totalTax = round2(b.cgstTotal + b.sgstTotal + b.igstTotal + b.cessTotal);

  return {
    date: startOfDay.toISOString().split('T')[0],
    summary: {
      totalBills: b.totalBills,
      postedBills: b.postedBills,
      draftBills: b.draftBills,
      cancelledBills: b.cancelledBills,
      grossSales: round2(b.grossSales),
      taxableSales: round2(b.taxableSales),
      totalTax,
      cgstTotal: round2(b.cgstTotal),
      sgstTotal: round2(b.sgstTotal),
      igstTotal: round2(b.igstTotal),
      cessTotal: round2(b.cessTotal),
      totalPaid: round2(b.totalPaid),
      totalOutstanding: round2(b.totalOutstanding),
    },
    paymentCollections: {
      ...paymentBreakdown,
      totalCollected: round2(
        paymentBreakdown.cash +
          paymentBreakdown.upi +
          paymentBreakdown.card +
          paymentBreakdown.bank +
          paymentBreakdown.other
      ),
    },
  };
};

/**
 * 9. Cashier-wise Sales Summary
 */
export const getPosCashierSummary = async (tenantId, query = {}) => {
  const targetDate = query.date ? new Date(query.date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const tId = new mongoose.Types.ObjectId(tenantId);
  const match = {
    tenantId: tId,
    isPOS: true,
    invoiceStatus: 'posted',
    invoiceDate: { $gte: startOfDay, $lte: endOfDay },
  };

  if (query.cashierId && mongoose.isValidObjectId(query.cashierId)) {
    match.cashierId = new mongoose.Types.ObjectId(query.cashierId);
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: '$cashierId',
        cashierName: { $first: '$cashierName' },
        billCount: { $sum: 1 },
        totalSales: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$paidAmount' },
        totalCash: {
          $sum: {
            $reduce: {
              input: '$posPayments',
              initialValue: 0,
              in: {
                $cond: [
                  { $eq: ['$$this.paymentMethod', 'cash'] },
                  { $add: ['$$value', '$$this.amount'] },
                  '$$value',
                ],
              },
            },
          },
        },
      },
    },
    { $sort: { totalSales: -1 } },
  ];

  const cashiers = await SalesInvoice.aggregate(pipeline);

  return {
    date: startOfDay.toISOString().split('T')[0],
    cashiers: cashiers.map((c) => ({
      cashierId: c._id,
      cashierName: c.cashierName || 'Cashier',
      billCount: c.billCount,
      totalSales: round2(c.totalSales),
      totalPaid: round2(c.totalPaid),
      totalCash: round2(c.totalCash),
    })),
  };
};

export default {
  getOrCreateWalkInCustomer,
  searchPosProducts,
  searchPosCustomers,
  createPosBill,
  finalizePosBill,
  getPosBillById,
  getPosBills,
  updateDraftPosBill,
  cancelPosBill,
  getPosReceiptData,
  getPosDailySummary,
  getPosCashierSummary,
};
