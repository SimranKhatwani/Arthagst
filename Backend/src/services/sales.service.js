import mongoose from 'mongoose';
import SalesInvoice from '../models/salesInvoice.model.js';
import Quotation from '../models/quotation.model.js';
import SalesOrder from '../models/salesOrder.model.js';
import DeliveryChallan from '../models/deliveryChallan.model.js';
import CreditNote from '../models/creditNote.model.js';
import Party from '../models/party.model.js';
import Warehouse from '../models/warehouse.model.js';
import Product from '../models/product.model.js';
import Tenant from '../models/tenant.model.js';
import Inventory from '../models/inventory.model.js';
import StockMovement from '../models/stockMovement.model.js';
import salesCalculator from './sales.calculator.js';
import {
  postSalesInvoiceJournal,
  reverseSalesInvoiceJournal,
  postCreditNoteJournal,
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
 * Validate Party, Warehouse, and Products for a sales document
 */
const validateSalesContext = async (tenantId, { partyId, warehouseId, placeOfSupply, items, paidAmount = 0 }, session = null) => {
  if (!mongoose.isValidObjectId(partyId)) {
    const error = new Error('Invalid party ID format');
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

  const supplierStateCode = tenant.stateCode || (tenant.GSTIN ? tenant.GSTIN.substring(0, 2) : '27');

  // 2. Validate Party (Customer)
  const partyQuery = Party.findOne({
    _id: partyId,
    tenantId,
    isDeleted: false,
  });
  if (session) partyQuery.session(session);
  const party = await partyQuery;

  if (!party) {
    const error = new Error('Customer party not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  if (!party.isActive) {
    const error = new Error(`Customer party '${party.name}' is currently inactive`);
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

  // Determine Place of Supply
  const resolvedPOS = placeOfSupply || party.stateCode || party.state || supplierStateCode;

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
      const error = new Error(`Product '${product.name}' is inactive and cannot be billed`);
      error.statusCode = 400;
      throw error;
    }

    const unitPrice = rawItem.unitPrice !== undefined ? Number(rawItem.unitPrice) : product.sellingPrice;
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
  const calculation = salesCalculator.calculateSalesDocument({
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
 * 1. Create a draft sales invoice
 */
export const createDraftInvoice = async (tenantId, userId, data) => {
  const { party, warehouse, calculation, resolvedPOS } = await validateSalesContext(
    tenantId,
    data
  );

  const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
  const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
    tenantId,
    'invoice',
    invoiceDate
  );

  const invoice = new SalesInvoice({
    tenantId,
    invoiceNumber: documentNumber,
    financialYear,
    partyId: party._id,
    partyName: party.name,
    partyGSTIN: party.GSTIN || null,
    partyPAN: party.PAN || null,
    warehouseId: warehouse._id,
    warehouseName: warehouse.warehouseName,
    invoiceDate,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    placeOfSupply: resolvedPOS,
    placeOfSupplyCode: calculation.placeOfSupplyCode,
    supplierStateCode: calculation.supplierStateCode,
    isInterState: calculation.isInterState,
    isExport: data.isExport || false,
    exportType: data.isExport ? (data.exportType || 'WOPAY') : null,
    billingAddress: data.billingAddress || party.billingAddress || '',
    shippingAddress: data.shippingAddress || party.shippingAddress || party.billingAddress || '',
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
    invoiceStatus: 'draft',
    stockDeducted: false,
    notes: data.notes || '',
    termsAndConditions: data.termsAndConditions || '',
    salesOrderId: data.salesOrderId || null,
    quotationId: data.quotationId || null,
    deliveryChallanId: data.deliveryChallanId || null,
    createdBy: userId,
  });

  await invoice.save();
  return invoice;
};

/**
 * 2. List sales invoices with pagination, search, and filters
 */
export const getInvoices = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    partyId,
    warehouseId,
    status,
    paymentStatus,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (partyId && mongoose.isValidObjectId(partyId)) {
    query.partyId = partyId;
  }

  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.warehouseId = warehouseId;
  }

  if (status) {
    query.invoiceStatus = status;
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  if (startDate || endDate) {
    query.invoiceDate = {};
    if (startDate) query.invoiceDate.$gte = new Date(startDate);
    if (endDate) query.invoiceDate.$lte = new Date(endDate);
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { invoiceNumber: searchRegex },
      { partyName: searchRegex },
      { 'items.productName': searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortBy]: sortDirection };

  const [invoices, total] = await Promise.all([
    SalesInvoice.find(query).sort(sortOptions).skip(skip).limit(limit),
    SalesInvoice.countDocuments(query),
  ]);

  return {
    invoices,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 3. Get invoice details by ID
 */
export const getInvoiceById = async (tenantId, invoiceId) => {
  if (!mongoose.isValidObjectId(invoiceId)) {
    const error = new Error('Invalid invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const invoice = await SalesInvoice.findOne({
    _id: invoiceId,
    tenantId,
  })
    .populate('partyId', 'name phone email billingAddress shippingAddress GSTIN PAN')
    .populate('warehouseId', 'warehouseName warehouseCode city state')
    .populate('createdBy', 'name email role');

  if (!invoice) {
    const error = new Error('Sales invoice not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  return invoice;
};

/**
 * 4. Update draft invoice
 */
export const updateDraftInvoice = async (tenantId, invoiceId, data) => {
  if (!mongoose.isValidObjectId(invoiceId)) {
    const error = new Error('Invalid invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const invoice = await SalesInvoice.findOne({
    _id: invoiceId,
    tenantId,
  });

  if (!invoice) {
    const error = new Error('Sales invoice not found');
    error.statusCode = 404;
    throw error;
  }

  if (invoice.invoiceStatus !== 'draft') {
    const error = new Error(`Cannot modify a ${invoice.invoiceStatus} invoice. Only draft invoices can be updated.`);
    error.statusCode = 400;
    throw error;
  }

  const updatedPartyId = data.partyId || invoice.partyId;
  const updatedWarehouseId = data.warehouseId || invoice.warehouseId;
  const updatedItems = data.items || invoice.items;
  const updatedPOS = data.placeOfSupply || invoice.placeOfSupply;
  const updatedPaid = data.paidAmount !== undefined ? data.paidAmount : invoice.paidAmount;

  const { party, warehouse, calculation } = await validateSalesContext(tenantId, {
    partyId: updatedPartyId,
    warehouseId: updatedWarehouseId,
    placeOfSupply: updatedPOS,
    items: updatedItems,
    paidAmount: updatedPaid,
  });

  invoice.partyId = party._id;
  invoice.partyName = party.name;
  invoice.partyGSTIN = party.GSTIN || null;
  invoice.partyPAN = party.PAN || null;
  invoice.warehouseId = warehouse._id;
  invoice.warehouseName = warehouse.warehouseName;
  if (data.invoiceDate) invoice.invoiceDate = new Date(data.invoiceDate);
  if (data.dueDate !== undefined) invoice.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  invoice.placeOfSupply = updatedPOS;
  invoice.placeOfSupplyCode = calculation.placeOfSupplyCode;
  invoice.supplierStateCode = calculation.supplierStateCode;
  invoice.isInterState = calculation.isInterState;
  if (data.billingAddress !== undefined) invoice.billingAddress = data.billingAddress;
  if (data.shippingAddress !== undefined) invoice.shippingAddress = data.shippingAddress;
  if (data.notes !== undefined) invoice.notes = data.notes;
  if (data.termsAndConditions !== undefined) invoice.termsAndConditions = data.termsAndConditions;

  invoice.items = calculation.items;
  invoice.subtotal = calculation.subtotal;
  invoice.discountTotal = calculation.discountTotal;
  invoice.taxableAmount = calculation.taxableAmount;
  invoice.cgstTotal = calculation.cgstTotal;
  invoice.sgstTotal = calculation.sgstTotal;
  invoice.igstTotal = calculation.igstTotal;
  invoice.cessTotal = calculation.cessTotal;
  invoice.roundOff = calculation.roundOff;
  invoice.grandTotal = calculation.grandTotal;
  invoice.paidAmount = calculation.paidAmount;
  invoice.balanceAmount = calculation.balanceAmount;
  invoice.paymentStatus = calculation.paymentStatus;

  await invoice.save();
  return invoice;
};

/**
 * 5. Post invoice: finalizes invoice and reduces warehouse inventory atomically
 */
export const postInvoice = async (tenantId, userId, invoiceId) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(invoiceId)) {
      const error = new Error('Invalid invoice ID format');
      error.statusCode = 400;
      throw error;
    }

    const invoice = await SalesInvoice.findOne({
      _id: invoiceId,
      tenantId,
    }).session(session);

    if (!invoice) {
      const error = new Error('Sales invoice not found');
      error.statusCode = 404;
      throw error;
    }

    if (invoice.invoiceStatus === 'posted') {
      const error = new Error('Invoice is already finalized and posted.');
      error.statusCode = 400;
      throw error;
    }

    if (invoice.invoiceStatus === 'cancelled') {
      const error = new Error('Cannot post a cancelled invoice.');
      error.statusCode = 400;
      throw error;
    }

    // Process stock deduction for each item requiring inventory tracking
    for (const item of invoice.items) {
      const product = await Product.findOne({
        _id: item.productId,
        tenantId,
      }).session(session);

      if (product && product.productType === 'goods' && product.trackInventory) {
        let inventory = await Inventory.findOne({
          tenantId,
          productId: product._id,
          warehouseId: invoice.warehouseId,
        }).session(session);

        const available = inventory ? inventory.availableQuantity : 0;
        if (!inventory || available < item.quantity) {
          const error = new Error(
            `Insufficient stock for '${item.productName}' in warehouse '${invoice.warehouseName}'. Available: ${available}, Required: ${item.quantity}`
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

        // Record append-only stock movement
        const movement = new StockMovement({
          tenantId,
          productId: product._id,
          warehouseId: invoice.warehouseId,
          movementType: 'sales',
          quantity: item.quantity,
          referenceType: 'sales_invoice',
          referenceId: invoice._id,
          previousStock: prevStock,
          newStock,
          remarks: `Invoice ${invoice.invoiceNumber} posted`,
          createdBy: userId,
        });
        await movement.save({ session });

        // Trigger low stock alert notification if inventory falls to or below threshold
        if (
          product.lowStockAlert !== undefined &&
          product.lowStockAlert !== null &&
          newStock <= product.lowStockAlert
        ) {
          await notificationService.createNotification({
            tenantId,
            title: 'Low Stock Alert',
            message: `Product '${product.name}' is low on stock (${newStock} remaining, alert threshold: ${product.lowStockAlert}).`,
            notificationType: 'low_stock',
            referenceType: 'Product',
            referenceId: product._id,
            session,
          });
        }
      }
    }

    invoice.invoiceStatus = 'posted';
    invoice.stockDeducted = true;
    invoice.postedAt = new Date();
    await invoice.save({ session });

    // Automatic Accounting Journal Posting
    await postSalesInvoiceJournal(tenantId, userId, invoice, session);

    // Sales Invoice Notification
    await notificationService.createNotification({
      tenantId,
      title: 'Sales Invoice Posted',
      message: `Sales invoice ${invoice.invoiceNumber} for ${invoice.partyName} (₹${invoice.grandTotal}) has been posted.`,
      notificationType: 'sales_invoice',
      referenceType: 'SalesInvoice',
      referenceId: invoice._id,
      session,
    });

    // Record Audit Log for invoice posting
    await auditLogService.logAuditAction({
      tenantId,
      userId,
      action: 'SALES_INVOICE_POSTED',
      module: 'sales',
      entityType: 'SalesInvoice',
      entityId: invoice._id,
      targetName: invoice.invoiceNumber,
      description: `Posted sales invoice ${invoice.invoiceNumber} for ₹${invoice.grandTotal}`,
      changes: {
        invoiceNumber: invoice.invoiceNumber,
        partyName: invoice.partyName,
        grandTotal: invoice.grandTotal,
      },
      session,
    });

    return invoice;
  });
};

/**
 * 6. Cancel invoice: rolls back stock if invoice was posted
 */
export const cancelInvoice = async (tenantId, userId, invoiceId, cancellationReason) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(invoiceId)) {
      const error = new Error('Invalid invoice ID format');
      error.statusCode = 400;
      throw error;
    }

    const invoice = await SalesInvoice.findOne({
      _id: invoiceId,
      tenantId,
    }).session(session);

    if (!invoice) {
      const error = new Error('Sales invoice not found');
      error.statusCode = 404;
      throw error;
    }

    if (invoice.invoiceStatus === 'cancelled') {
      const error = new Error('Invoice is already cancelled.');
      error.statusCode = 400;
      throw error;
    }

    // Check if sales returns/credit notes already exist against this invoice
    const creditNoteExists = await CreditNote.exists({
      invoiceId: invoice._id,
      tenantId,
      status: { $ne: 'cancelled' },
    }).session(session);

    if (creditNoteExists) {
      const error = new Error('Cannot cancel invoice because active Credit Notes exist against it. Cancel the credit notes first.');
      error.statusCode = 400;
      throw error;
    }

    if (invoice.eInvoiceStatus === 'generated') {
      const error = new Error('Cannot cancel invoice with an active E-Invoice (IRN). Please cancel the IRN first.');
      error.statusCode = 400;
      throw error;
    }

    if (invoice.eWayBillStatus === 'generated') {
      const error = new Error('Cannot cancel invoice with an active E-Way Bill. Please cancel the E-Way Bill first.');
      error.statusCode = 400;
      throw error;
    }

    // If stock was previously deducted, restore it atomically
    if (invoice.stockDeducted && invoice.invoiceStatus === 'posted') {
      for (const item of invoice.items) {
        const product = await Product.findOne({
          _id: item.productId,
          tenantId,
        }).session(session);

        if (product && product.productType === 'goods' && product.trackInventory) {
          let inventory = await Inventory.findOne({
            tenantId,
            productId: product._id,
            warehouseId: invoice.warehouseId,
          }).session(session);

          const prevStock = inventory ? inventory.quantity : 0;
          const newStock = prevStock + item.quantity;

          if (!inventory) {
            inventory = new Inventory({
              tenantId,
              productId: product._id,
              warehouseId: invoice.warehouseId,
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

          // Record restoration movement
          const movement = new StockMovement({
            tenantId,
            productId: product._id,
            warehouseId: invoice.warehouseId,
            movementType: 'sales_return',
            quantity: item.quantity,
            referenceType: 'sales_cancellation',
            referenceId: invoice._id,
            previousStock: prevStock,
            newStock,
            remarks: `Cancelled Invoice ${invoice.invoiceNumber}: ${cancellationReason}`,
            createdBy: userId,
          });
          await movement.save({ session });
        }
      }
    }

    const wasPosted = invoice.invoiceStatus === 'posted';
    invoice.invoiceStatus = 'cancelled';
    invoice.cancelledAt = new Date();
    invoice.cancellationReason = cancellationReason;
    await invoice.save({ session });

    // Reverse accounting journal entry if invoice was posted
    if (wasPosted) {
      await reverseSalesInvoiceJournal(tenantId, userId, invoice, session);
    }

    // Record Audit Log for invoice cancellation
    await auditLogService.logAuditAction({
      tenantId,
      userId,
      action: 'SALES_INVOICE_CANCELLED',
      module: 'sales',
      entityType: 'SalesInvoice',
      entityId: invoice._id,
      targetName: invoice.invoiceNumber,
      description: `Cancelled sales invoice ${invoice.invoiceNumber}. Reason: ${cancellationReason}`,
      changes: { cancellationReason },
      session,
    });

    return invoice;
  });
};

/**
 * 7. Quotation workflows
 */
export const createQuotation = async (tenantId, userId, data) => {
  const { party, warehouse, calculation, resolvedPOS } = await validateSalesContext(tenantId, data);
  const quotationDate = data.quotationDate ? new Date(data.quotationDate) : new Date();
  const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
    tenantId,
    'quotation',
    quotationDate
  );

  const quotation = new Quotation({
    tenantId,
    quotationNumber: documentNumber,
    financialYear,
    partyId: party._id,
    partyName: party.name,
    partyGSTIN: party.GSTIN || null,
    partyPAN: party.PAN || null,
    warehouseId: warehouse._id,
    warehouseName: warehouse.warehouseName,
    quotationDate,
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
    placeOfSupply: resolvedPOS,
    placeOfSupplyCode: calculation.placeOfSupplyCode,
    supplierStateCode: calculation.supplierStateCode,
    isInterState: calculation.isInterState,
    isExport: data.isExport || false,
    exportType: data.isExport ? (data.exportType || 'WOPAY') : null,
    billingAddress: data.billingAddress || party.billingAddress || '',
    shippingAddress: data.shippingAddress || party.shippingAddress || '',
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
    termsAndConditions: data.termsAndConditions || '',
    createdBy: userId,
  });

  await quotation.save();
  return quotation;
};

export const convertQuotationToOrder = async (tenantId, userId, quotationId) => {
  const quotation = await Quotation.findOne({ _id: quotationId, tenantId });
  if (!quotation) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  if (quotation.status === 'converted_to_order' || quotation.status === 'converted_to_invoice') {
    const error = new Error('Quotation has already been converted');
    error.statusCode = 400;
    throw error;
  }

  const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
    tenantId,
    'order',
    new Date()
  );

  const salesOrder = new SalesOrder({
    tenantId,
    orderNumber: documentNumber,
    financialYear,
    quotationId: quotation._id,
    partyId: quotation.partyId,
    partyName: quotation.partyName,
    partyGSTIN: quotation.partyGSTIN,
    partyPAN: quotation.partyPAN,
    warehouseId: quotation.warehouseId,
    warehouseName: quotation.warehouseName,
    orderDate: new Date(),
    placeOfSupply: quotation.placeOfSupply,
    placeOfSupplyCode: quotation.placeOfSupplyCode,
    supplierStateCode: quotation.supplierStateCode,
    isInterState: quotation.isInterState,
    billingAddress: quotation.billingAddress,
    shippingAddress: quotation.shippingAddress,
    items: quotation.items,
    subtotal: quotation.subtotal,
    discountTotal: quotation.discountTotal,
    taxableAmount: quotation.taxableAmount,
    cgstTotal: quotation.cgstTotal,
    sgstTotal: quotation.sgstTotal,
    igstTotal: quotation.igstTotal,
    cessTotal: quotation.cessTotal,
    roundOff: quotation.roundOff,
    grandTotal: quotation.grandTotal,
    status: 'confirmed',
    createdBy: userId,
  });

  await salesOrder.save();

  quotation.status = 'converted_to_order';
  quotation.convertedToOrderId = salesOrder._id;
  await quotation.save();

  return salesOrder;
};

export const convertQuotationToInvoice = async (tenantId, userId, quotationId) => {
  const quotation = await Quotation.findOne({ _id: quotationId, tenantId });
  if (!quotation) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  if (quotation.status === 'converted_to_invoice') {
    const error = new Error('Quotation has already been converted to an invoice');
    error.statusCode = 400;
    throw error;
  }

  const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
    tenantId,
    'invoice',
    new Date()
  );

  const invoice = new SalesInvoice({
    tenantId,
    invoiceNumber: documentNumber,
    financialYear,
    quotationId: quotation._id,
    partyId: quotation.partyId,
    partyName: quotation.partyName,
    partyGSTIN: quotation.partyGSTIN,
    partyPAN: quotation.partyPAN,
    warehouseId: quotation.warehouseId,
    warehouseName: quotation.warehouseName,
    invoiceDate: new Date(),
    placeOfSupply: quotation.placeOfSupply,
    placeOfSupplyCode: quotation.placeOfSupplyCode,
    supplierStateCode: quotation.supplierStateCode,
    isInterState: quotation.isInterState,
    billingAddress: quotation.billingAddress,
    shippingAddress: quotation.shippingAddress,
    items: quotation.items,
    subtotal: quotation.subtotal,
    discountTotal: quotation.discountTotal,
    taxableAmount: quotation.taxableAmount,
    cgstTotal: quotation.cgstTotal,
    sgstTotal: quotation.sgstTotal,
    igstTotal: quotation.igstTotal,
    cessTotal: quotation.cessTotal,
    roundOff: quotation.roundOff,
    grandTotal: quotation.grandTotal,
    paidAmount: 0,
    balanceAmount: quotation.grandTotal,
    paymentStatus: 'unpaid',
    invoiceStatus: 'draft',
    stockDeducted: false,
    createdBy: userId,
  });

  await invoice.save();

  quotation.status = 'converted_to_invoice';
  quotation.convertedToInvoiceId = invoice._id;
  await quotation.save();

  return invoice;
};

export const getQuotations = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    partyId,
    warehouseId,
    status,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (partyId && mongoose.isValidObjectId(partyId)) {
    query.partyId = partyId;
  }
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.warehouseId = warehouseId;
  }
  if (status) {
    query.status = status;
  }
  if (startDate || endDate) {
    query.quotationDate = {};
    if (startDate) query.quotationDate.$gte = new Date(startDate);
    if (endDate) query.quotationDate.$lte = new Date(endDate);
  }
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { quotationNumber: searchRegex },
      { partyName: searchRegex },
      { 'items.productName': searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortBy]: sortDirection };

  const [quotations, total] = await Promise.all([
    Quotation.find(query).sort(sortOptions).skip(skip).limit(limit),
    Quotation.countDocuments(query),
  ]);

  return {
    quotations,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getQuotationById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid quotation ID format');
    error.statusCode = 400;
    throw error;
  }

  const quotation = await Quotation.findOne({ _id: id, tenantId });
  if (!quotation) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  return quotation;
};

