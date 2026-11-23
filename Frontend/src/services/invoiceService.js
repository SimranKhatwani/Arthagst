export const generateNextDocNumber = (prefix, existingDocs = [], fieldName = 'invoiceNumber', padLen = 3) => {
  let maxNum = 0;
  existingDocs.forEach((doc) => {
    const val = String(doc[fieldName] || '');
    const match = val.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(padLen, '0')}`;
};

export const computePaymentStatus = (grandTotal, amountPaid) => {
  const total = Number(grandTotal) || 0;
  const paid = Number(amountPaid) || 0;
  if (paid <= 0) return 'Unpaid';
  if (paid >= total - 0.5) return 'Paid';
  return 'Partial';
};
