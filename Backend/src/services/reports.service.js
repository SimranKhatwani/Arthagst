import mongoose from 'mongoose';
import SalesInvoice from '../models/salesInvoice.model.js';
import PurchaseBill from '../models/purchaseBill.model.js';
import CreditNote from '../models/creditNote.model.js';
import DebitNote from '../models/debitNote.model.js';
import Payment from '../models/payment.model.js';
import Expense from '../models/expense.model.js';
import ExpenseCategory from '../models/expenseCategory.model.js';
import Party from '../models/party.model.js';
import Product from '../models/product.model.js';
import Inventory from '../models/inventory.model.js';
import StockMovement from '../models/stockMovement.model.js';
import Warehouse from '../models/warehouse.model.js';
import { round2, getFinancialYear } from './sales.calculator.js';

/**
 * Helper to construct MongoDB date filter object
 */
export const buildDateQuery = (dateField, { startDate, endDate, financialYear } = {}) => {
  const query = {};
  if (startDate || endDate) {
    query[dateField] = {};
    if (startDate) query[dateField].$gte = new Date(startDate);
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      query[dateField].$lte = e;
    }
  } else if (financialYear) {
    query.financialYear = financialYear;
  }
  return query;
};

// =========================================================================
// A. SALES REPORTS
// =========================================================================

/**
 * 1. Sales Summary Report
 */
export const getSalesSummary = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('invoiceDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        invoiceStatus: 'posted',
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalTaxable: { $sum: '$taxableAmount' },
        totalCGST: { $sum: '$cgstTotal' },
        totalSGST: { $sum: '$sgstTotal' },
        totalIGST: { $sum: '$igstTotal' },
        totalCess: { $sum: '$cessTotal' },
        totalSales: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$paidAmount' },
        totalOutstanding: { $sum: '$balanceAmount' },
      },
    },
  ];

  const [aggResult] = await SalesInvoice.aggregate(pipeline);

  const summary = aggResult || {
    totalInvoices: 0,
    totalTaxable: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalCess: 0,
    totalSales: 0,
    totalPaid: 0,
    totalOutstanding: 0,
  };

  const totalTax = round2(
    (summary.totalCGST || 0) +
      (summary.totalSGST || 0) +
      (summary.totalIGST || 0) +
      (summary.totalCess || 0)
  );
  const averageInvoiceValue =
    summary.totalInvoices > 0 ? round2(summary.totalSales / summary.totalInvoices) : 0;

  return {
    summary: {
      totalInvoices: summary.totalInvoices,
      totalTaxable: round2(summary.totalTaxable),
      totalCGST: round2(summary.totalCGST),
      totalSGST: round2(summary.totalSGST),
      totalIGST: round2(summary.totalIGST),
      totalCess: round2(summary.totalCess),
      totalTax,
      totalSales: round2(summary.totalSales),
      totalPaid: round2(summary.totalPaid),
      totalOutstanding: round2(summary.totalOutstanding),
      averageInvoiceValue,
    },
  };
};

/**
 * 2. Sales Register Report (Detailed invoices with pagination & CSV export)
 */
export const getSalesRegister = async (tenantId, query = {}) => {
  const { page = 1, limit = 50, search, partyId, warehouseId, sortBy = 'invoiceDate', sortOrder = 'desc' } = query;
  const filter = {
    tenantId,
    invoiceStatus: 'posted',
    ...buildDateQuery('invoiceDate', query),
  };

  if (partyId && mongoose.isValidObjectId(partyId)) {
    filter.partyId = partyId;
  }
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    filter.warehouseId = warehouseId;
  }
  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { invoiceNumber: regex },
      { partyName: regex },
      { partyGSTIN: regex },
    ];
  }

  const skip = (Math.max(1, page) - 1) * Math.min(1000, limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [invoices, total, totalsAgg] = await Promise.all([
    SalesInvoice.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Math.min(1000, limit))
      .lean(),
    SalesInvoice.countDocuments(filter),
    SalesInvoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTaxable: { $sum: '$taxableAmount' },
          totalTax: {
            $sum: { $add: ['$cgstTotal', '$sgstTotal', '$igstTotal', '$cessTotal'] },
          },
          totalGrand: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          totalBalance: { $sum: '$balanceAmount' },
        },
      },
    ]),
  ]);

  const summary = totalsAgg[0] || {
    totalTaxable: 0,
    totalTax: 0,
    totalGrand: 0,
    totalPaid: 0,
    totalBalance: 0,
  };

  return {
    invoices,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit) || 1,
    },
    totals: {
      totalTaxable: round2(summary.totalTaxable),
      totalTax: round2(summary.totalTax),
      totalGrand: round2(summary.totalGrand),
      totalPaid: round2(summary.totalPaid),
      totalBalance: round2(summary.totalBalance),
    },
  };
};

/**
 * 3. Sales by Customer Report
 */
export const getSalesByCustomer = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('invoiceDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        invoiceStatus: 'posted',
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: '$partyId',
        customerName: { $first: '$partyName' },
        GSTIN: { $first: '$partyGSTIN' },
        invoiceCount: { $sum: 1 },
        totalTaxable: { $sum: '$taxableAmount' },
        totalTax: { $sum: { $add: ['$cgstTotal', '$sgstTotal', '$igstTotal', '$cessTotal'] } },
        totalSales: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$paidAmount' },
        totalOutstanding: { $sum: '$balanceAmount' },
      },
    },
    { $sort: { totalSales: -1 } },
  ];

  const customers = await SalesInvoice.aggregate(pipeline);

  return {
    customers: customers.map((c) => ({
      partyId: c._id,
      customerName: c.customerName || 'Walk-in Customer',
      GSTIN: c.GSTIN || 'URP',
      invoiceCount: c.invoiceCount,
      totalTaxable: round2(c.totalTaxable),
      totalTax: round2(c.totalTax),
      totalSales: round2(c.totalSales),
      totalPaid: round2(c.totalPaid),
      totalOutstanding: round2(c.totalOutstanding),
    })),
  };
};

