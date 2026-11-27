import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loadAppState,
  saveAppState,
  resetDemoData,
} from '../services/storageService';
import * as inventoryService from '../services/inventoryService';
import {
  applyProductStockUpdates,
  createStockMovementRecord,
} from '../services/inventoryService';
import { computePaymentStatus, generateNextDocNumber } from '../services/invoiceService';
import { round2 } from '../services/calculationService';
import * as authService from '../services/authService';
import { getToken, setToken, removeToken } from '../services/api';
import * as partyService from '../services/partyService';
import * as categoryService from '../services/categoryService';
import * as unitService from '../services/unitService';
import * as productService from '../services/productService';
import * as warehouseService from '../services/warehouseService';
import * as tenantService from '../services/tenantService';
import * as salesInvoiceService from '../services/salesInvoiceService';
import * as quotationService from '../services/quotationService';
import * as salesOrderService from '../services/salesOrderService';
import * as deliveryChallanService from '../services/deliveryChallanService';
import * as creditNoteService from '../services/creditNoteService';
import * as purchaseOrderService from '../services/purchaseOrderService';
import * as grnService from '../services/grnService';
import * as purchaseBillService from '../services/purchaseBillService';
import * as purchaseReturnService from '../services/purchaseReturnService';
import * as paymentService from '../services/paymentService';
import * as bankAccountService from '../services/bankAccountService';
import * as bankTransactionService from '../services/bankTransactionService';
import * as expenseService from '../services/expenseService';
import * as posService from '../services/posService';
import * as accountingService from '../services/accountingService';
import * as gstService from '../services/gstService';
import * as eInvoiceService from '../services/eInvoiceService';
import * as eWayBillService from '../services/eWayBillService';
import * as reportsService from '../services/reportsService';
import * as superAdminService from '../services/superAdminService';
import * as userService from '../services/userService';

