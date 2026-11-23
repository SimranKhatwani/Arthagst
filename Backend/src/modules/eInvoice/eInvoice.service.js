import mongoose from 'mongoose';
import EInvoice from './eInvoice.model.js';
import SalesInvoice from '../sales/salesInvoice.model.js';
import Tenant from '../tenants/tenant.model.js';
import { getEInvoiceProvider } from './providers/index.js';
import { isValidGSTIN, resolveStateCode, round2 } from '../gst/gst.calculator.js';

/**
 * Format a Date object to DD/MM/YYYY required by E-Invoice schema
 */
const formatDateDDMMYYYY = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Check E-Invoice eligibility for a Sales Invoice
 */
export const checkEligibility = async (tenantId, salesInvoiceId) => {
  if (!mongoose.isValidObjectId(salesInvoiceId)) {
    const error = new Error('Invalid sales invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const [invoice, tenant, existingEInvoice] = await Promise.all([
    SalesInvoice.findOne({ _id: salesInvoiceId, tenantId }),
    Tenant.findById(tenantId),
    EInvoice.findOne({ tenantId, salesInvoiceId }),
  ]);

  if (!invoice) {
    const error = new Error('Sales invoice not found in your organization');
    error.statusCode = 404;
    throw error;
  }

  const reasons = [];

  // 1. Status Check
  if (invoice.invoiceStatus !== 'posted') {
    reasons.push(`Invoice is in '${invoice.invoiceStatus}' status. Only posted invoices are eligible for e-invoicing.`);
  }

  // 2. Existing E-Invoice Check
  if (existingEInvoice && existingEInvoice.status === 'generated') {
    reasons.push(`An active IRN (${existingEInvoice.IRN}) has already been generated for this invoice.`);
  }

  // 3. Supplier GSTIN Check
  const supplierGSTIN = tenant?.GSTIN?.trim().toUpperCase();
  if (!supplierGSTIN || !isValidGSTIN(supplierGSTIN)) {
    reasons.push('Your business (Supplier) does not have a valid 15-digit GSTIN configured in Organization Settings.');
  }

  // 4. Recipient GSTIN or Export Check
  const isExport = Boolean(invoice.isExport);
  const recipientGSTIN = invoice.partyGSTIN?.trim().toUpperCase();

  if (!isExport) {
    if (!recipientGSTIN || !isValidGSTIN(recipientGSTIN)) {
      reasons.push(
        'E-Invoicing is applicable for B2B/B2G supplies and Exports. The customer does not have a valid registered GSTIN.'
      );
    }
  }

  // 5. Place of Supply Check
  if (!invoice.placeOfSupply && !invoice.placeOfSupplyCode) {
    reasons.push('Place of supply (POS) is required.');
  }

  // 6. Line Items & HSN Validation
  if (!invoice.items || invoice.items.length === 0) {
    reasons.push('Invoice must have at least one line item.');
  } else {
    for (const item of invoice.items) {
      const hsn = (item.HSN || item.SAC || '').trim();
      if (!hsn) {
        reasons.push(`Item '${item.productName}' does not have an HSN/SAC code.`);
      }
      if (item.quantity <= 0) {
        reasons.push(`Item '${item.productName}' has invalid quantity (${item.quantity}).`);
      }
    }
  }

  const isEligible = reasons.length === 0;

  return {
    isEligible,
    reasons,
    invoice,
    tenant,
    existingEInvoice,
  };
};

/**
 * Format invoice into standard government E-Invoice INV-01 JSON Schema
 */