/**
 * 4. Sales by Product Report
 */
export const getSalesByProduct = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('invoiceDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        invoiceStatus: 'posted',
        ...dateMatch,
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        productName: { $first: '$items.productName' },
        SKU: { $first: '$items.SKU' },
        HSN: { $first: '$items.HSN' },
        totalQuantitySold: { $sum: '$items.quantity' },
        totalTaxable: { $sum: '$items.taxableValue' },
        totalTax: { $sum: { $add: ['$items.cgst', '$items.sgst', '$items.igst', '$items.cess'] } },
        totalRevenue: { $sum: '$items.total' },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ];

  const products = await SalesInvoice.aggregate(pipeline);

  return {
    products: products.map((p) => ({
      productId: p._id,
      productName: p.productName || 'Unknown Product',
      SKU: p.SKU || '',
      HSN: p.HSN || '',
      totalQuantitySold: round2(p.totalQuantitySold),
      totalTaxable: round2(p.totalTaxable),
      totalTax: round2(p.totalTax),
      totalRevenue: round2(p.totalRevenue),
    })),
  };
};

/**
 * 5. Sales by Invoice Status Report
 */
export const getSalesByStatus = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('invoiceDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: { invoiceStatus: '$invoiceStatus', paymentStatus: '$paymentStatus' },
        count: { $sum: 1 },
        totalAmount: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$paidAmount' },
        totalBalance: { $sum: '$balanceAmount' },
      },
    },
  ];

  const breakdown = await SalesInvoice.aggregate(pipeline);

  return {
    breakdown: breakdown.map((b) => ({
      invoiceStatus: b._id.invoiceStatus,
      paymentStatus: b._id.paymentStatus,
      count: b.count,
      totalAmount: round2(b.totalAmount),
      totalPaid: round2(b.totalPaid),
      totalBalance: round2(b.totalBalance),
    })),
  };
};

/**
 * 6. Sales Return Summary Report (Credit Notes)
 */
export const getSalesReturnSummary = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('creditNoteDate', query);

  const [returns, summary] = await Promise.all([
    CreditNote.find({
      tenantId: tId,
      status: 'posted',
      ...dateMatch,
    }).sort({ creditNoteDate: -1 }).lean(),
    CreditNote.aggregate([
      {
        $match: {
          tenantId: tId,
          status: 'posted',
          ...dateMatch,
        },
      },
      {
        $group: {
          _id: null,
          totalReturnsCount: { $sum: 1 },
          totalTaxable: { $sum: '$taxableAmount' },
          totalTax: { $sum: { $add: ['$cgstTotal', '$sgstTotal', '$igstTotal', '$cessTotal'] } },
          totalReturnedAmount: { $sum: '$grandTotal' },
        },
      },
    ]),
  ]);

  const s = summary[0] || { totalReturnsCount: 0, totalTaxable: 0, totalTax: 0, totalReturnedAmount: 0 };

  return {
    summary: {
      totalReturnsCount: s.totalReturnsCount,
      totalTaxable: round2(s.totalTaxable),
      totalTax: round2(s.totalTax),
      totalReturnedAmount: round2(s.totalReturnedAmount),
    },
    returns,
  };
};

// =========================================================================
// B. PURCHASE REPORTS
// =========================================================================

/**
 * 7. Purchase Summary Report
 */
export const getPurchaseSummary = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('billDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        billStatus: 'posted',
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: null,
        totalBills: { $sum: 1 },
        totalTaxable: { $sum: '$taxableAmount' },
        totalCGST: { $sum: '$cgstTotal' },
        totalSGST: { $sum: '$sgstTotal' },
        totalIGST: { $sum: '$igstTotal' },
        totalCess: { $sum: '$cessTotal' },
        totalPurchases: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$paidAmount' },
        totalOutstanding: { $sum: '$balanceAmount' },
      },
    },
  ];

  const [aggResult] = await PurchaseBill.aggregate(pipeline);

  const summary = aggResult || {
    totalBills: 0,
    totalTaxable: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalCess: 0,
    totalPurchases: 0,
    totalPaid: 0,
    totalOutstanding: 0,
  };

  const totalTax = round2(
    (summary.totalCGST || 0) +
      (summary.totalSGST || 0) +
      (summary.totalIGST || 0) +
      (summary.totalCess || 0)
  );
  const averageBillValue =
    summary.totalBills > 0 ? round2(summary.totalPurchases / summary.totalBills) : 0;

  return {
    summary: {
      totalBills: summary.totalBills,
      totalTaxable: round2(summary.totalTaxable),
      totalCGST: round2(summary.totalCGST),
      totalSGST: round2(summary.totalSGST),
      totalIGST: round2(summary.totalIGST),
      totalCess: round2(summary.totalCess),
      totalTax,
      totalPurchases: round2(summary.totalPurchases),
      totalPaid: round2(summary.totalPaid),
      totalOutstanding: round2(summary.totalOutstanding),
      averageBillValue,
    },
  };
};

/**
 * 8. Purchase Register Report (Detailed bills with pagination & CSV export)
 */
