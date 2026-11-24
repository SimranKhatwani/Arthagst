import SalesSequence from '../models/salesSequence.model.js';

export const INDIAN_STATES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

const STATE_NAME_TO_CODE = Object.entries(INDIAN_STATES).reduce((acc, [code, name]) => {
  acc[name.toLowerCase()] = code;
  return acc;
}, {});

/**
 * Get 2-digit Indian GST State code from code string or state name
 */
export const resolveStateCode = (input) => {
  if (!input) return '27'; // Default Maharashtra if unspecified
  const trimmed = String(input).trim();
  if (/^[0-9]{2}$/.test(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  return STATE_NAME_TO_CODE[lower] || '27';
};

/**
 * Get financial year string according to Indian Financial Year calendar (April 1 to March 31)
 * e.g., November 2026 -> '2026-27'; February 2027 -> '2026-27'
 */
export const getFinancialYear = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1 to 12

  if (month >= 4) {
    const nextYear = String((year + 1) % 100).padStart(2, '0');
    return `${year}-${nextYear}`;
  } else {
    const curYear = String(year % 100).padStart(2, '0');
    return `${year - 1}-${curYear}`;
  }
};

/**
 * Generate unique document number atomically
 */
export const generateDocumentNumber = async (
  tenantId,
  documentType = 'invoice',
  date = new Date(),
  session = null
) => {
  const financialYear = getFinancialYear(date);
  const prefixMap = {
    invoice: 'INV',
    quotation: 'QTN',
    order: 'SO',
    challan: 'DC',
    credit_note: 'CN',
  };
  const prefix = prefixMap[documentType] || 'DOC';

  const query = { tenantId, documentType, financialYear };
  const update = { $inc: { sequence: 1 } };
  const options = { upsert: true, returnDocument: 'after' };
  if (session) options.session = session;

  const seq = await SalesSequence.findOneAndUpdate(query, update, options);
  const formattedNumber = `${prefix}/${financialYear}/${String(seq.sequence).padStart(4, '0')}`;

  return {
    documentNumber: formattedNumber,
    financialYear,
  };
};

/**
 * Round number to 2 decimal places
 */
export const round2 = (num) => {
  return Math.round((Number(num) || 0) * 100) / 100;
};

/**
 * Calculate comprehensive GST line items and totals
 */
export const calculateSalesDocument = ({
  supplierStateCode,
  placeOfSupply,
  items,
  paidAmount = 0,
}) => {
  const resolvedSupplierCode = resolveStateCode(supplierStateCode);
  const resolvedPOSCode = resolveStateCode(placeOfSupply);
  const isInterState = resolvedSupplierCode !== resolvedPOSCode;

  let subtotal = 0;
  let discountTotal = 0;
  let taxableAmount = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let cessTotal = 0;

  const calculatedItems = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const gross = round2(quantity * unitPrice);

    const discount = round2(item.discount || 0);
    const taxableValue = Math.max(0, round2(gross - discount));

    const gstRate = Number(item.gstRate) || 0;
    const cessRate = Number(item.cessRate) || 0;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gstRate > 0 && taxableValue > 0) {
      if (isInterState) {
        igst = round2((taxableValue * gstRate) / 100);
      } else {
        const halfRate = gstRate / 2;
        cgst = round2((taxableValue * halfRate) / 100);
        sgst = round2((taxableValue * halfRate) / 100);
      }
    }

    const cess = cessRate > 0 && taxableValue > 0
      ? round2((taxableValue * cessRate) / 100)
      : 0;

    const lineTotal = round2(taxableValue + cgst + sgst + igst + cess);

    subtotal += gross;
    discountTotal += discount;
    taxableAmount += taxableValue;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;
    cessTotal += cess;

    return {
      productId: item.productId,
      productName: item.productName,
      description: item.description || '',
      HSN: item.HSN || '',
      SAC: item.SAC || '',
      quantity,
      unitId: item.unitId || null,
      unitName: item.unitName || 'PCS',
      unitPrice,
      discount,
      taxableValue,
      gstRate,
      cgst,
      sgst,
      igst,
      cess,
      lineTotal,
      returnedQuantity: item.returnedQuantity || 0,
    };
  });

  subtotal = round2(subtotal);
  discountTotal = round2(discountTotal);
  taxableAmount = round2(taxableAmount);
  cgstTotal = round2(cgstTotal);
  sgstTotal = round2(sgstTotal);
  igstTotal = round2(igstTotal);
  cessTotal = round2(cessTotal);

  const unroundedTotal = round2(taxableAmount + cgstTotal + sgstTotal + igstTotal + cessTotal);
  const grandTotal = Math.round(unroundedTotal);
  const roundOff = round2(grandTotal - unroundedTotal);

  const validPaid = Math.max(0, round2(paidAmount));
  const balanceAmount = Math.max(0, round2(grandTotal - validPaid));

  let paymentStatus = 'unpaid';
  if (validPaid >= grandTotal && grandTotal > 0) {
    paymentStatus = 'paid';
  } else if (validPaid > 0) {
    paymentStatus = 'partially_paid';
  }

  return {
    placeOfSupplyCode: resolvedPOSCode,
    supplierStateCode: resolvedSupplierCode,
    isInterState,
    items: calculatedItems,
    subtotal,
    discountTotal,
    taxableAmount,
    cgstTotal,
    sgstTotal,
    igstTotal,
    cessTotal,
    roundOff,
    grandTotal,
    paidAmount: validPaid,
    balanceAmount,
    paymentStatus,
  };
};

export default {
  INDIAN_STATES,
  resolveStateCode,
  getFinancialYear,
  generateDocumentNumber,
  round2,
  calculateSalesDocument,
};
