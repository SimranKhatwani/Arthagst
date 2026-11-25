import { ZodError } from 'zod';
import * as salesService from '../services/sales.service.js';
import {
  createSalesInvoiceSchema,
  updateSalesInvoiceSchema,
  cancelInvoiceSchema,
  createQuotationSchema,
  updateQuotationSchema,
  createSalesOrderSchema,
  updateSalesOrderSchema,
  createDeliveryChallanSchema,
  updateDeliveryChallanSchema,
  createSalesReturnSchema,
  createCreditNoteDirectSchema,
  querySalesDocumentsSchema,
} from '../validators/sales.validation.js';
import { generateInvoicePDF } from '../services/sales.pdf.js';
import Tenant from '../models/tenant.model.js';
import { sendResponse, formatZodErrors } from '../utils/apiResponse.js';

/**
 * Create draft invoice
 * POST /api/sales/invoices
 */
export const createInvoice = async (req, res, next) => {
  try {
    const validatedData = createSalesInvoiceSchema.parse(req.body);
    const invoice = await salesService.createDraftInvoice(
      req.tenantId,
      req.user?._id,
      validatedData
    );

    return sendResponse(res, 201, true, 'Draft sales invoice created successfully', invoice);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * List sales invoices
 * GET /api/sales/invoices
 */
export const getInvoices = async (req, res, next) => {
  try {
    const validatedQuery = querySalesDocumentsSchema.parse(req.query);
    const result = await salesService.getInvoices(req.tenantId, validatedQuery);

    return sendResponse(res, 200, true, 'Sales invoices retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Get invoice details by ID
 * GET /api/sales/invoices/:id
 */
export const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await salesService.getInvoiceById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Invoice details retrieved successfully', invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Update draft invoice
 * PUT /api/sales/invoices/:id
 */
export const updateInvoice = async (req, res, next) => {
  try {
    const validatedData = updateSalesInvoiceSchema.parse(req.body);
    const invoice = await salesService.updateDraftInvoice(
      req.tenantId,
      req.params.id,
      validatedData
    );

    return sendResponse(res, 200, true, 'Draft invoice updated successfully', invoice);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Finalize and post invoice (reduces warehouse stock atomically)
 * POST /api/sales/invoices/:id/post
 */
export const postInvoice = async (req, res, next) => {
  try {
    const invoice = await salesService.postInvoice(
      req.tenantId,
      req.user?._id,
      req.params.id
    );

    return sendResponse(res, 200, true, 'Invoice finalized and stock reduced successfully', invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel invoice (reverses stock atomically)
 * POST /api/sales/invoices/:id/cancel
 */
export const cancelInvoice = async (req, res, next) => {
  try {
    const { cancellationReason } = cancelInvoiceSchema.parse(req.body);
    const invoice = await salesService.cancelInvoice(
      req.tenantId,
      req.user?._id,
      req.params.id,
      cancellationReason
    );

    return sendResponse(res, 200, true, 'Invoice cancelled and stock reversed successfully', invoice);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(error),
      });
    }
    next(error);
  }
};

/**
 * Generate invoice PDF
 * GET /api/sales/invoices/:id/pdf
 */
export const getInvoicePDF = async (req, res, next) => {
  try {
    const invoice = await salesService.getInvoiceById(req.tenantId, req.params.id);
    const tenant = await Tenant.findById(req.tenantId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${invoice.invoiceNumber.replace(/[\/\\]/g, '_')}.pdf"`
    );

    generateInvoicePDF(invoice, tenant, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Quotation Handlers
 */
export const createQuotation = async (req, res, next) => {
  try {
    const validatedData = createQuotationSchema.parse(req.body);
    const quotation = await salesService.createQuotation(req.tenantId, req.user?._id, validatedData);
    return sendResponse(res, 201, true, 'Quotation created successfully', quotation);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const convertQuotationToOrder = async (req, res, next) => {
  try {
    const order = await salesService.convertQuotationToOrder(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'Quotation successfully converted to Sales Order', order);
  } catch (error) {
    next(error);
  }
};

export const convertQuotationToInvoice = async (req, res, next) => {
  try {
    const invoice = await salesService.convertQuotationToInvoice(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'Quotation successfully converted to Sales Invoice', invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Sales Order Handlers
 */
export const createSalesOrder = async (req, res, next) => {
  try {
    const validatedData = createSalesOrderSchema.parse(req.body);
    const order = await salesService.createSalesOrder(req.tenantId, req.user?._id, validatedData);
    return sendResponse(res, 201, true, 'Sales Order created successfully', order);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const convertOrderToInvoice = async (req, res, next) => {
  try {
    const invoice = await salesService.convertOrderToInvoice(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'Sales Order successfully converted to Sales Invoice', invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Delivery Challan Handlers
 */
export const createDeliveryChallan = async (req, res, next) => {
  try {
    const validatedData = createDeliveryChallanSchema.parse(req.body);
    const challan = await salesService.createDeliveryChallan(req.tenantId, req.user?._id, validatedData);
    return sendResponse(res, 201, true, 'Delivery Challan created successfully', challan);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const convertChallanToInvoice = async (req, res, next) => {
  try {
    const invoice = await salesService.convertChallanToInvoice(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'Delivery Challan successfully converted to Sales Invoice', invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Sales Return & Credit Note Handlers
 */
export const createSalesReturn = async (req, res, next) => {
  try {
    const validatedData = createSalesReturnSchema.parse(req.body);
    const creditNote = await salesService.createSalesReturn(
      req.tenantId,
      req.user?._id,
      req.params.id,
      validatedData
    );

    return sendResponse(res, 201, true, 'Sales return credit note drafted successfully', creditNote);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const postCreditNote = async (req, res, next) => {
  try {
    const creditNote = await salesService.postCreditNote(req.tenantId, req.user?._id, req.params.id);
    return sendResponse(res, 200, true, 'Credit note posted and stock restored successfully', creditNote);
  } catch (error) {
    next(error);
  }
};

export const getCreditNotes = async (req, res, next) => {
  try {
    const result = await salesService.getCreditNotes(req.tenantId, req.query);
    return sendResponse(res, 200, true, 'Credit notes retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

export const getCreditNoteById = async (req, res, next) => {
  try {
    const creditNote = await salesService.getCreditNoteById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Credit note details retrieved successfully', creditNote);
  } catch (error) {
    next(error);
  }
};

export const createCreditNote = async (req, res, next) => {
  try {
    const validatedData = createCreditNoteDirectSchema.parse(req.body);
    const invoiceId = validatedData.invoiceId;
    let creditNote = await salesService.createSalesReturn(
      req.tenantId,
      req.user?._id,
      invoiceId,
      validatedData
    );

    if (validatedData.restoreStock !== false) {
      creditNote = await salesService.postCreditNote(req.tenantId, req.user?._id, creditNote._id);
    }

    return sendResponse(res, 201, true, 'Credit note created successfully', creditNote);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getQuotations = async (req, res, next) => {
  try {
    const validatedQuery = querySalesDocumentsSchema.parse(req.query);
    const result = await salesService.getQuotations(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Quotations retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getQuotationById = async (req, res, next) => {
  try {
    const quotation = await salesService.getQuotationById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Quotation details retrieved successfully', quotation);
  } catch (error) {
    next(error);
  }
};

export const updateQuotation = async (req, res, next) => {
  try {
    const validatedData = updateQuotationSchema.parse(req.body);
    const quotation = await salesService.updateQuotation(req.tenantId, req.params.id, validatedData);
    return sendResponse(res, 200, true, 'Quotation updated successfully', quotation);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const deleteQuotation = async (req, res, next) => {
  try {
    const result = await salesService.deleteQuotation(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, result.message, null);
  } catch (error) {
    next(error);
  }
};

export const getSalesOrders = async (req, res, next) => {
  try {
    const validatedQuery = querySalesDocumentsSchema.parse(req.query);
    const result = await salesService.getSalesOrders(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Sales orders retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getSalesOrderById = async (req, res, next) => {
  try {
    const salesOrder = await salesService.getSalesOrderById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Sales order details retrieved successfully', salesOrder);
  } catch (error) {
    next(error);
  }
};

export const updateSalesOrder = async (req, res, next) => {
  try {
    const validatedData = updateSalesOrderSchema.parse(req.body);
    const salesOrder = await salesService.updateSalesOrder(req.tenantId, req.params.id, validatedData);
    return sendResponse(res, 200, true, 'Sales order updated successfully', salesOrder);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const cancelSalesOrder = async (req, res, next) => {
  try {
    const salesOrder = await salesService.cancelSalesOrder(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Sales order cancelled successfully', salesOrder);
  } catch (error) {
    next(error);
  }
};

export const getDeliveryChallans = async (req, res, next) => {
  try {
    const validatedQuery = querySalesDocumentsSchema.parse(req.query);
    const result = await salesService.getDeliveryChallans(req.tenantId, validatedQuery);
    return sendResponse(res, 200, true, 'Delivery challans retrieved successfully', result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export const getDeliveryChallanById = async (req, res, next) => {
  try {
    const challan = await salesService.getDeliveryChallanById(req.tenantId, req.params.id);
    return sendResponse(res, 200, true, 'Delivery challan details retrieved successfully', challan);
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryChallan = async (req, res, next) => {
  try {
    const validatedData = updateDeliveryChallanSchema.parse(req.body);
    const challan = await salesService.updateDeliveryChallan(req.tenantId, req.params.id, validatedData);
    return sendResponse(res, 200, true, 'Delivery challan updated successfully', challan);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, errors: formatZodErrors(error) });
    }
    next(error);
  }
};

export default {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  postInvoice,
  cancelInvoice,
  getInvoicePDF,
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  deleteQuotation,
  convertQuotationToOrder,
  convertQuotationToInvoice,
  createSalesOrder,
  getSalesOrders,
  getSalesOrderById,
  updateSalesOrder,
  cancelSalesOrder,
  convertOrderToInvoice,
  createDeliveryChallan,
  getDeliveryChallans,
  getDeliveryChallanById,
  updateDeliveryChallan,
  convertChallanToInvoice,
  createSalesReturn,
  createCreditNote,
  postCreditNote,
  getCreditNotes,
  getCreditNoteById,
};