export const getPurchaseRegister = async (tenantId, query = {}) => {
  const { page = 1, limit = 50, search, supplierId, warehouseId, sortBy = 'billDate', sortOrder = 'desc' } = query;
  const filter = {
    tenantId,
    billStatus: 'posted',
    ...buildDateQuery('billDate', query),
  };

  if (supplierId && mongoose.isValidObjectId(supplierId)) {
    filter.supplierId = supplierId;
  }
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    filter.warehouseId = warehouseId;
  }
  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { billNumber: regex },
      { supplierInvoiceNumber: regex },
      { supplierName: regex },
      { supplierGSTIN: regex },
    ];
  }

  const skip = (Math.max(1, page) - 1) * Math.min(1000, limit);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [bills, total, totalsAgg] = await Promise.all([
    PurchaseBill.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Math.min(1000, limit))
      .lean(),
    PurchaseBill.countDocuments(filter),
    PurchaseBill.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTaxable: { $sum: '$taxableAmount' },
          totalTax: {
            $sum: { $add: ['$cgstTotal', '$sgstTotal', '$igstTotal', '$cessTotal'] },
          },
          totalGrand: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          totalBalance: { $sum: '$balanceAmount' },
        },
      },
    ]),
  ]);

  const summary = totalsAgg[0] || {
    totalTaxable: 0,
    totalTax: 0,
    totalGrand: 0,
    totalPaid: 0,
    totalBalance: 0,
  };

  return {
    bills,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit) || 1,
    },
    totals: {
      totalTaxable: round2(summary.totalTaxable),
      totalTax: round2(summary.totalTax),
      totalGrand: round2(summary.totalGrand),
      totalPaid: round2(summary.totalPaid),
      totalBalance: round2(summary.totalBalance),
    },
  };
};

/**
 * 9. Purchase by Supplier Report
 */
export const getPurchaseBySupplier = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('billDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        billStatus: 'posted',
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: '$supplierId',
        supplierName: { $first: '$supplierName' },
        GSTIN: { $first: '$supplierGSTIN' },
        billCount: { $sum: 1 },
        totalTaxable: { $sum: '$taxableAmount' },
        totalTax: { $sum: { $add: ['$cgstTotal', '$sgstTotal', '$igstTotal', '$cessTotal'] } },
        totalPurchases: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$paidAmount' },
        totalOutstanding: { $sum: '$balanceAmount' },
      },
    },
    { $sort: { totalPurchases: -1 } },
  ];

  const suppliers = await PurchaseBill.aggregate(pipeline);

  return {
    suppliers: suppliers.map((s) => ({
      supplierId: s._id,
      supplierName: s.supplierName || 'Vendor',
      GSTIN: s.GSTIN || 'URP',
      billCount: s.billCount,
      totalTaxable: round2(s.totalTaxable),
      totalTax: round2(s.totalTax),
      totalPurchases: round2(s.totalPurchases),
      totalPaid: round2(s.totalPaid),
      totalOutstanding: round2(s.totalOutstanding),
    })),
  };
};

/**
 * 10. Purchase by Product Report
 */
export const getPurchaseByProduct = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('billDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        billStatus: 'posted',
        ...dateMatch,
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        productName: { $first: '$items.productName' },
        SKU: { $first: '$items.SKU' },
        HSN: { $first: '$items.HSN' },
        totalQuantityPurchased: { $sum: '$items.quantity' },
        totalTaxable: { $sum: '$items.taxableValue' },
        totalTax: { $sum: { $add: ['$items.cgst', '$items.sgst', '$items.igst', '$items.cess'] } },
        totalSpend: { $sum: '$items.total' },
      },
    },
    { $sort: { totalSpend: -1 } },
  ];

  const products = await PurchaseBill.aggregate(pipeline);

  return {
    products: products.map((p) => ({
      productId: p._id,
      productName: p.productName || 'Unknown Product',
      SKU: p.SKU || '',
      HSN: p.HSN || '',
      totalQuantityPurchased: round2(p.totalQuantityPurchased),
      totalTaxable: round2(p.totalTaxable),
      totalTax: round2(p.totalTax),
      totalSpend: round2(p.totalSpend),
    })),
  };
};

/**
 * 11. Purchase Return Summary Report (Debit Notes)
 */
export const getPurchaseReturnSummary = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('debitNoteDate', query);

  const [returns, summary] = await Promise.all([
    DebitNote.find({
      tenantId: tId,
      status: 'posted',
      ...dateMatch,
    }).sort({ debitNoteDate: -1 }).lean(),
    DebitNote.aggregate([
      {
        $match: {
          tenantId: tId,
          status: 'posted',
          ...dateMatch,
        },
      },
      {
        $group: {
          _id: null,
          totalReturnsCount: { $sum: 1 },
          totalTaxable: { $sum: '$taxableAmount' },
          totalTax: { $sum: { $add: ['$cgstTotal', '$sgstTotal', '$igstTotal', '$cessTotal'] } },
          totalReturnedAmount: { $sum: '$grandTotal' },
        },
      },
    ]),
  ]);

  const s = summary[0] || { totalReturnsCount: 0, totalTaxable: 0, totalTax: 0, totalReturnedAmount: 0 };

  return {
    summary: {
      totalReturnsCount: s.totalReturnsCount,
      totalTaxable: round2(s.totalTaxable),
      totalTax: round2(s.totalTax),
      totalReturnedAmount: round2(s.totalReturnedAmount),
    },
    returns,
  };
};

// =========================================================================
// C. INVENTORY REPORTS
// =========================================================================

/**
 * 12. Current Stock Report
 */