export const updateQuotation = async (tenantId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid quotation ID format');
    error.statusCode = 400;
    throw error;
  }

  const quotation = await Quotation.findOne({ _id: id, tenantId });
  if (!quotation) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  if (quotation.status === 'converted_to_order' || quotation.status === 'converted_to_invoice') {
    const error = new Error('Cannot update an already converted quotation');
    error.statusCode = 400;
    throw error;
  }

  if (data.items || data.partyId || data.warehouseId || data.placeOfSupply) {
    const partyId = data.partyId || quotation.partyId;
    const warehouseId = data.warehouseId || quotation.warehouseId;
    const items = data.items || quotation.items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      description: it.description,
    }));
    const placeOfSupply = data.placeOfSupply || quotation.placeOfSupply;

    const { party, warehouse, calculation, resolvedPOS } = await validateSalesContext(tenantId, {
      partyId,
      warehouseId,
      items,
      placeOfSupply,
    });

    quotation.partyId = party._id;
    quotation.partyName = party.name;
    quotation.partyGSTIN = party.GSTIN || null;
    quotation.partyPAN = party.PAN || null;
    quotation.warehouseId = warehouse._id;
    quotation.warehouseName = warehouse.warehouseName;
    quotation.placeOfSupply = resolvedPOS;
    quotation.placeOfSupplyCode = calculation.placeOfSupplyCode;
    quotation.supplierStateCode = calculation.supplierStateCode;
    quotation.isInterState = calculation.isInterState;
    quotation.items = calculation.items;
    quotation.subtotal = calculation.subtotal;
    quotation.discountTotal = calculation.discountTotal;
    quotation.taxableAmount = calculation.taxableAmount;
    quotation.cgstTotal = calculation.cgstTotal;
    quotation.sgstTotal = calculation.sgstTotal;
    quotation.igstTotal = calculation.igstTotal;
    quotation.cessTotal = calculation.cessTotal;
    quotation.roundOff = calculation.roundOff;
    quotation.grandTotal = calculation.grandTotal;
  }

  if (data.quotationDate) quotation.quotationDate = new Date(data.quotationDate);
  if (data.validUntil !== undefined) quotation.validUntil = data.validUntil ? new Date(data.validUntil) : null;
  if (data.billingAddress !== undefined) quotation.billingAddress = data.billingAddress;
  if (data.shippingAddress !== undefined) quotation.shippingAddress = data.shippingAddress;
  if (data.notes !== undefined) quotation.notes = data.notes;
  if (data.termsAndConditions !== undefined) quotation.termsAndConditions = data.termsAndConditions;
  if (data.status) quotation.status = data.status;

  await quotation.save();
  return quotation;
};

