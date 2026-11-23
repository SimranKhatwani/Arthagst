import PurchaseSequence from './purchaseSequence.model.js';
import { resolveStateCode, getFinancialYear, round2 } from '../sales/sales.calculator.js';

export { resolveStateCode, getFinancialYear, round2 };

/**
 * Generate unique purchase document number atomically
 */
export const generatePurchaseDocumentNumber = async (
  tenantId,
  documentType = 'bill',
  date = new Date(),
  session = null
) => {
  const financialYear = getFinancialYear(date);
  const prefixMap = {
    purchase_order: 'PO',
    grn: 'GRN',
    bill: 'BILL',
    debit_note: 'DN',
  };
  const prefix = prefixMap[documentType] || 'PUR';

  const query = { tenantId, documentType, financialYear };
  const update = { $inc: { sequence: 1 } };
  const options = { upsert: true, returnDocument: 'after' };
  if (session) options.session = session;

  const seq = await PurchaseSequence.findOneAndUpdate(query, update, options);
  const formattedNumber = `${prefix}/${financialYear}/${String(seq.sequence).padStart(4, '0')}`;

  return {
    documentNumber: formattedNumber,
    financialYear,
  };
};

/**
 * Calculate purchase document line items and taxes
 */
export const calculatePurchaseDocument = ({
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
      receivedQuantity: item.receivedQuantity || 0,
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
  resolveStateCode,
  getFinancialYear,
  round2,
  generatePurchaseDocumentNumber,
  calculatePurchaseDocument,
};