export const getCurrentStockReport = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const { warehouseId, categoryId, search, page = 1, limit = 50 } = query;

  const match = { tenantId: tId };
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    match.warehouseId = new mongoose.Types.ObjectId(warehouseId);
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    { $match: { 'product.isDeleted': false } },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouseId',
        foreignField: '_id',
        as: 'warehouse',
      },
    },
    { $unwind: '$warehouse' },
  ];

  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    pipeline.push({ $match: { 'product.categoryId': new mongoose.Types.ObjectId(categoryId) } });
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    pipeline.push({
      $match: {
        $or: [
          { 'product.name': regex },
          { 'product.SKU': regex },
          { 'warehouse.warehouseName': regex },
        ],
      },
    });
  }

  const countPipeline = [...pipeline, { $count: 'total' }];
  const [countResult] = await Inventory.aggregate(countPipeline);
  const total = countResult ? countResult.total : 0;

  pipeline.push(
    { $sort: { 'product.name': 1 } },
    { $skip: (Math.max(1, page) - 1) * Math.min(1000, limit) },
    { $limit: Math.min(1000, limit) }
  );

  const items = await Inventory.aggregate(pipeline);

  return {
    stock: items.map((i) => ({
      inventoryId: i._id,
      productId: i.product._id,
      productName: i.product.name,
      SKU: i.product.SKU,
      warehouseId: i.warehouse._id,
      warehouseName: i.warehouse.warehouseName,
      quantity: i.quantity,
      reservedQuantity: i.reservedQuantity,
      availableQuantity: i.availableQuantity,
      purchasePrice: i.product.purchasePrice || 0,
      valuation: round2(i.quantity * (i.product.purchasePrice || 0)),
    })),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 13. Low Stock Report
 */
export const getLowStockReport = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const { warehouseId } = query;

  const match = {
    tenantId: tId,
    productType: 'goods',
    trackInventory: true,
    isDeleted: false,
    lowStockAlert: { $gt: 0 },
  };

  const inventoryMatch = {
    $expr: {
      $and: [
        { $eq: ['$tenantId', '$$tId'] },
        { $eq: ['$productId', '$$pId'] },
      ],
    },
  };

  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    inventoryMatch.$expr.$and.push({
      $eq: ['$warehouseId', new mongoose.Types.ObjectId(warehouseId)],
    });
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'inventories',
        let: { tId: '$tenantId', pId: '$_id' },
        pipeline: [
          { $match: inventoryMatch },
          {
            $group: {
              _id: '$productId',
              totalQuantity: { $sum: '$quantity' },
              totalAvailable: { $sum: '$availableQuantity' },
            },
          },
        ],
        as: 'inventory',
      },
    },
    {
      $project: {
        productName: '$name',
        SKU: '$SKU',
        lowStockAlert: '$lowStockAlert',
        currentStock: {
          $ifNull: [{ $arrayElemAt: ['$inventory.totalQuantity', 0] }, 0],
        },
        availableStock: {
          $ifNull: [{ $arrayElemAt: ['$inventory.totalAvailable', 0] }, 0],
        },
      },
    },
    {
      $match: {
        $expr: { $lte: ['$currentStock', '$lowStockAlert'] },
      },
    },
    { $sort: { currentStock: 1 } },
  ];

  const items = await Product.aggregate(pipeline);

  return { lowStockItems: items };
};

/**
 * 14. Out of Stock Report
 */
export const getOutOfStockReport = async (tenantId) => {
  const tId = new mongoose.Types.ObjectId(tenantId);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        productType: 'goods',
        trackInventory: true,
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: 'inventories',
        let: { tId: '$tenantId', pId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$tenantId', '$$tId'] },
                  { $eq: ['$productId', '$$pId'] },
                ],
              },
            },
          },
          {
            $group: {
              _id: '$productId',
              totalQuantity: { $sum: '$quantity' },
            },
          },
        ],
        as: 'inventory',
      },
    },
    {
      $project: {
        productName: '$name',
        SKU: '$SKU',
        purchasePrice: '$purchasePrice',
        sellingPrice: '$sellingPrice',
        currentStock: {
          $ifNull: [{ $arrayElemAt: ['$inventory.totalQuantity', 0] }, 0],
        },
      },
    },
    {
      $match: {
        currentStock: { $lte: 0 },
      },
    },
    { $sort: { productName: 1 } },
  ];

  const items = await Product.aggregate(pipeline);

  return { outOfStockItems: items };
};

/**
 * 15. Stock Valuation Report
 */
export const getStockValuationReport = async (tenantId) => {
  const tId = new mongoose.Types.ObjectId(tenantId);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        productType: 'goods',
        trackInventory: true,
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: 'inventories',
        let: { tId: '$tenantId', pId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$tenantId', '$$tId'] },
                  { $eq: ['$productId', '$$pId'] },
                ],
              },
            },
          },
          {
            $group: {
              _id: '$productId',
              totalQuantity: { $sum: '$quantity' },
            },
          },
        ],
        as: 'inventory',
      },
    },
    {
      $project: {
        productId: '$_id',
        productName: '$name',
        SKU: '$SKU',
        purchasePrice: { $ifNull: ['$purchasePrice', 0] },
        sellingPrice: { $ifNull: ['$sellingPrice', 0] },
        totalQuantity: {
          $ifNull: [{ $arrayElemAt: ['$inventory.totalQuantity', 0] }, 0],
        },
        costValuation: {
          $multiply: [
            { $ifNull: [{ $arrayElemAt: ['$inventory.totalQuantity', 0] }, 0] },
            { $ifNull: ['$purchasePrice', 0] },
          ],
        },
        retailValuation: {
          $multiply: [
            { $ifNull: [{ $arrayElemAt: ['$inventory.totalQuantity', 0] }, 0] },
            { $ifNull: ['$sellingPrice', 0] },
          ],
        },
      },
    },
    { $sort: { costValuation: -1 } },
  ];

  const items = await Product.aggregate(pipeline);

  const totalCostValuation = round2(
    items.reduce((sum, item) => sum + (item.costValuation || 0), 0)
  );
  const totalRetailValuation = round2(
    items.reduce((sum, item) => sum + (item.retailValuation || 0), 0)
  );

  return {
    summary: {
      totalItemsTracked: items.length,
      totalCostValuation,
      totalRetailValuation,
    },
    items: items.map((i) => ({
      ...i,
      costValuation: round2(i.costValuation),
      retailValuation: round2(i.retailValuation),
    })),
  };
};

