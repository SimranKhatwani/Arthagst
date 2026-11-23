import mongoose from 'mongoose';
import EWayBill from './eWayBill.model.js';
import SalesInvoice from '../sales/salesInvoice.model.js';
import Tenant from '../tenants/tenant.model.js';
import EInvoice from '../eInvoice/eInvoice.model.js';
import { getEWayBillProvider } from './providers/index.js';

export const generateEWayBill = async (tenantId, userId, data) => {
  const { salesInvoiceId, distance, transportMode, transporterId, transporterName, vehicleNumber, vehicleType } = data;

  if (!mongoose.isValidObjectId(salesInvoiceId)) {
    const error = new Error('Invalid sales invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const [invoice, tenant, existingEWB, linkedEInvoice] = await Promise.all([
    SalesInvoice.findOne({ _id: salesInvoiceId, tenantId }),
    Tenant.findById(tenantId),
    EWayBill.findOne({ tenantId, salesInvoiceId, status: { $in: ['generated', 'active'] } }),
    EInvoice.findOne({ tenantId, salesInvoiceId, status: 'generated' }),
  ]);

  if (!invoice) {
    const error = new Error('Sales invoice not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  if (invoice.invoiceStatus !== 'posted') {
    const error = new Error(`Invoice is in '${invoice.invoiceStatus}' status. E-Way Bills can only be generated for posted invoices.`);
    error.statusCode = 400;
    throw error;
  }

  if (existingEWB) {
    const error = new Error(`An active E-Way Bill (${existingEWB.eWayBillNumber}) has already been generated for invoice ${invoice.invoiceNumber}.`);
    error.statusCode = 400;
    throw error;
  }

  if (!transporterId && !vehicleNumber) {
    const error = new Error('Either Transporter ID or Vehicle Number is mandatory to generate an E-Way Bill.');
    error.statusCode = 400;
    throw error;
  }

  const fromPincode = data.fromPincode || tenant.pincode || '400001';
  const toPincode = data.toPincode || '400001';

  // Format E-Way Bill payload
  const ewbPayload = {
    supplyType: 'O',
    subSupplyType: '1',
    docType: 'INV',
    docNo: invoice.invoiceNumber,
    docDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : '',
    fromGstin: tenant.GSTIN || 'URP',
    fromTrdName: tenant.businessName,
    fromAddr1: tenant.businessAddress || 'Address',
    fromPlace: tenant.city || 'City',
    fromPincode: Number(fromPincode),
    toGstin: invoice.partyGSTIN || 'URP',
    toTrdName: invoice.partyName,
    toAddr1: invoice.billingAddress || invoice.shippingAddress || 'Address',
    toPlace: invoice.billingAddress || 'City',
    toPincode: Number(toPincode),
    totalValue: invoice.grandTotal,
    cgstValue: invoice.cgstTotal,
    sgstValue: invoice.sgstTotal,
    igstValue: invoice.igstTotal,
    cessValue: invoice.cessTotal,
    transporterId: transporterId || '',
    transporterName: transporterName || '',
    transMode: transportMode || '1: Road',
    transDistance: Number(distance),
    vehNo: vehicleNumber || '',
    vehType: vehicleType || 'regular',
  };

  const eWayBill = new EWayBill({
    tenantId,
    salesInvoiceId: invoice._id,
    eInvoiceId: linkedEInvoice ? linkedEInvoice._id : null,
    documentNumber: invoice.invoiceNumber,
    documentDate: invoice.invoiceDate,
    supplyType: 'O: Outward',
    subSupplyType: '1: Supply',
    docType: 'INV',
    fromPincode: String(fromPincode),
    toPincode: String(toPincode),
    distance: Number(distance),
    transporterId: transporterId || '',
    transporterName: transporterName || '',
    transportMode: transportMode || '1: Road',
    vehicleNumber: vehicleNumber ? vehicleNumber.toUpperCase() : '',
    vehicleType: vehicleType || 'regular',
    status: 'pending',
    requestPayload: ewbPayload,
    createdBy: userId,
  });

  await eWayBill.save();

  // Call Provider Adapter
  const provider = getEWayBillProvider();
  eWayBill.provider = process.env.EWAYBILL_PROVIDER === 'mock' ? 'mock' : 'nic';

  try {
    const providerResult = await provider.generateEWayBill(ewbPayload);

    eWayBill.status = 'generated';
    eWayBill.eWayBillNumber = providerResult.eWayBillNumber;
    eWayBill.generatedDate = providerResult.generatedDate;
    eWayBill.validUntil = providerResult.validUntil;
    eWayBill.providerResponse = providerResult.providerResponse;
    eWayBill.errorMessage = '';

    if (vehicleNumber) {
      eWayBill.vehicleHistory = [
        {
          vehicleNumber: vehicleNumber.toUpperCase(),
          transporterId: transporterId || '',
          transportMode: transportMode || '1: Road',
          fromPlace: tenant.city || '',
          fromState: tenant.state || '',
          reasonCode: 'First Time Part-B Entry',
          reasonRemark: 'Initial generation',
          updatedAt: providerResult.generatedDate,
          updatedBy: userId,
        },
      ];
    }

    await eWayBill.save();

    // Update SalesInvoice with E-Way Bill Number
    invoice.eWayBillNumber = providerResult.eWayBillNumber;
    invoice.eWayBillStatus = 'generated';
    await invoice.save();

    return eWayBill;
  } catch (err) {
    eWayBill.status = 'failed';
    eWayBill.errorMessage = err.message || 'E-Way Bill generation failed';
    await eWayBill.save();

    err.statusCode = err.statusCode || 500;
    throw err;
  }
};

/**
 * Update Vehicle Details (Part-B Update)
 */
export const updateVehicle = async (tenantId, userId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid E-Way Bill ID format');
    error.statusCode = 400;
    throw error;
  }

  const eWayBill = await EWayBill.findOne({ _id: id, tenantId });
  if (!eWayBill) {
    const error = new Error('E-Way Bill not found');
    error.statusCode = 404;
    throw error;
  }

  if (eWayBill.status !== 'generated' && eWayBill.status !== 'active') {
    const error = new Error(`Cannot update vehicle for E-Way Bill in '${eWayBill.status}' status.`);
    error.statusCode = 400;
    throw error;
  }

  const provider = getEWayBillProvider();
  await provider.updateVehicle({
    eWayBillNumber: eWayBill.eWayBillNumber,
    vehicleNumber: data.vehicleNumber.toUpperCase(),
    transportMode: data.transportMode,
    fromPlace: data.fromPlace,
    fromState: data.fromState,
    reasonCode: data.reasonCode,
    reasonRemark: data.reasonRemark,
  });

  eWayBill.vehicleNumber = data.vehicleNumber.toUpperCase();
  eWayBill.transportMode = data.transportMode || eWayBill.transportMode;
  eWayBill.status = 'active';

  eWayBill.vehicleHistory.push({
    vehicleNumber: data.vehicleNumber.toUpperCase(),
    transporterId: eWayBill.transporterId,
    transportMode: data.transportMode || eWayBill.transportMode,
    fromPlace: data.fromPlace || '',
    fromState: data.fromState || '',
    reasonCode: data.reasonCode || '1: Due to Break Down',
    reasonRemark: data.reasonRemark || '',
    updatedAt: new Date(),
    updatedBy: userId,
  });

  await eWayBill.save();
  return eWayBill;
};

