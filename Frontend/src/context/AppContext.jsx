import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loadAppState,
  saveAppState,
  resetDemoData,
} from '../services/storageService';
import {
  applyProductStockUpdates,
  createStockMovementRecord,
} from '../services/inventoryService';
import { computePaymentStatus, generateNextDocNumber } from '../services/invoiceService';
import { round2 } from '../services/calculationService';

const AppContext = createContext(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

export const AppProvider = ({ children }) => {
  const [state, setState] = useState(() => loadAppState());
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [selectedFY, setSelectedFY] = useState(state.business?.financialYear || '2026-27');

  useEffect(() => {
    saveAppState(state);
  }, [state]);

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

  // Auth & Onboarding
  const loginDemo = useCallback((userEmail) => {
    setState((prev) => {
      const matched =
        prev.users.find((u) => u.email.toLowerCase() === String(userEmail || '').toLowerCase()) ||
        prev.users[0];
      return { ...prev, isAuthenticated: true, currentUser: matched };
    });
    notify('Signed in to Sharma Traders (Demo Workspace)');
  }, [notify]);

  const registerUser = useCallback((payload) => {
    const newUser = {
      id: `usr-${Date.now()}`,
      name: payload.ownerName,
      email: payload.email,
      mobile: payload.mobile,
      role: 'Owner',
      status: 'Active',
      lastLogin: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    setState((prev) => ({
      ...prev,
      isAuthenticated: true,
      onboardingCompleted: false,
      currentUser: newUser,
      users: [newUser, ...prev.users],
    }));
    notify('Account created. Complete business setup.');
  }, [notify]);

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

  const logout = useCallback(() => {
    setState((prev) => ({ ...prev, isAuthenticated: false }));
  }, []);

  // Reset Demo Data
  const handleResetDemo = useCallback(() => {
    const fresh = resetDemoData();
    setState(fresh);
    setSelectedFY(fresh.business.financialYear);
    notify('Demo dataset restored to initial state');
  }, [notify]);

  // Generic Master CRUD (Customers, Suppliers, Products, Categories, Units, Warehouses, Users, Expenses)
  const upsertRecord = useCallback((collectionKey, record, auditModule, labelField = 'name') => {
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
  }, [notify, state, updateStateWithAudit]);

  const deleteRecord = useCallback((collectionKey, id, auditModule, label) => {
    updateStateWithAudit(
      (prev) => ({
        ...prev,
        [collectionKey]: (prev[collectionKey] || []).filter((item) => item.id !== id),
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
  }, [notify, updateStateWithAudit]);

  // Save or Finalize Sales Invoice
  const saveSalesInvoice = useCallback((invoicePayload, paymentDetails = null) => {
    const paymentList = Array.isArray(paymentDetails)
      ? paymentDetails.filter((p) => Number(p?.amount) > 0)
      : paymentDetails && Number(paymentDetails.amount) > 0
      ? [paymentDetails]
      : [];
    const totalPaidInput = round2(paymentList.reduce((s, p) => s + Number(p.amount), 0));
    const amountPaid =
      totalPaidInput > 0 ? Math.min(invoicePayload.grandTotal, totalPaidInput) : Number(invoicePayload.amountPaid) || 0;
    const status = invoicePayload.status || 'Finalized';
    const paymentStatus =
      status === 'Draft'
        ? 'Draft'
        : status === 'Cancelled'
        ? 'Cancelled'
        : computePaymentStatus(invoicePayload.grandTotal, amountPaid);

    const invId = invoicePayload.id || `inv-${Date.now()}`;
    const invNumber =
      invoicePayload.invoiceNumber ||
      generateNextDocNumber(state.settings.invoice.prefix, state.invoices, 'invoiceNumber');

    const savedInv = {
      ...invoicePayload,
      id: invId,
      invoiceNumber: invNumber,
      status,
      amountPaid: status === 'Draft' ? 0 : amountPaid,
      paymentStatus,
    };

    updateStateWithAudit(
      (prev) => {
        const isExisting = prev.invoices.some((i) => i.id === savedInv.id);
        const nextInvoices = isExisting
          ? prev.invoices.map((i) => (i.id === savedInv.id ? savedInv : i))
          : [savedInv, ...prev.invoices];

        let nextProducts = prev.products;
        let nextMovements = prev.stockMovements;
        let nextPayments = prev.payments;
        let nextBankAccounts = prev.bankAccounts;
        let nextNotifications = prev.notifications;

        if (status === 'Finalized') {
          const movements = (savedInv.items || [])
            .filter((it) => it.productId)
            .map((it) => {
              const p = prev.products.find((pr) => pr.id === it.productId);
              return createStockMovementRecord({
                productId: it.productId,
                productName: it.name,
                sku: it.sku || p?.sku || '',
                warehouseId: p?.warehouseId || 'wh-1',
                warehouseName: prev.warehouses.find((w) => w.id === (p?.warehouseId || 'wh-1'))?.name || 'Jaipur Main Godown',
                type: 'Sale',
                qtyChange: -Math.abs(Number(it.qty) || 0),
                reference: savedInv.invoiceNumber,
                date: savedInv.date,
                notes: `Invoiced to ${savedInv.customerName}`,
              });
            });

          const stockRes = applyProductStockUpdates(prev.products, movements, prev.stockMovements);
          nextProducts = stockRes.updatedProducts;
          nextMovements = [...stockRes.addedMovements, ...prev.stockMovements];

          // Low stock alert generation
          stockRes.addedMovements.forEach((mv) => {
            const updatedProd = nextProducts.find((p) => p.id === mv.productId);
            if (updatedProd && updatedProd.stock <= (updatedProd.minStock || 5)) {
              const notifExists = nextNotifications.some(
                (n) => n.title.includes(updatedProd.name) && !n.read
              );
              if (!notifExists) {
                nextNotifications = [
                  {
                    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    category: 'Low Stock',
                    title: `${updatedProd.stock <= 0 ? 'Out of Stock' : 'Low Stock Alert'}: ${updatedProd.name}`,
                    message: `Remaining stock is ${updatedProd.stock} ${updatedProd.unit} after invoice ${savedInv.invoiceNumber}.`,
                    date: savedInv.date,
                    read: false,
                  },
                  ...nextNotifications,
                ];
              }
            }
          });

          if (paymentList.length > 0) {
            let existingReceipts = prev.payments.filter((p) => p.type === 'Payment In');
            const newPayRecords = [];

            paymentList.forEach((pItem, idx) => {
              const amt = round2(Number(pItem.amount));
              const payNo = generateNextDocNumber('RCPT/26-27/', [...newPayRecords, ...existingReceipts], 'paymentNumber');
              const targetAccountName =
                pItem.method === 'Cash'
                  ? 'Petty Cash Counter'
                  : pItem.method === 'UPI'
                  ? 'Business UPI Wallet'
                  : 'HDFC Bank Current A/c';

              newPayRecords.push({
                id: `pay-in-${Date.now()}-${idx}`,
                paymentNumber: payNo,
                type: 'Payment In',
                date: savedInv.date,
                partyId: savedInv.customerId,
                partyName: savedInv.customerName,
                invoiceId: savedInv.id,
                invoiceNumber: savedInv.invoiceNumber,
                amount: amt,
                method: pItem.method || 'UPI',
                accountName: targetAccountName,
                referenceNo: pItem.referenceNo || `REF-${Date.now().toString().slice(-6)}-${idx + 1}`,
                status: 'Completed',
                notes: `Initial payment for ${savedInv.invoiceNumber}`,
              });

              nextBankAccounts = nextBankAccounts.map((acc) =>
                acc.name === targetAccountName
                  ? { ...acc, balance: round2(acc.balance + amt) }
                  : acc
              );
            });

            nextPayments = [...newPayRecords, ...prev.payments];
          }
        }

        return {
          ...prev,
          invoices: nextInvoices,
          products: nextProducts,
          stockMovements: nextMovements,
          payments: nextPayments,
          bankAccounts: nextBankAccounts,
          notifications: nextNotifications,
        };
      },
      {
        action: status === 'Draft' ? 'Saved Draft Invoice' : 'Generated Tax Invoice',
        module: 'Sales',
        recordRef: savedInv.invoiceNumber,
        prevValue: '—',
        newValue: `${savedInv.customerName} · ₹${savedInv.grandTotal}`,
      }
    );
    notify(status === 'Draft' ? 'Draft invoice saved' : 'Tax invoice generated and stock updated');
    return savedInv;
  }, [notify, state.invoices, state.settings.invoice.prefix, updateStateWithAudit]);

  const cancelSalesInvoice = useCallback((invoiceId, reason = 'Cancelled by user') => {
    updateStateWithAudit(
      (prev) => {
        const inv = prev.invoices.find((i) => i.id === invoiceId);
        if (!inv || inv.status === 'Cancelled') return prev;

        const nextInvoices = prev.invoices.map((i) =>
          i.id === invoiceId
            ? { ...i, status: 'Cancelled', paymentStatus: 'Cancelled', cancelReason: reason }
            : i
        );

        let nextProducts = prev.products;
        let nextMovements = prev.stockMovements;
        if (inv.status === 'Finalized') {
          const movements = (inv.items || [])
            .filter((it) => it.productId)
            .map((it) =>
              createStockMovementRecord({
                productId: it.productId,
                productName: it.name,
                sku: it.sku || '',
                type: 'Return In',
                qtyChange: Math.abs(Number(it.qty) || 0),
                reference: `${inv.invoiceNumber}-CXL`,
                date: new Date().toISOString().slice(0, 10),
                notes: `Stock restored on invoice cancellation: ${reason}`,
              })
            );
          const res = applyProductStockUpdates(prev.products, movements, prev.stockMovements);
          nextProducts = res.updatedProducts;
          nextMovements = [...res.addedMovements, ...prev.stockMovements];
        }

        return {
          ...prev,
          invoices: nextInvoices,
          products: nextProducts,
          stockMovements: nextMovements,
        };
      },
      {
        action: 'Cancelled Invoice',
        module: 'Sales',
        recordRef: invoiceId,
        prevValue: 'Finalized',
        newValue: `Cancelled (${reason})`,
      }
    );
    notify('Invoice cancelled and inventory restored', 'info');
  }, [notify, updateStateWithAudit]);

  // Record Payment In / Payment Out
  const recordPayment = useCallback((paymentPayload) => {
    const amount = round2(Number(paymentPayload.amount) || 0);
    if (amount <= 0) {
      notify('Payment amount must be greater than zero', 'error');
      return false;
    }

    // Prevent exact duplicate reference submission within same invoice
    const dup = state.payments.find(
      (p) =>
        p.invoiceId === paymentPayload.invoiceId &&
        p.referenceNo &&
        paymentPayload.referenceNo &&
        p.referenceNo.toLowerCase() === paymentPayload.referenceNo.toLowerCase() &&
        Math.abs(p.amount - amount) < 0.01
    );
    if (dup) {
      notify('Duplicate payment reference detected for this invoice', 'error');
      return false;
    }

    const isIn = paymentPayload.type === 'Payment In';

    updateStateWithAudit(
      (prev) => {
        const prefix = isIn ? 'RCPT/26-27/' : 'PYMT/26-27/';
        const payNumber = generateNextDocNumber(
          prefix,
          prev.payments.filter((p) => p.type === paymentPayload.type),
          'paymentNumber'
        );

        const targetAccName =
          paymentPayload.accountName ||
          (paymentPayload.method === 'Cash'
            ? 'Petty Cash Counter'
            : paymentPayload.method === 'UPI'
            ? 'Business UPI Wallet'
            : 'HDFC Bank Current A/c');

        const newPay = {
          id: `pay-${Date.now()}`,
          paymentNumber: payNumber,
          ...paymentPayload,
          amount,
          accountName: targetAccName,
          status: 'Completed',
        };

        let nextInvoices = prev.invoices;
        let nextPurchases = prev.purchases;

        if (isIn && paymentPayload.invoiceId) {
          nextInvoices = prev.invoices.map((inv) => {
            if (inv.id !== paymentPayload.invoiceId) return inv;
            const nextPaid = round2((Number(inv.amountPaid) || 0) + amount);
            return {
              ...inv,
              amountPaid: Math.min(inv.grandTotal, nextPaid),
              paymentStatus: computePaymentStatus(inv.grandTotal, nextPaid),
            };
          });
        } else if (!isIn && paymentPayload.invoiceId) {
          nextPurchases = prev.purchases.map((pur) => {
            if (pur.id !== paymentPayload.invoiceId) return pur;
            const nextPaid = round2((Number(pur.amountPaid) || 0) + amount);
            return {
              ...pur,
              amountPaid: Math.min(pur.grandTotal, nextPaid),
              paymentStatus: computePaymentStatus(pur.grandTotal, nextPaid),
            };
          });
        }

        const nextBankAccounts = prev.bankAccounts.map((acc) => {
          if (acc.name !== targetAccName) return acc;
          return {
            ...acc,
            balance: round2(isIn ? acc.balance + amount : acc.balance - amount),
          };
        });

        return {
          ...prev,
          payments: [newPay, ...prev.payments],
          invoices: nextInvoices,
          purchases: nextPurchases,
          bankAccounts: nextBankAccounts,
        };
      },
      {
        action: `Recorded ${paymentPayload.type}`,
        module: 'Payments',
        recordRef: paymentPayload.invoiceNumber || paymentPayload.partyName,
        prevValue: 'Pending',
        newValue: `${paymentPayload.method} · ₹${amount}`,
      }
    );

    notify(`${paymentPayload.type} of ₹${amount.toLocaleString('en-IN')} recorded`);
    return true;
  }, [notify, state.payments, updateStateWithAudit]);

  // Save Purchase Bill + Update Inventory
  const savePurchaseBill = useCallback((purchasePayload) => {
    updateStateWithAudit(
      (prev) => {
        const billNumber =
          purchasePayload.billNumber ||
          generateNextDocNumber('PB/26-27/', prev.purchases, 'billNumber');
        const newPurchase = {
          ...purchasePayload,
          id: purchasePayload.id || `pur-${Date.now()}`,
          billNumber,
          status: 'Received',
          paymentStatus: computePaymentStatus(purchasePayload.grandTotal, purchasePayload.amountPaid || 0),
        };

        const movements = (newPurchase.items || [])
          .filter((it) => it.productId)
          .map((it) => {
            const prod = prev.products.find((p) => p.id === it.productId);
            return createStockMovementRecord({
              productId: it.productId,
              productName: it.name,
              sku: it.sku || prod?.sku || '',
              warehouseId: prod?.warehouseId || 'wh-1',
              warehouseName: prev.warehouses.find((w) => w.id === (prod?.warehouseId || 'wh-1'))?.name || 'Jaipur Main Godown',
              type: 'Purchase',
              qtyChange: Math.abs(Number(it.qty) || 0),
              reference: billNumber,
              date: newPurchase.date,
              notes: `Purchased from ${newPurchase.supplierName}`,
            });
          });

        const stockRes = applyProductStockUpdates(prev.products, movements, prev.stockMovements);

        let nextPayments = prev.payments;
        let nextBankAccounts = prev.bankAccounts;
        if (Number(newPurchase.amountPaid) > 0) {
          const payNo = generateNextDocNumber('PYMT/26-27/', prev.payments.filter((p) => p.type === 'Payment Out'), 'paymentNumber');
          nextPayments = [
            {
              id: `pay-out-${Date.now()}`,
              paymentNumber: payNo,
              type: 'Payment Out',
              date: newPurchase.date,
              partyId: newPurchase.supplierId,
              partyName: newPurchase.supplierName,
              invoiceId: newPurchase.id,
              invoiceNumber: billNumber,
              amount: round2(newPurchase.amountPaid),
              method: newPurchase.paymentMethod || 'NEFT',
              accountName: 'HDFC Bank Current A/c',
              referenceNo: `NEFT-${Date.now().toString().slice(-6)}`,
              status: 'Completed',
              notes: `Purchase payment for ${newPurchase.supplierInvoiceNo}`,
            },
            ...prev.payments,
          ];
          nextBankAccounts = prev.bankAccounts.map((acc) =>
            acc.name === 'HDFC Bank Current A/c'
              ? { ...acc, balance: round2(acc.balance - Number(newPurchase.amountPaid)) }
              : acc
          );
        }

        return {
          ...prev,
          purchases: [newPurchase, ...prev.purchases],
          products: stockRes.updatedProducts,
          stockMovements: [...stockRes.addedMovements, ...prev.stockMovements],
          payments: nextPayments,
          bankAccounts: nextBankAccounts,
        };
      },
      {
        action: 'Created Purchase Bill',
        module: 'Purchases',
        recordRef: purchasePayload.supplierInvoiceNo || 'New Purchase',
        prevValue: '—',
        newValue: `${purchasePayload.supplierName} · ₹${purchasePayload.grandTotal}`,
      }
    );
    notify('Purchase bill saved and inventory stock increased');
  }, [notify, updateStateWithAudit]);

  // Sales Return -> Credit Note + optional stock restoration
  const createSalesReturnCreditNote = useCallback((cnPayload) => {
    updateStateWithAudit(
      (prev) => {
        const creditNoteNumber = generateNextDocNumber('CN/26-27/', prev.creditNotes, 'creditNoteNumber');
        const newCN = {
          ...cnPayload,
          id: `cn-${Date.now()}`,
          creditNoteNumber,
          status: 'Issued',
        };

        let nextProducts = prev.products;
        let nextMovements = prev.stockMovements;
        if (cnPayload.restoreStock) {
          const movements = (cnPayload.items || []).map((it) =>
            createStockMovementRecord({
              productId: it.productId,
              productName: it.name,
              sku: it.sku || '',
              type: 'Return In',
              qtyChange: Math.abs(Number(it.qty) || 0),
              reference: creditNoteNumber,
              date: cnPayload.date,
              notes: `Sales return from ${cnPayload.customerName}`,
            })
          );
          const res = applyProductStockUpdates(prev.products, movements, prev.stockMovements);
          nextProducts = res.updatedProducts;
          nextMovements = [...res.addedMovements, ...prev.stockMovements];
        }

        return {
          ...prev,
          creditNotes: [newCN, ...prev.creditNotes],
          products: nextProducts,
          stockMovements: nextMovements,
        };
      },
      {
        action: 'Issued Credit Note',
        module: 'Sales Returns',
        recordRef: cnPayload.invoiceNumber,
        prevValue: '—',
        newValue: `₹${cnPayload.grandTotal} (${cnPayload.restoreStock ? 'Stock Restored' : 'Financial Adj'})`,
      }
    );
    notify('Credit Note issued successfully');
  }, [notify, updateStateWithAudit]);

  // Purchase Return -> Reduce Stock
  const createPurchaseReturn = useCallback((prPayload) => {
    updateStateWithAudit(
      (prev) => {
        const returnNumber = generateNextDocNumber('PR/26-27/', prev.purchaseReturns, 'returnNumber');
        const newPR = { ...prPayload, id: `pr-${Date.now()}`, returnNumber, status: 'Completed' };
        const movements = (prPayload.items || []).map((it) =>
          createStockMovementRecord({
            productId: it.productId,
            productName: it.name,
            sku: it.sku || '',
            type: 'Return Out',
            qtyChange: -Math.abs(Number(it.qty) || 0),
            reference: returnNumber,
            date: prPayload.date,
            notes: `Returned to ${prPayload.supplierName}`,
          })
        );
        const res = applyProductStockUpdates(prev.products, movements, prev.stockMovements);
        return {
          ...prev,
          purchaseReturns: [newPR, ...prev.purchaseReturns],
          products: res.updatedProducts,
          stockMovements: [...res.addedMovements, ...prev.stockMovements],
        };
      },
      {
        action: 'Created Purchase Return',
        module: 'Purchases',
        recordRef: prPayload.billNumber,
        prevValue: '—',
        newValue: `₹${prPayload.grandTotal}`,
      }
    );
    notify('Purchase return recorded and stock deducted');
  }, [notify, updateStateWithAudit]);

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
  const transferCashBank = useCallback(({ fromId, toId, amount, date, notes }) => {
    const amt = round2(Number(amount) || 0);
    if (amt <= 0 || fromId === toId) {
      notify('Select different source and destination accounts with valid amount', 'error');
      return;
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
  }, [notify, updateStateWithAudit]);

  // Simulated Demo E-Invoice IRN & E-Way Bill
  const generateDemoIRN = useCallback((invoice) => {
    const hash = Math.random().toString(16).slice(2, 18) + Date.now().toString(16);
    const record = {
      id: `einv-${Date.now()}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      gstin: invoice.customerGstin || 'URP',
      grandTotal: invoice.grandTotal,
      irn: `DEMO-IRN-${hash}`,
      ackNo: `DEMO-ACK-${Date.now().toString().slice(-10)}`,
      ackDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: 'Generated (Demo)',
      qrPayload: `DEMO-EINV|08AABCS1234F1Z5|${invoice.invoiceNumber}|${invoice.grandTotal}`,
    };
    updateStateWithAudit(
      (prev) => ({ ...prev, eInvoices: [record, ...prev.eInvoices] }),
      {
        action: 'Generated Demo IRN',
        module: 'E-Invoice',
        recordRef: invoice.invoiceNumber,
        prevValue: 'Pending',
        newValue: record.irn.slice(0, 22),
      }
    );
    notify('Simulated Demo IRN generated (Not an official IRP filing)');
    return record;
  }, [notify, updateStateWithAudit]);

  const generateDemoEWayBill = useCallback((payload) => {
    const record = {
      id: `ewb-${Date.now()}`,
      ewbNumber: `DEMO-EWB-${Math.floor(741000000000 + Math.random() * 99999999)}`,
      ...payload,
      generatedDate: new Date().toISOString().slice(0, 10),
      status: 'Active (Demo)',
    };
    updateStateWithAudit(
      (prev) => ({ ...prev, eWayBills: [record, ...prev.eWayBills] }),
      {
        action: 'Generated Demo E-Way Bill',
        module: 'E-Way Bill',
        recordRef: payload.invoiceNumber,
        prevValue: '—',
        newValue: record.ewbNumber,
      }
    );
    notify('Simulated Demo E-Way Bill created');
    return record;
  }, [notify, updateStateWithAudit]);

  const updateBusinessAndSettings = useCallback((businessPatch, settingsPatch) => {
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
    notify('Settings saved to local workspace');
  }, [notify, updateStateWithAudit]);

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
    loginDemo,
    registerUser,
    completeOnboarding,
    logout,
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
    generateDemoIRN,
    generateDemoEWayBill,
    updateBusinessAndSettings,
    updateSuperAdmin,
    updateStateWithAudit,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