/**
 * 16. Stock Movement Report
 */
export const getStockMovementReport = async (tenantId, query = {}) => {
  const { page = 1, limit = 50, productId, warehouseId, movementType } = query;
  const filter = {
    tenantId,
    ...buildDateQuery('createdAt', query),
  };

  if (productId && mongoose.isValidObjectId(productId)) {
    filter.productId = productId;
  }
  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    filter.warehouseId = warehouseId;
  }
  if (movementType) {
    filter.movementType = movementType;
  }

  const skip = (Math.max(1, page) - 1) * Math.min(1000, limit);

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('productId', 'name SKU')
      .populate('warehouseId', 'warehouseName warehouseCode')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(1000, limit))
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  return {
    movements,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 17. Warehouse-wise Stock Report
 */
export const getWarehouseWiseStockReport = async (tenantId) => {
  const tId = new mongoose.Types.ObjectId(tenantId);

  const pipeline = [
    { $match: { tenantId: tId } },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    { $match: { 'product.isDeleted': false } },
    {
      $group: {
        _id: '$warehouseId',
        totalSKUs: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalAvailable: { $sum: '$availableQuantity' },
        totalValuation: {
          $sum: { $multiply: ['$quantity', { $ifNull: ['$product.purchasePrice', 0] }] },
        },
      },
    },
    {
      $lookup: {
        from: 'warehouses',
        localField: '_id',
        foreignField: '_id',
        as: 'warehouse',
      },
    },
    { $unwind: '$warehouse' },
    {
      $project: {
        warehouseId: '$_id',
        warehouseName: '$warehouse.warehouseName',
        warehouseCode: '$warehouse.warehouseCode',
        city: '$warehouse.city',
        totalSKUs: 1,
        totalQuantity: 1,
        totalAvailable: 1,
        totalValuation: 1,
      },
    },
  ];

  const warehouses = await Inventory.aggregate(pipeline);

  return {
    warehouses: warehouses.map((w) => ({
      ...w,
      totalValuation: round2(w.totalValuation),
    })),
  };
};

/**
 * 18. Product-wise Stock Report
 */
export const getProductWiseStockReport = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const { page = 1, limit = 50, search } = query;

  const match = {
    tenantId: tId,
    productType: 'goods',
    isDeleted: false,
  };

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    match.$or = [{ name: regex }, { SKU: regex }];
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'inventories',
        localField: '_id',
        foreignField: 'productId',
        as: 'inventories',
      },
    },
    {
      $project: {
        productId: '$_id',
        productName: '$name',
        SKU: '$SKU',
        purchasePrice: '$purchasePrice',
        sellingPrice: '$sellingPrice',
        totalStock: { $sum: '$inventories.quantity' },
        availableStock: { $sum: '$inventories.availableQuantity' },
        warehouseBreakdown: '$inventories',
      },
    },
    { $sort: { productName: 1 } },
    { $skip: (Math.max(1, page) - 1) * Math.min(1000, limit) },
    { $limit: Math.min(1000, limit) },
  ];

  const [products, total] = await Promise.all([
    Product.aggregate(pipeline),
    Product.countDocuments(match),
  ]);

  return {
    products,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

// =========================================================================
// D. PARTY REPORTS
// =========================================================================

/**
 * 19. Customer Outstanding Report
 */
export const getCustomerOutstandingReport = async (tenantId) => {
  const tId = new mongoose.Types.ObjectId(tenantId);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        invoiceStatus: 'posted',
        balanceAmount: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: '$partyId',
        customerName: { $first: '$partyName' },
        GSTIN: { $first: '$partyGSTIN' },
        totalInvoiced: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$paidAmount' },
        totalOutstanding: { $sum: '$balanceAmount' },
        unpaidInvoicesCount: { $sum: 1 },
      },
    },
    { $sort: { totalOutstanding: -1 } },
  ];

  const customers = await SalesInvoice.aggregate(pipeline);

  return {
    customers: customers.map((c) => ({
      partyId: c._id,
      customerName: c.customerName,
      GSTIN: c.GSTIN || 'URP',
      totalInvoiced: round2(c.totalInvoiced),
      totalPaid: round2(c.totalPaid),
      totalOutstanding: round2(c.totalOutstanding),
      unpaidInvoicesCount: c.unpaidInvoicesCount,
    })),
  };
};

/**
 * 20. Supplier Outstanding Report
 */
export const getSupplierOutstandingReport = async (tenantId) => {
  const tId = new mongoose.Types.ObjectId(tenantId);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        billStatus: 'posted',
        balanceAmount: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: '$supplierId',
        supplierName: { $first: '$supplierName' },
        GSTIN: { $first: '$supplierGSTIN' },
        totalBilled: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$paidAmount' },
        totalOutstanding: { $sum: '$balanceAmount' },
        unpaidBillsCount: { $sum: 1 },
      },
    },
    { $sort: { totalOutstanding: -1 } },
  ];

  const suppliers = await PurchaseBill.aggregate(pipeline);

  return {
    suppliers: suppliers.map((s) => ({
      supplierId: s._id,
      supplierName: s.supplierName,
      GSTIN: s.GSTIN || 'URP',
      totalBilled: round2(s.totalBilled),
      totalPaid: round2(s.totalPaid),
      totalOutstanding: round2(s.totalOutstanding),
      unpaidBillsCount: s.unpaidBillsCount,
    })),
  };
};