export const formatEInvoicePayload = (tenant, invoice) => {
  const sellerGSTIN = tenant.GSTIN.trim().toUpperCase();
  const sellerStateCode = resolveStateCode(tenant.stateCode || tenant.state || sellerGSTIN.substring(0, 2)) || '27';
  const buyerGSTIN = invoice.isExport ? 'URP' : invoice.partyGSTIN.trim().toUpperCase();
  const buyerStateCode = invoice.placeOfSupplyCode || resolveStateCode(invoice.placeOfSupply) || '27';

  // Supply type determination
  let supTyp = 'B2B';
  if (invoice.isExport) {
    supTyp = invoice.exportType === 'WPAY' ? 'EXPWP' : 'EXPWOP';
  }

  // Item List
  const itemList = (invoice.items || []).map((itm, idx) => {
    const qty = Number(itm.quantity) || 1;
    const rate = Number(itm.unitPrice) || 0;
    const totAmt = round2(qty * rate);
    const discount = Number(itm.discount) || 0;
    const taxableAmt = round2(itm.taxableValue);
    const gstRate = Number(itm.gstRate) || 0;

    return {
      ItemSeq: idx + 1,
      PrdDesc: itm.productName,
      IsServc: itm.productType === 'service' ? 'Y' : 'N',
      HsnCd: (itm.HSN || itm.SAC || '').trim(),
      Qty: qty,
      Unit: itm.unitName || 'PCS',
      UnitPrice: rate,
      TotAmt: totAmt,
      Discount: discount,
      AssAmt: taxableAmt,
      GstRt: gstRate,
      IgstAmt: Number(itm.igst) || 0,
      CgstAmt: Number(itm.cgst) || 0,
      SgstAmt: Number(itm.sgst) || 0,
      CesAmt: Number(itm.cess) || 0,
      TotItemVal: Number(itm.lineTotal) || taxableAmt,
    };
  });

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: supTyp,
      RegRev: 'N',
      EcmGstin: null,
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: invoice.invoiceNumber,
      Dt: formatDateDDMMYYYY(invoice.invoiceDate),
    },
    SellerDtls: {
      Gstin: sellerGSTIN,
      LglNm: tenant.businessName,
      TrdNm: tenant.businessName,
      Addr1: tenant.businessAddress || 'Business Address',
      Loc: tenant.city || 'City',
      Pin: Number(tenant.pincode) || 400001,
      Stcd: sellerStateCode,
    },
    BuyerDtls: {
      Gstin: buyerGSTIN,
      LglNm: invoice.partyName,
      TrdNm: invoice.partyName,
      Pos: buyerStateCode,
      Addr1: invoice.billingAddress || invoice.shippingAddress || 'Customer Address',
      Loc: invoice.billingAddress || 'City',
      Pin: 400001,
      Stcd: buyerStateCode,
    },
    ItemList: itemList,
    ValDtls: {
      AssVal: invoice.taxableAmount,
      CgstVal: invoice.cgstTotal,
      SgstVal: invoice.sgstTotal,
      IgstVal: invoice.igstTotal,
      CesVal: invoice.cessTotal,
      RndOffAmt: invoice.roundOff || 0,
      TotInvVal: invoice.grandTotal,
    },
  };
};

/**
 * Generate E-Invoice (IRN)
 */
export const generateEInvoice = async (tenantId, userId, data) => {
  const { salesInvoiceId } = data;

  // 1. Check Eligibility
  const { isEligible, reasons, invoice, tenant, existingEInvoice } = await checkEligibility(
    tenantId,
    salesInvoiceId
  );

  if (!isEligible) {
    const error = new Error(`Invoice is not eligible for E-Invoicing: ${reasons.join('; ')}`);
    error.statusCode = 400;
    error.details = reasons;
    throw error;
  }

  if (existingEInvoice && existingEInvoice.status === 'generated') {
    const error = new Error(`IRN already generated for invoice ${invoice.invoiceNumber}: ${existingEInvoice.IRN}`);
    error.statusCode = 400;
    throw error;
  }

  // 2. Format government standardized INV-01 JSON payload
  const eInvoicePayload = formatEInvoicePayload(tenant, invoice);

  // 3. Create or reuse EInvoice record in pending status
  let eInvoice = existingEInvoice;
  if (!eInvoice) {
    eInvoice = new EInvoice({
      tenantId,
      salesInvoiceId: invoice._id,
      GSTIN: tenant.GSTIN.trim().toUpperCase(),
      recipientGSTIN: (invoice.partyGSTIN || 'URP').trim().toUpperCase(),
      documentNumber: invoice.invoiceNumber,
      documentDate: invoice.invoiceDate,
      documentType: 'INV',
      status: 'pending',
      requestPayload: eInvoicePayload,
      createdBy: userId,
    });
  } else {
    eInvoice.status = 'pending';
    eInvoice.requestPayload = eInvoicePayload;
    eInvoice.errorMessage = '';
  }

  await eInvoice.save();

  // 4. Call Provider Adapter
  const provider = getEInvoiceProvider();
  eInvoice.provider = process.env.EINVOICE_PROVIDER === 'mock' ? 'mock' : 'nic';

  try {
    const providerResult = await provider.generateIRN(eInvoicePayload);

    // 5. Update EInvoice on successful generation
    eInvoice.status = 'generated';
    eInvoice.IRN = providerResult.irn;
    eInvoice.acknowledgementNumber = providerResult.acknowledgementNumber;
    eInvoice.acknowledgementDate = providerResult.acknowledgementDate;
    eInvoice.signedQRCode = providerResult.signedQRCode;
    eInvoice.signedInvoice = providerResult.signedInvoice;
    eInvoice.providerResponse = providerResult.providerResponse;
    eInvoice.errorMessage = '';
    await eInvoice.save();

    // 6. Update SalesInvoice with IRN metadata
    invoice.eInvoiceStatus = 'generated';
    invoice.irn = providerResult.irn;
    invoice.signedQRCode = providerResult.signedQRCode;
    await invoice.save();

    return eInvoice;
  } catch (err) {
    // 7. Record failure
    eInvoice.status = 'failed';
    eInvoice.errorMessage = err.message || 'E-Invoice generation failed';
    await eInvoice.save();

    invoice.eInvoiceStatus = 'failed';
    await invoice.save();

    err.statusCode = err.statusCode || 500;
    throw err;
  }
};

