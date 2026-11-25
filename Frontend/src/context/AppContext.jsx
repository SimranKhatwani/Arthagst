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
import * as authService from '../services/authService';
import { getToken, setToken, removeToken } from '../services/api';
import * as partyService from '../services/partyService';
import * as categoryService from '../services/categoryService';
import * as unitService from '../services/unitService';
import * as productService from '../services/productService';
import * as warehouseService from '../services/warehouseService';
import * as tenantService from '../services/tenantService';

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
      const [partiesRes, categoriesRes, unitsRes, productsRes, warehousesRes, profileRes] =
        await Promise.allSettled([
          partyService.getParties({ limit: 100 }),
          categoryService.getCategories({ limit: 100 }),
          unitService.getUnits({ limit: 100 }),
          productService.getProducts({ limit: 100 }),
          warehouseService.getWarehouses({ limit: 100 }),
          tenantService.getTenantProfile(),
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
              hsn: p.HSN || p.hsn,
              minStock: p.lowStockAlert !== undefined ? p.lowStockAlert : p.minStock,
              stock: p.openingStock !== undefined ? p.openingStock : (p.stock || 0),
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

        return next;
      });
    } catch (err) {
      console.warn('Phase 1 data load failed:', err);
    } finally {
      setPhase1Loading(false);
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
          loadPhase1Data();
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
        if (isMounted) setAuthLoading(false);
      });

    return () => {
      isMounted = false;
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
      setAuthLoading(true);
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
        setAuthLoading(false);
        notify(`Welcome back, ${data.user?.name || 'Administrator'}!`);
        // Immediately fetch live tenant Phase 1 master data from MongoDB
        loadPhase1Data();
        return data;
      } catch (err) {
        setAuthLoading(false);
        throw err;
      }
    },
    [loadPhase1Data, notify]
  );

  const register = useCallback(
    async (payload) => {
      setAuthLoading(true);
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
        setAuthLoading(false);
        notify(`Business account created for ${data.tenant.businessName}!`);
        loadPhase1Data();
        return data;
      } catch (err) {
        setAuthLoading(false);
        throw err;
      }
    },
    [loadPhase1Data, notify]
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
    }));
    notify('Signed out successfully');
  }, [notify]);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await authService.getMe();
      if (data?.user && data?.tenant) {
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
          },
        }));
        loadPhase1Data();
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
      }));
      throw err;
    }
  }, [loadPhase1Data]);

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
              String(u.id || u._id) === String(record.unitId) ||
              u.shortName === record.unit ||
              u.name === record.unit
          );
          const catObj = (state.categories || []).find(
            (c) =>
              String(c.id || c._id) === String(record.categoryId) ||
              c.name === record.category
          );

          if (!unitObj?._id && !unitObj?.id && !record.unitId) {
            throw new Error('Please create at least one Measurement Unit before adding products');
          }

          const payload = {
            name: record.name,
            productType: record.productType || 'goods',
            categoryId: catObj ? (catObj._id || catObj.id) : record.categoryId || null,
            unitId: unitObj ? (unitObj._id || unitObj.id) : record.unitId,
            SKU: (record.SKU || record.sku || '').toUpperCase(),
            barcode: record.barcode || null,
            description: record.description || '',
            HSN: record.HSN || record.hsn || null,
            SAC: record.SAC || record.sac || null,
            gstRate: Number(record.gstRate) || 0,
            cessRate: Number(record.cessRate) || 0,
            purchasePrice: Number(record.purchasePrice) || 0,
            sellingPrice: Number(record.sellingPrice) || 0,
            mrp: Number(record.mrp) || 0,
            openingStock: Number(record.openingStock) || 0,
            lowStockAlert: Number(record.minStock || record.lowStockAlert) || 0,
            trackInventory: record.trackInventory !== false,
            isActive: record.isActive !== false && !record.archived,
          };

          const saved = isEdit
            ? await productService.updateProduct(id, payload)
            : await productService.createProduct(payload);

          const enriched = {
            ...saved,
            category: catObj?.name || record.category || 'General',
            unit: unitObj?.shortName || record.unit || 'PCS',
            sku: saved.SKU || record.sku,
            hsn: saved.HSN || record.hsn,
            stock: saved.openingStock !== undefined ? saved.openingStock : (record.stock || 0),
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
            isDefault: Boolean(record.isDefault),
            isActive: record.isActive !== false,
          };
          const saved = isEdit
            ? await warehouseService.updateWarehouse(id, payload)
            : await warehouseService.createWarehouse(payload);

          const enriched = {
            ...saved,
            name: saved.warehouseName || record.name,
            code: saved.warehouseCode || record.code,
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
      }

      // In-memory / Prototype state for other non-Phase-1 modules
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
    [notify, state, updateStateWithAudit]
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
    [notify, updateStateWithAudit]
  );

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
    loadPhase1Data,
    refreshPhase1Data: loadPhase1Data,
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
    generateDemoIRN,
    generateDemoEWayBill,
    updateBusinessAndSettings,
    updateSuperAdmin,
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
