import mongoose from 'mongoose';
import Inventory from '../models/inventory.model.js';
import StockMovement from '../models/stockMovement.model.js';
import Warehouse from '../models/warehouse.model.js';
import Product from '../models/product.model.js';

/**
 * Validate product and warehouse ownership, activity, and trackability
 */
const validateProductAndWarehouse = async (tenantId, productId, warehouseId, session = null) => {
  if (!mongoose.isValidObjectId(productId)) {
    const error = new Error('Invalid product ID format');
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.isValidObjectId(warehouseId)) {
    const error = new Error('Invalid warehouse ID format');
    error.statusCode = 400;
    throw error;
  }

  // 1. Validate Product
  const productQuery = Product.findOne({
    _id: productId,
    tenantId,
    isDeleted: false,
  });
  if (session) productQuery.session(session);
  const product = await productQuery;

  if (!product) {
    const error = new Error('Product not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  if (product.productType === 'service' || !product.trackInventory) {
    const error = new Error('Stock operations are only allowed for goods products with inventory tracking enabled');
    error.statusCode = 400;
    throw error;
  }

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

  return { product, warehouse };
};

/**
 * Transaction execution helper with automatic retry for TransientTransactionErrors (WriteConflict)
 */
const runTransactionWithRetry = async (operation, maxRetries = 10) => {
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
          // Jittered backoff for concurrent writes
          await new Promise((resolve) => setTimeout(resolve, 40 * attempt + Math.random() * 40));
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
 * Initialize opening stock for a product in a warehouse
 */
export const initializeOpeningStock = async (tenantId, userId, data) => {
  return runTransactionWithRetry(async (session) => {
    const { product, warehouse } = await validateProductAndWarehouse(
      tenantId,
      data.productId,
      data.warehouseId,
      session
    );

    // Prevent duplicate opening stock initialization
    const existingMovement = await StockMovement.findOne({
      tenantId,
      productId: product._id,
      warehouseId: warehouse._id,
      movementType: 'opening_stock',
    }).session(session);

    if (existingMovement) {
      const error = new Error(
        `Opening stock has already been initialized for '${product.name}' in warehouse '${warehouse.warehouseName}'`
      );
      error.statusCode = 409;
      throw error;
    }

    let inventory = await Inventory.findOne({
      tenantId,
      productId: product._id,
      warehouseId: warehouse._id,
    }).session(session);

    if (inventory && inventory.quantity > 0) {
      const error = new Error('Opening stock can only be set on an uninitialized stock record');
      error.statusCode = 409;
      throw error;
    }

    const previousStock = inventory ? inventory.quantity : 0;
    const newStock = data.quantity;

    if (!inventory) {
      inventory = new Inventory({
        tenantId,
        productId: product._id,
        warehouseId: warehouse._id,
        quantity: newStock,
        reservedQuantity: 0,
        availableQuantity: newStock,
      });
    } else {
      inventory.quantity = newStock;
      inventory.availableQuantity = newStock - inventory.reservedQuantity;
    }

    await inventory.save({ session });

    // Record append-only movement
    const movement = new StockMovement({
      tenantId,
      productId: product._id,
      warehouseId: warehouse._id,
      movementType: 'opening_stock',
      quantity: newStock,
      referenceType: 'opening_stock',
      referenceId: product._id,
      previousStock,
      newStock,
      remarks: data.remarks || 'Initial opening stock',
      createdBy: userId,
    });

    await movement.save({ session });

    return {
      inventory,
      movement,
    };
  });
};

/**
 * Add stock to a warehouse (Stock In)
 */
export const stockIn = async (tenantId, userId, data) => {
  return runTransactionWithRetry(async (session) => {
    const { product, warehouse } = await validateProductAndWarehouse(
      tenantId,
      data.productId,
      data.warehouseId,
      session
    );

    let inventory = await Inventory.findOne({
      tenantId,
      productId: product._id,
      warehouseId: warehouse._id,
    }).session(session);

    const previousStock = inventory ? inventory.quantity : 0;
    const newStock = previousStock + data.quantity;

    if (!inventory) {
      inventory = new Inventory({
        tenantId,
        productId: product._id,
        warehouseId: warehouse._id,
        quantity: newStock,
        reservedQuantity: 0,
        availableQuantity: newStock,
      });
    } else {
      inventory.quantity = newStock;
      inventory.availableQuantity = newStock - inventory.reservedQuantity;
    }

    await inventory.save({ session });

    // Record movement
    const movement = new StockMovement({
      tenantId,
      productId: product._id,
      warehouseId: warehouse._id,
      movementType: 'stock_in',
      quantity: data.quantity,
      referenceType: data.referenceType || 'manual',
      referenceId: data.referenceId || null,
      previousStock,
      newStock,
      remarks: data.remarks || '',
      createdBy: userId,
    });

    await movement.save({ session });

    return {
      inventory,
      movement,
    };
  });
};

/**
 * Reduce stock from a warehouse (Stock Out)
 */
export const stockOut = async (tenantId, userId, data) => {
  return runTransactionWithRetry(async (session) => {
    const { product, warehouse } = await validateProductAndWarehouse(
      tenantId,
      data.productId,
      data.warehouseId,
      session
    );

    const inventory = await Inventory.findOne({
      tenantId,
      productId: product._id,
      warehouseId: warehouse._id,
    }).session(session);

    const availableStock = inventory ? inventory.availableQuantity : 0;

    if (!inventory || availableStock < data.quantity) {
      const error = new Error(
        `Insufficient available stock for '${product.name}' in warehouse '${warehouse.warehouseName}'. Available: ${availableStock}, Requested: ${data.quantity}`
      );
      error.statusCode = 400;
      throw error;
    }

    const previousStock = inventory.quantity;
    const newStock = previousStock - data.quantity;

    if (newStock < 0) {
      const error = new Error('Stock cannot become negative');
      error.statusCode = 400;
      throw error;
    }

    inventory.quantity = newStock;
    inventory.availableQuantity = newStock - inventory.reservedQuantity;
    await inventory.save({ session });

    // Record movement
    const movement = new StockMovement({
      tenantId,
      productId: product._id,
      warehouseId: warehouse._id,
      movementType: 'stock_out',
      quantity: data.quantity,
      referenceType: data.referenceType || 'manual',
      referenceId: data.referenceId || null,
      previousStock,
      newStock,
      remarks: data.remarks || '',
      createdBy: userId,
    });

    await movement.save({ session });

    return {
      inventory,
      movement,
    };
  });
};

/**
 * Adjust stock in a warehouse (physical inventory count reconciliation)
 */
export const adjustStock = async (tenantId, userId, data) => {
  return runTransactionWithRetry(async (session) => {
    const { product, warehouse } = await validateProductAndWarehouse(
      tenantId,
      data.productId,
      data.warehouseId,
      session
    );

    let inventory = await Inventory.findOne({
      tenantId,
      productId: product._id,
      warehouseId: warehouse._id,
    }).session(session);

    const previousStock = inventory ? inventory.quantity : 0;
    let targetQuantity;

    if (data.mode === 'set') {
      targetQuantity = data.quantity;
    } else if (data.mode === 'add') {
      targetQuantity = previousStock + data.quantity;
    } else if (data.mode === 'reduce') {
      targetQuantity = previousStock - data.quantity;
    }

    if (targetQuantity < 0) {
      const error = new Error(`Stock quantity cannot become negative after adjustment. Resulting stock: ${targetQuantity}`);
      error.statusCode = 400;
      throw error;
    }

    const quantityDelta = Math.abs(targetQuantity - previousStock);

    if (!inventory) {
      inventory = new Inventory({
        tenantId,
        productId: product._id,
        warehouseId: warehouse._id,
        quantity: targetQuantity,
        reservedQuantity: 0,
        availableQuantity: targetQuantity,
      });
    } else {
      inventory.quantity = targetQuantity;
      inventory.availableQuantity = targetQuantity - inventory.reservedQuantity;
    }

    await inventory.save({ session });

    // Record movement
    const movement = new StockMovement({
      tenantId,
      productId: product._id,
      warehouseId: warehouse._id,
      movementType: 'adjustment',
      quantity: quantityDelta,
      referenceType: 'adjustment',
      referenceId: data.referenceId || null,
      previousStock,
      newStock: targetQuantity,
      remarks: data.remarks,
      createdBy: userId,
    });

    await movement.save({ session });

    return {
      inventory,
      movement,
    };
  });
};

/**
 * Transfer stock between two warehouses atomically
 */
export const transferStock = async (tenantId, userId, data) => {
  return runTransactionWithRetry(async (session) => {
    if (data.fromWarehouseId === data.toWarehouseId) {
      const error = new Error('Source and destination warehouses cannot be the same');
      error.statusCode = 400;
      throw error;
    }

    // Validate product
    if (!mongoose.isValidObjectId(data.productId)) {
      const error = new Error('Invalid product ID format');
      error.statusCode = 400;
      throw error;
    }

    const product = await Product.findOne({
      _id: data.productId,
      tenantId,
      isDeleted: false,
    }).session(session);

    if (!product) {
      const error = new Error('Product not found in your organization');
      error.statusCode = 404;
      throw error;
    }

    if (product.productType === 'service' || !product.trackInventory) {
      const error = new Error('Stock transfers are only allowed for goods products with inventory tracking enabled');
      error.statusCode = 400;
      throw error;
    }

    // Validate source warehouse
    if (!mongoose.isValidObjectId(data.fromWarehouseId)) {
      const error = new Error('Invalid source warehouse ID format');
      error.statusCode = 400;
      throw error;
    }

    const fromWarehouse = await Warehouse.findOne({
      _id: data.fromWarehouseId,
      tenantId,
      isDeleted: false,
    }).session(session);

    if (!fromWarehouse) {
      const error = new Error('Source warehouse not found in your organization');
      error.statusCode = 404;
      throw error;
    }

    if (!fromWarehouse.isActive) {
      const error = new Error(`Source warehouse '${fromWarehouse.warehouseName}' is inactive`);
      error.statusCode = 400;
      throw error;
    }

    // Validate destination warehouse
    if (!mongoose.isValidObjectId(data.toWarehouseId)) {
      const error = new Error('Invalid destination warehouse ID format');
      error.statusCode = 400;
      throw error;
    }

    const toWarehouse = await Warehouse.findOne({
      _id: data.toWarehouseId,
      tenantId,
      isDeleted: false,
    }).session(session);

    if (!toWarehouse) {
      const error = new Error('Destination warehouse not found in your organization');
      error.statusCode = 404;
      throw error;
    }

    if (!toWarehouse.isActive) {
      const error = new Error(`Destination warehouse '${toWarehouse.warehouseName}' is inactive`);
      error.statusCode = 400;
      throw error;
    }

    // Check source warehouse stock
    const sourceInventory = await Inventory.findOne({
      tenantId,
      productId: product._id,
      warehouseId: fromWarehouse._id,
    }).session(session);

    const availableInSource = sourceInventory ? sourceInventory.availableQuantity : 0;
    if (!sourceInventory || availableInSource < data.quantity) {
      const error = new Error(
        `Insufficient stock in warehouse '${fromWarehouse.warehouseName}'. Available: ${availableInSource}, Requested: ${data.quantity}`
      );
      error.statusCode = 400;
      throw error;
    }

    // Find or create destination inventory
    let destInventory = await Inventory.findOne({
      tenantId,
      productId: product._id,
      warehouseId: toWarehouse._id,
    }).session(session);

    const fromPreviousStock = sourceInventory.quantity;
    const fromNewStock = fromPreviousStock - data.quantity;

    const toPreviousStock = destInventory ? destInventory.quantity : 0;
    const toNewStock = toPreviousStock + data.quantity;

    // Deduct from source
    sourceInventory.quantity = fromNewStock;
    sourceInventory.availableQuantity = fromNewStock - sourceInventory.reservedQuantity;
    await sourceInventory.save({ session });

    // Add to destination
    if (!destInventory) {
      destInventory = new Inventory({
        tenantId,
        productId: product._id,
        warehouseId: toWarehouse._id,
        quantity: toNewStock,
        reservedQuantity: 0,
        availableQuantity: toNewStock,
      });
    } else {
      destInventory.quantity = toNewStock;
      destInventory.availableQuantity = toNewStock - destInventory.reservedQuantity;
    }
    await destInventory.save({ session });

    // Shared transfer identifier for tracing
    const transferRefId = new mongoose.Types.ObjectId();

    // Record transfer_out movement
    const transferOutMovement = new StockMovement({
      tenantId,
      productId: product._id,
      warehouseId: fromWarehouse._id,
      movementType: 'transfer_out',
      quantity: data.quantity,
      referenceType: 'transfer',
      referenceId: transferRefId,
      previousStock: fromPreviousStock,
      newStock: fromNewStock,
      remarks: data.remarks || `Transferred to ${toWarehouse.warehouseName}`,
      createdBy: userId,
    });
    await transferOutMovement.save({ session });

    // Record transfer_in movement
    const transferInMovement = new StockMovement({
      tenantId,
      productId: product._id,
      warehouseId: toWarehouse._id,
      movementType: 'transfer_in',
      quantity: data.quantity,
      referenceType: 'transfer',
      referenceId: transferRefId,
      previousStock: toPreviousStock,
      newStock: toNewStock,
      remarks: data.remarks || `Transferred from ${fromWarehouse.warehouseName}`,
      createdBy: userId,
    });
    await transferInMovement.save({ session });

    return {
      transferId: transferRefId,
      sourceWarehouse: {
        warehouseId: fromWarehouse._id,
        warehouseName: fromWarehouse.warehouseName,
        previousStock: fromPreviousStock,
        newStock: fromNewStock,
      },
      destinationWarehouse: {
        warehouseId: toWarehouse._id,
        warehouseName: toWarehouse.warehouseName,
        previousStock: toPreviousStock,
        newStock: toNewStock,
      },
      quantity: data.quantity,
      movements: [transferOutMovement, transferInMovement],
    };
  });
};

/**
 * List inventory records with pagination, search, and filtering
 */
export const getInventory = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    warehouseId,
    productId,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.warehouseId = warehouseId;
  }

  if (productId && mongoose.isValidObjectId(productId)) {
    query.productId = productId;
  }

  // If search is provided, find matching product IDs first
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    const matchedProducts = await Product.find({
      tenantId,
      isDeleted: false,
      $or: [{ name: searchRegex }, { SKU: searchRegex }, { barcode: searchRegex }],
    }).select('_id');

    const productIds = matchedProducts.map((p) => p._id);
    query.productId = { $in: productIds };
  }

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortBy]: sortDirection };

  const [inventoryList, total] = await Promise.all([
    Inventory.find(query)
      .populate('productId', 'name SKU barcode lowStockAlert unitId productType')
      .populate('warehouseId', 'warehouseName warehouseCode isDefault isActive')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit),
    Inventory.countDocuments(query),
  ]);

  return {
    inventory: inventoryList,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Product-wise stock summary across all warehouses
 */
export const getProductStockSummary = async (tenantId, productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    const error = new Error('Invalid product ID format');
    error.statusCode = 400;
    throw error;
  }

  const product = await Product.findOne({
    _id: productId,
    tenantId,
    isDeleted: false,
  }).populate('unitId', 'name shortName gstUqcCode');

  if (!product) {
    const error = new Error('Product not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  const stockRecords = await Inventory.find({
    tenantId,
    productId: product._id,
  }).populate('warehouseId', 'warehouseName warehouseCode isDefault isActive');

  const totalQuantity = stockRecords.reduce((sum, item) => sum + item.quantity, 0);
  const totalReserved = stockRecords.reduce((sum, item) => sum + item.reservedQuantity, 0);
  const totalAvailable = stockRecords.reduce((sum, item) => sum + item.availableQuantity, 0);

  return {
    product: {
      _id: product._id,
      name: product.name,
      SKU: product.SKU,
      barcode: product.barcode,
      unit: product.unitId,
      lowStockAlert: product.lowStockAlert,
    },
    totalQuantity,
    totalReserved,
    totalAvailable,
    warehouses: stockRecords.map((s) => ({
      warehouseId: s.warehouseId._id,
      warehouseName: s.warehouseId.warehouseName,
      warehouseCode: s.warehouseId.warehouseCode,
      isDefault: s.warehouseId.isDefault,
      quantity: s.quantity,
      reservedQuantity: s.reservedQuantity,
      availableQuantity: s.availableQuantity,
      updatedAt: s.updatedAt,
    })),
  };
};

