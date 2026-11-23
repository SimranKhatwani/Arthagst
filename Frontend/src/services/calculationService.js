export const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

export const formatINR = (amount, showDecimals = true) => {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(val);
};

export const formatNumberIN = (num) => {
  return new Intl.NumberFormat('en-IN').format(Number(num) || 0);
};

export const formatDateIN = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const amountInWordsINR = (amount) => {
  const num = Math.round((Number(amount) || 0) * 100) / 100;
  if (num === 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seven' + 'ty', 'Eighty', 'Ninety'];

  const twoDigits = (n) => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  };

  const convertInt = (n) => {
    if (n === 0) return '';
    let str = '';
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    const hundred = Math.floor(n / 100);
    const rest = n % 100;

    if (crore) str += convertInt(crore) + ' Crore ';
    if (lakh) str += twoDigits(lakh) + ' Lakh ';
    if (thousand) str += twoDigits(thousand) + ' Thousand ';
    if (hundred) str += ones[hundred] + ' Hundred ';
    if (rest) str += (str ? 'and ' : '') + twoDigits(rest);
    return str.trim();
  };

  const rupees = Math.floor(Math.abs(num));
  const paise = Math.round((Math.abs(num) - rupees) * 100);
  let result = (rupees ? convertInt(rupees) + ' Rupees' : '');
  if (paise > 0) {
    result += (result ? ' and ' : '') + twoDigits(paise) + ' Paise';
  }
  return (num < 0 ? 'Minus ' : '') + result + ' Only';
};

export const calculateLineItem = ({
  qty = 1,
  rate = 0,
  discountPct = 0,
  gstRate = 18,
  cessRate = 0,
  isIntraState = true,
  priceInclusive = false,
}) => {
  const q = Math.max(0, Number(qty) || 0);
  const r = Math.max(0, Number(rate) || 0);
  const discP = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const gst = Math.max(0, Number(gstRate) || 0);
  const cess = Math.max(0, Number(cessRate) || 0);

  let baseRate = r;
  if (priceInclusive && gst + cess > 0) {
    baseRate = r / (1 + (gst + cess) / 100);
  }

  const grossAmount = round2(q * baseRate);
  const discountAmount = round2((grossAmount * discP) / 100);
  const taxableAmount = round2(grossAmount - discountAmount);
  const totalGst = round2((taxableAmount * gst) / 100);
  const cessAmount = round2((taxableAmount * cess) / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isIntraState) {
    cgst = round2(totalGst / 2);
    sgst = round2(totalGst - cgst);
  } else {
    igst = totalGst;
  }

  const totalAmount = round2(taxableAmount + cgst + sgst + igst + cessAmount);

  return {
    qty: q,
    rate: r,
    discountPct: discP,
    gstRate: gst,
    cessRate: cess,
    grossAmount,
    discountAmount,
    taxableAmount,
    cgst,
    sgst,
    igst,
    cessAmount,
    totalTax: round2(cgst + sgst + igst + cessAmount),
    totalAmount,
  };
};

export const calculateInvoiceTotals = ({
  items = [],
  sellerState = 'Rajasthan',
  placeOfSupply = 'Rajasthan',
  shipping = 0,
  otherCharges = 0,
  roundOffEnabled = true,
  priceInclusive = false,
}) => {
  const isIntraState =
    String(sellerState).trim().toLowerCase() ===
    String(placeOfSupply || sellerState).trim().toLowerCase();

  let subtotal = 0;
  let totalDiscount = 0;
  let taxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalCess = 0;

  const computedItems = items.map((item) => {
    const calc = calculateLineItem({
      qty: item.qty,
      rate: item.rate,
      discountPct: item.discountPct ?? item.discount ?? 0,
      gstRate: item.gstRate,
      cessRate: item.cessRate || 0,
      isIntraState,
      priceInclusive,
    });
    subtotal = round2(subtotal + calc.grossAmount);
    totalDiscount = round2(totalDiscount + calc.discountAmount);
    taxableValue = round2(taxableValue + calc.taxableAmount);
    totalCgst = round2(totalCgst + calc.cgst);
    totalSgst = round2(totalSgst + calc.sgst);
    totalIgst = round2(totalIgst + calc.igst);
    totalCess = round2(totalCess + calc.cessAmount);

    return {
      ...item,
      ...calc,
    };
  });

  const ship = Math.max(0, Number(shipping) || 0);
  const other = Math.max(0, Number(otherCharges) || 0);
  const totalTax = round2(totalCgst + totalSgst + totalIgst + totalCess);
  const rawGrand = round2(taxableValue + totalTax + ship + other);
  const roundedGrand = roundOffEnabled ? Math.round(rawGrand) : rawGrand;
  const roundOff = round2(roundedGrand - rawGrand);

  return {
    isIntraState,
    items: computedItems,
    subtotal,
    totalDiscount,
    taxableValue,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    cess: totalCess,
    totalTax,
    shipping: ship,
    otherCharges: other,
    roundOff,
    grandTotal: roundedGrand,
  };
};

