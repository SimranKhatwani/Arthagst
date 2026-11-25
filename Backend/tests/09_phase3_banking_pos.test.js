import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { createTenantAndUser } from './helpers/authHelper.js';
import Inventory from '../src/models/inventory.model.js';
import BankAccount from '../src/models/bankAccount.model.js';
import BankTransaction from '../src/models/bankTransaction.model.js';
import Payment from '../src/models/payment.model.js';
import Expense from '../src/models/expense.model.js';
import SalesInvoice from '../src/models/salesInvoice.model.js';
import PurchaseBill from '../src/models/purchaseBill.model.js';

describe('Phase 3: Banking, Payments, Expenses & POS Integration', () => {
  let tenantA, userA, tokenA;
  let tenantB, userB, tokenB;
  let warehouseA, categoryA, unitA;
  let productA;
  let customerA, supplierA;
  let bankAccount1, bankAccount2;
  let salesInvoiceA, purchaseBillA;
  let expenseCategoryA;

  beforeAll(async () => {
    // 1. Setup Tenant A
    const resA = await createTenantAndUser({
      tenantCode: 'P3-ORG-A',
      businessName: 'Apex Financial Services & Retail Ltd',
      email: 'finance.admin@apexretail.com',
    });
    tenantA = resA.tenant;
    userA = resA.user;
    tokenA = resA.token;

    // 2. Setup Tenant B (for multi-tenant isolation tests)
    const resB = await createTenantAndUser({
      tenantCode: 'P3-ORG-B',
      businessName: 'Zenith Rival Retailers',
      email: 'owner@zenithretail.com',
    });
    tenantB = resB.tenant;
    userB = resB.user;
    tokenB = resB.token;

    // 3. Create Warehouse for Tenant A
    const whRes = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        warehouseName: 'Central POS Depot',
        warehouseCode: 'POS-DEPOT-01',
        city: 'Jaipur',
        state: 'Rajasthan',
        stateCode: '08',
      });
    warehouseA = whRes.body.data;

    // 4. Create Category and Unit for Tenant A
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Electronic Appliances' });
    categoryA = catRes.body.data;

    const unitRes = await request(app)
      .post('/api/units')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Piece', shortName: 'PCS', gstUqcCode: 'PCS' });
    unitA = unitRes.body.data;

    // 5. Create Customer Party for Tenant A
    const custRes = await request(app)
      .post('/api/parties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partyType: 'customer',
        name: 'Sharma Tech Shoppe',
        businessName: 'Sharma Tech Shoppe',
        phone: '9829012345',
        email: 'sharma@techshoppe.com',
        GSTIN: '08AAAAA0000A1Z5',
        state: 'Rajasthan',
        stateCode: '08',
        billingAddress: '55 MI Road, Jaipur',
      });
    customerA = custRes.body.data;

    // 6. Create Supplier Party for Tenant A
    const supRes = await request(app)
      .post('/api/parties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partyType: 'supplier',
        name: 'National Component Hub',
        businessName: 'National Component Hub',
        phone: '9811098765',
        email: 'supply@nationalhub.com',
        GSTIN: '08BBBBB1111B1Z2',
        state: 'Rajasthan',
        stateCode: '08',
        billingAddress: '12 Industrial Area, Jaipur',
      });
    supplierA = supRes.body.data;

    // 7. Create Product for Tenant A
    const p1Res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Smart WiFi Switch 16A',
        SKU: 'WIFI-SW-16A',
        barcode: '8901234567890',
        categoryId: categoryA._id,
        unitId: unitA._id,
        sellingPrice: 1000,
        purchasePrice: 600,
        gstRate: 18,
        productType: 'goods',
        trackInventory: true,
      });
    productA = p1Res.body.data;

    // Seed initial inventory stock for testing sales & POS deductions
    await Inventory.create({
      tenantId: tenantA._id,
      productId: productA._id,
      warehouseId: warehouseA._id,
      quantity: 100,
      availableQuantity: 100,
      reservedQuantity: 0,
    });

    // 8. Create and Post a Sales Invoice for Tenant A (for Payment In testing)
    const invRes = await request(app)
      .post('/api/sales/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partyId: customerA._id,
        warehouseId: warehouseA._id,
        invoiceDate: '2026-11-20',
        items: [
          {
            productId: productA._id,
            quantity: 5,
            unitPrice: 1000,
          },
        ],
      });
    salesInvoiceA = invRes.body.data;
    await request(app)
      .post(`/api/sales/invoices/${salesInvoiceA._id}/post`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Refresh sales invoice
    const invGetRes = await request(app)
      .get(`/api/sales/invoices/${salesInvoiceA._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    salesInvoiceA = invGetRes.body.data;

    // 9. Create and Post a Purchase Bill for Tenant A (for Payment Out testing)
    const billRes = await request(app)
      .post('/api/purchases/bills')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        supplierId: supplierA._id,
        warehouseId: warehouseA._id,
        billDate: '2026-11-21',
        supplierInvoiceNumber: 'SUP-INV-9901',
        items: [
          {
            productId: productA._id,
            quantity: 10,
            unitPrice: 600,
          },
        ],
      });
    purchaseBillA = billRes.body.data;
    await request(app)
      .post(`/api/purchases/bills/${purchaseBillA._id}/post`)
      .set('Authorization', `Bearer ${tokenA}`);

    // Refresh purchase bill
    const billGetRes = await request(app)
      .get(`/api/purchases/bills/${purchaseBillA._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    purchaseBillA = billGetRes.body.data;
  });

  // =========================================================================
  // MODULE 1: BANK ACCOUNTS
  // =========================================================================
  describe('1. Bank Accounts CRUD & Balances', () => {
    it('should create a bank account with opening balance', async () => {
      const res = await request(app)
        .post('/api/banking/accounts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          accountName: 'HDFC Current Account',
          accountType: 'bank',
          bankName: 'HDFC Bank',
          accountHolderName: 'Apex Financial Services Ltd',
          accountNumber: '50200012345678',
          IFSC: 'HDFC0001234',
          openingBalance: 50000,
          isDefault: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accountName).toBe('HDFC Current Account');
      expect(res.body.data.currentBalance).toBe(50000);
      expect(res.body.data.openingBalance).toBe(50000);
      bankAccount1 = res.body.data;
    });

    it('should create a second cash account', async () => {
      const res = await request(app)
        .post('/api/banking/accounts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          accountName: 'Main Cash Register',
          accountType: 'cash',
          openingBalance: 10000,
          isDefault: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accountName).toBe('Main Cash Register');
      expect(res.body.data.currentBalance).toBe(10000);
      bankAccount2 = res.body.data;
    });

    it('should list all bank accounts with pagination', async () => {
      const res = await request(app)
        .get('/api/banking/accounts')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.accounts)).toBe(true);
      expect(res.body.data.accounts.length).toBeGreaterThanOrEqual(2);
    });

    it('should retrieve bank account details by ID', async () => {
      const res = await request(app)
        .get(`/api/banking/accounts/${bankAccount1._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(bankAccount1._id);
      expect(res.body.data.bankName).toBe('HDFC Bank');
    });

    it('should update bank account details', async () => {
      const res = await request(app)
        .put(`/api/banking/accounts/${bankAccount1._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          accountHolderName: 'Apex Financial Services & Retail Ltd',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accountHolderName).toBe('Apex Financial Services & Retail Ltd');
    });

    it('should update bank account status (activate/deactivate)', async () => {
      const res = await request(app)
        .patch(`/api/banking/accounts/${bankAccount2._id}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);

      // Re-activate for further tests
      await request(app)
        .patch(`/api/banking/accounts/${bankAccount2._id}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ isActive: true });
    });
  });

  // =========================================================================
  // MODULE 2: BANK TRANSACTIONS & TRANSFERS
  // =========================================================================
  describe('2. Bank Transactions & Contra Transfers', () => {
    it('should record a deposit transaction and increase account balance', async () => {
      const res = await request(app)
        .post('/api/banking/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          bankAccountId: bankAccount1._id,
          transactionType: 'deposit',
          amount: 5000,
          description: 'Client cash deposit at counter',
          referenceNumber: 'DEP-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe(5000);
      expect(res.body.data.transaction.transactionType).toBe('deposit');
      expect(res.body.data.transaction.balanceAfter).toBe(55000);

      // Verify account balance updated
      const acc = await BankAccount.findById(bankAccount1._id);
      expect(acc.currentBalance).toBe(55000);
    });

    it('should record a withdrawal transaction and decrease account balance', async () => {
      const res = await request(app)
        .post('/api/banking/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          bankAccountId: bankAccount1._id,
          transactionType: 'withdrawal',
          amount: 2000,
          description: 'Office petty cash replenishment',
          referenceNumber: 'WTH-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.amount).toBe(2000);
      expect(res.body.data.transaction.transactionType).toBe('withdrawal');
      expect(res.body.data.transaction.balanceAfter).toBe(53000);

      const acc = await BankAccount.findById(bankAccount1._id);
      expect(acc.currentBalance).toBe(53000);
    });

    it('should execute a contra transfer between accounts atomically', async () => {
      // Transfer ₹5,000 from bankAccount1 (current: 53,000) to bankAccount2 (current: 10,000)
      const res = await request(app)
        .post('/api/banking/transfers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          fromAccountId: bankAccount1._id,
          toAccountId: bankAccount2._id,
          amount: 5000,
          notes: 'Bank to Cash Register transfer',
          referenceNumber: 'CONTRA-001',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transferAmount).toBe(5000);
      expect(res.body.data.fromAccount).toBeDefined();
      expect(res.body.data.toAccount).toBeDefined();
      expect(res.body.data.outwardTransactionId).toBeDefined();
      expect(res.body.data.inwardTransactionId).toBeDefined();

      // Check balances in DB
      const acc1 = await BankAccount.findById(bankAccount1._id);
      const acc2 = await BankAccount.findById(bankAccount2._id);
      expect(acc1.currentBalance).toBe(48000);
      expect(acc2.currentBalance).toBe(15000);
    });

    it('should query bank transactions history with filters', async () => {
      const res = await request(app)
        .get('/api/banking/transactions')
        .query({ bankAccountId: bankAccount1._id })
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.transactions)).toBe(true);
      expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(3);
    });
  });

  // =========================================================================
  // MODULE 3: PAYMENT IN (CUSTOMER PAYMENTS)
  // =========================================================================
  describe('3. Payment In – Customer Payments & Invoice Linking', () => {
    it('should record a customer payment linked to invoice and decrease invoice balance', async () => {
      const invoiceTotal = salesInvoiceA.grandTotal; // 5900 (5 * 1000 + 18% GST)
      const payAmt = 3000;

      const bankAccBefore = await BankAccount.findById(bankAccount1._id);

      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          direction: 'in',
          partyId: customerA._id,
          paymentDate: '2026-11-22',
          amount: payAmt,
          paymentMethod: 'UPI',
          bankAccountId: bankAccount1._id,
          referenceNumber: 'UPI-REC-001',
          notes: `Advance receipt for ${salesInvoiceA.invoiceNumber}`,
          allocations: [
            {
              salesInvoiceId: salesInvoiceA._id,
              allocatedAmount: payAmt,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(payAmt);
      expect(res.body.data.direction).toBe('in');
      expect(res.body.data.unallocatedAmount).toBe(0);

      // Verify sales invoice balance updated
      const updatedInv = await SalesInvoice.findById(salesInvoiceA._id);
      expect(updatedInv.paidAmount).toBe(payAmt);
      expect(updatedInv.balanceAmount).toBe(invoiceTotal - payAmt);
      expect(updatedInv.paymentStatus).toBe('partially_paid');

      // Verify bank account balance increased
      const bankAccAfter = await BankAccount.findById(bankAccount1._id);
      expect(bankAccAfter.currentBalance).toBe(bankAccBefore.currentBalance + payAmt);
    });

    it('should list customer payments with direction=in filter', async () => {
      const res = await request(app)
        .get('/api/payments')
        .query({ direction: 'in' })
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.payments)).toBe(true);
      expect(res.body.data.payments.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.payments[0].direction).toBe('in');
    });
  });

  // =========================================================================
  // MODULE 4: PAYMENT OUT (SUPPLIER PAYMENTS)
  // =========================================================================
  describe('4. Payment Out – Supplier Payments & Bill Linking', () => {
    it('should record a supplier payment linked to purchase bill and decrease bill balance', async () => {
      const billTotal = purchaseBillA.grandTotal; // 7080 (10 * 600 + 18% GST)
      const payAmt = 4000;

      const bankAccBefore = await BankAccount.findById(bankAccount1._id);

      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          direction: 'out',
          partyId: supplierA._id,
          paymentDate: '2026-11-23',
          amount: payAmt,
          paymentMethod: 'bank',
          bankAccountId: bankAccount1._id,
          referenceNumber: 'NEFT-OUT-001',
          notes: `Vendor payment for ${purchaseBillA.billNumber}`,
          allocations: [
            {
              purchaseBillId: purchaseBillA._id,
              allocatedAmount: payAmt,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(payAmt);
      expect(res.body.data.direction).toBe('out');

      // Verify purchase bill balance updated
      const updatedBill = await PurchaseBill.findById(purchaseBillA._id);
      expect(updatedBill.paidAmount).toBe(payAmt);
      expect(updatedBill.balanceAmount).toBe(billTotal - payAmt);
      expect(updatedBill.paymentStatus).toBe('partially_paid');

      // Verify bank account balance decreased
      const bankAccAfter = await BankAccount.findById(bankAccount1._id);
      expect(bankAccAfter.currentBalance).toBe(bankAccBefore.currentBalance - payAmt);
    });

    it('should list supplier payments with direction=out filter', async () => {
      const res = await request(app)
        .get('/api/payments')
        .query({ direction: 'out' })
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.payments)).toBe(true);
      expect(res.body.data.payments.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.payments[0].direction).toBe('out');
    });
  });

  // =========================================================================
  // MODULE 5: PAYMENT ALLOCATION ENGINE
  // =========================================================================
  describe('5. Payment Allocation Engine', () => {
    let unallocatedPayment;

    it('should record an on-account unallocated payment', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          direction: 'in',
          partyId: customerA._id,
          paymentDate: '2026-11-24',
          amount: 2500,
          paymentMethod: 'UPI',
          bankAccountId: bankAccount1._id,
          referenceNumber: 'UPI-ADV-002',
          notes: 'General advance deposit',
          allocations: [],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unallocatedAmount).toBe(2500);
      unallocatedPayment = res.body.data;
    });

    it('should allocate unallocated amount to outstanding sales invoice', async () => {
      const allocAmt = 1500;
      const res = await request(app)
        .post(`/api/payments/${unallocatedPayment._id}/allocate`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          allocations: [
            {
              salesInvoiceId: salesInvoiceA._id,
              allocatedAmount: allocAmt,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unallocatedAmount).toBe(1000); // 2500 - 1500

      // Verify invoice paidAmount updated further
      const updatedInv = await SalesInvoice.findById(salesInvoiceA._id);
      expect(updatedInv.paidAmount).toBe(4500); // 3000 + 1500
    });

    it('should reject allocation exceeding unallocated payment amount', async () => {
      // Remaining unallocated is 1000; attempting to allocate 5000 should fail
      const res = await request(app)
        .post(`/api/payments/${unallocatedPayment._id}/allocate`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          allocations: [
            {
              salesInvoiceId: salesInvoiceA._id,
              allocatedAmount: 5000,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // MODULE 6: EXPENSES
  // =========================================================================
  describe('6. Expenses Management & Bank Balance Updates', () => {
    let expenseRecord;

    it('should create an expense category', async () => {
      const res = await request(app)
        .post('/api/expenses/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Office Broadband & Utilities',
          description: 'High-speed internet and telecom utility bills',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Office Broadband & Utilities');
      expenseCategoryA = res.body.data;
    });

    it('should create an expense with GST and deduct bank balance', async () => {
      const bankBefore = await BankAccount.findById(bankAccount1._id);
      const taxable = 2000;
      const gstRate = 18;
      const total = 2360; // 2000 + 360 GST

      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          categoryId: expenseCategoryA._id,
          expenseDate: '2026-11-23',
          amount: total,
          isGSTApplicable: true,
          taxableAmount: taxable,
          gstRate,
          isITCClaimable: true,
          paymentMethod: 'bank',
          bankAccountId: bankAccount1._id,
          payeeName: 'Airtel Broadband Ltd',
          notes: 'High-speed fiber bill November 2026',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(total);
      expect(res.body.data.taxableAmount).toBe(taxable);
      expect(res.body.data.cgst).toBe(180);
      expect(res.body.data.sgst).toBe(180);
      expenseRecord = res.body.data;

      // Verify bank account was deducted
      const bankAfter = await BankAccount.findById(bankAccount1._id);
      expect(bankAfter.currentBalance).toBe(bankBefore.currentBalance - total);
    });

    it('should retrieve expense details by ID', async () => {
      const res = await request(app)
        .get(`/api/expenses/${expenseRecord._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(expenseRecord._id);
      expect(res.body.data.payeeName).toBe('Airtel Broadband Ltd');
    });

    it('should update an expense and adjust bank balance accordingly', async () => {
      const bankBefore = await BankAccount.findById(bankAccount1._id);
      // Change expense total from 2360 to 2950 (diff: +590)
      const res = await request(app)
        .put(`/api/expenses/${expenseRecord._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          categoryId: expenseCategoryA._id,
          amount: 2950,
          isGSTApplicable: true,
          taxableAmount: 2500,
          gstRate: 18,
          payeeName: 'Airtel Enterprise Fiber',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(2950);
      expect(res.body.data.payeeName).toBe('Airtel Enterprise Fiber');

      // Verify bank account adjusted by the difference (2950 - 2360 = 590 deducted)
      const bankAfter = await BankAccount.findById(bankAccount1._id);
      expect(bankAfter.currentBalance).toBe(bankBefore.currentBalance - 590);
    });

    it('should cancel/delete an expense and restore bank balance', async () => {
      const bankBefore = await BankAccount.findById(bankAccount1._id);

      const res = await request(app)
        .delete(`/api/expenses/${expenseRecord._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify bank account restored by 2950
      const bankAfter = await BankAccount.findById(bankAccount1._id);
      expect(bankAfter.currentBalance).toBe(bankBefore.currentBalance + 2950);
    });
  });

  // =========================================================================
  // MODULE 7: POS BILLING
  // =========================================================================
  describe('7. POS Retail Billing & Inventory Deductions', () => {
    let posBill;

    it('should fetch POS product catalog with stock status', async () => {
      const res = await request(app)
        .get('/api/pos/products')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((p) => p._id === productA._id);
      expect(found).toBeDefined();
    });

    it('should create and finalize POS bill, deducting inventory and recording payment', async () => {
      const stockBefore = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });

      const res = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          partyId: customerA._id,
          items: [
            {
              productId: productA._id,
              quantity: 2,
              unitPrice: 1000,
              discount: 0,
            },
          ],
          billDiscount: 0,
          payments: [
            {
              paymentMethod: 'cash',
              amount: 1000,
              bankAccountId: bankAccount2._id,
            },
            {
              paymentMethod: 'upi',
              amount: 1360,
              bankAccountId: bankAccount1._id,
              referenceNumber: 'UPI-POS-1234',
            },
          ],
          finalize: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoiceNumber).toBeDefined();
      expect(res.body.data.invoiceStatus).toBe('posted');
      posBill = res.body.data;

      // Verify stock deducted by 2 units
      const stockAfter = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      expect(stockAfter.quantity).toBe(stockBefore.quantity - 2);
    });

    it('should generate thermal / retail printable receipt for POS bill', async () => {
      const res = await request(app)
        .get(`/api/pos/bills/${posBill._id}/receipt`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bill.billNumber).toMatch(/^POS\//);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.totals.grandTotal).toBeDefined();
    });

    it('should return POS daily summary statistics', async () => {
      const res = await request(app)
        .get('/api/pos/daily-summary')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalBills).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.grossSales).toBeGreaterThan(0);
      expect(res.body.data.paymentCollections.totalCollected).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // MODULE 8: MULTI-TENANT ISOLATION
  // =========================================================================
  describe('8. Multi-Tenant Isolation Enforcement', () => {
    it('Tenant B cannot view Tenant A bank accounts', async () => {
      const res = await request(app)
        .get(`/api/banking/accounts/${bankAccount1._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('Tenant B cannot transfer funds from Tenant A bank account', async () => {
      const res = await request(app)
        .post('/api/banking/transfers')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          fromAccountId: bankAccount1._id,
          toAccountId: bankAccount2._id,
          amount: 1000,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('Tenant B cannot view Tenant A bank transactions', async () => {
      const res = await request(app)
        .get('/api/banking/transactions')
        .query({ bankAccountId: bankAccount1._id })
        .set('Authorization', `Bearer ${tokenB}`);

      // Returns 404 or an empty list with 0 items for Tenant B
      if (res.status === 200) {
        expect(res.body.data.transactions.length).toBe(0);
      } else {
        expect(res.status).toBe(404);
      }
    });

    it('Tenant B cannot view or allocate Tenant A payments', async () => {
      const res = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.payments.length).toBe(0);
    });

    it('Tenant B cannot view or modify Tenant A expenses', async () => {
      const res = await request(app)
        .get('/api/expenses')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.expenses.length).toBe(0);
    });

    it('Tenant B cannot view Tenant A POS receipt', async () => {
      // Need a valid bill ID from Tenant A
      const billsRes = await request(app)
        .get('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`);

      const billId = billsRes.body.data?.[0]?._id;
      if (billId) {
        const res = await request(app)
          .get(`/api/pos/bills/${billId}/receipt`)
          .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(404);
      }
    });
  });

  // =========================================================================
  // MODULE 9: VALIDATION & ERROR HANDLING EDGE CASES
  // =========================================================================
  describe('9. Financial Validation & Error Edge Cases', () => {
    it('should reject fund transfer with same source and destination account', async () => {
      const res = await request(app)
        .post('/api/banking/transfers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          fromAccountId: bankAccount1._id,
          toAccountId: bankAccount1._id,
          amount: 1000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject fund transfer with non-positive amount', async () => {
      const res = await request(app)
        .post('/api/banking/transfers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          fromAccountId: bankAccount1._id,
          toAccountId: bankAccount2._id,
          amount: -500,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject payment with negative amount', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          direction: 'in',
          partyId: customerA._id,
          amount: -100,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject expense with non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          categoryId: fakeId,
          amount: 500,
          payeeName: 'Vendor',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