export const deleteQuotation = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid quotation ID format');
    error.statusCode = 400;
    throw error;
  }

  const quotation = await Quotation.findOne({ _id: id, tenantId });
  if (!quotation) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  if (quotation.status === 'converted_to_order' || quotation.status === 'converted_to_invoice') {
    const error = new Error('Cannot delete an already converted quotation');
    error.statusCode = 400;
    throw error;
  }

  await quotation.deleteOne();
  return { message: 'Quotation deleted successfully' };
};

/**
 * 8. Sales Order workflows
 */
export const createSalesOrder = async (tenantId, userId, data) => {
  const { party, warehouse, calculation, resolvedPOS } = await validateSalesContext(tenantId, data);
  const orderDate = data.orderDate ? new Date(data.orderDate) : new Date();
  const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
    tenantId,
    'order',
    orderDate
  );

  const salesOrder = new SalesOrder({
    tenantId,
    orderNumber: documentNumber,
    financialYear,
    quotationId: data.quotationId || null,
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
    isExport: data.isExport || false,
    exportType: data.isExport ? (data.exportType || 'WOPAY') : null,
    billingAddress: data.billingAddress || party.billingAddress || '',
    shippingAddress: data.shippingAddress || party.shippingAddress || '',
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
    termsAndConditions: data.termsAndConditions || '',
    createdBy: userId,
  });

  await salesOrder.save();
  return salesOrder;
};