/**
 * 21. Customer Ledger Report (Chronological Debit / Credit / Balance)
 */
export const getCustomerLedger = async (tenantId, partyId, query = {}) => {
  if (!mongoose.isValidObjectId(partyId)) {
    const error = new Error('Invalid party ID format');
    error.statusCode = 400;
    throw error;
  }

  const pId = new mongoose.Types.ObjectId(partyId);
  const party = await Party.findOne({ _id: pId, tenantId });
  if (!party) {
    const error = new Error('Party not found');
    error.statusCode = 404;
    throw error;
  }

  const dateMatchSales = buildDateQuery('invoiceDate', query);
  const dateMatchPay = buildDateQuery('paymentDate', query);
  const dateMatchCN = buildDateQuery('creditNoteDate', query);

  const [invoices, payments, creditNotes] = await Promise.all([
    SalesInvoice.find({
      tenantId,
      partyId: pId,
      invoiceStatus: 'posted',
      ...dateMatchSales,
    }).lean(),
    Payment.find({
      tenantId,
      partyId: pId,
      direction: 'in',
      status: { $ne: 'cancelled' },
      ...dateMatchPay,
    }).lean(),
    CreditNote.find({
      tenantId,
      partyId: pId,
      status: 'posted',
      ...dateMatchCN,
    }).lean(),
  ]);

  // Combine into unified ledger entries
  const entries = [];

  for (const inv of invoices) {
    entries.push({
      date: inv.invoiceDate,
      type: 'Invoice',
      documentNumber: inv.invoiceNumber,
      debit: round2(inv.grandTotal),
      credit: 0,
      description: `Sales Invoice #${inv.invoiceNumber}`,
    });
  }

  for (const pay of payments) {
    entries.push({
      date: pay.paymentDate,
      type: 'Receipt',
      documentNumber: pay.paymentNumber,
      debit: 0,
      credit: round2(pay.amount),
      description: `Payment Receipt (${pay.paymentMethod}) #${pay.paymentNumber}`,
    });
  }

  for (const cn of creditNotes) {
    entries.push({
      date: cn.creditNoteDate,
      type: 'Credit Note',
      documentNumber: cn.creditNoteNumber,
      debit: 0,
      credit: round2(cn.grandTotal),
      description: `Credit Note #${cn.creditNoteNumber}`,
    });
  }

  // Sort chronologically
  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBalance = party.openingBalance || 0;
  const ledger = entries.map((entry) => {
    runningBalance = round2(runningBalance + entry.debit - entry.credit);
    return {
      ...entry,
      balance: runningBalance,
    };
  });

  return {
    party: {
      partyId: party._id,
      name: party.name,
      GSTIN: party.GSTIN,
      openingBalance: party.openingBalance || 0,
    },
    ledger,
    closingBalance: runningBalance,
  };
};

/**
 * 22. Supplier Ledger Report
 */
export const getSupplierLedger = async (tenantId, supplierId, query = {}) => {
  if (!mongoose.isValidObjectId(supplierId)) {
    const error = new Error('Invalid supplier ID format');
    error.statusCode = 400;
    throw error;
  }

  const sId = new mongoose.Types.ObjectId(supplierId);
  const supplier = await Party.findOne({ _id: sId, tenantId });
  if (!supplier) {
    const error = new Error('Supplier not found');
    error.statusCode = 404;
    throw error;
  }

  const dateMatchBills = buildDateQuery('billDate', query);
  const dateMatchPay = buildDateQuery('paymentDate', query);
  const dateMatchDN = buildDateQuery('debitNoteDate', query);

  const [bills, payments, debitNotes] = await Promise.all([
    PurchaseBill.find({
      tenantId,
      supplierId: sId,
      billStatus: 'posted',
      ...dateMatchBills,
    }).lean(),
    Payment.find({
      tenantId,
      partyId: sId,
      direction: 'out',
      status: { $ne: 'cancelled' },
      ...dateMatchPay,
    }).lean(),
    DebitNote.find({
      tenantId,
      supplierId: sId,
      status: 'posted',
      ...dateMatchDN,
    }).lean(),
  ]);

  const entries = [];

  for (const bill of bills) {
    entries.push({
      date: bill.billDate,
      type: 'Bill',
      documentNumber: bill.billNumber,
      debit: 0,
      credit: round2(bill.grandTotal),
      description: `Purchase Bill #${bill.billNumber}`,
    });
  }

  for (const pay of payments) {
    entries.push({
      date: pay.paymentDate,
      type: 'Payment',
      documentNumber: pay.paymentNumber,
      debit: round2(pay.amount),
      credit: 0,
      description: `Supplier Payment (${pay.paymentMethod}) #${pay.paymentNumber}`,
    });
  }

  for (const dn of debitNotes) {
    entries.push({
      date: dn.debitNoteDate,
      type: 'Debit Note',
      documentNumber: dn.debitNoteNumber,
      debit: round2(dn.grandTotal),
      credit: 0,
      description: `Debit Note #${dn.debitNoteNumber}`,
    });
  }

  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBalance = supplier.openingBalance || 0;
  const ledger = entries.map((entry) => {
    runningBalance = round2(runningBalance + entry.credit - entry.debit);
    return {
      ...entry,
      balance: runningBalance,
    };
  });

  return {
    supplier: {
      supplierId: supplier._id,
      name: supplier.name,
      GSTIN: supplier.GSTIN,
      openingBalance: supplier.openingBalance || 0,
    },
    ledger,
    closingBalance: runningBalance,
  };
};

