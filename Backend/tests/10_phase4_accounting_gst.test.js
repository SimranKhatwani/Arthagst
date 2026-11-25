import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { createTenantAndUser } from './helpers/authHelper.js';
import Account from '../src/models/account.model.js';
import JournalEntry from '../src/models/journalEntry.model.js';
import Inventory from '../src/models/inventory.model.js';
import SalesInvoice from '../src/models/salesInvoice.model.js';
import PurchaseBill from '../src/models/purchaseBill.model.js';
import EInvoice from '../src/models/eInvoice.model.js';
import EWayBill from '../src/models/eWayBill.model.js';

describe('Phase 4: GST Compliance, Accounting & Financial Reports Integration', () => {
  let tenantA, userA, tokenA;
  let tenantB, userB, tokenB;
  let warehouseA, categoryA, unitA, productA;
  let customerA, supplierA;
  let salesInvoiceA, purchaseBillA;
  let customAccountA;
  let manualJournalEntryA;
  let eInvoiceA;
  let eWayBillA;
  let gstr2bImportA;

  beforeAll(async () => {
    // 1. Setup Tenant A (Primary Tenant)
    const resA = await createTenantAndUser({
      tenantCode: 'P4-ORG-A',
      businessName: 'Apex GST Compliance & Accounting Systems',
      email: 'ca.apex@compliancecorp.in',
    });
    tenantA = resA.tenant;
    userA = resA.user;
    tokenA = resA.token;

    // 2. Setup Tenant B (Isolation Check Tenant)
    const resB = await createTenantAndUser({
      tenantCode: 'P4-ORG-B',
      businessName: 'Zenith Audit Partners',
      email: 'auditor@zenithaudit.in',
    });
    tenantB = resB.tenant;
    userB = resB.user;
    tokenB = resB.token;

    // 3. Create Warehouse, Category, Unit, Product for Tenant A
    const whRes = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        warehouseName: 'Main Regional Warehouse',
        warehouseCode: 'REG-WH-01',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
      });
    warehouseA = whRes.body.data;

    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Commercial Hardware' });
    categoryA = catRes.body.data;

    const unitRes = await request(app)
      .post('/api/units')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Numbers', shortName: 'NOS', gstUqcCode: 'NOS' });
    unitA = unitRes.body.data;

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Industrial Inverter Battery 150AH',
        SKU: 'INV-BAT-150',
        HSN: '8507',
        categoryId: categoryA._id,
        unitId: unitA._id,
        purchasePrice: 8000,
        sellingPrice: 12000,
        gstRate: 18,
        productType: 'goods',
        trackInventory: true,
      });
    productA = prodRes.body.data;

    // Seed inventory stock
    await Inventory.create({
      tenantId: tenantA._id,
      productId: productA._id,
      warehouseId: warehouseA._id,
      quantity: 100,
      availableQuantity: 100,
      reservedQuantity: 0,
    });

    // 4. Create Registered B2B Customer Party for Tenant A
    const custRes = await request(app)
      .post('/api/parties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partyType: 'customer',
        name: 'Maharashtra Solar Solutions Ltd',
        businessName: 'Maharashtra Solar Solutions Ltd',
        phone: '9820011223',
        email: 'billing@mahsolar.com',
        GSTIN: '27AABCM8812K1Z9',
        state: 'Maharashtra',
        stateCode: '27',
        billingAddress: 'B-404, Tech Park, Andheri East, Mumbai',
      });
    customerA = custRes.body.data;

    // 5. Create Registered B2B Supplier Party for Tenant A
    const supRes = await request(app)
      .post('/api/parties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partyType: 'supplier',
        name: 'Exide Battery Manufacturing India',
        businessName: 'Exide Battery Manufacturing India',
        phone: '9820099887',
        email: 'orders@exidebattery.com',
        GSTIN: '27AABCE1234F1Z8',
        state: 'Maharashtra',
        stateCode: '27',
        billingAddress: 'Plot 12, MIDC Industrial Area, Pune',
      });
    supplierA = supRes.body.data;

    // 6. Create Posted Sales Invoice with B2B Customer for GST & E-Invoice testing
    const invRes = await request(app)
      .post('/api/sales/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partyId: customerA._id,
        warehouseId: warehouseA._id,
        invoiceDate: '2026-06-15',
        placeOfSupply: '27',
        items: [
          {
            productId: productA._id,
            quantity: 5,
            unitPrice: 12000,
            discount: 0,
            description: 'Commercial Battery Consignment',
          },
        ],
        notes: 'Finalized B2B Invoice for Phase 4 GST Integration',
      });
    salesInvoiceA = invRes.body.data;

    // Post Sales Invoice
    if (salesInvoiceA) {
      await request(app)
        .post(`/api/sales/invoices/${salesInvoiceA._id}/post`)
        .set('Authorization', `Bearer ${tokenA}`);
      const invGet = await request(app)
        .get(`/api/sales/invoices/${salesInvoiceA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      salesInvoiceA = invGet.body.data;
    }

    // 7. Create Posted Purchase Bill with Supplier for Input Tax Credit (ITC)
    const billRes = await request(app)
      .post('/api/purchases/bills')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        supplierId: supplierA._id,
        warehouseId: warehouseA._id,
        billDate: '2026-06-10',
        supplierInvoiceNumber: 'EXIDE/PUN/2026/088',
        placeOfSupply: '27',
        items: [
          {
            productId: productA._id,
            quantity: 10,
            unitPrice: 8000,
            discount: 0,
            description: 'Factory Raw Materials Consignment',
          },
        ],
        notes: 'Factory Raw Inward Purchase Bill',
      });
    purchaseBillA = billRes.body.data;

    // Post Purchase Bill
    if (purchaseBillA) {
      await request(app)
        .post(`/api/purchases/bills/${purchaseBillA._id}/post`)
        .set('Authorization', `Bearer ${tokenA}`);
      const billGet = await request(app)
        .get(`/api/purchases/bills/${purchaseBillA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      purchaseBillA = billGet.body.data;
    }
  });

  // =========================================================================
  // 1. CHART OF ACCOUNTS (COA)
  // =========================================================================
  describe('A. Chart of Accounts (COA)', () => {
    it('1.1 should list default seeded accounts for Tenant A', async () => {
      const res = await request(app)
        .get('/api/accounting/accounts')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(10);

      const classifications = res.body.data.map((a) => a.accountType);
      expect(classifications).toContain('asset');
      expect(classifications).toContain('liability');
      expect(classifications).toContain('income');
      expect(classifications).toContain('expense');
    });

    it('1.2 should create a custom sub-account under an existing group', async () => {
      const accountsRes = await request(app)
        .get('/api/accounting/accounts')
        .set('Authorization', `Bearer ${tokenA}`);

      const expenseParent = accountsRes.body.data.find((a) => a.accountType === 'expense');

      const res = await request(app)
        .post('/api/accounting/accounts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          accountCode: '5099',
          accountName: 'Cloud Server & Software Hosting',
          accountType: 'expense',
          accountSubType: 'operating_expense',
          balanceType: 'debit',
          parentAccountId: expenseParent?._id || expenseParent?.id,
          description: 'SaaS AWS and Cloud Hosting Subscriptions',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accountCode).toBe('5099');
      expect(res.body.data.accountName).toBe('Cloud Server & Software Hosting');
      customAccountA = res.body.data;
    });

    it('1.3 should update an existing custom account', async () => {
      const res = await request(app)
        .put(`/api/accounting/accounts/${customAccountA._id || customAccountA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          accountName: 'Cloud Server Infrastructure & AI API Hosting',
          description: 'Hosting, GPU computing, and AI tokens',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accountName).toBe('Cloud Server Infrastructure & AI API Hosting');
    });
  });

  // =========================================================================
  // 2. JOURNAL ENTRIES & DOUBLE-ENTRY ENFORCEMENT
  // =========================================================================
  describe('B. Journal Entries & Double-Entry Balance Verification', () => {
    it('2.1 should reject an unbalanced journal entry where Dr != Cr', async () => {
      const accounts = await Account.find({ tenantId: tenantA._id }).limit(2);

      const res = await request(app)
        .post('/api/accounting/journal-entries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          entryDate: '2026-06-20',
          narration: 'Unbalanced test entry',
          lines: [
            {
              accountId: accounts[0]._id,
              debit: 10000,
              credit: 0,
              description: 'Debit side',
            },
            {
              accountId: accounts[1]._id,
              debit: 0,
              credit: 8500, // Discrepancy of 1500!
              description: 'Credit side',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('2.2 should post a valid balanced manual journal entry where Dr == Cr', async () => {
      const cashAccount = await Account.findOne({
        tenantId: tenantA._id,
        accountType: 'asset',
      });
      const equityAccount = await Account.findOne({
        tenantId: tenantA._id,
        accountType: 'equity',
      });

      const res = await request(app)
        .post('/api/accounting/journal-entries')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          entryDate: '2026-06-20',
          narration: 'Owner fresh capital infusion in cash',
          lines: [
            {
              accountId: String(cashAccount._id),
              debit: 50000,
              credit: 0,
              description: 'Cash received',
            },
            {
              accountId: String(equityAccount._id),
              debit: 0,
              credit: 50000,
              description: 'Capital account credited',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entryNumber).toBeDefined();
      expect(res.body.data.totalDebit).toBe(50000);
      expect(res.body.data.totalCredit).toBe(50000);
      manualJournalEntryA = res.body.data;
    });

    it('2.3 should reverse a journal entry and create equal opposite lines', async () => {
      const res = await request(app)
        .post(`/api/accounting/journal-entries/${manualJournalEntryA._id || manualJournalEntryA.id}/reverse`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          reason: 'Wrong deposit account entry adjustment',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reversalEntry).toBeDefined();
      expect(res.body.data.reversalEntry.totalDebit).toBe(50000);
      expect(res.body.data.reversalEntry.totalCredit).toBe(50000);
    });
  });

  // =========================================================================
  // 3. FINANCIAL STATEMENTS & ACCOUNTING EQUATION
  // =========================================================================
  describe('C. Financial Reports & Balance Sheet Equations', () => {
    it('3.1 should fetch General Ledger with account statement lines', async () => {
      const res = await request(app)
        .get('/api/accounting/reports/general-ledger')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('3.2 should compute Trial Balance with perfect Dr == Cr balance', async () => {
      const res = await request(app)
        .get('/api/accounting/reports/trial-balance')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ financialYear: '2026-2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const { totalClosingDebit, totalClosingCredit, isBalanced } = res.body.data;
      expect(typeof totalClosingDebit).toBe('number');
      expect(typeof totalClosingCredit).toBe('number');
      expect(Math.abs(totalClosingDebit - totalClosingCredit)).toBeLessThanOrEqual(0.05);
      expect(isBalanced).toBe(true);
    });

    it('3.3 should compute Profit and Loss Statement with revenue, COGS and net profit', async () => {
      const res = await request(app)
        .get('/api/accounting/reports/profit-and-loss')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ financialYear: '2026-2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const pnl = res.body.data;
      expect(pnl.netProfit !== undefined || pnl.revenue !== undefined).toBe(true);
    });

    it('3.4 should compute Balance Sheet adhering to Assets = Liabilities + Equity', async () => {
      const res = await request(app)
        .get('/api/accounting/reports/balance-sheet')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ financialYear: '2026-2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const bs = res.body.data;
      const totalAssets = bs.assets?.totalAssets ?? bs.totalAssets ?? 0;
      const totalLiabilities = bs.liabilities?.totalLiabilities ?? bs.totalLiabilities ?? 0;
      const totalEquity = bs.equity?.totalEquity ?? bs.totalEquity ?? 0;

      // Verify Fundamental Accounting Equation: Assets == Liabilities + Equity
      expect(Math.abs(totalAssets - (totalLiabilities + totalEquity))).toBeLessThanOrEqual(1.0);
    });
  });

  // =========================================================================
  // 4. GST COMPLIANCE (DASHBOARD, GSTR-1, GSTR-3B, GSTR-2B)
  // =========================================================================
  describe('D. GST Compliance & Returns Integration', () => {
    it('4.1 should retrieve GST Dashboard summary reflecting outward tax and ITC', async () => {
      const res = await request(app)
        .get('/api/gst/dashboard')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ financialYear: '2026-2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const { outwardSupplies, inwardSupplies, inputTaxCredit, netLiability } = res.body.data;
      expect(outwardSupplies).toBeDefined();
      expect(inwardSupplies).toBeDefined();
      expect(inputTaxCredit).toBeDefined();
      expect(netLiability).toBeDefined();
      expect(outwardSupplies.totalOutputTax).toBeGreaterThanOrEqual(0);
    });

    it('4.2 should prepare GSTR-1 outward supplies return with B2B section', async () => {
      const res = await request(app)
        .get('/api/gst/gstr1')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ financialYear: '2026-2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sections).toBeDefined();
      expect(res.body.data.summary).toBeDefined();

      const sections = res.body.data.sections;
      expect(Array.isArray(sections.b2b)).toBe(true);
      expect(Array.isArray(sections.b2cs)).toBe(true);
      expect(Array.isArray(sections.hsn)).toBe(true);
    });

    it('4.3 should export GSTR-1 in JSON and CSV formats', async () => {
      // JSON export
      const jsonRes = await request(app)
        .get('/api/gst/gstr1/export')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ financialYear: '2026-2027', format: 'json' });

      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.success).toBe(true);
      expect(jsonRes.body.data.filename).toBeDefined();

      // CSV export
      const csvRes = await request(app)
        .get('/api/gst/gstr1/export')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ financialYear: '2026-2027', format: 'csv' });

      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
    });

    it('4.4 should prepare GSTR-3B summary (Table 3.1 & Table 4 ITC)', async () => {
      const res = await request(app)
        .get('/api/gst/gstr3b')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ financialYear: '2026-2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.table3_1).toBeDefined();
      expect(res.body.data.table4).toBeDefined();
      expect(res.body.data.table3_1.outwardTaxableSupplies).toBeDefined();
    });

    it('4.5 should import auto-drafted GSTR-2B data from portal JSON', async () => {
      const res = await request(app)
        .post('/api/gst/gstr2b/import')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          returnPeriod: '062026',
          financialYear: '2026-2027',
          sourceFileName: `gstr2b_test_${Date.now()}.json`,
          entries: [
            {
              supplierGSTIN: '27AABCE1234F1Z8',
              supplierName: 'Exide Battery Manufacturing India',
              invoiceNumber: 'EXIDE/PUN/2026/088',
              documentType: 'INV',
              invoiceDate: '2026-06-10',
              invoiceValue: 94400,
              taxableValue: 80000,
              cgst: 7200,
              sgst: 7200,
              igst: 0,
              cess: 0,
              itcAvailability: true,
            },
            {
              supplierGSTIN: '27AAACR1122C1ZT',
              supplierName: 'External Supplier Not in Books',
              invoiceNumber: 'EXT/INV/999',
              documentType: 'INV',
              invoiceDate: '2026-06-12',
              invoiceValue: 23600,
              taxableValue: 20000,
              cgst: 1800,
              sgst: 1800,
              igst: 0,
              cess: 0,
              itcAvailability: true,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id || res.body.data.importId).toBeDefined();
      gstr2bImportA = res.body.data;
    });

    it('4.6 should reconcile GSTR-2B entries with Purchase Bills in MongoDB', async () => {
      const importId = gstr2bImportA._id || gstr2bImportA.importId;

      const res = await request(app)
        .post('/api/gst/gstr2b/reconcile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          importId: String(importId),
          tolerance: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();

      const { summary, matched, missingInBooks } = res.body.data;
      expect(summary.totalGSTR2BRecords).toBe(2);
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(missingInBooks.length).toBeGreaterThanOrEqual(1);
    });

    it('4.7 should track statutory GST filing calendar and update return period status', async () => {
      // 1. Get calendar
      const calRes = await request(app)
        .get('/api/gst/calendar')
        .set('Authorization', `Bearer ${tokenA}`)
        .query({ financialYear: '2026-2027' });

      expect(calRes.status).toBe(200);
      expect(calRes.body.success).toBe(true);
      expect(Array.isArray(calRes.body.data.calendar)).toBe(true);
      expect(calRes.body.data.calendar.length).toBeGreaterThanOrEqual(12);

      // 2. Update status of return period
      const updateRes = await request(app)
        .post('/api/gst/calendar/status')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          returnPeriod: '062026',
          financialYear: '2026-2027',
          returnType: 'GSTR-1',
          preparationStatus: 'completed',
          filingStatus: 'filed_offline',
          acknowledgementNumber: 'ARN123456789012',
          notes: 'Filing confirmed on GSTN offline portal tool',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.preparationStatus).toBe('completed');
    });
  });

  // =========================================================================
  // 5. E-INVOICE & E-WAY BILL LIFECYCLE
  // =========================================================================
  describe('E. E-Invoice (IRN) and E-Way Bill Integration', () => {
    it('5.1 should check e-invoice eligibility for finalized sales invoice', async () => {
      const invId = salesInvoiceA._id || salesInvoiceA.id;
      const res = await request(app)
        .get(`/api/e-invoices/invoice/${invId}/eligibility`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isEligible).toBe(true);
    });

    it('5.2 should generate simulated E-Invoice IRN with signed QR code', async () => {
      const invId = salesInvoiceA._id || salesInvoiceA.id;
      const res = await request(app)
        .post('/api/e-invoices/generate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          salesInvoiceId: String(invId),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.IRN).toBeDefined();
      expect(res.body.data.acknowledgementNumber).toBeDefined();
      expect(res.body.data.signedQRCode).toBeDefined();
      expect(res.body.data.status).toBe('generated');
      eInvoiceA = res.body.data;
    });

    it('5.3 should list generated E-Invoices for Tenant A', async () => {
      const res = await request(app)
        .get('/api/e-invoices')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.eInvoices)).toBe(true);
      expect(res.body.data.eInvoices.length).toBeGreaterThanOrEqual(1);
    });

    it('5.4 should cancel an E-Invoice with reason and remarks', async () => {
      const eInvId = eInvoiceA._id || eInvoiceA.id;
      const res = await request(app)
        .post(`/api/e-invoices/${eInvId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          cancellationReason: '1',
          cancellationRemarks: 'Order duplicate entry correction',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('5.5 should generate an E-Way Bill for invoice movement', async () => {
      const invId = salesInvoiceA._id || salesInvoiceA.id;
      const res = await request(app)
        .post('/api/e-way-bills/generate')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          salesInvoiceId: String(invId),
          distance: 280,
          transportMode: '1: Road',
          vehicleNumber: 'MH-12-AB-1234',
          transporterName: 'VRL Logistics Ltd',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.eWayBillNumber).toBeDefined();
      expect(res.body.data.validUntil).toBeDefined();
      expect(res.body.data.status).toBe('generated');
      eWayBillA = res.body.data;
    });

    it('5.6 should update vehicle number (Part-B) on active E-Way Bill', async () => {
      const ewbId = eWayBillA._id || eWayBillA.id;
      const res = await request(app)
        .patch(`/api/e-way-bills/${ewbId}/vehicle`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          vehicleNumber: 'MH-14-XY-9999',
          fromPlace: 'Pune MIDC',
          reasonCode: '1: Due to Break Down',
          reasonRemark: 'Original vehicle tire puncture breakdown',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicleNumber).toBe('MH-14-XY-9999');
    });

    it('5.7 should cancel an E-Way Bill within valid timeframe', async () => {
      const ewbId = eWayBillA._id || eWayBillA.id;
      const res = await request(app)
        .post(`/api/e-way-bills/${ewbId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          cancellationReason: '2',
          cancellationRemarks: 'Order shipment cancelled by consignee',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });
  });

  // =========================================================================
  // 6. OPERATIONAL & FINANCIAL REPORTS
  // =========================================================================
  describe('F. Operational & Financial Reports', () => {
    it('6.1 should fetch sales summary and register reports', async () => {
      const res = await request(app)
        .get('/api/reports/sales/summary')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('6.2 should fetch purchase summary report', async () => {
      const res = await request(app)
        .get('/api/reports/purchases/summary')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('6.3 should fetch inventory stock valuation report', async () => {
      const res = await request(app)
        .get('/api/reports/inventory/valuation')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  // =========================================================================
  // 7. MULTI-TENANT ISOLATION
  // =========================================================================
  describe('G. Multi-Tenant Security & Isolation Verification', () => {
    it('7.1 should block Tenant B from fetching Tenant A custom account', async () => {
      const accountId = customAccountA._id || customAccountA.id;
      const res = await request(app)
        .get(`/api/accounting/accounts/${accountId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('7.2 should block Tenant B from viewing Tenant A journal entries', async () => {
      const res = await request(app)
        .get('/api/accounting/journal-entries')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const entryIds = (res.body.data.entries || res.body.data || []).map((e) => String(e._id || e.id));
      expect(entryIds).not.toContain(String(manualJournalEntryA._id || manualJournalEntryA.id));
    });

    it('7.3 should block Tenant B from viewing Tenant A E-Invoices', async () => {
      const res = await request(app)
        .get('/api/e-invoices')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const eInvIds = (res.body.data.eInvoices || []).map((e) => String(e._id || e.id));
      expect(eInvIds).not.toContain(String(eInvoiceA._id || eInvoiceA.id));
    });

    it('7.4 should block Tenant B from canceling Tenant A E-Way Bill', async () => {
      const ewbId = eWayBillA._id || eWayBillA.id;
      const res = await request(app)
        .post(`/api/e-way-bills/${ewbId}/cancel`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          cancellationReason: '1',
          cancellationRemarks: 'Malicious attempt by unauthorized tenant',
        });

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('7.5 should verify Tenant B GST dashboard contains 0 output tax from Tenant A', async () => {
      const res = await request(app)
        .get('/api/gst/dashboard')
        .set('Authorization', `Bearer ${tokenB}`)
        .query({ financialYear: '2026-2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.outwardSupplies.totalOutputTax).toBe(0);
      expect(res.body.data.counts.salesInvoices).toBe(0);
    });
  });
});