export const convertOrderToInvoice = async (tenantId, userId, orderId) => {
  const order = await SalesOrder.findOne({ _id: orderId, tenantId });
  if (!order) {
    const error = new Error('Sales order not found');
    error.statusCode = 404;
    throw error;
  }

  if (order.status === 'converted_to_invoice') {
    const error = new Error('Sales order has already been converted to an invoice');
    error.statusCode = 400;
    throw error;
  }

  const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
    tenantId,
    'invoice',
    new Date()
  );

  const invoice = new SalesInvoice({
    tenantId,
    invoiceNumber: documentNumber,
    financialYear,
    salesOrderId: order._id,
    partyId: order.partyId,
    partyName: order.partyName,
    partyGSTIN: order.partyGSTIN,
    partyPAN: order.partyPAN,
    warehouseId: order.warehouseId,
    warehouseName: order.warehouseName,
    invoiceDate: new Date(),
    placeOfSupply: order.placeOfSupply,
    placeOfSupplyCode: order.placeOfSupplyCode,
    supplierStateCode: order.supplierStateCode,
    isInterState: order.isInterState,
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    items: order.items,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    taxableAmount: order.taxableAmount,
    cgstTotal: order.cgstTotal,
    sgstTotal: order.sgstTotal,
    igstTotal: order.igstTotal,
    cessTotal: order.cessTotal,
    roundOff: order.roundOff,
    grandTotal: order.grandTotal,
    paidAmount: 0,
    balanceAmount: order.grandTotal,
    paymentStatus: 'unpaid',
    invoiceStatus: 'draft',
    stockDeducted: false,
    createdBy: userId,
  });

  await invoice.save();

  order.status = 'converted_to_invoice';
  order.convertedToInvoiceId = invoice._id;
  await order.save();

  return invoice;
};