const AppContext = createContext(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

export const AppProvider = ({ children }) => {
  const [state, setState] = useState(() => loadAppState());
  const [authLoading, setAuthLoading] = useState(Boolean(getToken()));
  const [phase1Loading, setPhase1Loading] = useState(false);
  const [phase2Loading, setPhase2Loading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [selectedFY, setSelectedFY] = useState(state.business?.financialYear || '2026-27');

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const loadPhase1Data = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setPhase1Loading(true);
    try {
      const [partiesRes, categoriesRes, unitsRes, productsRes, warehousesRes, profileRes, usersRes] =
        await Promise.allSettled([
          partyService.getParties({ limit: 100 }),
          categoryService.getCategories({ limit: 100 }),
          unitService.getUnits({ limit: 100 }),
          productService.getProducts({ limit: 100 }),
          warehouseService.getWarehouses({ limit: 100 }),
          tenantService.getTenantProfile(),
          userService.getUsers({ limit: 100 }),
        ]);

      setState((prev) => {
        const next = { ...prev };

        let fetchedCategories = next.categories || [];
        if (categoriesRes.status === 'fulfilled' && categoriesRes.value) {
          fetchedCategories = categoriesRes.value.categories || categoriesRes.value.data?.categories || [];
          next.categories = fetchedCategories;
        }

        let fetchedUnits = next.units || [];
        if (unitsRes.status === 'fulfilled' && unitsRes.value) {
          fetchedUnits = unitsRes.value.units || unitsRes.value.data?.units || [];
          next.units = fetchedUnits;
        }

        let fetchedWarehouses = next.warehouses || [];
        if (warehousesRes.status === 'fulfilled' && warehousesRes.value) {
          const rawWh = warehousesRes.value.warehouses || warehousesRes.value.data?.warehouses || [];
          fetchedWarehouses = rawWh.map((w) => ({
            ...w,
            id: w._id || w.id,
            name: w.warehouseName || w.name,
            code: w.warehouseCode || w.code,
          }));
          next.warehouses = fetchedWarehouses;
        }

        if (partiesRes.status === 'fulfilled' && partiesRes.value) {
          const rawParties = partiesRes.value.parties || partiesRes.value.data?.parties || [];
          next.customers = rawParties.filter((p) => p.partyType === 'customer' || p.partyType === 'both');
          next.suppliers = rawParties.filter((p) => p.partyType === 'supplier' || p.partyType === 'both');
        }

        if (productsRes.status === 'fulfilled' && productsRes.value) {
          const rawProducts = productsRes.value.products || productsRes.value.data?.products || [];
          next.products = rawProducts.map((p) => {
            const cat = fetchedCategories.find(
              (c) => String(c.id || c._id) === String(p.categoryId?._id || p.categoryId)
            );
            const un = fetchedUnits.find(
              (u) => String(u.id || u._id) === String(p.unitId?._id || p.unitId)
            );
            return {
              ...p,
              category: cat?.name || p.categoryId?.name || p.category || 'General',
              unit: un?.shortName || p.unitId?.shortName || p.unit || 'PCS',
              sku: p.SKU || p.sku,
              SKU: p.SKU || p.sku,
              hsn: p.HSN || p.hsn,
              HSN: p.HSN || p.hsn,
              minStock: p.lowStockAlert !== undefined ? p.lowStockAlert : p.minStock,
              stock: p.stock !== undefined ? p.stock : (p.openingStock || 0),
            };
          });
        }

        if (profileRes.status === 'fulfilled' && profileRes.value) {
          const t = profileRes.value.tenant || profileRes.value;
          if (t) {
            next.currentTenant = { ...next.currentTenant, ...t };
            next.business = {
              ...next.business,
              ...t,
              businessName: t.businessName || next.business?.businessName,
              legalName: t.legalName || t.businessName || next.business?.legalName,
              email: t.email || next.business?.email,
              phone: t.phone || next.business?.phone,
              address: t.businessAddress || t.address || next.business?.address,
              city: t.city || next.business?.city,
              state: t.state || next.business?.state,
              pincode: t.pincode || next.business?.pincode,
              gstin: t.GSTIN || t.gstin || next.business?.gstin,
              pan: t.PAN || t.pan || next.business?.pan,
            };
          }
        }

        if (usersRes.status === 'fulfilled' && usersRes.value) {
          const rawUsers = usersRes.value.users || usersRes.value.data?.users || [];
          next.users = rawUsers.map((u) => ({
            id: String(u._id || u.id),
            name: u.name,
            email: u.email,
            mobile: u.phone || u.mobile || '',
            phone: u.phone || u.mobile || '',
            role: u.role,
            status: u.isActive ? 'Active' : 'Inactive',
            isActive: u.isActive,
            lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
            permissions: u.permissions || [],
            createdAt: u.createdAt,
          }));
        } else if (!next.users || next.users.length === 0) {
          next.users = [];
        }

        // Ensure currently logged-in account (Owner) is represented in team users list
        if (next.users.length === 0 && next.currentUser) {
          next.users = [
            {
              id: String(next.currentUser._id || next.currentUser.id || 'owner-1'),
              name: next.currentUser.name || 'Organization Owner',
              email: next.currentUser.email || '',
              mobile: next.currentUser.phone || '',
              phone: next.currentUser.phone || '',
              role: next.currentUser.role || 'Owner',
              status: 'Active',
              isActive: true,
              lastLogin: 'Active session',
              permissions: next.currentUser.permissions || ['all'],
            },
          ];
        }

        return next;
      });
    } catch (err) {
      console.warn('Phase 1 data load failed:', err);
    } finally {
      setPhase1Loading(false);
    }
  }, []);

  const loadPhase2Data = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setPhase2Loading(true);
    try {
      const [
        invoicesRes,
        quotationsRes,
        salesOrdersRes,
        challansRes,
        creditNotesRes,
        purchasesRes,
        purchaseOrdersRes,
        grnsRes,
        returnsRes,
        paymentsRes,
        bankAccountsRes,
        expensesRes,
        categoriesRes,
        accountsRes,
        journalEntriesRes,
        eInvoicesRes,
        eWayBillsRes,
        calendarRes,
        movementsRes,
      ] = await Promise.allSettled([
        salesInvoiceService.getInvoices({ limit: 100 }),
        quotationService.getQuotations({ limit: 100 }),
        salesOrderService.getSalesOrders({ limit: 100 }),
        deliveryChallanService.getDeliveryChallans({ limit: 100 }),
        creditNoteService.getCreditNotes({ limit: 100 }),
        purchaseBillService.getPurchaseBills({ limit: 100 }),
        purchaseOrderService.getPurchaseOrders({ limit: 100 }),
        grnService.getGRNs({ limit: 100 }),
        purchaseReturnService.getPurchaseReturns({ limit: 100 }),
        paymentService.getPayments({ limit: 100 }),
        bankAccountService.getBankAccounts({ limit: 100 }),
        expenseService.getExpenses({ limit: 100 }),
        expenseService.getCategories(),
        accountingService.getAccounts(),
        accountingService.getJournalEntries({ limit: 100 }),
        eInvoiceService.getEInvoices({ limit: 100 }),
        eWayBillService.getEWayBills({ limit: 100 }),
        gstService.getFilingCalendar(),
        inventoryService.getStockMovements({ limit: 100 }),
      ]);

      setState((prev) => {
        const next = { ...prev };

        if (invoicesRes.status === 'fulfilled' && invoicesRes.value) {
          const rawInvoices = invoicesRes.value.invoices || invoicesRes.value.data?.invoices || [];
          next.invoices = rawInvoices.map((inv) => ({
            ...inv,
            id: String(inv._id || inv.id),
            date: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : (inv.date || ''),
            dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : (inv.dueDate || ''),
            customerId: String(inv.partyId?._id || inv.partyId || ''),
            customerName: inv.partyName || inv.customerName || '',
            customerGstin: inv.partyGSTIN || inv.customerGstin || '',
            customerState: inv.placeOfSupply || inv.customerState || '',
            status: inv.invoiceStatus === 'posted' ? 'Finalized' : (inv.invoiceStatus === 'cancelled' ? 'Cancelled' : (inv.status || 'Draft')),
            taxableValue: inv.taxableAmount !== undefined ? inv.taxableAmount : (inv.taxableValue || 0),
            totalTax: (inv.cgstTotal || 0) + (inv.sgstTotal || 0) + (inv.igstTotal || 0) + (inv.cessTotal || 0),
            amountPaid: inv.paidAmount !== undefined ? inv.paidAmount : (inv.amountPaid || 0),
            paymentStatus: inv.paymentStatus === 'paid' ? 'Paid' : (inv.paymentStatus === 'partially_paid' ? 'Partial' : (inv.paymentStatus === 'unpaid' ? 'Unpaid' : (inv.paymentStatus || 'Unpaid'))),
            items: (inv.items || []).map((it) => ({
              ...it,
              productId: String(it.productId?._id || it.productId || ''),
              name: it.productName || it.name || '',
              qty: it.quantity !== undefined ? it.quantity : (it.qty || 1),
              rate: it.unitPrice !== undefined ? it.unitPrice : (it.rate || 0),
              sku: it.SKU || it.sku || '',
              hsn: it.HSN || it.hsn || '',
              unit: it.unitName || it.unit || 'PCS',
            })),
          }));
        }

        if (quotationsRes.status === 'fulfilled' && quotationsRes.value) {
          const rawQuotations = quotationsRes.value.quotations || quotationsRes.value.data?.quotations || [];
          next.quotations = rawQuotations.map((q) => ({
            ...q,
            id: String(q._id || q.id),
            date: q.quotationDate ? new Date(q.quotationDate).toISOString().slice(0, 10) : (q.date || ''),
            validUntil: q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : (q.validUntil || ''),
            customerId: String(q.partyId?._id || q.partyId || ''),
            customerName: q.partyName || q.customerName || '',
            customerGstin: q.partyGSTIN || q.customerGstin || '',
            customerState: q.placeOfSupply || q.customerState || '',
            status: q.status ? q.status.charAt(0).toUpperCase() + q.status.slice(1) : 'Sent',
            taxableValue: q.taxableAmount !== undefined ? q.taxableAmount : (q.taxableValue || 0),
            totalTax: (q.cgstTotal || 0) + (q.sgstTotal || 0) + (q.igstTotal || 0) + (q.cessTotal || 0),
            items: (q.items || []).map((it) => ({
              ...it,
              productId: String(it.productId?._id || it.productId || ''),
              name: it.productName || it.name || '',
              qty: it.quantity !== undefined ? it.quantity : (it.qty || 1),
              rate: it.unitPrice !== undefined ? it.unitPrice : (it.rate || 0),
            })),
          }));
        }

        if (salesOrdersRes.status === 'fulfilled' && salesOrdersRes.value) {
          const rawOrders = salesOrdersRes.value.salesOrders || salesOrdersRes.value.data?.salesOrders || [];
          next.salesOrders = rawOrders.map((so) => ({
            ...so,
            id: String(so._id || so.id),
            date: so.orderDate ? new Date(so.orderDate).toISOString().slice(0, 10) : (so.date || ''),
            expectedDelivery: so.expectedDeliveryDate ? new Date(so.expectedDeliveryDate).toISOString().slice(0, 10) : (so.expectedDelivery || ''),
            customerId: String(so.partyId?._id || so.partyId || ''),
            customerName: so.partyName || so.customerName || '',
            customerGstin: so.partyGSTIN || so.customerGstin || '',
            status: so.status ? so.status.charAt(0).toUpperCase() + so.status.slice(1) : 'Confirmed',
            taxableValue: so.taxableAmount !== undefined ? so.taxableAmount : (so.taxableValue || 0),
            totalTax: (so.cgstTotal || 0) + (so.sgstTotal || 0) + (so.igstTotal || 0) + (so.cessTotal || 0),
            items: (so.items || []).map((it) => ({
              ...it,
              productId: String(it.productId?._id || it.productId || ''),
              name: it.productName || it.name || '',
              qty: it.quantity !== undefined ? it.quantity : (it.qty || 1),
              rate: it.unitPrice !== undefined ? it.unitPrice : (it.rate || 0),
            })),
          }));
        }

        if (challansRes.status === 'fulfilled' && challansRes.value) {
          const rawChallans = challansRes.value.deliveryChallans || challansRes.value.data?.deliveryChallans || [];
          next.deliveryChallans = rawChallans.map((dc) => ({
            ...dc,
            id: String(dc._id || dc.id),
            date: dc.challanDate ? new Date(dc.challanDate).toISOString().slice(0, 10) : (dc.date || ''),
            customerId: String(dc.partyId?._id || dc.partyId || ''),
            customerName: dc.partyName || dc.customerName || '',
            vehicleNo: dc.vehicleNumber || dc.vehicleNo || '',
            status: dc.status ? dc.status.charAt(0).toUpperCase() + dc.status.slice(1) : 'Dispatched',
            taxableValue: dc.taxableAmount !== undefined ? dc.taxableAmount : (dc.taxableValue || 0),
            totalTax: (dc.cgstTotal || 0) + (dc.sgstTotal || 0) + (dc.igstTotal || 0) + (dc.cessTotal || 0),
          }));
        }

        if (creditNotesRes.status === 'fulfilled' && creditNotesRes.value) {
          const rawCNs = creditNotesRes.value.creditNotes || creditNotesRes.value.data?.creditNotes || [];
          next.creditNotes = rawCNs.map((cn) => ({
            ...cn,
            id: String(cn._id || cn.id),
            date: cn.creditNoteDate ? new Date(cn.creditNoteDate).toISOString().slice(0, 10) : (cn.date || ''),
            customerId: String(cn.partyId?._id || cn.partyId || ''),
            customerName: cn.partyName || cn.customerName || '',
            status: cn.status === 'posted' ? 'Issued' : (cn.status === 'cancelled' ? 'Cancelled' : 'Draft'),
            taxableValue: cn.taxableAmount !== undefined ? cn.taxableAmount : (cn.taxableValue || 0),
            totalTax: (cn.cgstTotal || 0) + (cn.sgstTotal || 0) + (cn.igstTotal || 0) + (cn.cessTotal || 0),
          }));
        }

        if (purchasesRes.status === 'fulfilled' && purchasesRes.value) {
          const rawBills = purchasesRes.value.bills || purchasesRes.value.data?.bills || [];
          next.purchases = rawBills.map((pb) => ({
            ...pb,
            id: String(pb._id || pb.id),
            supplierInvoiceNo: pb.supplierInvoiceNumber || pb.supplierInvoiceNo || '',
            date: pb.billDate ? new Date(pb.billDate).toISOString().slice(0, 10) : (pb.date || ''),
            dueDate: pb.dueDate ? new Date(pb.dueDate).toISOString().slice(0, 10) : (pb.dueDate || ''),
            supplierId: String(pb.supplierId?._id || pb.supplierId || ''),
            supplierName: pb.supplierName || '',
            supplierGstin: pb.supplierGSTIN || pb.supplierGstin || '',
            taxableValue: pb.taxableAmount !== undefined ? pb.taxableAmount : (pb.taxableValue || 0),
            totalTax: (pb.cgstTotal || 0) + (pb.sgstTotal || 0) + (pb.igstTotal || 0) + (pb.cessTotal || 0),
            amountPaid: pb.paidAmount !== undefined ? pb.paidAmount : (pb.amountPaid || 0),
            paymentStatus: pb.paymentStatus === 'paid' ? 'Paid' : (pb.paymentStatus === 'partially_paid' ? 'Partial' : 'Unpaid'),
            status: pb.status === 'posted' ? 'Received' : (pb.status || 'Received'),
            items: (pb.items || []).map((it) => ({
              ...it,
              productId: String(it.productId?._id || it.productId || ''),
              name: it.productName || it.name || '',
              qty: it.quantity !== undefined ? it.quantity : (it.qty || 1),
              rate: it.unitPrice !== undefined ? it.unitPrice : (it.rate || 0),
              hsn: it.HSN || it.hsn || '',
            })),
          }));
        }

        if (purchaseOrdersRes.status === 'fulfilled' && purchaseOrdersRes.value) {
          const rawPOs = purchaseOrdersRes.value.purchaseOrders || purchaseOrdersRes.value.data?.purchaseOrders || [];
          next.purchaseOrders = rawPOs.map((po) => ({
            ...po,
            id: String(po._id || po.id),
            date: po.orderDate ? new Date(po.orderDate).toISOString().slice(0, 10) : (po.date || ''),
            supplierId: String(po.partyId?._id || po.partyId || ''),
            supplierName: po.partyName || po.supplierName || '',
          }));
        }

        if (grnsRes.status === 'fulfilled' && grnsRes.value) {
          const rawGRNs = grnsRes.value.grns || grnsRes.value.data?.grns || [];
          next.grns = rawGRNs.map((grn) => ({
            ...grn,
            id: String(grn._id || grn.id),
            date: grn.receiptDate ? new Date(grn.receiptDate).toISOString().slice(0, 10) : (grn.date || ''),
            poReference: grn.purchaseOrderId?.orderNumber || grn.supplierChallanNumber || grn.poReference || 'Direct',
            supplierId: String(grn.supplierId?._id || grn.supplierId || ''),
            supplierName: grn.supplierName || '',
            status: grn.status === 'posted' ? 'Completed' : (grn.status === 'cancelled' ? 'Cancelled' : 'Draft'),
            items: (grn.items || []).map((it) => ({
              ...it,
              orderedQty: it.orderedQuantity !== undefined ? it.orderedQuantity : (it.orderedQty || 0),
              receivedQty: it.receivedQuantity !== undefined ? it.receivedQuantity : (it.receivedQty || 0),
              damagedQty: it.rejectedQuantity !== undefined ? it.rejectedQuantity : (it.damagedQty || 0),
              missingQty: Math.max(0, (it.orderedQuantity || 0) - (it.receivedQuantity || 0)),
            })),
          }));
        }

        if (returnsRes.status === 'fulfilled' && returnsRes.value) {
          const rawPRs = returnsRes.value.debitNotes || returnsRes.value.data?.debitNotes || [];
          next.purchaseReturns = rawPRs.map((dn) => ({
            ...dn,
            id: String(dn._id || dn.id),
            returnNumber: dn.debitNoteNumber || dn.returnNumber,
            billNumber: dn.billNumber || '',
            date: dn.debitNoteDate ? new Date(dn.debitNoteDate).toISOString().slice(0, 10) : (dn.date || ''),
            supplierId: String(dn.supplierId?._id || dn.supplierId || ''),
            supplierName: dn.supplierName || '',
            status: dn.status === 'posted' ? 'Completed' : (dn.status === 'cancelled' ? 'Cancelled' : 'Draft'),
            taxableValue: dn.taxableAmount !== undefined ? dn.taxableAmount : (dn.taxableValue || 0),
            totalTax: (dn.cgstTotal || 0) + (dn.sgstTotal || 0) + (dn.igstTotal || 0) + (dn.cessTotal || 0),
          }));
          next.debitNotes = next.purchaseReturns;
        }

        if (paymentsRes.status === 'fulfilled' && paymentsRes.value) {
          const rawPay = paymentsRes.value.payments || paymentsRes.value.data?.payments || [];
          next.payments = rawPay.map((p) => ({
            ...p,
            id: String(p._id || p.id),
            type: p.direction === 'in' ? 'Payment In' : 'Payment Out',
            date: p.paymentDate ? new Date(p.paymentDate).toISOString().slice(0, 10) : (p.date || ''),
            amount: p.amount || 0,
            method: p.paymentMethod || p.method || 'Bank',
            referenceNo: p.referenceNumber || p.referenceNo || '',
            status: p.status === 'completed' ? 'Completed' : 'Cancelled',
          }));
        }

        if (bankAccountsRes.status === 'fulfilled' && bankAccountsRes.value) {
          const rawAccs = bankAccountsRes.value.accounts || bankAccountsRes.value.data?.accounts || [];
          next.bankAccounts = rawAccs.map((acc) => ({
            ...acc,
            id: String(acc._id || acc.id),
            name: acc.accountName || acc.name,
            accountNo: acc.accountNumber || '',
            type: acc.accountType === 'cash' ? 'Cash' : (acc.accountType === 'UPI' ? 'UPI' : 'Bank'),
            balance: Number(acc.currentBalance) || 0,
            openingBalance: Number(acc.openingBalance) || 0,
            isActive: acc.isActive,
            isDefault: acc.isDefault,
          }));
        }

        if (expensesRes.status === 'fulfilled' && expensesRes.value) {
          const rawExp = expensesRes.value.expenses || expensesRes.value.data?.expenses || [];
          next.expenses = rawExp.map((exp) => ({
            ...exp,
            id: String(exp._id || exp.id),
            expenseNumber: exp.expenseNumber,
            title: exp.notes || exp.payeeName || exp.categoryName,
            category: exp.categoryName,
            vendorName: exp.payeeName || '',
            amount: exp.taxableAmount !== undefined ? exp.taxableAmount : exp.amount,
            gstRate: exp.gstRate || 0,
            cgst: exp.cgst || 0,
            sgst: exp.sgst || 0,
            igst: exp.igst || 0,
            totalAmount: exp.amount || 0,
            date: exp.expenseDate ? new Date(exp.expenseDate).toISOString().slice(0, 10) : '',
            paymentMethod: exp.paymentMethod || 'Cash',
            status: exp.status === 'paid' ? 'Paid' : (exp.status === 'cancelled' ? 'Archived' : 'Paid'),
          }));
        }

        if (categoriesRes.status === 'fulfilled' && categoriesRes.value) {
          next.expenseCategories = Array.isArray(categoriesRes.value) ? categoriesRes.value : (categoriesRes.value.data || []);
        }

        if (accountsRes.status === 'fulfilled' && accountsRes.value) {
          const rawAccounts = Array.isArray(accountsRes.value) ? accountsRes.value : (accountsRes.value.data || []);
          next.chartOfAccounts = rawAccounts.map((a) => ({
            ...a,
            id: String(a._id || a.id),
            code: a.accountCode || a.code,
            name: a.accountName || a.name,
            group: a.accountSubType || a.group || 'General',
            type: a.accountType ? a.accountType.charAt(0).toUpperCase() + a.accountType.slice(1) : (a.type || 'Asset'),
            normalBalance: a.balanceType ? a.balanceType.charAt(0).toUpperCase() + a.balanceType.slice(1) : (a.normalBalance || 'Debit'),
            openingBalance: Number(a.openingBalance) || 0,
          }));
        }

        if (journalEntriesRes.status === 'fulfilled' && journalEntriesRes.value) {
          const rawJournals = journalEntriesRes.value.entries || journalEntriesRes.value.data?.entries || [];
          next.journalEntries = rawJournals.map((je) => ({
            ...je,
            id: String(je._id || je.id),
            entryNumber: je.entryNumber,
            date: je.entryDate ? new Date(je.entryDate).toISOString().slice(0, 10) : (je.date || ''),
            voucherType: je.sourceType === 'manual' ? 'Journal' : (je.sourceType || 'Journal'),
            narration: je.narration || '',
            lines: (je.lines || []).map((l) => ({
              ...l,
              accountName: l.accountName || '',
              accountCode: l.accountCode || '',
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
            })),
          }));
        }

        if (eInvoicesRes.status === 'fulfilled' && eInvoicesRes.value) {
          const rawEInvs = eInvoicesRes.value.eInvoices || eInvoicesRes.value.data?.eInvoices || [];
          next.eInvoices = rawEInvs.map((e) => ({
            ...e,
            id: String(e._id || e.id),
            invoiceId: String(e.salesInvoiceId?._id || e.salesInvoiceId || ''),
            invoiceNumber: e.documentNumber,
            customerName: e.recipientGSTIN || '',
            gstin: e.recipientGSTIN || 'URP',
            irn: e.IRN || '',
            ackNo: e.ackNo || '',
            ackDate: e.ackDate ? new Date(e.ackDate).toISOString().replace('T', ' ').slice(0, 19) : '',
            status: e.status === 'generated' ? 'Generated' : (e.status === 'cancelled' ? 'Cancelled' : 'Pending'),
            qrPayload: e.signedQRCode || '',
          }));
        }

        if (eWayBillsRes.status === 'fulfilled' && eWayBillsRes.value) {
          const rawEWBs = eWayBillsRes.value.eWayBills || eWayBillsRes.value.data?.eWayBills || [];
          next.eWayBills = rawEWBs.map((ewb) => ({
            ...ewb,
            id: String(ewb._id || ewb.id),
            invoiceId: String(ewb.salesInvoiceId?._id || ewb.salesInvoiceId || ''),
            invoiceNumber: ewb.documentNumber,
            ewbNumber: ewb.eWayBillNumber || ewb.ewbNumber,
            generatedDate: ewb.eWayBillDate ? new Date(ewb.eWayBillDate).toISOString().slice(0, 10) : '',
            validUpto: ewb.validUpto ? new Date(ewb.validUpto).toISOString().slice(0, 10) : '',
            vehicleNo: ewb.vehicleNumber || '',
            fromPlace: ewb.fromPlace || '',
            toPlace: ewb.toPlace || '',
            distanceKm: ewb.distanceKm || 0,
            status: ewb.status === 'active' ? 'Active' : (ewb.status === 'cancelled' ? 'Cancelled' : (ewb.status || 'Active')),
          }));
        }

        if (calendarRes.status === 'fulfilled' && calendarRes.value) {
          next.gstCalendar = Array.isArray(calendarRes.value) ? calendarRes.value : (calendarRes.value.calendar || calendarRes.value.data || []);
        }

        if (movementsRes.status === 'fulfilled' && movementsRes.value) {
          const rawMv = movementsRes.value.movements || movementsRes.value.data?.movements || [];
          next.stockMovements = rawMv.map((m) => ({
            ...m,
            id: String(m._id || m.id),
            date: m.date ? new Date(m.date).toISOString().slice(0, 10) : (m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : ''),
            productName: m.productName || m.productId?.name || '',
            warehouseName: m.warehouseName || m.warehouseId?.warehouseName || m.warehouseId?.name || '',
            sku: m.sku || m.productId?.SKU || '',
            qtyChange: m.quantity !== undefined ? m.quantity : (m.qtyChange || 0),
            type: m.movementType === 'in' ? 'Stock In' : (m.movementType === 'out' ? 'Stock Out' : (m.type || 'Adjustment')),
            reference: m.referenceNumber || m.reference || '—',
            notes: m.notes || m.description || '',
          }));
        } else {
          next.stockMovements = (next.stockMovements || []).filter(
            (m) =>
              !String(m.id).startsWith('sm-') &&
              !['PB/26-27/014', 'ST/26-27/019', 'PB/26-27/015', 'ST/26-27/021', 'CN/26-27/005', 'PB/26-27/016', 'ADJ-26-014'].includes(m.reference)
          );
        }

        // Clean any fake demo batches or fake GSTR-2B records for authenticated tenants
        next.batches = (next.batches || []).filter(
          (b) =>
            !String(b.id).startsWith('bat-') &&
            !['FOR-26A1', 'FOR-26B4', 'IGB-2605', 'AAS-2609', 'MDH-2604', 'TTG-2608', 'AP-2606'].includes(b.batchNo)
        );
        next.gstr2bRecords = (next.gstr2bRecords || []).filter(
          (r) =>
            !String(r.id).startsWith('2b-') &&
            !r.gstin?.includes('(DEMO)') &&
            !['HAV/RAJ/26-081', 'CRM/MH/840', 'JKP/DL/518', 'PKP/JPR/229', 'MCS/JPR/902', 'AWL/JPR/589'].includes(r.invoiceNo)
        );

        return next;
      });
    } catch (err) {
      console.warn('Phase 2 transactional data load failed:', err);
    } finally {
      setPhase2Loading(false);
    }
  }, []);

  const loadSuperAdminData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [tenantsRes, plansRes, invoicesRes, ticketsRes, annRes, flagsRes, settingsRes, auditRes, usersRes] =
        await Promise.allSettled([
          superAdminService.getTenants({ limit: 100 }),
          superAdminService.getPlans(),
          superAdminService.getInvoices({ limit: 50 }),
          superAdminService.getTickets({ limit: 50 }),
          superAdminService.getAnnouncements(),
          superAdminService.getFeatureFlags(),
          superAdminService.getPlatformSettings(),
          superAdminService.getAuditLogs({ limit: 50 }),
          superAdminService.getUsers({ limit: 100 }),
        ]);

      setState((prev) => {
        const sa = { ...prev.superAdmin };
        if (tenantsRes.status === 'fulfilled' && tenantsRes.value?.tenants) {
          sa.tenants = tenantsRes.value.tenants.map((t) => ({
            id: t._id || t.id,
            businessName: t.businessName,
            owner: t.ownerName || t.owner || 'Admin',
            city: t.city || 'Jaipur',
            state: t.state || 'Rajasthan',
            plan: t.subscription?.planName || 'Growth',
            status: t.isActive ? 'Active' : 'Expired',
            users: t.subscription?.limits?.maxUsers || 1,
            invoicesCount: 0,
            mrr: t.subscription?.planCode === 'ENTERPRISE' ? 4999 : t.subscription?.planCode === 'GROWTH' ? 1999 : 799,
            joinedDate: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : '2026-04-01',
            renewalDate: t.subscription?.currentPeriodEnd ? new Date(t.subscription.currentPeriodEnd).toISOString().slice(0, 10) : '2027-03-31',
          }));
        }
        if (plansRes.status === 'fulfilled' && plansRes.value) {
          const plansList = Array.isArray(plansRes.value) ? plansRes.value : plansRes.value?.plans || [];
          if (plansList.length > 0) {
            sa.plans = plansList.map((p) => ({
              id: p._id || p.id,
              name: p.name,
              audience: p.description || p.audience || '',
              monthlyPrice: p.price,
              annualPrice: p.annualPrice || p.price * 10,
              maxUsers: p.limits?.maxUsers || 5,
              maxInvoices: p.limits?.maxInvoices || 1000,
              maxWarehouses: p.limits?.maxWarehouses || 2,
              features: p.features || [],
            }));
          }
        }
        if (invoicesRes.status === 'fulfilled' && invoicesRes.value?.invoices) {
          sa.platformPayments = invoicesRes.value.invoices.map((inv) => ({
            id: inv._id || inv.id,
            txnId: inv.paymentReference?.transactionId || inv.invoiceNumber,
            tenant: inv.tenantId?.businessName || (inv.tenantId ? String(inv.tenantId) : 'Tenant'),
            tenantId: inv.tenantId?._id || inv.tenantId || null,
            plan: inv.planName,
            planCode: inv.planCode,
            cycle: inv.billingPeriod?.startDate && inv.billingPeriod?.endDate
              ? (Math.round((new Date(inv.billingPeriod.endDate) - new Date(inv.billingPeriod.startDate)) / (1000 * 60 * 60 * 24)) > 60 ? 'Yearly' : 'Monthly')
              : 'Monthly',
            date: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            amount: inv.totalAmount,
            status: inv.paymentStatus === 'paid' ? 'Settled' : inv.paymentStatus === 'failed' ? 'Failed' : 'Pending',
          }));
        }
        if (ticketsRes.status === 'fulfilled' && ticketsRes.value?.tickets) {
          sa.tickets = ticketsRes.value.tickets.map((t) => ({
            id: t._id || t.id,
            ticketNo: t.ticketNo,
            tenant: t.tenantName || t.tenantId?.businessName || 'Platform Support',
            subject: t.subject,
            priority: t.priority,
            status: t.status,
            created: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          }));
        }
        if (annRes.status === 'fulfilled' && Array.isArray(annRes.value)) {
          sa.announcements = annRes.value.map((a) => ({
            id: a._id || a.id,
            title: a.title,
            target: a.targetAudience || 'All Active Tenants',
            date: a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            status: a.status,
          }));
        }
        if (flagsRes.status === 'fulfilled' && Array.isArray(flagsRes.value)) {
          sa.featureFlags = flagsRes.value.map((f) => ({
            id: f._id || f.id,
            key: f.key,
            name: f.name,
            description: f.description,
            enabled: f.enabled,
          }));
        }
        if (auditRes.status === 'fulfilled' && auditRes.value?.logs) {
          sa.platformAuditLogs = auditRes.value.logs.map((l) => ({
            id: l._id || l.id,
            actor: l.actor?.name || l.actor?.email || 'Platform Admin',
            action: l.action,
            target: l.targetName || l.entityType || 'Platform',
            timestamp: l.timestamp ? new Date(l.timestamp).toISOString().replace('T', ' ').slice(0, 16) : new Date().toISOString().slice(0, 16),
            detail: l.description || (l.details ? JSON.stringify(l.details) : ''),
          }));
        }
        if (usersRes.status === 'fulfilled' && usersRes.value?.users) {
          sa.users = usersRes.value.users.map((u) => ({
            id: u._id || u.id,
            name: u.name,
            email: u.email,
            phone: u.phone || '—',
            mobile: u.phone || '—',
            role: u.role || 'user',
            tenantId: u.tenantId?._id || u.tenantId,
            tenantName: u.tenantId?.businessName || (u.tenantId?.tenantCode ? `Tenant (${u.tenantId.tenantCode})` : 'Platform Admin'),
            tenantCode: u.tenantId?.tenantCode || 'PLATFORM',
            status: u.isActive ? 'Active' : 'Inactive',
            isActive: u.isActive,
            joinedDate: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '—',
            lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
          }));
        }
        return { ...prev, superAdmin: sa };
      });
    } catch (err) {
      console.warn('SuperAdmin live data fetch error:', err.message);
    }
  }, []);

  // Initial authentication verification from backend /api/auth/me
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        console.warn('Session verification safety timeout reached (4s). Clearing authLoading.');
        setAuthLoading(false);
      }
    }, 4000);

    authService
      .getMe()
      .then((data) => {
        if (!isMounted) return;
        if (data?.user) {
          const tenant = data.tenant || {
            tenantCode: 'PLATFORM',
            businessName: 'Platform Administration',
            subscriptionStatus: 'active',
            isActive: true,
          };
          setState((prev) => ({
            ...prev,
            isAuthenticated: true,
            currentUser: data.user,
            currentTenant: tenant,
            business: {
              ...prev.business,
              ...tenant,
              businessName: tenant.businessName || prev.business?.businessName,
              tenantCode: tenant.tenantCode || 'PLATFORM',
              email: tenant.email || data.user.email || prev.business?.email,
              phone: tenant.phone || prev.business?.phone,
              state: tenant.state || prev.business?.state,
              city: tenant.city || prev.business?.city,
              subscriptionStatus: tenant.subscriptionStatus || 'active',
            },
          }));
          if (data.user?.isSuperAdmin || data.user?.role === 'super_admin') {
            loadSuperAdminData();
          } else {
            loadPhase1Data();
            loadPhase2Data();
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Session verification failed:', err.message);
        removeToken();
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          currentUser: null,
          currentTenant: null,
        }));
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        if (isMounted) setAuthLoading(false);
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Listen for unauthorized 401 events from api client
  useEffect(() => {
    const handleUnauthorized = () => {
      removeToken();
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        currentUser: null,
        currentTenant: null,
      }));
      notify('Session expired. Please sign in again.', 'error');
    };

    window.addEventListener('arthagst:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('arthagst:unauthorized', handleUnauthorized);
  }, []);

  const notify = useCallback((message, type = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirmAction = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmState({
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure you want to proceed?',
        confirmText: options.confirmText || 'Confirm',
        danger: Boolean(options.danger),
        onConfirm: () => {
          setConfirmState(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmState(null);
          resolve(false);
        },
      });
    });
  }, []);

  const makeAuditEntry = (prevState, action, module, recordRef, prevValue, newValue) => ({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    user: prevState.currentUser?.name || 'Anil Sharma',
    action,
    module,
    recordRef,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    prevValue: prevValue || '—',
    newValue: newValue || '—',
  });

  const updateStateWithAudit = useCallback((updater, auditMeta) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (auditMeta) {
        const entry = makeAuditEntry(
          prev,
          auditMeta.action,
          auditMeta.module,
          auditMeta.recordRef,
          auditMeta.prevValue,
          auditMeta.newValue
        );
        return {
          ...next,
          auditLogs: [entry, ...(next.auditLogs || [])].slice(0, 200),
        };
      }
      return next;
    });
  }, []);

  // Backend Authentication & Session State
  const login = useCallback(
    async ({ tenantCode, email, password, isSuperAdmin }) => {
      try {
        let data;
        if (isSuperAdmin && (!tenantCode || !tenantCode.trim())) {
          data = await authService.superAdminLogin({ email, password });
        } else {
          data = await authService.login({ tenantCode, email, password });
        }
        setToken(data.token);
        if (data.tenant?.tenantCode) {
          localStorage.setItem('arthagst_last_tenant_code', data.tenant.tenantCode);
        }
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          currentUser: data.user,
          currentTenant: data.tenant,
          business: {
            ...prev.business,
            ...data.tenant,
            businessName: data.tenant?.businessName || prev.business?.businessName,
            tenantCode: data.tenant?.tenantCode || 'PLATFORM',
            email: data.tenant?.email || data.user?.email || prev.business?.email,
            subscriptionStatus: data.tenant?.subscriptionStatus || 'active',
          },
        }));
        notify(`Welcome back, ${data.user?.name || 'Administrator'}!`);
        if (data.user?.isSuperAdmin || data.user?.role === 'super_admin') {
          loadSuperAdminData();
        } else {
          loadPhase1Data();
          loadPhase2Data();
        }
        return data;
      } catch (err) {
        throw err;
      }
    },
    [loadPhase1Data, loadPhase2Data, loadSuperAdminData, notify]
  );

  const register = useCallback(
    async (payload) => {
      try {
        const data = await authService.register(payload);
        setToken(data.token);
        if (data.tenant?.tenantCode) {
          localStorage.setItem('arthagst_last_tenant_code', data.tenant.tenantCode);
        }
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          currentUser: data.user,
          currentTenant: data.tenant,
          business: {
            ...prev.business,
            ...data.tenant,
            businessName: data.tenant.businessName || prev.business?.businessName,
            tenantCode: data.tenant.tenantCode,
            subscriptionStatus: data.tenant.subscriptionStatus,
          },
        }));
        notify(`Business account created for ${data.tenant.businessName}!`);
        loadPhase1Data();
        loadPhase2Data();
        return data;
      } catch (err) {
        throw err;
      }
    },
    [loadPhase1Data, loadPhase2Data, notify]
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Non-blocking logout call
    }
    removeToken();
    try {
      localStorage.removeItem('arthagst_prototype_state_v1');
    } catch {
      // Ignore
    }
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      currentUser: null,
      currentTenant: null,
      customers: [],
      suppliers: [],
      categories: [],
      units: [],
      products: [],
      warehouses: [],
      invoices: [],
      quotations: [],
      salesOrders: [],
      deliveryChallans: [],
      creditNotes: [],
      debitNotes: [],
      purchases: [],
      purchaseOrders: [],
      grns: [],
      purchaseReturns: [],
      payments: [],
      bankAccounts: [],
      expenses: [],
      expenseCategories: [],
      chartOfAccounts: [],
      journalEntries: [],
      eInvoices: [],
      eWayBills: [],
      gstCalendar: [],
    }));
    notify('Signed out successfully');
  }, [notify]);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await authService.getMe();
      if (data?.user) {
        const isSuper = data.user.isSuperAdmin || data.user.role === 'super_admin';
        const tenant = data.tenant || (isSuper ? {
          tenantCode: 'PLATFORM',
          businessName: 'Platform Administration',
          subscriptionStatus: 'active',
          isActive: true,
        } : null);
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          currentUser: data.user,
          currentTenant: tenant,
          business: tenant ? {
            ...prev.business,
            ...tenant,
            businessName: tenant.businessName || prev.business?.businessName,
            tenantCode: tenant.tenantCode || prev.business?.tenantCode,
            email: tenant.email || data.user.email || prev.business?.email,
            phone: tenant.phone || prev.business?.phone,
            state: tenant.state || prev.business?.state,
            city: tenant.city || prev.business?.city,
            subscriptionStatus: tenant.subscriptionStatus || prev.business?.subscriptionStatus,
          } : prev.business,
        }));
        if (isSuper) {
          loadSuperAdminData();
        } else {
          loadPhase1Data();
          loadPhase2Data();
        }
      }
      return data;
    } catch (err) {
      removeToken();
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        currentUser: null,
        currentTenant: null,
        customers: [],
        suppliers: [],
        categories: [],
        units: [],
        products: [],
        warehouses: [],
        invoices: [],
        quotations: [],
        salesOrders: [],
        deliveryChallans: [],
        creditNotes: [],
        debitNotes: [],
        purchases: [],
        purchaseOrders: [],
        grns: [],
        purchaseReturns: [],
        payments: [],
        bankAccounts: [],
        expenses: [],
        expenseCategories: [],
      }));
      throw err;
    }
  }, [loadPhase1Data, loadPhase2Data, loadSuperAdminData]);

  const completeOnboarding = useCallback((bizPayload) => {
    setState((prev) => ({
      ...prev,
      onboardingCompleted: true,
      business: { ...prev.business, ...bizPayload },
      settings: {
        ...prev.settings,
        invoice: {
          ...prev.settings.invoice,
          prefix: bizPayload.invoicePrefix || prev.settings.invoice.prefix,
          template: bizPayload.invoiceTemplate || prev.settings.invoice.template,
        },
        financial: {
          ...prev.settings.financial,
          financialYear: bizPayload.financialYear || prev.settings.financial.financialYear,
        },
      },
    }));
    notify('Business onboarding saved');
  }, [notify]);

  // Reset Demo Data
  const handleResetDemo = useCallback(() => {
    const fresh = resetDemoData();
    setState(fresh);
    setSelectedFY(fresh.business.financialYear);
    notify('Demo dataset restored to initial state');
  }, [notify]);

  // Master CRUD (Customers, Suppliers, Products, Categories, Units, Warehouses, Users, Expenses)
  // Seamlessly delegates Phase 1 master data to real backend APIs when authenticated
  const upsertRecord = useCallback(
    async (collectionKey, record, auditModule, labelField = 'name') => {
      const isAuth = Boolean(getToken());

      if (isAuth) {
        if (collectionKey === 'customers') {
          const isEdit = Boolean(record._id || (record.id && record.id.length === 24));
          const id = record._id || record.id;
          const payload = {
            partyType: 'customer',
            name: record.name,
            businessName: record.businessName || record.name,
            phone: record.phone || record.mobile || '',
            email: record.email || null,
            GSTIN: record.GSTIN || record.gstin || null,
            PAN: record.PAN || record.pan || null,
            billingAddress: record.billingAddress || record.address || '',
            shippingAddress: record.shippingAddress || record.billingAddress || record.address || '',
            state: record.state || 'Rajasthan',
            openingBalance: Number(record.openingBalance) || 0,
            creditLimit: Number(record.creditLimit) || 0,
            paymentTerms: record.paymentTerms || 'Net 15',
            isActive: record.isActive !== false && record.status !== 'Inactive',
          };
          const saved = isEdit
            ? await partyService.updateParty(id, payload)
            : await partyService.createParty(payload);

          setState((prev) => {
            const list = prev.customers || [];
            const exists = list.some((c) => (c._id || c.id) === (saved._id || saved.id));
            const nextList = exists
              ? list.map((c) => ((c._id || c.id) === (saved._id || saved.id) ? { ...c, ...saved } : c))
              : [saved, ...list];
            return { ...prev, customers: nextList };
          });
          notify(`${auditModule} saved successfully`);
          return saved;
        }

        if (collectionKey === 'suppliers') {
          const isEdit = Boolean(record._id || (record.id && record.id.length === 24));
          const id = record._id || record.id;
          const payload = {
            partyType: 'supplier',
            name: record.name,
            businessName: record.businessName || record.name,
            phone: record.phone || record.mobile || '',
            email: record.email || null,
            GSTIN: record.GSTIN || record.gstin || null,
            PAN: record.PAN || record.pan || null,
            billingAddress: record.billingAddress || record.address || '',
            shippingAddress: record.shippingAddress || record.billingAddress || record.address || '',
            state: record.state || 'Rajasthan',
            openingBalance: Number(record.openingBalance) || 0,
            balanceType: 'payable',
            isActive: record.isActive !== false && record.status !== 'Inactive' && record.status !== 'Archived',
          };
          const saved = isEdit
            ? await partyService.updateParty(id, payload)
            : await partyService.createParty(payload);

          setState((prev) => {
            const list = prev.suppliers || [];
            const exists = list.some((s) => (s._id || s.id) === (saved._id || saved.id));
            const nextList = exists
              ? list.map((s) => ((s._id || s.id) === (saved._id || saved.id) ? { ...s, ...saved } : s))
              : [saved, ...list];
            return { ...prev, suppliers: nextList };
          });
          notify(`${auditModule} saved successfully`);
          return saved;
        }

        if (collectionKey === 'categories') {
          const isEdit = Boolean(record._id || (record.id && record.id.length === 24));
          const id = record._id || record.id;
          const payload = {
            name: record.name,
            description: record.description || '',
            parentCategory: record.parentCategory || null,
            isActive: record.isActive !== false,
          };
          const saved = isEdit
            ? await categoryService.updateCategory(id, payload)
            : await categoryService.createCategory(payload);

          setState((prev) => {
            const list = prev.categories || [];
            const exists = list.some((c) => (c._id || c.id) === (saved._id || saved.id));
            const nextList = exists
              ? list.map((c) => ((c._id || c.id) === (saved._id || saved.id) ? { ...c, ...saved } : c))
              : [saved, ...list];
            return { ...prev, categories: nextList };
          });
          notify(`${auditModule} saved successfully`);
          return saved;
        }

        if (collectionKey === 'units') {
          const isEdit = Boolean(record._id || (record.id && record.id.length === 24));
          const id = record._id || record.id;
          const payload = {
            name: record.name,
            shortName: record.shortName || record.code || '',
            unitType: record.unitType || 'quantity',
            gstUqcCode: record.gstUqcCode || record.uqc || 'PCS-PIECES',
            allowDecimal: record.allowDecimal !== false,
            isActive: record.isActive !== false,
          };
          const saved = isEdit
            ? await unitService.updateUnit(id, payload)
            : await unitService.createUnit(payload);

          setState((prev) => {
            const list = prev.units || [];
            const exists = list.some((u) => (u._id || u.id) === (saved._id || saved.id));
            const nextList = exists
              ? list.map((u) => ((u._id || u.id) === (saved._id || saved.id) ? { ...u, ...saved } : u))
              : [saved, ...list];
            return { ...prev, units: nextList };
          });
          notify(`${auditModule} saved successfully`);
          return saved;
        }

        if (collectionKey === 'products') {
          const isEdit = Boolean(record._id || (record.id && record.id.length === 24));
          const id = record._id || record.id;

          const unitObj = (state.units || []).find(
            (u) =>
              String(u.id || u._id) === String(record.unitId?._id || record.unitId?.id || record.unitId) ||
              u.shortName === record.unit ||
              u.name === record.unit
          );
          const catObj = (state.categories || []).find(
            (c) =>
              String(c.id || c._id) === String(record.categoryId?._id || record.categoryId?.id || record.categoryId) ||
              c.name === record.category
          );

          if (!unitObj?._id && !unitObj?.id && !record.unitId) {
            throw new Error('Please create at least one Measurement Unit before adding products');
          }

          const cleanSKU = (record.sku || record.SKU || '').trim().toUpperCase();
          const cleanHSN = (record.hsn || record.HSN || '').trim();
          const cleanSAC = (record.sac || record.SAC || '').trim();

          const resolvedCategoryId = catObj
            ? (catObj._id || catObj.id)
            : (record.categoryId?._id || record.categoryId?.id || record.categoryId || null);
          const resolvedUnitId = unitObj
            ? (unitObj._id || unitObj.id)
            : (record.unitId?._id || record.unitId?.id || record.unitId);

          const targetStock = Number(
            record.stock !== undefined ? record.stock : (record.openingStock !== undefined ? record.openingStock : 0)
          ) || 0;

          const payload = {
            name: record.name,
            productType: record.productType || 'goods',
            categoryId: resolvedCategoryId,
            unitId: resolvedUnitId,
            SKU: cleanSKU,
            sku: cleanSKU,
            barcode: record.barcode || null,
            description: record.description || '',
            HSN: cleanHSN || null,
            SAC: cleanSAC || null,
            gstRate: Number(record.gstRate) || 0,
            cessRate: Number(record.cessRate) || 0,
            purchasePrice: Number(record.purchasePrice) || 0,
            sellingPrice: Number(record.sellingPrice) || 0,
            mrp: Number(record.mrp) || 0,
            openingStock: targetStock,
            stock: targetStock,
            lowStockAlert: Number(record.minStock || record.lowStockAlert) || 0,
            trackInventory: record.trackInventory !== false,
            isActive: record.isActive !== false && !record.archived,
          };

          const saved = isEdit
            ? await productService.updateProduct(id, payload)
            : await productService.createProduct(payload);

          const finalStock = saved.stock !== undefined
            ? saved.stock
            : (saved.openingStock !== undefined ? saved.openingStock : targetStock);

          const enriched = {
            ...saved,
            id: saved._id || saved.id || id,
            category: catObj?.name || (typeof saved.categoryId === 'object' ? saved.categoryId?.name : '') || record.category || 'General',
            unit: unitObj?.shortName || (typeof saved.unitId === 'object' ? saved.unitId?.shortName : '') || record.unit || 'PCS',
            sku: saved.SKU || cleanSKU,
            SKU: saved.SKU || cleanSKU,
            hsn: saved.HSN || cleanHSN,
            HSN: saved.HSN || cleanHSN,
            stock: finalStock,
            openingStock: finalStock,
            minStock: saved.lowStockAlert !== undefined ? saved.lowStockAlert : (record.minStock || 0),
          };

          setState((prev) => {
            const list = prev.products || [];
            const exists = list.some((p) => (p._id || p.id) === (enriched._id || enriched.id));
            const nextList = exists
              ? list.map((p) => ((p._id || p.id) === (enriched._id || enriched.id) ? { ...p, ...enriched } : p))
              : [enriched, ...list];
            return { ...prev, products: nextList };
          });
          notify(`${auditModule} saved successfully`);
          return enriched;
        }

        if (collectionKey === 'warehouses') {
          const isEdit = Boolean(record._id || (record.id && record.id.length === 24));
          const id = record._id || record.id;
          const payload = {
            warehouseName: record.warehouseName || record.name,
            warehouseCode: (record.warehouseCode || record.code || '').toUpperCase(),
            address: record.address || '',
            city: record.city || '',
            state: record.state || '',
            pincode: record.pincode || '',
            manager: record.manager || '',
            capacity: record.capacity || '',
            isActive: record.isActive !== false,
          };
          if (record.isDefault !== undefined) {
            payload.isDefault = Boolean(record.isDefault);
          } else if (!isEdit) {
            payload.isDefault = false;
          }
          const saved = isEdit
            ? await warehouseService.updateWarehouse(id, payload)
            : await warehouseService.createWarehouse(payload);

          const enriched = {
            ...saved,
            id: saved._id || saved.id || id,
            name: saved.warehouseName || record.name,
            code: saved.warehouseCode || record.code,
            manager: saved.manager || record.manager,
            capacity: saved.capacity || record.capacity,
            isDefault: saved.isDefault !== undefined ? saved.isDefault : record.isDefault,
          };

          setState((prev) => {
            const list = prev.warehouses || [];
            const exists = list.some((w) => (w._id || w.id) === (enriched._id || enriched.id));
            const nextList = exists
              ? list.map((w) => ((w._id || w.id) === (enriched._id || enriched.id) ? { ...w, ...enriched } : w))
              : [enriched, ...list];
            return { ...prev, warehouses: nextList };
          });
          notify(`${auditModule} saved successfully`);
          return enriched;
        }

        if (collectionKey === 'quotations') {
          const warehouseId = record.warehouseId || state.warehouses[0]?.id || state.warehouses[0]?._id;
          const payload = {
            partyId: String(record.customerId || record.partyId),
            warehouseId: String(warehouseId),
            quotationDate: record.date || new Date().toISOString().slice(0, 10),
            validUntil: record.validUntil || record.secondDate || null,
            placeOfSupply: record.placeOfSupply || record.customerState,
            items: (record.items && record.items.length)
              ? record.items.map((it) => ({
                  productId: String(it.productId || it.id),
                  quantity: Number(it.qty || it.quantity || 1),
                  unitPrice: Number(it.rate || it.unitPrice || 0),
                  discount: Number(it.discountPct || it.discount || 0),
                  description: it.description || '',
                }))
              : [{
                  productId: String(record.productId),
                  quantity: Number(record.qty || 1),
                }],
            notes: record.notes || '',
          };
          const saved = await quotationService.createQuotation(payload);
          notify(`${auditModule} saved successfully`);
          await loadPhase2Data();
          return saved;
        }

        if (collectionKey === 'salesOrders') {
          const warehouseId = record.warehouseId || state.warehouses[0]?.id || state.warehouses[0]?._id;
          const payload = {
            partyId: String(record.customerId || record.partyId),
            warehouseId: String(warehouseId),
            orderDate: record.date || new Date().toISOString().slice(0, 10),
            expectedDeliveryDate: record.expectedDelivery || record.secondDate || null,
            placeOfSupply: record.placeOfSupply || record.customerState,
            items: (record.items && record.items.length)
              ? record.items.map((it) => ({
                  productId: String(it.productId || it.id),
                  quantity: Number(it.qty || it.quantity || 1),
                  unitPrice: Number(it.rate || it.unitPrice || 0),
                  discount: Number(it.discountPct || it.discount || 0),
                  description: it.description || '',
                }))
              : [{
                  productId: String(record.productId),
                  quantity: Number(record.qty || 1),
                }],
            notes: record.notes || '',
          };
          const saved = await salesOrderService.createSalesOrder(payload);
          notify(`${auditModule} saved successfully`);
          await loadPhase2Data();
          return saved;
        }

        if (collectionKey === 'deliveryChallans') {
          const warehouseId = record.warehouseId || state.warehouses[0]?.id || state.warehouses[0]?._id;
          const payload = {
            partyId: String(record.customerId || record.partyId),
            warehouseId: String(warehouseId),
            challanDate: record.date || new Date().toISOString().slice(0, 10),
            vehicleNumber: record.vehicleNo || record.vehicleNumber || '',
            placeOfSupply: record.placeOfSupply || record.customerState,
            items: (record.items && record.items.length)
              ? record.items.map((it) => ({
                  productId: String(it.productId || it.id),
                  quantity: Number(it.qty || it.quantity || 1),
                  unitPrice: Number(it.rate || it.unitPrice || 0),
                  discount: Number(it.discountPct || it.discount || 0),
                  description: it.description || '',
                }))
              : [{
                  productId: String(record.productId),
                  quantity: Number(record.qty || 1),
                }],
            notes: record.notes || '',
          };
          const saved = await deliveryChallanService.createDeliveryChallan(payload);
          notify(`${auditModule} saved successfully`);
          await loadPhase2Data();
          return saved;
        }

        if (collectionKey === 'purchaseOrders') {
          const warehouseId = record.warehouseId || state.warehouses[0]?.id || state.warehouses[0]?._id;
          const payload = {
            partyId: String(record.supplierId || record.partyId),
            warehouseId: String(warehouseId),
            orderDate: record.date || new Date().toISOString().slice(0, 10),
            expectedDeliveryDate: record.expectedDelivery || record.secondDate || null,
            placeOfSupply: record.placeOfSupply || record.supplierState || state.business.state,
            items: (record.items && record.items.length)
              ? record.items.map((it) => ({
                  productId: String(it.productId || it.id),
                  quantity: Number(it.qty || it.quantity || 1),
                  unitPrice: Number(it.rate || it.unitPrice || 0),
                  discount: Number(it.discountPct || it.discount || 0),
                  description: it.description || '',
                }))
              : [{
                  productId: String(record.productId),
                  quantity: Number(record.qty || 1),
                }],
            notes: record.notes || '',
          };
          const saved = await purchaseOrderService.createPurchaseOrder(payload);
          notify(`${auditModule} saved successfully`);
          await loadPhase2Data();
          return saved;
        }

        if (collectionKey === 'grns') {
          const warehouseId = record.warehouseId || state.warehouses[0]?.id || state.warehouses[0]?._id;
          const payload = {
            supplierId: String(record.supplierId),
            warehouseId: String(warehouseId),
            supplierChallanNumber: record.poReference || '',
            receiptDate: record.date || new Date().toISOString().slice(0, 10),
            items: (record.items || []).map((it) => ({
              productId: String(it.productId),
              receivedQuantity: Number(it.receivedQty || it.quantity || 1),
              acceptedQuantity: Number(it.receivedQty || it.quantity || 1),
              rejectedQuantity: Number(it.damagedQty || 0),
              remarks: record.notes || '',
            })),
          };
          const saved = await grnService.createGRN(payload);
          const grn = saved?.grn || saved;
          if (grn && (grn._id || grn.id)) {
            await grnService.postGRN(grn._id || grn.id);
          }
          notify(`${auditModule} recorded and stock updated`);
          await Promise.all([loadPhase1Data(), loadPhase2Data()]);
          return saved;
        }

        if (collectionKey === 'expenses') {
          const isEdit = Boolean(record._id || (record.id && record.id.length === 24));
          const id = record._id || record.id;
          let cat = (state.expenseCategories || []).find(
            (c) => c.name === record.category || String(c._id) === String(record.categoryId)
          );
          let categoryId = cat?._id || cat?.id || state.expenseCategories?.[0]?._id;
          if (!categoryId) {
            try {
              const createdCat = await expenseService.createCategory({
                name: record.category || 'Office & Admin Expenses',
                description: 'General business and operating expenses',
              });
              categoryId = createdCat?._id || createdCat?.id || createdCat?.data?._id;
            } catch (catErr) {
              notify('Failed to initialize expense category: ' + (catErr.message || ''), 'error');
              return null;
            }
          }

          const baseAmt = Number(record.amount || 0);
          const gstRate = Number(record.gstRate || 0);
          const totalAmt = Number(record.totalAmount || round2(baseAmt + (baseAmt * gstRate) / 100));

          const payload = {
            categoryId: String(categoryId),
            expenseDate: record.date || new Date().toISOString().slice(0, 10),
            amount: totalAmt,
            isGSTApplicable: gstRate > 0,
            taxableAmount: baseAmt,
            gstRate,
            isITCClaimable: record.itcEligible !== false,
            paymentMethod: (record.paymentMethod || 'UPI').toLowerCase(),
            bankAccountId: record.bankAccountId ? String(record.bankAccountId) : null,
            payeeName: record.vendorName || record.payeeName || '',
            notes: record.title || record.notes || '',
          };

          const saved = isEdit
            ? await expenseService.updateExpense(id, payload)
            : await expenseService.createExpense(payload);
          notify(`${auditModule} saved successfully`);
          await loadPhase2Data();
          return saved;
        }

        if (collectionKey === 'bankAccounts') {
          const isEdit = Boolean(record._id || (record.id && record.id.length === 24));
          const id = record._id || record.id;
          const payload = {
            accountName: record.name || record.accountName,
            accountType: (record.type || record.accountType || 'bank').toLowerCase(),
            bankName: record.bankName || '',
            accountNumber: record.accountNo || record.accountNumber || '',
            openingBalance: Number(record.openingBalance || 0),
            isActive: record.isActive !== false,
            isDefault: Boolean(record.isDefault),
          };
          const saved = isEdit
            ? await bankAccountService.updateBankAccount(id, payload)
            : await bankAccountService.createBankAccount(payload);
          notify(`${auditModule} saved successfully`);
          await loadPhase2Data();
          return saved;
        }

        if (collectionKey === 'chartOfAccounts' || collectionKey === 'accounts') {
          const isEdit = Boolean(record._id || (record.id && record.id.length === 24));
          const id = record._id || record.id;
          const payload = {
            accountName: record.name || record.accountName,
            accountCode: String(record.code || record.accountCode),
            accountType: (record.type || record.accountType || 'asset').toLowerCase(),
            accountSubType: record.group || record.accountSubType || 'general',
            balanceType: (record.normalBalance || record.balanceType || 'debit').toLowerCase(),
            openingBalance: Number(record.openingBalance || 0),
            description: record.description || '',
          };
          const saved = isEdit
            ? await accountingService.updateAccount(id, payload)
            : await accountingService.createAccount(payload);
          notify(`${auditModule} saved successfully`);
          await loadPhase2Data();
          return saved;
        }
      }

      // In-memory / Prototype fallback for purely offline/demo testing
      let isNew = false;
      updateStateWithAudit(
        (prev) => {
          const list = prev[collectionKey] || [];
          const exists = list.some((item) => item.id === record.id);
          isNew = !exists;
          const nextList = exists
            ? list.map((item) => (item.id === record.id ? record : item))
            : [record, ...list];
          return { ...prev, [collectionKey]: nextList };
        },
        {
          action: record.id && state[collectionKey]?.some((i) => i.id === record.id) ? `Updated ${auditModule}` : `Created ${auditModule}`,
          module: auditModule,
          recordRef: record[labelField] || record.id,
          prevValue: isNew ? '—' : 'Existing record',
          newValue: record[labelField] || record.id,
        }
      );
      notify(`${auditModule} saved successfully`);
      return record;
    },
    [loadPhase1Data, loadPhase2Data, notify, state, updateStateWithAudit]
  );

  const deleteRecord = useCallback(
    async (collectionKey, id, auditModule, label) => {
      const isAuth = Boolean(getToken());

      if (isAuth) {
        try {
          if (collectionKey === 'customers' || collectionKey === 'suppliers') {
            await partyService.deleteParty(id);
          } else if (collectionKey === 'categories') {
            await categoryService.deleteCategory(id);
          } else if (collectionKey === 'units') {
            await unitService.deleteUnit(id);
          } else if (collectionKey === 'products') {
            await productService.deleteProduct(id);
          } else if (collectionKey === 'warehouses') {
            await warehouseService.deleteWarehouse(id);
          } else if (collectionKey === 'quotations') {
            await quotationService.deleteQuotation(id);
            await loadPhase2Data();
          } else if (collectionKey === 'salesOrders') {
            await salesOrderService.cancelSalesOrder(id);
            await loadPhase2Data();
          } else if (collectionKey === 'purchaseOrders') {
            await purchaseOrderService.cancelPurchaseOrder(id);
            await loadPhase2Data();
          } else if (collectionKey === 'expenses') {
            await expenseService.deleteExpense(id);
            await loadPhase2Data();
          } else if (collectionKey === 'bankAccounts') {
            await bankAccountService.deleteBankAccount(id);
            await loadPhase2Data();
          } else if (collectionKey === 'chartOfAccounts' || collectionKey === 'accounts') {
            await accountingService.deleteAccount(id);
            await loadPhase2Data();
          }
        } catch (err) {
          notify(err.message || `Failed to remove ${auditModule}`, 'error');
          throw err;
        }
      }

      updateStateWithAudit(
        (prev) => ({
          ...prev,
          [collectionKey]: (prev[collectionKey] || []).filter(
            (item) => item.id !== id && item._id !== id
          ),
        }),
        {
          action: `Deleted ${auditModule}`,
          module: auditModule,
          recordRef: label || id,
          prevValue: label || id,
          newValue: 'Removed',
        }
      );
      notify(`${auditModule} removed`);
    },
    [loadPhase2Data, notify, updateStateWithAudit]
  );

  // Save or Finalize Sales Invoice (Directly with Backend & MongoDB)
  const saveSalesInvoice = useCallback(
    async (invoicePayload, paymentDetails = null) => {
      const isAuth = Boolean(getToken());
      if (!isAuth) {
        notify('You must be signed in to save invoices', 'error');
        return null;
      }

      try {
        const backendItems = (invoicePayload.items || []).map((it) => ({
          productId: String(it.productId || it.id),
          quantity: Number(it.qty || it.quantity || 1),
          unitPrice: Number(it.rate || it.unitPrice || 0),
          discount: Number(it.discountPct || it.discount || 0),
          description: it.description || '',
        }));

        const warehouseId =
          invoicePayload.warehouseId ||
          state.warehouses[0]?._id ||
          state.warehouses[0]?.id;

        if (!warehouseId) {
          notify('A warehouse is required to generate invoices. Please create one in Warehouses master.', 'error');
          return null;
        }

        const partyId = String(invoicePayload.customerId || invoicePayload.partyId);

        const createPayload = {
          partyId,
          warehouseId: String(warehouseId),
          invoiceDate: invoicePayload.date || new Date().toISOString().slice(0, 10),
          dueDate: invoicePayload.dueDate || null,
          placeOfSupply: invoicePayload.placeOfSupply || invoicePayload.customerState,
          items: backendItems,
          notes: invoicePayload.notes || '',
          paidAmount: Number(invoicePayload.amountPaid) || 0,
        };

        let savedInv;
        const isExisting = invoicePayload.id && !invoicePayload.id.startsWith('inv-');

        if (isExisting) {
          savedInv = await salesInvoiceService.updateInvoice(invoicePayload.id, createPayload);
        } else {
          savedInv = await salesInvoiceService.createInvoice(createPayload);
        }

        // Unpack backend response: handle { data: invoice }, { invoice }, or direct object
        const rawInvoice = savedInv?.data || savedInv?.invoice || savedInv;
        const invoiceRecord = { ...(rawInvoice?.data || rawInvoice) };
        const invId = invoiceRecord._id || invoiceRecord.id;

        if (invoicePayload.status === 'Finalized' && invId && invoiceRecord.invoiceStatus !== 'posted') {
          try {
            const postedRes = await salesInvoiceService.postInvoice(invId);
            const postedData = postedRes?.data || postedRes?.invoice || postedRes;
            Object.assign(invoiceRecord, postedData);
          } catch (postErr) {
            console.warn('Auto-post sales invoice error:', postErr.message);
          }
        }

        const remainingBal = invoiceRecord.balanceAmount !== undefined ? invoiceRecord.balanceAmount : (invoiceRecord.outstandingBalance !== undefined ? invoiceRecord.outstandingBalance : 0);
        if (paymentDetails && Number(paymentDetails.amount) > 0 && remainingBal > 0 && invId) {
          try {
            const payAmt = Math.min(Number(paymentDetails.amount), remainingBal);
            await paymentService.createPayment({
              direction: 'in',
              partyId,
              paymentDate: invoicePayload.date || new Date().toISOString().slice(0, 10),
              amount: payAmt,
              paymentMethod: paymentDetails.method === 'Cash' ? 'cash' : (paymentDetails.method === 'UPI' ? 'UPI' : 'bank'),
              referenceNumber: paymentDetails.referenceNo || `INV-${invoiceRecord.invoiceNumber}`,
              allocations: [{ salesInvoiceId: String(invId), allocatedAmount: payAmt }],
            });
            invoiceRecord.paidAmount = (invoiceRecord.paidAmount || 0) + payAmt;
            invoiceRecord.balanceAmount = Math.max(0, (invoiceRecord.balanceAmount || 0) - payAmt);
            invoiceRecord.paymentStatus = invoiceRecord.balanceAmount === 0 ? 'paid' : 'partial';
          } catch (payErr) {
            console.warn('Initial invoice payment warning:', payErr.message);
          }
        }

        // Normalize invoice fields for unified frontend consumption
        invoiceRecord.customerName = invoiceRecord.customerName || invoiceRecord.partyName || invoicePayload.customerName || 'Walk-in Customer';
        invoiceRecord.partyName = invoiceRecord.customerName;
        invoiceRecord.paymentMethod = invoicePayload.paymentMethod || invoiceRecord.paymentMethod || 'Cash';
        invoiceRecord.taxableValue = invoiceRecord.taxableValue ?? invoiceRecord.taxableAmount ?? invoicePayload.taxableValue ?? 0;
        invoiceRecord.taxableAmount = invoiceRecord.taxableValue;
        invoiceRecord.totalTax = invoiceRecord.totalTax ?? ((invoiceRecord.cgstTotal || 0) + (invoiceRecord.sgstTotal || 0) + (invoiceRecord.igstTotal || 0) + (invoiceRecord.cessTotal || 0));
        if (invoiceRecord.totalTax === 0 && invoicePayload.totalTax) {
          invoiceRecord.totalTax = invoicePayload.totalTax;
        }

        // Normalize items so neither .name nor .productName, .qty nor .quantity is ever missing
        invoiceRecord.items = (invoiceRecord.items && invoiceRecord.items.length > 0 ? invoiceRecord.items : (invoicePayload.items || [])).map((it, idx) => {
          const orig = invoicePayload.items?.[idx] || {};
          const itName = it.productName || it.name || orig.name || orig.productName || 'Item';
          const itQty = it.quantity ?? it.qty ?? orig.qty ?? orig.quantity ?? 1;
          const itRate = it.unitPrice ?? it.rate ?? orig.rate ?? orig.unitPrice ?? 0;
          const itTotal = it.lineTotal ?? it.totalAmount ?? orig.totalAmount ?? (itRate * itQty);
          return {
            ...it,
            name: itName,
            productName: itName,
            qty: itQty,
            quantity: itQty,
            rate: itRate,
            unitPrice: itRate,
            totalAmount: itTotal,
            lineTotal: itTotal,
            gstRate: it.gstRate ?? orig.gstRate ?? 0,
          };
        });

        setState((prev) => {
          const invList = prev.invoices || [];
          const exists = invList.some((i) => (i._id || i.id) === invId);
          const nextInvoices = exists
            ? invList.map((i) => ((i._id || i.id) === invId ? { ...i, ...invoiceRecord } : i))
            : [invoiceRecord, ...invList];

          const nextProducts = (prev.products || []).map((p) => {
            const purchasedItem = (backendItems || []).find(
              (it) => String(it.productId) === String(p._id) || String(it.productId) === String(p.id)
            );
            if (purchasedItem && p.stock !== undefined) {
              return { ...p, stock: Math.max(0, p.stock - purchasedItem.quantity) };
            }
            return p;
          });

          return { ...prev, invoices: nextInvoices, products: nextProducts };
        });

        notify(invoicePayload.status === 'Draft' ? 'Draft invoice saved' : 'Tax invoice generated and stock updated');

        // Refresh full state in background without blocking POS checkout UI
        Promise.all([loadPhase1Data(), loadPhase2Data()]).catch((syncErr) =>
          console.warn('Background sync notice:', syncErr.message)
        );

        return invoiceRecord;
      } catch (err) {
        notify(err.message || 'Failed to save sales invoice', 'error');
        throw err;
      }
    },
    [loadPhase1Data, loadPhase2Data, notify, state.warehouses]
  );

  const cancelSalesInvoice = useCallback(
    async (invoiceId, reason = 'Cancelled by user') => {
      const isAuth = Boolean(getToken());
      if (!isAuth) return;

      try {
        await salesInvoiceService.cancelInvoice(invoiceId, reason);
        notify('Invoice cancelled and inventory restored', 'info');
        await Promise.all([loadPhase1Data(), loadPhase2Data()]);
      } catch (err) {
        notify(err.message || 'Failed to cancel invoice', 'error');
        throw err;
      }
    },
    [loadPhase1Data, loadPhase2Data, notify]
  );

  // Record Payment In / Payment Out (Directly with Backend & MongoDB)
  const recordPayment = useCallback(
    async (paymentPayload) => {
      const amount = round2(Number(paymentPayload.amount) || 0);
      if (amount <= 0) {
        notify('Payment amount must be greater than zero', 'error');
        return false;
      }

      const isAuth = Boolean(getToken());
      if (!isAuth) return false;

      try {
        const isIn = paymentPayload.type === 'Payment In';
        const allocations = [];
        if (paymentPayload.invoiceId) {
          if (isIn) {
            allocations.push({ salesInvoiceId: String(paymentPayload.invoiceId), allocatedAmount: amount });
          } else {
            allocations.push({ purchaseBillId: String(paymentPayload.invoiceId), allocatedAmount: amount });
          }
        }

        await paymentService.createPayment({
          direction: isIn ? 'in' : 'out',
          partyId: paymentPayload.partyId ? String(paymentPayload.partyId) : null,
          paymentDate: paymentPayload.date || new Date().toISOString().slice(0, 10),
          amount,
          paymentMethod: paymentPayload.method === 'Cash' ? 'cash' : (paymentPayload.method === 'UPI' ? 'UPI' : 'bank'),
          bankAccountId: paymentPayload.bankAccountId ? String(paymentPayload.bankAccountId) : null,
          referenceNumber: paymentPayload.referenceNo || '',
          notes: paymentPayload.notes || '',
          allocations,
        });

        notify(`${paymentPayload.type} of ₹${amount.toLocaleString('en-IN')} recorded`);
        await Promise.all([loadPhase1Data(), loadPhase2Data()]);
        return true;
      } catch (err) {
        notify(err.message || 'Failed to record payment', 'error');
        return false;
      }
    },
    [loadPhase1Data, loadPhase2Data, notify]
  );

  // Save Purchase Bill + Update Inventory (Directly with Backend & MongoDB)
  const savePurchaseBill = useCallback(
    async (purchasePayload) => {
      const isAuth = Boolean(getToken());
      if (!isAuth) {
        notify('You must be signed in to save purchase bills', 'error');
        return null;
      }

      try {
        const warehouseId =
          purchasePayload.warehouseId ||
          state.warehouses[0]?._id ||
          state.warehouses[0]?.id;

        if (!warehouseId) {
          notify('A warehouse is required for purchases. Please create one in Warehouses master.', 'error');
          return null;
        }

        const supplierId = String(purchasePayload.supplierId);
        const backendItems = (purchasePayload.items || []).map((it) => ({
          productId: String(it.productId || it.id),
          quantity: Number(it.qty || it.quantity || 1),
          unitPrice: Number(it.rate || it.unitPrice || 0),
          discount: Number(it.discountPct || it.discount || 0),
          description: it.description || '',
        }));

        const createPayload = {
          supplierId,
          supplierInvoiceNumber: purchasePayload.supplierInvoiceNo || purchasePayload.supplierInvoiceNumber || `SUP-${Date.now().toString().slice(-4)}`,
          warehouseId: String(warehouseId),
          billDate: purchasePayload.date || new Date().toISOString().slice(0, 10),
          dueDate: purchasePayload.dueDate || null,
          placeOfSupply: purchasePayload.placeOfSupply || state.business.state,
          items: backendItems,
          paidAmount: Number(purchasePayload.amountPaid) || 0,
        };

        let savedBill;
        const isExisting = purchasePayload.id && !purchasePayload.id.startsWith('pur-');
        if (isExisting) {
          savedBill = await purchaseBillService.updatePurchaseBill(purchasePayload.id, createPayload);
        } else {
          savedBill = await purchaseBillService.createPurchaseBill(createPayload);
        }

        const billRecord = savedBill?.bill || savedBill;
        const billId = billRecord._id || billRecord.id;

        if (billRecord.status !== 'posted') {
          const postedRes = await purchaseBillService.postPurchaseBill(billId);
          Object.assign(billRecord, postedRes?.bill || postedRes);
        }

        const remainingBal = billRecord.balanceAmount !== undefined ? billRecord.balanceAmount : (billRecord.outstandingBalance !== undefined ? billRecord.outstandingBalance : 0);
        if (Number(purchasePayload.amountPaid) > 0 && remainingBal > 0) {
          try {
            const payAmt = Math.min(Number(purchasePayload.amountPaid), remainingBal);
            await paymentService.createPayment({
              direction: 'out',
              partyId: supplierId,
              paymentDate: purchasePayload.date || new Date().toISOString().slice(0, 10),
              amount: payAmt,
              paymentMethod: purchasePayload.paymentMethod === 'Cash' ? 'cash' : (purchasePayload.paymentMethod === 'UPI' ? 'UPI' : 'bank'),
              referenceNumber: `BILL-${billRecord.billNumber}`,
              allocations: [{ purchaseBillId: String(billId), allocatedAmount: payAmt }],
            });
          } catch (payErr) {
            console.warn('Initial purchase payment warning:', payErr.message);
          }
        }

        setState((prev) => {
          const billList = prev.purchases || [];
          const exists = billList.some((b) => (b._id || b.id) === billId);
          const nextBills = exists
            ? billList.map((b) => ((b._id || b.id) === billId ? { ...b, ...billRecord } : b))
            : [billRecord, ...billList];

          const nextProducts = (prev.products || []).map((p) => {
            const purItem = (backendItems || []).find(
              (it) => String(it.productId) === String(p._id) || String(it.productId) === String(p.id)
            );
            if (purItem && p.stock !== undefined) {
              return { ...p, stock: (p.stock || 0) + purItem.quantity };
            }
            return p;
          });

          return { ...prev, purchases: nextBills, products: nextProducts };
        });

        notify('Purchase bill saved and inventory stock increased');

        // Background sync to refresh caches without delaying user
        Promise.all([loadPhase1Data(), loadPhase2Data()]).catch((syncErr) =>
          console.warn('Background sync notice:', syncErr.message)
        );

        return billRecord;
      } catch (err) {
        notify(err.message || 'Failed to save purchase bill', 'error');
        throw err;
      }
    },
    [loadPhase1Data, loadPhase2Data, notify, state.business.state, state.warehouses]
  );

  // Sales Return -> Credit Note + optional stock restoration (Directly with Backend & MongoDB)
  const createSalesReturnCreditNote = useCallback(
    async (cnPayload) => {
      const isAuth = Boolean(getToken());
      if (!isAuth) return;

      try {
        const invoice = state.invoices.find((i) => i.id === cnPayload.invoiceId || i._id === cnPayload.invoiceId);
        if (!invoice) {
          notify('Original sales invoice not found', 'error');
          return;
        }

        const returnItems = (cnPayload.items || []).map((retIt) => {
          const invIt = (invoice.items || []).find((i) => String(i.productId?._id || i.productId) === String(retIt.productId));
          return {
            invoiceItemId: String(invIt?._id || invIt?.id || retIt.productId),
            returnedQuantity: Number(retIt.qty || retIt.returnedQuantity || 1),
          };
        });

        const payload = {
          invoiceId: String(invoice._id || invoice.id),
          reason: 'sales_return',
          items: returnItems,
          remarks: cnPayload.reason || 'Sales return',
          restoreStock: cnPayload.restoreStock !== false,
        };

        await creditNoteService.createCreditNote(payload);
        notify('Credit Note issued and stock restored');
        await Promise.all([loadPhase1Data(), loadPhase2Data()]);
      } catch (err) {
        notify(err.message || 'Failed to issue credit note', 'error');
        throw err;
      }
    },
    [loadPhase1Data, loadPhase2Data, notify, state.invoices]
  );

  // Purchase Return -> Reduce Stock (Directly with Backend & MongoDB)
  const createPurchaseReturn = useCallback(
    async (prPayload) => {
      const isAuth = Boolean(getToken());
      if (!isAuth) return;

      try {
        const bill = state.purchases.find((p) => p.id === prPayload.purchaseId || p._id === prPayload.purchaseId);
        if (!bill) {
          notify('Original purchase bill not found', 'error');
          return;
        }

        const returnItems = (prPayload.items || []).map((retIt) => {
          const billIt = (bill.items || []).find((i) => String(i.productId?._id || i.productId) === String(retIt.productId));
          return {
            billItemId: String(billIt?._id || billIt?.id || retIt.productId),
            returnedQuantity: Number(retIt.qty || retIt.returnedQuantity || 1),
          };
        });

        const payload = {
          billId: String(bill._id || bill.id),
          reason: 'purchase_return',
          items: returnItems,
          remarks: prPayload.reason || 'Purchase return',
        };

        const res = await purchaseReturnService.createPurchaseReturn(payload);
        const debitNote = res?.debitNote || res;
        if (debitNote && (debitNote._id || debitNote.id)) {
          await purchaseReturnService.postDebitNote(debitNote._id || debitNote.id);
        }

        notify('Purchase return recorded and stock deducted');
        await Promise.all([loadPhase1Data(), loadPhase2Data()]);
      } catch (err) {
        notify(err.message || 'Failed to record purchase return', 'error');
        throw err;
      }
    },
    [loadPhase1Data, loadPhase2Data, notify, state.purchases]
  );

  // Conversions between Documents
  const convertQuotationToInvoice = useCallback(
    async (quotationId) => {
      try {
        const res = await quotationService.convertQuotationToInvoice(quotationId);
        notify('Quotation converted to draft invoice');
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to convert quotation', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  const convertQuotationToOrder = useCallback(
    async (quotationId) => {
      try {
        const res = await quotationService.convertQuotationToOrder(quotationId);
        notify('Quotation converted to sales order');
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to convert quotation', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  const convertOrderToInvoice = useCallback(
    async (orderId) => {
      try {
        const res = await salesOrderService.convertOrderToInvoice(orderId);
        notify('Sales order converted to draft invoice');
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to convert sales order', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  const convertChallanToInvoice = useCallback(
    async (challanId) => {
      try {
        const res = await deliveryChallanService.convertChallanToInvoice(challanId);
        notify('Delivery challan converted to draft invoice');
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to convert delivery challan', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  // Stock Adjustment / Transfer
  const adjustInventoryStock = useCallback(({ productId, type, qtyChange, warehouseId, notes, reference }) => {
    updateStateWithAudit(
      (prev) => {
        const prod = prev.products.find((p) => p.id === productId);
        if (!prod) return prev;
        const wh = prev.warehouses.find((w) => w.id === (warehouseId || prod.warehouseId));
        const mv = createStockMovementRecord({
          productId,
          productName: prod.name,
          sku: prod.sku,
          warehouseId: wh?.id || 'wh-1',
          warehouseName: wh?.name || 'Jaipur Main Godown',
          type,
          qtyChange: Number(qtyChange),
          reference: reference || `ADJ-${Date.now().toString().slice(-5)}`,
          date: new Date().toISOString().slice(0, 10),
          notes,
        });
        const res = applyProductStockUpdates(prev.products, [mv], prev.stockMovements);
        return {
          ...prev,
          products: res.updatedProducts,
          stockMovements: [...res.addedMovements, ...prev.stockMovements],
        };
      },
      {
        action: `Stock ${type}`,
        module: 'Inventory',
        recordRef: productId,
        prevValue: '—',
        newValue: `Qty delta: ${qtyChange} (${notes || type})`,
      }
    );
    notify(`Stock ${type.toLowerCase()} updated`);
  }, [notify, updateStateWithAudit]);

  // Bank Contra Transfer
  const transferCashBank = useCallback(async ({ fromId, toId, amount, date, notes }) => {
    const amt = round2(Number(amount) || 0);
    if (amt <= 0 || fromId === toId) {
      notify('Select different source and destination accounts with valid amount', 'error');
      return false;
    }

    const isAuth = Boolean(getToken());
    if (isAuth) {
      try {
        const res = await bankTransactionService.transferFunds({
          fromAccountId: String(fromId),
          toAccountId: String(toId),
          amount: amt,
          date: date || new Date().toISOString().slice(0, 10),
          notes: notes || '',
        });
        notify(`Transferred ₹${amt.toLocaleString('en-IN')} between accounts`);
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Transfer failed', 'error');
        throw err;
      }
    }

    updateStateWithAudit(
      (prev) => {
        const fromAcc = prev.bankAccounts.find((a) => a.id === fromId);
        const toAcc = prev.bankAccounts.find((a) => a.id === toId);
        const nextBankAccounts = prev.bankAccounts.map((acc) => {
          if (acc.id === fromId) return { ...acc, balance: round2(acc.balance - amt) };
          if (acc.id === toId) return { ...acc, balance: round2(acc.balance + amt) };
          return acc;
        });
        const jeNo = generateNextDocNumber('CN/26-27/', prev.journalEntries, 'entryNumber');
        const newJE = {
          id: `je-${Date.now()}`,
          entryNumber: jeNo,
          date: date || new Date().toISOString().slice(0, 10),
          voucherType: 'Contra',
          narration: notes || `Contra transfer from ${fromAcc?.name} to ${toAcc?.name}`,
          lines: [
            { accountCode: '1002', accountName: toAcc?.name || 'Destination', debit: amt, credit: 0 },
            { accountCode: '1001', accountName: fromAcc?.name || 'Source', debit: 0, credit: amt },
          ],
        };
        return {
          ...prev,
          bankAccounts: nextBankAccounts,
          journalEntries: [newJE, ...prev.journalEntries],
        };
      },
      {
        action: 'Contra Transfer',
        module: 'Payments',
        recordRef: `${fromId} -> ${toId}`,
        prevValue: '—',
        newValue: `₹${amt}`,
      }
    );
    notify(`Transferred ₹${amt.toLocaleString('en-IN')} between accounts`);
  }, [loadPhase2Data, notify, updateStateWithAudit]);

  // POS Billing directly connected to backend
  const savePosBill = useCallback(
    async (billPayload) => {
      const isAuth = Boolean(getToken());
      if (!isAuth) {
        notify('You must be signed in to submit POS billing', 'error');
        return null;
      }
      try {
        const warehouseId = billPayload.warehouseId || state.warehouses[0]?._id || state.warehouses[0]?.id;
        const res = await posService.createBill({
          ...billPayload,
          warehouseId: String(warehouseId),
          finalize: true,
        });
        notify(`POS Invoice ${res.invoiceNumber} billed successfully`);
        Promise.all([loadPhase1Data(), loadPhase2Data()]).catch((syncErr) =>
          console.warn('Background sync notice:', syncErr.message)
        );
        return res;
      } catch (err) {
        notify(err.message || 'Failed to complete POS billing', 'error');
        throw err;
      }
    },
    [loadPhase1Data, loadPhase2Data, notify, state.warehouses]
  );

  // E-Invoice Generation (Live with Backend /api/e-invoices)
  const generateEInvoice = useCallback(
    async (invoiceOrData) => {
      const isAuth = Boolean(getToken());
      if (!isAuth) {
        notify('You must be signed in to generate e-invoices', 'error');
        return null;
      }
      try {
        const payload = invoiceOrData.salesInvoiceId
          ? invoiceOrData
          : { salesInvoiceId: String(invoiceOrData._id || invoiceOrData.id || invoiceOrData.invoiceId) };
        const res = await eInvoiceService.generateEInvoice(payload);
        notify(`IRN generated successfully: ${res.IRN || ''}`);
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to generate e-invoice', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  const cancelEInvoice = useCallback(
    async (eInvoiceId, cancellationReason = '1', cancellationRemarks = 'Cancelled by user') => {
      const isAuth = Boolean(getToken());
      if (!isAuth) return null;
      try {
        const res = await eInvoiceService.cancelEInvoice(eInvoiceId, {
          cancellationReason: String(cancellationReason),
          cancellationRemarks: String(cancellationRemarks),
        });
        notify('E-Invoice cancelled successfully');
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to cancel e-invoice', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  // E-Way Bill Generation (Live with Backend /api/e-way-bills)
  const generateEWayBill = useCallback(
    async (ewbPayload) => {
      const isAuth = Boolean(getToken());
      if (!isAuth) {
        notify('You must be signed in to generate e-way bills', 'error');
        return null;
      }
      try {
        const res = await eWayBillService.generateEWayBill(ewbPayload);
        notify(`E-Way Bill generated successfully: ${res.eWayBillNumber || res.ewbNumber || ''}`);
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to generate e-way bill', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  const cancelEWayBill = useCallback(
    async (ewbId, cancellationReason = '1', cancellationRemarks = 'Cancelled by user') => {
      const isAuth = Boolean(getToken());
      if (!isAuth) return null;
      try {
        const res = await eWayBillService.cancelEWayBill(ewbId, {
          cancellationReason: String(cancellationReason),
          cancellationRemarks: String(cancellationRemarks),
        });
        notify('E-Way Bill cancelled successfully');
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to cancel e-way bill', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  // Journal Entry Posting (Live with Backend /api/accounting/journal-entries)
  const postJournalEntry = useCallback(
    async (entryData) => {
      const isAuth = Boolean(getToken());
      if (!isAuth) {
        notify('You must be signed in to post journal entries', 'error');
        return null;
      }
      try {
        const res = await accountingService.createJournalEntry(entryData);
        notify(`Journal entry ${res.entryNumber || ''} posted successfully`);
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to post journal entry', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  const reverseJournalEntry = useCallback(
    async (id, data = {}) => {
      const isAuth = Boolean(getToken());
      if (!isAuth) return null;
      try {
        const res = await accountingService.reverseJournalEntry(id, data);
        notify('Journal entry reversed successfully');
        await loadPhase2Data();
        return res;
      } catch (err) {
        notify(err.message || 'Failed to reverse journal entry', 'error');
        throw err;
      }
    },
    [loadPhase2Data, notify]
  );

  // Legacy simulated aliases pointing directly to live API handlers
  const generateDemoIRN = generateEInvoice;
  const generateDemoEWayBill = generateEWayBill;

  const updateBusinessAndSettings = useCallback(
    async (businessPatch, settingsPatch) => {
      const isAuth = Boolean(getToken());

      if (isAuth && businessPatch) {
        try {
          const tenantPayload = {
            businessName: businessPatch.businessName,
            businessType: businessPatch.businessType,
            ownerName: businessPatch.ownerName,
            email: businessPatch.email,
            phone: businessPatch.phone,
            GSTIN: businessPatch.GSTIN || businessPatch.gstin || null,
            PAN: businessPatch.PAN || businessPatch.pan || null,
            businessAddress: businessPatch.businessAddress || businessPatch.address || '',
            city: businessPatch.city || '',
            state: businessPatch.state || '',
            pincode: businessPatch.pincode || '',
          };
          const updatedTenant = await tenantService.updateTenantProfile(tenantPayload);
          setState((prev) => ({
            ...prev,
            currentTenant: { ...prev.currentTenant, ...updatedTenant },
            business: {
              ...prev.business,
              ...updatedTenant,
              businessName: updatedTenant.businessName || prev.business?.businessName,
            },
          }));
        } catch (err) {
          notify(err.message || 'Failed to update organization profile on server', 'error');
        }
      }

      updateStateWithAudit(
        (prev) => ({
          ...prev,
          business: businessPatch ? { ...prev.business, ...businessPatch } : prev.business,
          settings: settingsPatch ? { ...prev.settings, ...settingsPatch } : prev.settings,
        }),
        {
          action: 'Updated Settings',
          module: 'Settings',
          recordRef: 'Workspace Config',
          prevValue: 'Previous preferences',
          newValue: 'Saved changes',
        }
      );
      notify('Settings saved successfully');
    },
    [notify, updateStateWithAudit]
  );

  const updateSuperAdmin = useCallback((updater, msg = 'Platform record updated') => {
    setState((prev) => ({
      ...prev,
      superAdmin: typeof updater === 'function' ? updater(prev.superAdmin) : updater,
    }));
    notify(msg);
  }, [notify]);

  const value = {
    state,
    setState,
    selectedFY,
    setSelectedFY,
    toasts,
    notify,
    dismissToast,
    confirmState,
    confirmAction,
    authLoading,
    phase1Loading,
    phase2Loading,
    loadPhase1Data,
    refreshPhase1Data: loadPhase1Data,
    loadPhase2Data,
    refreshPhase2Data: loadPhase2Data,
    convertQuotationToInvoice,
    convertQuotationToOrder,
    convertOrderToInvoice,
    convertChallanToInvoice,
    login,
    register,
    loginUser: login,
    registerUser: register,
    logout,
    refreshProfile,
    completeOnboarding,
    handleResetDemo,
    upsertRecord,
    deleteRecord,
    saveSalesInvoice,
    cancelSalesInvoice,
    recordPayment,
    savePurchaseBill,
    createSalesReturnCreditNote,
    createPurchaseReturn,
    adjustInventoryStock,
    transferCashBank,
    savePosBill,
    generateEInvoice,
    cancelEInvoice,
    generateEWayBill,
    cancelEWayBill,
    postJournalEntry,
    reverseJournalEntry,
    generateDemoIRN,
    generateDemoEWayBill,
    updateBusinessAndSettings,
    updateSuperAdmin,
    loadSuperAdminData,
    updateStateWithAudit,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAuth = () => {
  const ctx = useApp();
  return {
    isAuthenticated: ctx.state.isAuthenticated,
    user: ctx.state.currentUser,
    tenant: ctx.state.currentTenant,
    business: ctx.state.business,
    authLoading: ctx.authLoading,
    login: ctx.login,
    register: ctx.register,
    logout: ctx.logout,
    refreshProfile: ctx.refreshProfile,
  };
};
