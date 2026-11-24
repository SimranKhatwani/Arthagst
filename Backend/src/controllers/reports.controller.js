import { ZodError } from 'zod';
import * as reportsService from '../services/reports.service.js';
import { sendCsvResponse } from '../utils/csvExport.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';
import {
  baseReportFilterSchema,
  salesReportQuerySchema,
  purchaseReportQuerySchema,
  inventoryReportQuerySchema,
  partyReportQuerySchema,
  paymentReportQuerySchema,
  expenseReportQuerySchema,
} from '../validators/reports.validation.js';

// =========================================================================
// A. SALES REPORTS CONTROLLERS
// =========================================================================

export const getSalesSummary = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getSalesSummary(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Sales summary report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getSalesRegister = async (req, res, next) => {
  try {
    const validated = salesReportQuerySchema.parse(req.query);
    const data = await reportsService.getSalesRegister(req.tenantId, validated);

    if (validated.format === 'csv') {
      const columns = [
        { key: 'invoiceNumber', label: 'Invoice Number' },
        { key: 'invoiceDate', label: 'Invoice Date' },
        { key: 'partyName', label: 'Customer Name' },
        { key: 'partyGSTIN', label: 'Customer GSTIN' },
        { key: 'taxableAmount', label: 'Taxable Amount' },
        { key: 'cgstTotal', label: 'CGST' },
        { key: 'sgstTotal', label: 'SGST' },
        { key: 'igstTotal', label: 'IGST' },
        { key: 'grandTotal', label: 'Grand Total' },
        { key: 'paidAmount', label: 'Paid Amount' },
        { key: 'balanceAmount', label: 'Balance' },
        { key: 'paymentStatus', label: 'Payment Status' },
      ];
      return sendCsvResponse(res, 'sales_register.csv', columns, data.invoices);
    }

    return sendResponse(res, 200, true, 'Sales register report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getSalesByCustomer = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getSalesByCustomer(req.tenantId, validated);

    if (validated.format === 'csv') {
      const columns = [
        { key: 'customerName', label: 'Customer Name' },
        { key: 'GSTIN', label: 'GSTIN' },
        { key: 'invoiceCount', label: 'Invoices' },
        { key: 'totalTaxable', label: 'Total Taxable' },
        { key: 'totalTax', label: 'Total Tax' },
        { key: 'totalSales', label: 'Total Sales' },
        { key: 'totalPaid', label: 'Total Paid' },
        { key: 'totalOutstanding', label: 'Outstanding Balance' },
      ];
      return sendCsvResponse(res, 'sales_by_customer.csv', columns, data.customers);
    }

    return sendResponse(res, 200, true, 'Sales by customer report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getSalesByProduct = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getSalesByProduct(req.tenantId, validated);

    if (validated.format === 'csv') {
      const columns = [
        { key: 'productName', label: 'Product Name' },
        { key: 'SKU', label: 'SKU' },
        { key: 'HSN', label: 'HSN' },
        { key: 'totalQuantitySold', label: 'Quantity Sold' },
        { key: 'totalTaxable', label: 'Taxable Value' },
        { key: 'totalTax', label: 'Tax Amount' },
        { key: 'totalRevenue', label: 'Total Revenue' },
      ];
      return sendCsvResponse(res, 'sales_by_product.csv', columns, data.products);
    }

    return sendResponse(res, 200, true, 'Sales by product report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getSalesByStatus = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getSalesByStatus(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Sales by status report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getSalesReturnSummary = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getSalesReturnSummary(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Sales return summary report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

// =========================================================================
// B. PURCHASE REPORTS CONTROLLERS
// =========================================================================

export const getPurchaseSummary = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getPurchaseSummary(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Purchase summary report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getPurchaseRegister = async (req, res, next) => {
  try {
    const validated = purchaseReportQuerySchema.parse(req.query);
    const data = await reportsService.getPurchaseRegister(req.tenantId, validated);

    if (validated.format === 'csv') {
      const columns = [
        { key: 'billNumber', label: 'Bill Number' },
        { key: 'supplierInvoiceNumber', label: 'Supplier Invoice Number' },
        { key: 'billDate', label: 'Bill Date' },
        { key: 'supplierName', label: 'Supplier Name' },
        { key: 'supplierGSTIN', label: 'Supplier GSTIN' },
        { key: 'taxableAmount', label: 'Taxable Amount' },
        { key: 'grandTotal', label: 'Grand Total' },
        { key: 'paidAmount', label: 'Paid Amount' },
        { key: 'balanceAmount', label: 'Balance' },
        { key: 'paymentStatus', label: 'Payment Status' },
      ];
      return sendCsvResponse(res, 'purchase_register.csv', columns, data.bills);
    }

    return sendResponse(res, 200, true, 'Purchase register report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getPurchaseBySupplier = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getPurchaseBySupplier(req.tenantId, validated);

    if (validated.format === 'csv') {
      const columns = [
        { key: 'supplierName', label: 'Supplier Name' },
        { key: 'GSTIN', label: 'GSTIN' },
        { key: 'billCount', label: 'Bill Count' },
        { key: 'totalTaxable', label: 'Total Taxable' },
        { key: 'totalTax', label: 'Total Tax' },
        { key: 'totalPurchases', label: 'Total Spend' },
        { key: 'totalPaid', label: 'Total Paid' },
        { key: 'totalOutstanding', label: 'Outstanding Balance' },
      ];
      return sendCsvResponse(res, 'purchase_by_supplier.csv', columns, data.suppliers);
    }

    return sendResponse(res, 200, true, 'Purchase by supplier report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getPurchaseByProduct = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getPurchaseByProduct(req.tenantId, validated);

    if (validated.format === 'csv') {
      const columns = [
        { key: 'productName', label: 'Product Name' },
        { key: 'SKU', label: 'SKU' },
        { key: 'HSN', label: 'HSN' },
        { key: 'totalQuantityPurchased', label: 'Quantity Purchased' },
        { key: 'totalTaxable', label: 'Taxable Value' },
        { key: 'totalTax', label: 'Tax Amount' },
        { key: 'totalSpend', label: 'Total Spend' },
      ];
      return sendCsvResponse(res, 'purchase_by_product.csv', columns, data.products);
    }

    return sendResponse(res, 200, true, 'Purchase by product report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getPurchaseReturnSummary = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getPurchaseReturnSummary(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Purchase return summary report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

// =========================================================================
// C. INVENTORY REPORTS CONTROLLERS
// =========================================================================

export const getCurrentStockReport = async (req, res, next) => {
  try {
    const validated = inventoryReportQuerySchema.parse(req.query);
    const data = await reportsService.getCurrentStockReport(req.tenantId, validated);

    if (validated.format === 'csv') {
      const columns = [
        { key: 'productName', label: 'Product Name' },
        { key: 'SKU', label: 'SKU' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'quantity', label: 'Total Quantity' },
        { key: 'availableQuantity', label: 'Available Quantity' },
        { key: 'purchasePrice', label: 'Unit Cost' },
        { key: 'valuation', label: 'Stock Valuation' },
      ];
      return sendCsvResponse(res, 'current_stock.csv', columns, data.stock);
    }

    return sendResponse(res, 200, true, 'Current stock report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getLowStockReport = async (req, res, next) => {
  try {
    const data = await reportsService.getLowStockReport(req.tenantId, req.query);
    return sendResponse(res, 200, true, 'Low stock report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getOutOfStockReport = async (req, res, next) => {
  try {
    const data = await reportsService.getOutOfStockReport(req.tenantId);
    return sendResponse(res, 200, true, 'Out of stock report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getStockValuationReport = async (req, res, next) => {
  try {
    const data = await reportsService.getStockValuationReport(req.tenantId);

    if (req.query.format === 'csv') {
      const columns = [
        { key: 'productName', label: 'Product Name' },
        { key: 'SKU', label: 'SKU' },
        { key: 'totalQuantity', label: 'Quantity in Hand' },
        { key: 'purchasePrice', label: 'Cost Price' },
        { key: 'costValuation', label: 'Cost Valuation' },
        { key: 'sellingPrice', label: 'Retail Price' },
        { key: 'retailValuation', label: 'Retail Valuation' },
      ];
      return sendCsvResponse(res, 'stock_valuation.csv', columns, data.items);
    }

    return sendResponse(res, 200, true, 'Stock valuation report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getStockMovementReport = async (req, res, next) => {
  try {
    const validated = inventoryReportQuerySchema.parse(req.query);
    const data = await reportsService.getStockMovementReport(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Stock movement report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getWarehouseWiseStockReport = async (req, res, next) => {
  try {
    const data = await reportsService.getWarehouseWiseStockReport(req.tenantId);
    return sendResponse(res, 200, true, 'Warehouse-wise stock report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getProductWiseStockReport = async (req, res, next) => {
  try {
    const data = await reportsService.getProductWiseStockReport(req.tenantId, req.query);
    return sendResponse(res, 200, true, 'Product-wise stock report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// D. PARTY REPORTS CONTROLLERS
// =========================================================================

export const getCustomerOutstandingReport = async (req, res, next) => {
  try {
    const data = await reportsService.getCustomerOutstandingReport(req.tenantId);

    if (req.query.format === 'csv') {
      const columns = [
        { key: 'customerName', label: 'Customer Name' },
        { key: 'GSTIN', label: 'GSTIN' },
        { key: 'totalInvoiced', label: 'Total Invoiced' },
        { key: 'totalPaid', label: 'Total Paid' },
        { key: 'totalOutstanding', label: 'Total Outstanding' },
        { key: 'unpaidInvoicesCount', label: 'Unpaid Invoices' },
      ];
      return sendCsvResponse(res, 'customer_outstanding.csv', columns, data.customers);
    }

    return sendResponse(res, 200, true, 'Customer outstanding report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getSupplierOutstandingReport = async (req, res, next) => {
  try {
    const data = await reportsService.getSupplierOutstandingReport(req.tenantId);

    if (req.query.format === 'csv') {
      const columns = [
        { key: 'supplierName', label: 'Supplier Name' },
        { key: 'GSTIN', label: 'GSTIN' },
        { key: 'totalBilled', label: 'Total Billed' },
        { key: 'totalPaid', label: 'Total Paid' },
        { key: 'totalOutstanding', label: 'Total Payable' },
        { key: 'unpaidBillsCount', label: 'Unpaid Bills' },
      ];
      return sendCsvResponse(res, 'supplier_outstanding.csv', columns, data.suppliers);
    }

    return sendResponse(res, 200, true, 'Supplier outstanding report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getCustomerLedger = async (req, res, next) => {
  try {
    const data = await reportsService.getCustomerLedger(req.tenantId, req.params.partyId, req.query);

    if (req.query.format === 'csv') {
      const columns = [
        { key: 'date', label: 'Date' },
        { key: 'type', label: 'Transaction Type' },
        { key: 'documentNumber', label: 'Document #' },
        { key: 'description', label: 'Description' },
        { key: 'debit', label: 'Debit (Dr)' },
        { key: 'credit', label: 'Credit (Cr)' },
        { key: 'balance', label: 'Closing Balance' },
      ];
      return sendCsvResponse(res, `customer_ledger_${req.params.partyId}.csv`, columns, data.ledger);
    }

    return sendResponse(res, 200, true, 'Customer ledger report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getSupplierLedger = async (req, res, next) => {
  try {
    const data = await reportsService.getSupplierLedger(req.tenantId, req.params.partyId, req.query);

    if (req.query.format === 'csv') {
      const columns = [
        { key: 'date', label: 'Date' },
        { key: 'type', label: 'Transaction Type' },
        { key: 'documentNumber', label: 'Document #' },
        { key: 'description', label: 'Description' },
        { key: 'debit', label: 'Debit (Dr)' },
        { key: 'credit', label: 'Credit (Cr)' },
        { key: 'balance', label: 'Closing Balance' },
      ];
      return sendCsvResponse(res, `supplier_ledger_${req.params.partyId}.csv`, columns, data.ledger);
    }

    return sendResponse(res, 200, true, 'Supplier ledger report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getPartyTransactionHistory = async (req, res, next) => {
  try {
    const data = await reportsService.getPartyTransactionHistory(req.tenantId, req.params.partyId, req.query);
    return sendResponse(res, 200, true, 'Party transaction history retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// E. PAYMENT REPORTS CONTROLLERS
// =========================================================================

export const getMoneyInReport = async (req, res, next) => {
  try {
    const validated = paymentReportQuerySchema.parse(req.query);
    const data = await reportsService.getMoneyInReport(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Money in report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getMoneyOutReport = async (req, res, next) => {
  try {
    const validated = paymentReportQuerySchema.parse(req.query);
    const data = await reportsService.getMoneyOutReport(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Money out report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getPaymentModeSummary = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getPaymentModeSummary(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Payment mode summary report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getUnallocatedPaymentsReport = async (req, res, next) => {
  try {
    const data = await reportsService.getUnallocatedPaymentsReport(req.tenantId);
    return sendResponse(res, 200, true, 'Unallocated payments report retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

export const getReceivablesAndPayablesSummary = async (req, res, next) => {
  try {
    const data = await reportsService.getReceivablesAndPayablesSummary(req.tenantId);
    return sendResponse(res, 200, true, 'Receivables and payables summary retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// F. EXPENSE REPORTS CONTROLLERS
// =========================================================================

export const getExpenseSummary = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getExpenseSummary(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Expense summary report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getCategoryWiseExpenseReport = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getCategoryWiseExpenseReport(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Category-wise expense report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};

export const getMonthlyExpenseReport = async (req, res, next) => {
  try {
    const validated = baseReportFilterSchema.parse(req.query);
    const data = await reportsService.getMonthlyExpenseReport(req.tenantId, validated);
    return sendResponse(res, 200, true, 'Monthly expense report retrieved successfully', data);
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    next(error);
  }
};