export const getSalesOrders = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    partyId,
    warehouseId,
    status,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (partyId && mongoose.isValidObjectId(partyId)) {
    query.partyId = partyId;
  }
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.warehouseId = warehouseId;
  }
  if (status) {
    query.status = status;
  }
  if (startDate || endDate) {
    query.orderDate = {};
    if (startDate) query.orderDate.$gte = new Date(startDate);
    if (endDate) query.orderDate.$lte = new Date(endDate);
  }
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { orderNumber: searchRegex },
      { partyName: searchRegex },
      { 'items.productName': searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortBy]: sortDirection };

  const [salesOrders, total] = await Promise.all([
    SalesOrder.find(query).sort(sortOptions).skip(skip).limit(limit),
    SalesOrder.countDocuments(query),
  ]);

  return {
    salesOrders,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getSalesOrderById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid sales order ID format');
    error.statusCode = 400;
    throw error;
  }

  const salesOrder = await SalesOrder.findOne({ _id: id, tenantId });
  if (!salesOrder) {
    const error = new Error('Sales order not found');
    error.statusCode = 404;
    throw error;
  }

  return salesOrder;
};

export const updateSalesOrder = async (tenantId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid sales order ID format');
    error.statusCode = 400;
    throw error;
  }

  const salesOrder = await SalesOrder.findOne({ _id: id, tenantId });
  if (!salesOrder) {
    const error = new Error('Sales order not found');
    error.statusCode = 404;
    throw error;
  }

  if (salesOrder.status === 'converted_to_invoice') {
    const error = new Error('Cannot update an already converted sales order');
    error.statusCode = 400;
    throw error;
  }

  if (data.items || data.partyId || data.warehouseId || data.placeOfSupply) {
    const partyId = data.partyId || salesOrder.partyId;
    const warehouseId = data.warehouseId || salesOrder.warehouseId;
    const items = data.items || salesOrder.items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      description: it.description,
    }));
    const placeOfSupply = data.placeOfSupply || salesOrder.placeOfSupply;

    const { party, warehouse, calculation, resolvedPOS } = await validateSalesContext(tenantId, {
      partyId,
      warehouseId,
      items,
      placeOfSupply,
    });

    salesOrder.partyId = party._id;
    salesOrder.partyName = party.name;
    salesOrder.partyGSTIN = party.GSTIN || null;
    salesOrder.partyPAN = party.PAN || null;
    salesOrder.warehouseId = warehouse._id;
    salesOrder.warehouseName = warehouse.warehouseName;
    salesOrder.placeOfSupply = resolvedPOS;
    salesOrder.placeOfSupplyCode = calculation.placeOfSupplyCode;
    salesOrder.supplierStateCode = calculation.supplierStateCode;
    salesOrder.isInterState = calculation.isInterState;
    salesOrder.items = calculation.items;
    salesOrder.subtotal = calculation.subtotal;
    salesOrder.discountTotal = calculation.discountTotal;
    salesOrder.taxableAmount = calculation.taxableAmount;
    salesOrder.cgstTotal = calculation.cgstTotal;
    salesOrder.sgstTotal = calculation.sgstTotal;
    salesOrder.igstTotal = calculation.igstTotal;
    salesOrder.cessTotal = calculation.cessTotal;
    salesOrder.roundOff = calculation.roundOff;
    salesOrder.grandTotal = calculation.grandTotal;
  }

  if (data.orderDate) salesOrder.orderDate = new Date(data.orderDate);
  if (data.expectedDeliveryDate !== undefined) salesOrder.expectedDeliveryDate = data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null;
  if (data.billingAddress !== undefined) salesOrder.billingAddress = data.billingAddress;
  if (data.shippingAddress !== undefined) salesOrder.shippingAddress = data.shippingAddress;
  if (data.notes !== undefined) salesOrder.notes = data.notes;
  if (data.termsAndConditions !== undefined) salesOrder.termsAndConditions = data.termsAndConditions;
  if (data.status) salesOrder.status = data.status;

  await salesOrder.save();
  return salesOrder;
};