/**
 * 23. Party Transaction History Report (Unified Timeline)
 */
export const getPartyTransactionHistory = async (tenantId, partyId, query = {}) => {
  if (!mongoose.isValidObjectId(partyId)) {
    const error = new Error('Invalid party ID format');
    error.statusCode = 400;
    throw error;
  }

  const pId = new mongoose.Types.ObjectId(partyId);
  const party = await Party.findOne({ _id: pId, tenantId });
  if (!party) {
    const error = new Error('Party not found');
    error.statusCode = 404;
    throw error;
  }

  const [invoices, bills, payments, creditNotes, debitNotes] = await Promise.all([
    SalesInvoice.find({ tenantId, partyId: pId }).lean(),
    PurchaseBill.find({ tenantId, supplierId: pId }).lean(),
    Payment.find({ tenantId, partyId: pId }).lean(),
    CreditNote.find({ tenantId, partyId: pId }).lean(),
    DebitNote.find({ tenantId, supplierId: pId }).lean(),
  ]);

  const timeline = [];

  for (const inv of invoices) {
    timeline.push({
      date: inv.invoiceDate,
      category: 'Sales Invoice',
      documentNumber: inv.invoiceNumber,
      amount: inv.grandTotal,
      status: inv.invoiceStatus,
    });
  }
  for (const b of bills) {
    timeline.push({
      date: b.billDate,
      category: 'Purchase Bill',
      documentNumber: b.billNumber,
      amount: b.grandTotal,
      status: b.billStatus,
    });
  }
  for (const p of payments) {
    timeline.push({
      date: p.paymentDate,
      category: p.direction === 'in' ? 'Receipt' : 'Payment',
      documentNumber: p.paymentNumber,
      amount: p.amount,
      status: p.status,
    });
  }
  for (const cn of creditNotes) {
    timeline.push({
      date: cn.creditNoteDate,
      category: 'Credit Note',
      documentNumber: cn.creditNoteNumber,
      amount: cn.grandTotal,
      status: cn.status,
    });
  }
  for (const dn of debitNotes) {
    timeline.push({
      date: dn.debitNoteDate,
      category: 'Debit Note',
      documentNumber: dn.debitNoteNumber,
      amount: dn.grandTotal,
      status: dn.status,
    });
  }

  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    party: { partyId: party._id, name: party.name, partyType: party.partyType },
    timeline,
  };
};

// =========================================================================
// E. PAYMENT REPORTS
// =========================================================================

/**
 * 24. Money In Report (Receipts)
 */
export const getMoneyInReport = async (tenantId, query = {}) => {
  const { page = 1, limit = 50, paymentMethod, bankAccountId } = query;
  const filter = {
    tenantId,
    direction: 'in',
    status: { $ne: 'cancelled' },
    ...buildDateQuery('paymentDate', query),
  };

  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (bankAccountId && mongoose.isValidObjectId(bankAccountId)) filter.bankAccountId = bankAccountId;

  const skip = (Math.max(1, page) - 1) * Math.min(1000, limit);

  const [receipts, total, totalsAgg] = await Promise.all([
    Payment.find(filter)
      .populate('partyId', 'name GSTIN')
      .populate('bankAccountId', 'accountName bankName')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(Math.min(1000, limit))
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalReceived: { $sum: '$amount' },
          totalAllocated: { $sum: '$allocatedAmount' },
          totalUnallocated: { $sum: '$unallocatedAmount' },
        },
      },
    ]),
  ]);

  const summary = totalsAgg[0] || { totalReceived: 0, totalAllocated: 0, totalUnallocated: 0 };

  return {
    receipts,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit) || 1,
    },
    totals: {
      totalReceived: round2(summary.totalReceived),
      totalAllocated: round2(summary.totalAllocated),
      totalUnallocated: round2(summary.totalUnallocated),
    },
  };
};

/**
 * 25. Money Out Report (Supplier Payments)
 */
export const getMoneyOutReport = async (tenantId, query = {}) => {
  const { page = 1, limit = 50, paymentMethod, bankAccountId } = query;
  const filter = {
    tenantId,
    direction: 'out',
    status: { $ne: 'cancelled' },
    ...buildDateQuery('paymentDate', query),
  };

  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (bankAccountId && mongoose.isValidObjectId(bankAccountId)) filter.bankAccountId = bankAccountId;

  const skip = (Math.max(1, page) - 1) * Math.min(1000, limit);

  const [payments, total, totalsAgg] = await Promise.all([
    Payment.find(filter)
      .populate('partyId', 'name GSTIN')
      .populate('bankAccountId', 'accountName bankName')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(Math.min(1000, limit))
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amount' },
          totalAllocated: { $sum: '$allocatedAmount' },
          totalUnallocated: { $sum: '$unallocatedAmount' },
        },
      },
    ]),
  ]);

  const summary = totalsAgg[0] || { totalPaid: 0, totalAllocated: 0, totalUnallocated: 0 };

  return {
    payments,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit) || 1,
    },
    totals: {
      totalPaid: round2(summary.totalPaid),
      totalAllocated: round2(summary.totalAllocated),
      totalUnallocated: round2(summary.totalUnallocated),
    },
  };
};

/**
 * 26. Payment Mode Summary Report
 */
export const getPaymentModeSummary = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('paymentDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        status: { $ne: 'cancelled' },
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: { direction: '$direction', method: '$paymentMethod' },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.direction': 1, totalAmount: -1 } },
  ];

  const breakdown = await Payment.aggregate(pipeline);

  return {
    breakdown: breakdown.map((b) => ({
      direction: b._id.direction, // 'in' or 'out'
      paymentMethod: b._id.method,
      count: b.count,
      totalAmount: round2(b.totalAmount),
    })),
  };
};