/**
 * Warehouse-wise stock summary
 */
export const getWarehouseStockSummary = async (tenantId, warehouseId, options = {}) => {
  if (!mongoose.isValidObjectId(warehouseId)) {
    const error = new Error('Invalid warehouse ID format');
    error.statusCode = 400;
    throw error;
  }

  const warehouse = await Warehouse.findOne({
    _id: warehouseId,
    tenantId,
    isDeleted: false,
  });

  if (!warehouse) {
    const error = new Error('Warehouse not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  const { page = 1, limit = 20, search } = options;
  const query = { tenantId, warehouseId: warehouse._id };

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    const matchedProducts = await Product.find({
      tenantId,
      isDeleted: false,
      $or: [{ name: searchRegex }, { SKU: searchRegex }, { barcode: searchRegex }],
    }).select('_id');

    query.productId = { $in: matchedProducts.map((p) => p._id) };
  }

  const skip = (page - 1) * limit;

  const [stockRecords, total] = await Promise.all([
    Inventory.find(query)
      .populate('productId', 'name SKU barcode lowStockAlert unitId')
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1 }),
    Inventory.countDocuments(query),
  ]);

  return {
    warehouse: {
      _id: warehouse._id,
      warehouseName: warehouse.warehouseName,
      warehouseCode: warehouse.warehouseCode,
      isDefault: warehouse.isDefault,
    },
    items: stockRecords,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * List stock movement history
 */
export const getMovements = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 20,
    productId,
    warehouseId,
    movementType,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (productId && mongoose.isValidObjectId(productId)) {
    query.productId = productId;
  }

  if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
    query.warehouseId = warehouseId;
  }

  if (movementType) {
    query.movementType = movementType;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortBy]: sortDirection };

  const [movements, total] = await Promise.all([
    StockMovement.find(query)
      .populate('productId', 'name SKU barcode')
      .populate('warehouseId', 'warehouseName warehouseCode')
      .populate('createdBy', 'name email role')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(query),
  ]);

  return {
    movements,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Low stock report
 */
export const getLowStockReport = async (tenantId, options = {}) => {
  const { page = 1, limit = 20, search, warehouseId } = options;

  const productMatch = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    productType: 'goods',
    trackInventory: true,
    isDeleted: false,
    lowStockAlert: { $gt: 0 },
  };

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    productMatch.$or = [{ name: searchRegex }, { SKU: searchRegex }, { barcode: searchRegex }];
  }

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
    { $match: productMatch },
    {
      $lookup: {
        from: 'inventories',
        let: { tId: '$tenantId', pId: '$_id' },
        pipeline: [
          { $match: inventoryMatch },
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: '$quantity' },
              totalAvailable: { $sum: '$availableQuantity' },
            },
          },
        ],
        as: 'stockSummary',
      },
    },
    {
      $addFields: {
        currentStock: {
          $ifNull: [{ $arrayElemAt: ['$stockSummary.totalAvailable', 0] }, 0],
        },
      },
    },
    {
      $match: {
        $expr: { $lte: ['$currentStock', '$lowStockAlert'] },
      },
    },
    {
      $lookup: {
        from: 'units',
        localField: 'unitId',
        foreignField: '_id',
        as: 'unitInfo',
      },
    },
    {
      $project: {
        name: 1,
        SKU: 1,
        barcode: 1,
        lowStockAlert: 1,
        currentStock: 1,
        unit: { $arrayElemAt: ['$unitInfo', 0] },
        shortfall: { $subtract: ['$lowStockAlert', '$currentStock'] },
      },
    },
    { $sort: { shortfall: -1, name: 1 } },
  ];

  const skip = (page - 1) * limit;

  const [countResult, items] = await Promise.all([
    Product.aggregate([...pipeline, { $count: 'total' }]),
    Product.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
  ]);

  const total = countResult[0] ? countResult[0].total : 0;

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    },
  };
};

export default {
  initializeOpeningStock,
  stockIn,
  stockOut,
  adjustStock,
  transferStock,
  getInventory,
  getProductStockSummary,
  getWarehouseStockSummary,
  getMovements,
  getLowStockReport,
};