export const cancelSalesOrder = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid sales order ID format');
    error.statusCode = 400;
    throw error;
  }

  const salesOrder = await SalesOrder.findOne({ _id: id, tenantId });
  if (!salesOrder) {
    const error = new Error('Sales order not found');
    error.statusCode = 404;
    throw error;
  }

  if (salesOrder.status === 'converted_to_invoice') {
    const error = new Error('Cannot cancel an already converted sales order');
    error.statusCode = 400;
    throw error;
  }

  salesOrder.status = 'cancelled';
  await salesOrder.save();
  return salesOrder;
};

/**
 * 9. Delivery Challan workflows
 */
export const createDeliveryChallan = async (tenantId, userId, data) => {
  const { party, warehouse, calculation, resolvedPOS } = await validateSalesContext(tenantId, data);
  const challanDate = data.challanDate ? new Date(data.challanDate) : new Date();
  const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
    tenantId,
    'challan',
    challanDate
  );

  const challan = new DeliveryChallan({
    tenantId,
    challanNumber: documentNumber,
    financialYear,
    salesOrderId: data.salesOrderId || null,
    partyId: party._id,
    partyName: party.name,
    partyGSTIN: party.GSTIN || null,
    partyPAN: party.PAN || null,
    warehouseId: warehouse._id,
    warehouseName: warehouse.warehouseName,
    challanDate,
    challanType: data.challanType || 'supply_on_approval',
    vehicleNumber: data.vehicleNumber || '',
    placeOfSupply: resolvedPOS,
    placeOfSupplyCode: calculation.placeOfSupplyCode,
    supplierStateCode: calculation.supplierStateCode,
    isInterState: calculation.isInterState,
    isExport: data.isExport || false,
    exportType: data.isExport ? (data.exportType || 'WOPAY') : null,
    billingAddress: data.billingAddress || party.billingAddress || '',
    shippingAddress: data.shippingAddress || party.shippingAddress || '',
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

  await challan.save();
  return challan;
};

export const convertChallanToInvoice = async (tenantId, userId, challanId) => {
  const challan = await DeliveryChallan.findOne({ _id: challanId, tenantId });
  if (!challan) {
    const error = new Error('Delivery challan not found');
    error.statusCode = 404;
    throw error;
  }

  if (challan.status === 'converted_to_invoice') {
    const error = new Error('Delivery challan has already been converted to an invoice');
    error.statusCode = 400;
    throw error;
  }

  const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
    tenantId,
    'invoice',
    new Date()
  );

  const invoice = new SalesInvoice({
    tenantId,
    invoiceNumber: documentNumber,
    financialYear,
    deliveryChallanId: challan._id,
    partyId: challan.partyId,
    partyName: challan.partyName,
    partyGSTIN: challan.partyGSTIN,
    partyPAN: challan.partyPAN,
    warehouseId: challan.warehouseId,
    warehouseName: challan.warehouseName,
    invoiceDate: new Date(),
    placeOfSupply: challan.placeOfSupply,
    placeOfSupplyCode: challan.placeOfSupplyCode,
    supplierStateCode: challan.supplierStateCode,
    isInterState: challan.isInterState,
    billingAddress: challan.billingAddress,
    shippingAddress: challan.shippingAddress,
    items: challan.items,
    subtotal: challan.subtotal,
    discountTotal: challan.discountTotal,
    taxableAmount: challan.taxableAmount,
    cgstTotal: challan.cgstTotal,
    sgstTotal: challan.sgstTotal,
    igstTotal: challan.igstTotal,
    cessTotal: challan.cessTotal,
    roundOff: challan.roundOff,
    grandTotal: challan.grandTotal,
    paidAmount: 0,
    balanceAmount: challan.grandTotal,
    paymentStatus: 'unpaid',
    invoiceStatus: 'draft',
    stockDeducted: false,
    createdBy: userId,
  });

  await invoice.save();

  challan.status = 'converted_to_invoice';
  challan.convertedToInvoiceId = invoice._id;
  await challan.save();

  return invoice;
};

export const getDeliveryChallans = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    partyId,
    warehouseId,
    status,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (partyId && mongoose.isValidObjectId(partyId)) {
    query.partyId = partyId;
  }
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.warehouseId = warehouseId;
  }
  if (status) {
    query.status = status;
  }
  if (startDate || endDate) {
    query.challanDate = {};
    if (startDate) query.challanDate.$gte = new Date(startDate);
    if (endDate) query.challanDate.$lte = new Date(endDate);
  }
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { challanNumber: searchRegex },
      { partyName: searchRegex },
      { vehicleNumber: searchRegex },
      { 'items.productName': searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortBy]: sortDirection };

  const [deliveryChallans, total] = await Promise.all([
    DeliveryChallan.find(query).sort(sortOptions).skip(skip).limit(limit),
    DeliveryChallan.countDocuments(query),
  ]);

  return {
    deliveryChallans,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getDeliveryChallanById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid delivery challan ID format');
    error.statusCode = 400;
    throw error;
  }

  const challan = await DeliveryChallan.findOne({ _id: id, tenantId });
  if (!challan) {
    const error = new Error('Delivery challan not found');
    error.statusCode = 404;
    throw error;
  }

  return challan;
};