/**
 * 27. Unallocated Payments Report (Advances)
 */
export const getUnallocatedPaymentsReport = async (tenantId) => {
  const payments = await Payment.find({
    tenantId,
    status: { $ne: 'cancelled' },
    unallocatedAmount: { $gt: 0 },
  })
    .populate('partyId', 'name GSTIN')
    .sort({ paymentDate: -1 })
    .lean();

  const totalUnallocatedIn = round2(
    payments.filter((p) => p.direction === 'in').reduce((acc, p) => acc + p.unallocatedAmount, 0)
  );
  const totalUnallocatedOut = round2(
    payments.filter((p) => p.direction === 'out').reduce((acc, p) => acc + p.unallocatedAmount, 0)
  );

  return {
    summary: {
      totalCustomerAdvances: totalUnallocatedIn,
      totalSupplierAdvances: totalUnallocatedOut,
      count: payments.length,
    },
    payments,
  };
};

/**
 * 28. Receivables and Payables Summary Report
 */
export const getReceivablesAndPayablesSummary = async (tenantId) => {
  const tId = new mongoose.Types.ObjectId(tenantId);

  const [recAgg, payAgg, advInAgg, advOutAgg] = await Promise.all([
    SalesInvoice.aggregate([
      { $match: { tenantId: tId, invoiceStatus: 'posted', balanceAmount: { $gt: 0 } } },
      { $group: { _id: null, totalReceivables: { $sum: '$balanceAmount' }, count: { $sum: 1 } } },
    ]),
    PurchaseBill.aggregate([
      { $match: { tenantId: tId, billStatus: 'posted', balanceAmount: { $gt: 0 } } },
      { $group: { _id: null, totalPayables: { $sum: '$balanceAmount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { tenantId: tId, direction: 'in', status: { $ne: 'cancelled' }, unallocatedAmount: { $gt: 0 } } },
      { $group: { _id: null, totalAdvances: { $sum: '$unallocatedAmount' } } },
    ]),
    Payment.aggregate([
      { $match: { tenantId: tId, direction: 'out', status: { $ne: 'cancelled' }, unallocatedAmount: { $gt: 0 } } },
      { $group: { _id: null, totalAdvances: { $sum: '$unallocatedAmount' } } },
    ]),
  ]);

  const totalReceivables = round2(recAgg[0]?.totalReceivables || 0);
  const totalPayables = round2(payAgg[0]?.totalPayables || 0);
  const customerAdvances = round2(advInAgg[0]?.totalAdvances || 0);
  const supplierAdvances = round2(advOutAgg[0]?.totalAdvances || 0);

  const netReceivables = round2(totalReceivables - customerAdvances);
  const netPayables = round2(totalPayables - supplierAdvances);
  const netPosition = round2(netReceivables - netPayables);

  return {
    summary: {
      totalReceivables,
      customerAdvances,
      netReceivables,
      receivablesCount: recAgg[0]?.count || 0,
      totalPayables,
      supplierAdvances,
      netPayables,
      payablesCount: payAgg[0]?.count || 0,
      netPosition, // Positive = net money to receive, negative = net money to pay
    },
  };
};

// =========================================================================
// F. EXPENSE REPORTS
// =========================================================================

/**
 * 29. Expense Summary Report
 */
export const getExpenseSummary = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('expenseDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        status: { $ne: 'cancelled' },
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: '$amount' },
        totalTaxable: { $sum: { $ifNull: ['$taxableAmount', 0] } },
        totalGST: { $sum: { $ifNull: ['$gstAmount', 0] } },
        count: { $sum: 1 },
      },
    },
  ];

  const [aggResult] = await Expense.aggregate(pipeline);

  const summary = aggResult || { totalExpenses: 0, totalTaxable: 0, totalGST: 0, count: 0 };
  const averageExpense = summary.count > 0 ? round2(summary.totalExpenses / summary.count) : 0;

  return {
    summary: {
      totalExpenses: round2(summary.totalExpenses),
      totalTaxable: round2(summary.totalTaxable),
      totalGST: round2(summary.totalGST),
      count: summary.count,
      averageExpense,
    },
  };
};

/**
 * 30. Category-wise Expense Report
 */
export const getCategoryWiseExpenseReport = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('expenseDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        status: { $ne: 'cancelled' },
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: '$categoryId',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'expensecategories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        categoryId: '$_id',
        categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
        totalAmount: 1,
        count: 1,
      },
    },
    { $sort: { totalAmount: -1 } },
  ];

  const categories = await Expense.aggregate(pipeline);
  const grandTotal = categories.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

  return {
    categories: categories.map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      totalAmount: round2(c.totalAmount),
      count: c.count,
      percentage: grandTotal > 0 ? round2((c.totalAmount / grandTotal) * 100) : 0,
    })),
    grandTotal: round2(grandTotal),
  };
};

/**
 * 31. Monthly Expense Report
 */
export const getMonthlyExpenseReport = async (tenantId, query = {}) => {
  const tId = new mongoose.Types.ObjectId(tenantId);
  const dateMatch = buildDateQuery('expenseDate', query);

  const pipeline = [
    {
      $match: {
        tenantId: tId,
        status: { $ne: 'cancelled' },
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$expenseDate' } },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const monthly = await Expense.aggregate(pipeline);

  return {
    monthly: monthly.map((m) => ({
      month: m._id,
      totalAmount: round2(m.totalAmount),
      count: m.count,
    })),
  };
};