export const getCustomerOutstanding = (customer, invoices = [], creditNotes = []) => {
  if (!customer) return 0;
  const openBal = Number(customer.openingBalance) || 0;
  const invBalance = invoices
    .filter(
      (inv) =>
        inv.customerId === customer.id &&
        inv.status !== 'Draft' &&
        inv.status !== 'Cancelled'
    )
    .reduce((sum, inv) => sum + Math.max(0, (Number(inv.grandTotal) || 0) - (Number(inv.amountPaid) || 0)), 0);
  const cnTotal = creditNotes
    .filter((cn) => cn.customerId === customer.id && cn.status === 'Issued')
    .reduce((sum, cn) => sum + (Number(cn.grandTotal) || 0), 0);
  return round2(Math.max(0, openBal + invBalance - cnTotal));
};

export const getSupplierOutstanding = (supplier, purchases = [], purchaseReturns = []) => {
  if (!supplier) return 0;
  const openBal = Number(supplier.openingBalance) || 0;
  const purBalance = purchases
    .filter((p) => p.supplierId === supplier.id && p.status !== 'Cancelled')
    .reduce((sum, p) => sum + Math.max(0, (Number(p.grandTotal) || 0) - (Number(p.amountPaid) || 0)), 0);
  const prTotal = purchaseReturns
    .filter((pr) => pr.supplierId === supplier.id && pr.status === 'Completed')
    .reduce((sum, pr) => sum + (Number(pr.grandTotal) || 0), 0);
  return round2(Math.max(0, openBal + purBalance - prTotal));
};

export const computeDashboardMetrics = (data, selectedFY = '2026-27') => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const validInvoices = (data.invoices || []).filter(
    (inv) =>
      inv.status !== 'Draft' &&
      inv.status !== 'Cancelled' &&
      (!selectedFY || inv.financialYear === selectedFY)
  );

  const validPurchases = (data.purchases || []).filter(
    (p) => p.status !== 'Cancelled' && (!selectedFY || p.financialYear === selectedFY)
  );

  const validExpenses = (data.expenses || []).filter(
    (e) => e.status !== 'Archived'
  );

  // Use latest invoice date month if current month has no entries so dashboard always feels alive
  const currentMonth = todayStr.slice(0, 7);
  let todaySales = validInvoices
    .filter((inv) => inv.date === todayStr)
    .reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0);

  let monthlySales = validInvoices
    .filter((inv) => (inv.date || '').startsWith(currentMonth))
    .reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0);

  const totalSales = validInvoices.reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0);
  if (monthlySales === 0 && validInvoices.length > 0) {
    const latestMonth = validInvoices
      .map((i) => (i.date || '').slice(0, 7))
      .sort()
      .pop();
    monthlySales = validInvoices
      .filter((inv) => (inv.date || '').startsWith(latestMonth))
      .reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0);
  }
  if (todaySales === 0 && validInvoices.length > 0) {
    const latestDate = validInvoices.map((i) => i.date || '').sort().pop();
    todaySales = validInvoices
      .filter((inv) => inv.date === latestDate)
      .reduce((s, inv) => s + (Number(inv.grandTotal) || 0), 0);
  }

  const totalPurchases = validPurchases.reduce((s, p) => s + (Number(p.grandTotal) || 0), 0);
  const totalExpenses = validExpenses.reduce((s, e) => s + (Number(e.totalAmount) || 0), 0);
  const totalSalesTaxable = validInvoices.reduce((s, i) => s + (Number(i.taxableValue) || 0), 0);
  const totalPurchaseTaxable = validPurchases.reduce((s, p) => s + (Number(p.taxableValue) || 0), 0);
  const totalExpenseTaxable = validExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const grossProfit = round2(totalSalesTaxable - totalPurchaseTaxable - totalExpenseTaxable);

  const outstandingReceivables = (data.customers || []).reduce(
    (s, c) => s + getCustomerOutstanding(c, data.invoices, data.creditNotes),
    0
  );
  const outstandingPayables = (data.suppliers || []).reduce(
    (s, sup) => s + getSupplierOutstanding(sup, data.purchases, data.purchaseReturns),
    0
  );

  // Inventory metrics
  const activeProducts = (data.products || []).filter((p) => !p.archived);
  const stockValue = activeProducts.reduce(
    (s, p) => s + Math.max(0, Number(p.stock) || 0) * (Number(p.purchasePrice) || 0),
    0
  );
  const lowStockCount = activeProducts.filter((p) => p.stock > 0 && p.stock <= (p.minStock || 5)).length;
  const outOfStockCount = activeProducts.filter((p) => (p.stock || 0) <= 0).length;

  const soonThreshold = new Date();
  soonThreshold.setDate(soonThreshold.getDate() + 45);
  const expiringCount = (data.batches || []).filter((b) => {
    if (!b.expiryDate || (b.qty || 0) <= 0) return false;
    return new Date(b.expiryDate) <= soonThreshold;
  }).length;

  return {
    todaySales: round2(todaySales),
    monthlySales: round2(monthlySales),
    totalSales: round2(totalSales),
    totalPurchases: round2(totalPurchases),
    totalExpenses: round2(totalExpenses),
    grossProfit,
    outstandingReceivables: round2(outstandingReceivables),
    outstandingPayables: round2(outstandingPayables),
    totalProducts: activeProducts.length,
    stockValue: round2(stockValue),
    lowStockCount,
    outOfStockCount,
    expiringCount,
  };
};