export const updateDeliveryChallan = async (tenantId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid delivery challan ID format');
    error.statusCode = 400;
    throw error;
  }

  const challan = await DeliveryChallan.findOne({ _id: id, tenantId });
  if (!challan) {
    const error = new Error('Delivery challan not found');
    error.statusCode = 404;
    throw error;
  }

  if (challan.status === 'converted_to_invoice') {
    const error = new Error('Cannot update an already converted delivery challan');
    error.statusCode = 400;
    throw error;
  }

  if (data.items || data.partyId || data.warehouseId || data.placeOfSupply) {
    const partyId = data.partyId || challan.partyId;
    const warehouseId = data.warehouseId || challan.warehouseId;
    const items = data.items || challan.items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      description: it.description,
    }));
    const placeOfSupply = data.placeOfSupply || challan.placeOfSupply;

    const { party, warehouse, calculation, resolvedPOS } = await validateSalesContext(tenantId, {
      partyId,
      warehouseId,
      items,
      placeOfSupply,
    });

    challan.partyId = party._id;
    challan.partyName = party.name;
    challan.partyGSTIN = party.GSTIN || null;
    challan.partyPAN = party.PAN || null;
    challan.warehouseId = warehouse._id;
    challan.warehouseName = warehouse.warehouseName;
    challan.placeOfSupply = resolvedPOS;
    challan.placeOfSupplyCode = calculation.placeOfSupplyCode;
    challan.supplierStateCode = calculation.supplierStateCode;
    challan.isInterState = calculation.isInterState;
    challan.items = calculation.items;
    challan.subtotal = calculation.subtotal;
    challan.discountTotal = calculation.discountTotal;
    challan.taxableAmount = calculation.taxableAmount;
    challan.cgstTotal = calculation.cgstTotal;
    challan.sgstTotal = calculation.sgstTotal;
    challan.igstTotal = calculation.igstTotal;
    challan.cessTotal = calculation.cessTotal;
    challan.roundOff = calculation.roundOff;
    challan.grandTotal = calculation.grandTotal;
  }

  if (data.challanDate) challan.challanDate = new Date(data.challanDate);
  if (data.challanType) challan.challanType = data.challanType;
  if (data.vehicleNumber !== undefined) challan.vehicleNumber = data.vehicleNumber;
  if (data.billingAddress !== undefined) challan.billingAddress = data.billingAddress;
  if (data.shippingAddress !== undefined) challan.shippingAddress = data.shippingAddress;
  if (data.notes !== undefined) challan.notes = data.notes;
  if (data.status) challan.status = data.status;

  await challan.save();
  return challan;
};

/**
 * 10. Sales Returns and Credit Notes
 */