/**
 * Update Transporter Details
 */
export const updateTransporter = async (tenantId, userId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid E-Way Bill ID format');
    error.statusCode = 400;
    throw error;
  }

  const eWayBill = await EWayBill.findOne({ _id: id, tenantId });
  if (!eWayBill) {
    const error = new Error('E-Way Bill not found');
    error.statusCode = 404;
    throw error;
  }

  const provider = getEWayBillProvider();
  await provider.updateTransporter({
    eWayBillNumber: eWayBill.eWayBillNumber,
    transporterId: data.transporterId.toUpperCase(),
  });

  eWayBill.transporterId = data.transporterId.toUpperCase();
  if (data.transporterName) eWayBill.transporterName = data.transporterName;

  await eWayBill.save();
  return eWayBill;
};

/**
 * Extend Validity of E-Way Bill
 */
export const extendValidity = async (tenantId, userId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid E-Way Bill ID format');
    error.statusCode = 400;
    throw error;
  }

  const eWayBill = await EWayBill.findOne({ _id: id, tenantId });
  if (!eWayBill) {
    const error = new Error('E-Way Bill not found');
    error.statusCode = 404;
    throw error;
  }

  const provider = getEWayBillProvider();
  const providerResult = await provider.extendValidity({
    eWayBillNumber: eWayBill.eWayBillNumber,
    remainingDistance: data.remainingDistance,
    fromPlace: data.fromPlace,
    fromState: data.fromState,
    vehicleNumber: data.vehicleNumber || eWayBill.vehicleNumber,
    reasonCode: data.reasonCode,
  });

  eWayBill.validUntil = providerResult.validUntil;
  eWayBill.extensionReason = data.reasonCode || data.reasonRemark || 'Extended validity';
  if (data.vehicleNumber) {
    eWayBill.vehicleNumber = data.vehicleNumber.toUpperCase();
  }

  await eWayBill.save();
  return eWayBill;
};