/**
 * Cancel E-Invoice (IRN)
 */
export const cancelEInvoice = async (tenantId, userId, eInvoiceId, data) => {
  if (!mongoose.isValidObjectId(eInvoiceId)) {
    const error = new Error('Invalid E-Invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const eInvoice = await EInvoice.findOne({ _id: eInvoiceId, tenantId });
  if (!eInvoice) {
    const error = new Error('E-Invoice not found');
    error.statusCode = 404;
    throw error;
  }

  if (eInvoice.status !== 'generated') {
    const error = new Error(`Cannot cancel E-Invoice in '${eInvoice.status}' status. Only generated IRNs can be cancelled.`);
    error.statusCode = 400;
    throw error;
  }

  // 24-Hour Rule Check per GST rules
  if (eInvoice.acknowledgementDate) {
    const hoursElapsed = (Date.now() - new Date(eInvoice.acknowledgementDate).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      const error = new Error(
        'IRN cannot be cancelled after 24 hours of generation per GST portal rules. A Credit Note must be issued instead.'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const provider = getEInvoiceProvider();

  const providerResult = await provider.cancelIRN({
    irn: eInvoice.IRN,
    reason: data.cancellationReason,
    remarks: data.cancellationRemarks,
  });

  const cancellationDate = providerResult.cancelDate || new Date();

  eInvoice.status = 'cancelled';
  eInvoice.cancellationReason = data.cancellationReason;
  eInvoice.cancellationRemarks = data.cancellationRemarks;
  eInvoice.cancellationDate = cancellationDate;
  if (providerResult.providerResponse) {
    eInvoice.providerResponse = {
      ...eInvoice.providerResponse,
      cancellation: providerResult.providerResponse,
    };
  }
  await eInvoice.save();

  // Update SalesInvoice
  await SalesInvoice.findByIdAndUpdate(eInvoice.salesInvoiceId, {
    eInvoiceStatus: 'cancelled',
  });

  return eInvoice;
};

/**
 * Get paginated list of E-Invoices
 */
export const getEInvoices = async (tenantId, options = {}) => {
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
      { IRN: searchRegex },
      { recipientGSTIN: searchRegex },
      { acknowledgementNumber: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [eInvoices, total] = await Promise.all([
    EInvoice.find(query)
      .populate('salesInvoiceId', 'invoiceNumber grandTotal paymentStatus partyName invoiceStatus')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    EInvoice.countDocuments(query),
  ]);

  return {
    eInvoices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get E-Invoice by ID
 */
export const getEInvoiceById = async (tenantId, eInvoiceId) => {
  if (!mongoose.isValidObjectId(eInvoiceId)) {
    const error = new Error('Invalid E-Invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const eInvoice = await EInvoice.findOne({ _id: eInvoiceId, tenantId })
    .populate('salesInvoiceId')
    .populate('createdBy', 'name email')
    .lean();

  if (!eInvoice) {
    const error = new Error('E-Invoice not found');
    error.statusCode = 404;
    throw error;
  }

  return eInvoice;
};

/**
 * Get E-Invoice by Sales Invoice ID
 */
export const getEInvoiceByInvoiceId = async (tenantId, salesInvoiceId) => {
  if (!mongoose.isValidObjectId(salesInvoiceId)) {
    const error = new Error('Invalid sales invoice ID format');
    error.statusCode = 400;
    throw error;
  }

  const eInvoice = await EInvoice.findOne({ salesInvoiceId, tenantId })
    .populate('createdBy', 'name email')
    .lean();

  return eInvoice;
};

export default {
  checkEligibility,
  formatEInvoicePayload,
  generateEInvoice,
  cancelEInvoice,
  getEInvoices,
  getEInvoiceById,
  getEInvoiceByInvoiceId,
};