export const createSalesReturn = async (tenantId, userId, invoiceId, data) => {
  if (!mongoose.isValidObjectId(invoiceId)) {
    const error = new Error('Invalid invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const invoice = await SalesInvoice.findOne({ _id: invoiceId, tenantId });
  if (!invoice) {
    const error = new Error('Sales invoice not found');
    error.statusCode = 404;
    throw error;
  }

  if (invoice.invoiceStatus !== 'posted') {
    const error = new Error('Credit notes can only be issued against posted invoices.');
    error.statusCode = 400;
    throw error;
  }

  // Validate return quantities against remaining unreturned invoice quantities
  const returnItems = [];
  for (const itemInput of data.items) {
    const invoiceItem = invoice.items.id(itemInput.invoiceItemId);
    if (!invoiceItem) {
      const error = new Error(`Invoice item ID '${itemInput.invoiceItemId}' not found in invoice.`);
      error.statusCode = 404;
      throw error;
    }

    const availableToReturn = invoiceItem.quantity - (invoiceItem.returnedQuantity || 0);
    if (itemInput.returnedQuantity > availableToReturn) {
      const error = new Error(
        `Returned quantity (${itemInput.returnedQuantity}) exceeds remaining invoiced quantity (${availableToReturn}) for item '${invoiceItem.productName}'.`
      );
      error.statusCode = 400;
      throw error;
    }

    // Proportionally calculate GST reversal for returned portion
    const returnRatio = itemInput.returnedQuantity / invoiceItem.quantity;
    const taxableValue = salesCalculator.round2(invoiceItem.taxableValue * returnRatio);
    const cgst = salesCalculator.round2(invoiceItem.cgst * returnRatio);
    const sgst = salesCalculator.round2(invoiceItem.sgst * returnRatio);
    const igst = salesCalculator.round2(invoiceItem.igst * returnRatio);
    const cess = salesCalculator.round2(invoiceItem.cess * returnRatio);
    const lineTotal = salesCalculator.round2(taxableValue + cgst + sgst + igst + cess);

    returnItems.push({
      invoiceItemId: invoiceItem._id,
      productId: invoiceItem.productId,
      productName: invoiceItem.productName,
      HSN: invoiceItem.HSN,
      SAC: invoiceItem.SAC,
      returnedQuantity: itemInput.returnedQuantity,
      unitId: invoiceItem.unitId,
      unitName: invoiceItem.unitName,
      unitPrice: invoiceItem.unitPrice,
      discount: salesCalculator.round2((invoiceItem.discount || 0) * returnRatio),
      taxableValue,
      gstRate: invoiceItem.gstRate,
      cgst,
      sgst,
      igst,
      cess,
      lineTotal,
    });
  }

  const subtotal = salesCalculator.round2(returnItems.reduce((acc, i) => acc + i.unitPrice * i.returnedQuantity, 0));
  const discountTotal = salesCalculator.round2(returnItems.reduce((acc, i) => acc + i.discount, 0));
  const taxableAmount = salesCalculator.round2(returnItems.reduce((acc, i) => acc + i.taxableValue, 0));
  const cgstTotal = salesCalculator.round2(returnItems.reduce((acc, i) => acc + i.cgst, 0));
  const sgstTotal = salesCalculator.round2(returnItems.reduce((acc, i) => acc + i.sgst, 0));
  const igstTotal = salesCalculator.round2(returnItems.reduce((acc, i) => acc + i.igst, 0));
  const cessTotal = salesCalculator.round2(returnItems.reduce((acc, i) => acc + i.cess, 0));

  const unroundedTotal = salesCalculator.round2(taxableAmount + cgstTotal + sgstTotal + igstTotal + cessTotal);
  const grandTotal = Math.round(unroundedTotal);
  const roundOff = salesCalculator.round2(grandTotal - unroundedTotal);

  const { documentNumber, financialYear } = await salesCalculator.generateDocumentNumber(
    tenantId,
    'credit_note',
    new Date()
  );

  const creditNote = new CreditNote({
    tenantId,
    creditNoteNumber: documentNumber,
    financialYear,
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    partyId: invoice.partyId,
    partyName: invoice.partyName,
    partyGSTIN: invoice.partyGSTIN,
    warehouseId: invoice.warehouseId,
    warehouseName: invoice.warehouseName,
    creditNoteDate: data.creditNoteDate ? new Date(data.creditNoteDate) : new Date(),
    reason: data.reason || 'sales_return',
    placeOfSupply: invoice.placeOfSupply,
    placeOfSupplyCode: invoice.placeOfSupplyCode,
    supplierStateCode: invoice.supplierStateCode,
    isInterState: invoice.isInterState,
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
    stockRestored: false,
    remarks: data.remarks || '',
    createdBy: userId,
  });

  await creditNote.save();
  return creditNote;
};

/**
 * 11. Post Credit Note: Restores returned inventory atomically and records stock movement
 */
export const postCreditNote = async (tenantId, userId, creditNoteId) => {
  return runTransaction(async (session) => {
    if (!mongoose.isValidObjectId(creditNoteId)) {
      const error = new Error('Invalid credit note ID format');
      error.statusCode = 400;
      throw error;
    }

    const creditNote = await CreditNote.findOne({
      _id: creditNoteId,
      tenantId,
    }).session(session);

    if (!creditNote) {
      const error = new Error('Credit note not found');
      error.statusCode = 404;
      throw error;
    }

    if (creditNote.status === 'posted') {
      const error = new Error('Credit note is already posted.');
      error.statusCode = 400;
      throw error;
    }

    if (creditNote.status === 'cancelled') {
      const error = new Error('Cannot post a cancelled credit note.');
      error.statusCode = 400;
      throw error;
    }

    const invoice = await SalesInvoice.findOne({
      _id: creditNote.invoiceId,
      tenantId,
    }).session(session);

    if (!invoice) {
      const error = new Error('Linked invoice no longer exists');
      error.statusCode = 404;
      throw error;
    }

    // Process physical goods restoration into warehouse
    for (const item of creditNote.items) {
      const product = await Product.findOne({
        _id: item.productId,
        tenantId,
      }).session(session);

      if (product && product.productType === 'goods' && product.trackInventory) {
        let inventory = await Inventory.findOne({
          tenantId,
          productId: product._id,
          warehouseId: creditNote.warehouseId,
        }).session(session);

        const prevStock = inventory ? inventory.quantity : 0;
        const newStock = prevStock + item.returnedQuantity;

        if (!inventory) {
          inventory = new Inventory({
            tenantId,
            productId: product._id,
            warehouseId: creditNote.warehouseId,
            quantity: newStock,
            reservedQuantity: 0,
            availableQuantity: newStock,
          });
        } else {
          inventory.quantity = newStock;
          inventory.availableQuantity = newStock - inventory.reservedQuantity;
        }
        await inventory.save({ session });

        product.stock = (product.stock || 0) + item.returnedQuantity;
        await product.save({ session });

        // Record append-only stock return movement
        const movement = new StockMovement({
          tenantId,
          productId: product._id,
          warehouseId: creditNote.warehouseId,
          movementType: 'sales_return',
          quantity: item.returnedQuantity,
          referenceType: 'credit_note',
          referenceId: creditNote._id,
          previousStock: prevStock,
          newStock,
          remarks: `Credit Note ${creditNote.creditNoteNumber} posted for Invoice ${creditNote.invoiceNumber}`,
          createdBy: userId,
        });
        await movement.save({ session });
      }

      // Update original invoice line item's returnedQuantity tracking
      const invoiceLine = invoice.items.id(item.invoiceItemId);
      if (invoiceLine) {
        invoiceLine.returnedQuantity = (invoiceLine.returnedQuantity || 0) + item.returnedQuantity;
      }
    }

    await invoice.save({ session });

    creditNote.status = 'posted';
    creditNote.stockRestored = true;
    creditNote.postedAt = new Date();
    await creditNote.save({ session });

    // Automatic Accounting Journal Posting
    await postCreditNoteJournal(tenantId, userId, creditNote, session);

    return creditNote;
  });
};

/**
 * 12. List Credit Notes
 */
export const getCreditNotes = async (tenantId, options = {}) => {
  const { page = 1, limit = 10, search, invoiceId, status } = options;
  const query = { tenantId };

  if (invoiceId && mongoose.isValidObjectId(invoiceId)) {
    query.invoiceId = invoiceId;
  }

  if (status) {
    query.status = status;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { creditNoteNumber: searchRegex },
      { invoiceNumber: searchRegex },
      { partyName: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const [creditNotes, total] = await Promise.all([
    CreditNote.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    CreditNote.countDocuments(query),
  ]);

  return {
    creditNotes,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getCreditNoteById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid credit note ID');
    error.statusCode = 400;
    throw error;
  }

  const creditNote = await CreditNote.findOne({ _id: id, tenantId });
  if (!creditNote) {
    const error = new Error('Credit note not found');
    error.statusCode = 404;
    throw error;
  }

  return creditNote;
};

export default {
  createDraftInvoice,
  getInvoices,
  getInvoiceById,
  updateDraftInvoice,
  postInvoice,
  cancelInvoice,
  createQuotation,
  convertQuotationToOrder,
  convertQuotationToInvoice,
  createSalesOrder,
  convertOrderToInvoice,
  createDeliveryChallan,
  convertChallanToInvoice,
  createSalesReturn,
  postCreditNote,
  getCreditNotes,
  getCreditNoteById,
};