/**
 * Cancel E-Way Bill
 */
export const cancelEWayBill = async (tenantId, userId, id, data) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid E-Way Bill ID format');
    error.statusCode = 400;
    throw error;
  }

  const eWayBill = await EWayBill.findOne({ _id: id, tenantId });
  if (!eWayBill) {
    const error = new Error('E-Way Bill not found');
    error.statusCode = 404;
    throw error;
  }

  if (eWayBill.status === 'cancelled') {
    const error = new Error('E-Way Bill is already cancelled');
    error.statusCode = 400;
    throw error;
  }

  // 24-Hour Rule Check per GST rules
  if (eWayBill.generatedDate) {
    const hoursElapsed = (Date.now() - new Date(eWayBill.generatedDate).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      const error = new Error('E-Way Bill cannot be cancelled after 24 hours of generation per GST portal rules.');
      error.statusCode = 400;
      throw error;
    }
  }

  const provider = getEWayBillProvider();
  const providerResult = await provider.cancelEWayBill({
    eWayBillNumber: eWayBill.eWayBillNumber,
    reason: data.cancellationReason,
    remarks: data.cancellationRemarks,
  });

  eWayBill.status = 'cancelled';
  eWayBill.cancellationReason = data.cancellationReason;
  eWayBill.cancellationRemarks = data.cancellationRemarks;
  eWayBill.cancellationDate = providerResult.cancelDate || new Date();
  await eWayBill.save();

  // Update SalesInvoice
  await SalesInvoice.findByIdAndUpdate(eWayBill.salesInvoiceId, {
    eWayBillStatus: 'cancelled',
  });

  return eWayBill;
};

/**
 * Get paginated list of E-Way Bills
 */
export const getEWayBills = async (tenantId, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenantId };

  if (status) query.status = status;

  if (startDate || endDate) {
    query.documentDate = {};
    if (startDate) query.documentDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.documentDate.$lte = end;
    }
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    query.$or = [
      { documentNumber: searchRegex },
      { eWayBillNumber: searchRegex },
      { transporterId: searchRegex },
      { vehicleNumber: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [eWayBills, total] = await Promise.all([
    EWayBill.find(query)
      .populate('salesInvoiceId', 'invoiceNumber grandTotal paymentStatus partyName invoiceStatus')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    EWayBill.countDocuments(query),
  ]);

  return {
    eWayBills,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get E-Way Bill by ID
 */
export const getEWayBillById = async (tenantId, id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid E-Way Bill ID format');
    error.statusCode = 400;
    throw error;
  }

  const eWayBill = await EWayBill.findOne({ _id: id, tenantId })
    .populate('salesInvoiceId')
    .populate('eInvoiceId')
    .populate('createdBy', 'name email')
    .lean();

  if (!eWayBill) {
    const error = new Error('E-Way Bill not found');
    error.statusCode = 404;
    throw error;
  }

  return eWayBill;
};

/**
 * Get E-Way Bill by Sales Invoice ID
 */
export const getEWayBillByInvoiceId = async (tenantId, salesInvoiceId) => {
  if (!mongoose.isValidObjectId(salesInvoiceId)) {
    const error = new Error('Invalid sales invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const eWayBills = await EWayBill.find({ salesInvoiceId, tenantId })
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  return eWayBills;
};

export default {
  generateEWayBill,
  updateVehicle,
  updateTransporter,
  extendValidity,
  cancelEWayBill,
  getEWayBills,
  getEWayBillById,
  getEWayBillByInvoiceId,
};
