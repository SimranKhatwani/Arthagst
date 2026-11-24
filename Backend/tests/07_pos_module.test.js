import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { createTenantAndUser } from './helpers/authHelper.js';
import Inventory from '../src/models/inventory.model.js';
import StockMovement from '../src/models/stockMovement.model.js';
import JournalEntry from '../src/models/journalEntry.model.js';
import Payment from '../src/models/payment.model.js';
import BankAccount from '../src/models/bankAccount.model.js';
import SalesInvoice from '../src/models/salesInvoice.model.js';

describe('Point of Sale (POS) Backend Module', () => {
  let tenantA, userA, tokenA;
  let tenantB, userB, tokenB;
  let warehouseA, categoryA, unitA;
  let productAlpha, productBeta, productNoStock;
  let bankAccountA;
  let customerParty;

  beforeAll(async () => {
    // 1. Setup Tenant A
    const resA = await createTenantAndUser({
      tenantCode: 'POS-ORG-A',
      businessName: 'SuperMart Retailers Pvt Ltd',
      email: 'pos.admin@supermart.com',
    });
    tenantA = resA.tenant;
    userA = resA.user;
    tokenA = resA.token;

    // 2. Setup Tenant B (for isolation tests)
    const resB = await createTenantAndUser({
      tenantCode: 'POS-ORG-B',
      businessName: 'Competitor Store Ltd',
      email: 'owner@competitor.com',
    });
    tenantB = resB.tenant;
    userB = resB.user;
    tokenB = resB.token;

    // 3. Create Warehouse for Tenant A
    const whRes = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        warehouseName: 'Main Store POS Counter',
        warehouseCode: 'POS-WH-01',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
      });
    warehouseA = whRes.body.data;

    // 4. Create Category and Unit
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'FMCG Groceries' });
    categoryA = catRes.body.data;

    const unitRes = await request(app)
      .post('/api/units')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Piece', shortName: 'PCS', gstUqcCode: 'PCS' });
    unitA = unitRes.body.data;

    // 5. Create Products
    // Product Alpha: GST 18%, Selling Price ₹1,000, Barcode '8901234567890'
    const p1Res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Smart WiFi Plug 16A',
        SKU: 'WIFI-PLUG-16A',
        barcode: '8901234567890',
        categoryId: categoryA._id,
        unitId: unitA._id,
        sellingPrice: 1000,
        purchasePrice: 600,
        gstRate: 18,
        productType: 'goods',
        trackInventory: true,
        lowStockAlert: 5,
      });
    productAlpha = p1Res.body.data;

    // Product Beta: GST 12%, Selling Price ₹500, Barcode '8901234567891'
    const p2Res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'USB-C Fast Charging Cable 2M',
        SKU: 'CABLE-USBC-2M',
        barcode: '8901234567891',
        categoryId: categoryA._id,
        unitId: unitA._id,
        sellingPrice: 500,
        purchasePrice: 250,
        gstRate: 12,
        productType: 'goods',
        trackInventory: true,
      });
    productBeta = p2Res.body.data;

    // Product with Zero Stock
    const p3Res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Rare Vintage Coffee Mug',
        SKU: 'MUG-VINTAGE-01',
        barcode: '8901234567892',
        categoryId: categoryA._id,
        unitId: unitA._id,
        sellingPrice: 800,
        gstRate: 18,
        productType: 'goods',
        trackInventory: true,
      });
    productNoStock = p3Res.body.data;

    // 6. Initialize Stock in Warehouse A
    // Stock: 50 units of productAlpha, 20 units of productBeta
    await request(app)
      .post('/api/inventory/opening-stock')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: productAlpha._id,
        warehouseId: warehouseA._id,
        quantity: 50,
        remarks: 'Store opening stock',
      });

    await request(app)
      .post('/api/inventory/opening-stock')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: productBeta._id,
        warehouseId: warehouseA._id,
        quantity: 20,
        remarks: 'Store opening stock',
      });

    // 7. Create Customer Party
    const partyRes = await request(app)
      .post('/api/parties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Rahul Sharma',
        partyType: 'customer',
        phone: '9820011223',
        email: 'rahul.sharma@gmail.com',
        state: 'Maharashtra',
        stateCode: '27',
      });
    customerParty = partyRes.body.data;

    // 8. Create Bank Account for digital/card payments
    const bankRes = await request(app)
      .post('/api/banking/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        accountName: 'HDFC Store POS Account',
        accountType: 'bank',
        bankName: 'HDFC Bank',
        accountNumber: '9988776655',
        IFSC: 'HDFC0001234',
        openingBalance: 50000,
      });
    bankAccountA = bankRes.body.data;
  });

  describe('1. POS Catalog & Lookup APIs', () => {
    it('GET /api/pos/products should return products with live warehouse stock availability', async () => {
      const res = await request(app)
        .get(`/api/pos/products?warehouseId=${warehouseA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data;
      expect(Array.isArray(items)).toBe(true);

      const alpha = items.find((p) => p.SKU === 'WIFI-PLUG-16A');
      expect(alpha).toBeDefined();
      expect(alpha.availableStock).toBe(50);
      expect(alpha.isOutOfStock).toBe(false);

      const zeroStock = items.find((p) => p.SKU === 'MUG-VINTAGE-01');
      expect(zeroStock).toBeDefined();
      expect(zeroStock.availableStock).toBe(0);
      expect(zeroStock.isOutOfStock).toBe(true);
    });

    it('GET /api/pos/products should support barcode and SKU search', async () => {
      // Search by barcode
      const barcodeRes = await request(app)
        .get('/api/pos/products?barcode=8901234567890')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(barcodeRes.status).toBe(200);
      expect(barcodeRes.body.data.length).toBe(1);
      expect(barcodeRes.body.data[0].SKU).toBe('WIFI-PLUG-16A');

      // Search by SKU
      const skuRes = await request(app)
        .get('/api/pos/products?SKU=CABLE-USBC-2M')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(skuRes.status).toBe(200);
      expect(skuRes.body.data.length).toBe(1);
      expect(skuRes.body.data[0].name).toBe('USB-C Fast Charging Cable 2M');
    });

    it('GET /api/pos/customers should list customers and support phone search', async () => {
      const res = await request(app)
        .get('/api/pos/customers?search=9820011223')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((c) => c.phone === '9820011223')).toBe(true);
    });
  });

  describe('2. POS Bill Management (Draft & Update Lifecycle)', () => {
    let draftBillId;

    it('POST /api/pos/bills should create a draft bill with Walk-in Customer automatically', async () => {
      const res = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          isWalkIn: true,
          items: [
            { productId: productAlpha._id, quantity: 2, unitPrice: 1000, discount: 50 },
            { productId: productBeta._id, quantity: 1, unitPrice: 500, discount: 0 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const bill = res.body.data;
      draftBillId = bill._id;

      // Numbering: Starts with POS/
      expect(bill.posBillNumber).toMatch(/^POS\/\d{4}-\d{2}\/\d{4}$/);
      expect(bill.invoiceNumber).toBe(bill.posBillNumber);
      expect(bill.isPOS).toBe(true);
      expect(bill.isWalkIn).toBe(true);
      expect(bill.invoiceStatus).toBe('draft');
      expect(bill.stockDeducted).toBe(false);

      // Math verification:
      // Item 1: (1000 * 2) - 50 = 1950 taxable + 18% GST (351) = 2301
      // Item 2: 500 * 1 = 500 taxable + 12% GST (60) = 560
      // Total Taxable: 2450
      // Total Tax: 351 + 60 = 411 (CGST: 205.5, SGST: 205.5)
      // Grand Total: 2861
      expect(bill.taxableAmount).toBe(2450);
      expect(bill.cgstTotal).toBe(205.5);
      expect(bill.sgstTotal).toBe(205.5);
      expect(bill.grandTotal).toBe(2861);
      expect(bill.balanceAmount).toBe(2861);
      expect(bill.paymentStatus).toBe('unpaid');

      // Verify stock was NOT deducted yet
      const inv = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productAlpha._id,
        warehouseId: warehouseA._id,
      });
      expect(inv.availableQuantity).toBe(50);
    });

    it('PATCH /api/pos/bills/:id should update a draft POS bill and recalculate totals', async () => {
      const res = await request(app)
        .patch(`/api/pos/bills/${draftBillId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          items: [
            { productId: productAlpha._id, quantity: 1, unitPrice: 1000, discount: 0 },
          ],
          billDiscount: 100, // Flat bill discount
          notes: 'Customer used store voucher',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const bill = res.body.data;
      expect(bill.items.length).toBe(1);
      expect(bill.notes).toBe('Customer used store voucher');
      expect(bill.grandTotal).toBeLessThan(1180); // 1000 + 18% = 1180, minus voucher
    });
  });

  describe('3. POS Bill Finalization, Stock Deductions & Inventory Controls', () => {
    it('POST /api/pos/bills should fail if requested quantity exceeds available stock', async () => {
      const res = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          partyId: customerParty._id,
          finalize: true,
          items: [
            { productId: productNoStock._id, quantity: 1, unitPrice: 800 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient stock');
    });

    it('POST /api/pos/bills/:id/finalize should deduct inventory and record stock movements atomically', async () => {
      // 1. Create a draft bill with 5 units of productAlpha
      const createRes = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          partyId: customerParty._id,
          items: [
            { productId: productAlpha._id, quantity: 5, unitPrice: 1000 },
          ],
        });
      expect(createRes.status).toBe(201);
      const billId = createRes.body.data._id;

      // 2. Finalize the bill
      const finRes = await request(app)
        .post(`/api/pos/bills/${billId}/finalize`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      expect(finRes.status).toBe(200);
      expect(finRes.body.success).toBe(true);
      const bill = finRes.body.data;
      expect(bill.invoiceStatus).toBe('posted');
      expect(bill.stockDeducted).toBe(true);

      // 3. Verify stock deduction in database (50 - 5 = 45)
      const inv = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productAlpha._id,
        warehouseId: warehouseA._id,
      });
      expect(inv.availableQuantity).toBe(45);
      expect(inv.quantity).toBe(45);

      // 4. Verify immutable stock movement created
      const movement = await StockMovement.findOne({
        tenantId: tenantA._id,
        productId: productAlpha._id,
        $or: [{ referenceId: bill._id }, { referenceId: new mongoose.Types.ObjectId(bill._id) }],
      });
      expect(movement).toBeDefined();
      expect(movement.movementType).toBe('sales');
      expect(movement.quantity).toBe(5);
      expect(movement.newStock).toBe(45);

      // 5. Verify double finalization is prevented (idempotent / 400 error)
      const repeatRes = await request(app)
        .post(`/api/pos/bills/${billId}/finalize`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});
      expect(repeatRes.status).toBe(400);
      expect(repeatRes.body.message).toContain('already finalized');
    });
  });

  describe('4. POS Split Payments & Multi-Method Checkout', () => {
    let splitBill;

    it('POST /api/pos/bills should support multi-mode split payments (Cash + UPI/Bank)', async () => {
      // Bill Total: 2 units * ₹500 = ₹1,000 + 12% GST = ₹1,120
      // Payment: ₹600 Cash + ₹520 Bank
      const res = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          partyId: customerParty._id,
          finalize: true,
          items: [
            { productId: productBeta._id, quantity: 2, unitPrice: 500 },
          ],
          payments: [
            { paymentMethod: 'cash', amount: 600 },
            {
              paymentMethod: 'upi',
              amount: 520,
              bankAccountId: bankAccountA._id,
              referenceNumber: 'UPI987654321000',
            },
          ],
        });

      expect(res.status).toBe(201);
      splitBill = res.body.data;

      expect(splitBill.grandTotal).toBe(1120);
      expect(splitBill.paidAmount).toBe(1120);
      expect(splitBill.balanceAmount).toBe(0);
      expect(splitBill.paymentStatus).toBe('paid');
      expect(splitBill.posPayments.length).toBe(2);

      // Verify payment records created in Payment collection
      const payments = await Payment.find({
        tenantId: tenantA._id,
        'allocations.salesInvoiceId': splitBill._id,
      });
      expect(payments.length).toBe(2);
      expect(payments.some((p) => p.paymentMethod === 'cash' && p.amount === 600)).toBe(true);
      expect(payments.some((p) => p.paymentMethod.toLowerCase() === 'upi' && p.amount === 520)).toBe(true);

      // Verify bank account balance updated (50,000 + 520 = 50,520)
      const bank = await BankAccount.findById(bankAccountA._id);
      expect(bank.currentBalance).toBe(50520);
    });

    it('POST /api/pos/bills should support partial payments with remaining balance', async () => {
      // Bill Total: 1 unit * ₹1,000 = ₹1,000 + 18% = ₹1,180
      // Payment: ₹500 Cash (Partial)
      const res = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          partyId: customerParty._id,
          finalize: true,
          items: [{ productId: productAlpha._id, quantity: 1, unitPrice: 1000 }],
          payments: [{ paymentMethod: 'cash', amount: 500 }],
        });

      expect(res.status).toBe(201);
      const bill = res.body.data;
      expect(bill.grandTotal).toBe(1180);
      expect(bill.paidAmount).toBe(500);
      expect(bill.balanceAmount).toBe(680);
      expect(bill.paymentStatus).toBe('partially_paid');
    });

    it('POST /api/pos/bills should calculate changeReturned when cash tendered exceeds total', async () => {
      // Bill Total: 1 unit * ₹500 = ₹500 + 12% = ₹560
      // Payment: ₹600 Cash tendered -> Change returned: ₹40
      const res = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          isWalkIn: true,
          finalize: true,
          items: [{ productId: productBeta._id, quantity: 1, unitPrice: 500 }],
          payments: [{ paymentMethod: 'cash', amount: 600 }],
        });

      expect(res.status).toBe(201);
      const bill = res.body.data;
      expect(bill.grandTotal).toBe(560);
      expect(bill.paidAmount).toBe(560);
      expect(bill.changeReturned).toBe(40);
      expect(bill.paymentStatus).toBe('paid');
    });
  });

  describe('5. Accounting Integration (Double-Entry Verification)', () => {
    it('Finalized POS bill must automatically post balanced Sales and Payment journals', async () => {
      // Create and finalize a bill
      const res = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          partyId: customerParty._id,
          finalize: true,
          items: [{ productId: productAlpha._id, quantity: 1, unitPrice: 1000 }],
          payments: [{ paymentMethod: 'cash', amount: 1180 }],
        });

      const bill = res.body.data;

      // 1. Verify Sales Invoice Journal Entry
      const salesJournal = await JournalEntry.findOne({
        tenantId: tenantA._id,
        sourceId: bill._id,
        sourceType: 'sales_invoice',
      });
      expect(salesJournal).toBeDefined();
      expect(salesJournal.totalDebit).toBe(1180);
      expect(salesJournal.totalCredit).toBe(1180);

      // Verify specific lines: AR debit 1180, Sales credit 1000, CGST 90, SGST 90
      expect(salesJournal.lines.some((l) => l.accountCode === '1100' && l.debit === 1180)).toBe(true);
      expect(salesJournal.lines.some((l) => l.accountCode === '4010' && l.credit === 1000)).toBe(true);
      expect(salesJournal.lines.some((l) => l.accountCode === '2110' && l.credit === 90)).toBe(true);
      expect(salesJournal.lines.some((l) => l.accountCode === '2120' && l.credit === 90)).toBe(true);

      // 2. Verify Payment Journal Entry (Debit Cash 1010, Credit AR 1100)
      const billPayment = await Payment.findOne({
        tenantId: tenantA._id,
        'allocations.salesInvoiceId': bill._id,
      });
      expect(billPayment).toBeDefined();

      const paymentJournal = await JournalEntry.findOne({
        tenantId: tenantA._id,
        sourceId: billPayment._id,
        sourceType: 'payment_receipt',
      });
      expect(paymentJournal).toBeDefined();
      expect(paymentJournal.totalDebit).toBe(1180);
      expect(paymentJournal.totalCredit).toBe(1180);
    });
  });

  describe('6. POS Bill Cancellation & Stock/Payment Reversals', () => {
    let cancellableBillId;
    let initialAlphaStock;
    let initialBankBal;

    beforeAll(async () => {
      const inv = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productAlpha._id,
        warehouseId: warehouseA._id,
      });
      initialAlphaStock = inv.availableQuantity;

      const bank = await BankAccount.findById(bankAccountA._id);
      initialBankBal = bank.currentBalance;

      // Create a finalized bill with 2 units of productAlpha paid via bank transfer
      const res = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          partyId: customerParty._id,
          finalize: true,
          items: [{ productId: productAlpha._id, quantity: 2, unitPrice: 1000 }],
          payments: [
            { paymentMethod: 'bank', amount: 2360, bankAccountId: bankAccountA._id },
          ],
        });
      cancellableBillId = res.body.data._id;
    });

    it('POST /api/pos/bills/:id/cancel should reverse inventory, payments, and journals', async () => {
      const res = await request(app)
        .post(`/api/pos/bills/${cancellableBillId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          cancellationReason: 'Customer returned items immediately at counter',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const bill = res.body.data;
      expect(bill.invoiceStatus).toBe('cancelled');
      expect(bill.cancellationReason).toBe('Customer returned items immediately at counter');

      // 1. Verify stock restored to inventory
      const inv = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productAlpha._id,
        warehouseId: warehouseA._id,
      });
      expect(inv.availableQuantity).toBe(initialAlphaStock);

      // 2. Verify reversing stock movement
      const revMovement = await StockMovement.findOne({
        tenantId: tenantA._id,
        productId: productAlpha._id,
        movementType: 'sales_return',
        $or: [{ referenceId: bill._id }, { referenceId: new mongoose.Types.ObjectId(bill._id) }],
      });
      expect(revMovement).toBeDefined();
      expect(revMovement.quantity).toBe(2);

      // 3. Verify bank balance reversed
      const bank = await BankAccount.findById(bankAccountA._id);
      expect(bank.currentBalance).toBe(initialBankBal);

      // 4. Verify reversing journal entry
      const revJournal = await JournalEntry.findOne({
        tenantId: tenantA._id,
        sourceId: bill._id,
        narration: { $regex: /Reversal/i },
      });
      expect(revJournal).toBeDefined();
      expect(revJournal.totalDebit).toBe(2360);
      expect(revJournal.totalCredit).toBe(2360);

      // 5. Cannot cancel an already cancelled bill
      const repeatRes = await request(app)
        .post(`/api/pos/bills/${cancellableBillId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ cancellationReason: 'Repeat cancel' });
      expect(repeatRes.status).toBe(400);
      expect(repeatRes.body.message).toContain('already cancelled');
    });
  });

  describe('7. Receipt, Reporting & Telemetry APIs', () => {
    let testBillId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          warehouseId: warehouseA._id,
          partyId: customerParty._id,
          finalize: true,
          items: [{ productId: productBeta._id, quantity: 1, unitPrice: 500 }],
          payments: [{ paymentMethod: 'cash', amount: 560 }],
        });
      testBillId = res.body.data._id;
    });

    it('GET /api/pos/bills/:id/receipt should return formatted thermal receipt data', async () => {
      const res = await request(app)
        .get(`/api/pos/bills/${testBillId}/receipt`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const receipt = res.body.data;

      expect(receipt.store.name).toBe('SuperMart Retailers Pvt Ltd');
      expect(receipt.bill.billNumber).toMatch(/^POS\//);
      expect(receipt.items.length).toBeGreaterThanOrEqual(1);
      expect(receipt.totals.grandTotal).toBe(560);
      expect(receipt.payments[0].method).toBe('cash');
      expect(receipt.footer.message).toBeDefined();
    });

    it('GET /api/pos/daily-summary should aggregate POS metrics and payment collections', async () => {
      const res = await request(app)
        .get('/api/pos/daily-summary')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const summary = res.body.data;

      expect(summary.summary.totalBills).toBeGreaterThanOrEqual(1);
      expect(summary.summary.postedBills).toBeGreaterThanOrEqual(1);
      expect(summary.summary.grossSales).toBeGreaterThan(0);
      expect(summary.paymentCollections.totalCollected).toBeGreaterThan(0);
      expect(summary.paymentCollections.cash).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/pos/cashier-summary should aggregate sales per cashier', async () => {
      const res = await request(app)
        .get('/api/pos/cashier-summary')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(Array.isArray(data.cashiers)).toBe(true);
      expect(data.cashiers.length).toBeGreaterThanOrEqual(1);
      expect(data.cashiers[0].billCount).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/pos/bills should list bills with pagination and filters', async () => {
      const res = await request(app)
        .get('/api/pos/bills?status=posted')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.totalRevenue).toBeGreaterThan(0);
    });
  });

  describe('8. Security, Tenant Isolation & Authentication', () => {
    it('Tenant B cannot access or modify Tenant A POS bills (Strict Isolation)', async () => {
      // 1. Get a bill from Tenant A
      const aBills = await SalesInvoice.find({ tenantId: tenantA._id, isPOS: true }).limit(1);
      const billId = aBills[0]._id;

      // 2. Tenant B queries Tenant A bill -> 404 Not Found
      const getRes = await request(app)
        .get(`/api/pos/bills/${billId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(getRes.status).toBe(404);

      // 3. Tenant B attempts to cancel Tenant A bill -> 404 Not Found
      const cancelRes = await request(app)
        .post(`/api/pos/bills/${billId}/cancel`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ cancellationReason: 'Unauthorized cross-tenant cancel attempt' });
      expect(cancelRes.status).toBe(404);

      // 4. Tenant B POS bills list returns 0 bills
      const listRes = await request(app)
        .get('/api/pos/bills')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(0);
      expect(listRes.body.pagination.total).toBe(0);
    });

    it('Unauthenticated requests to /api/pos must be rejected with 401', async () => {
      const res = await request(app).get('/api/pos/bills');
      expect(res.status).toBe(401);
    });
  });
});
