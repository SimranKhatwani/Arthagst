import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { createTenantAndUser } from './helpers/authHelper.js';
import Inventory from '../src/models/inventory.model.js';
import StockMovement from '../src/models/stockMovement.model.js';
import SalesInvoice from '../src/models/salesInvoice.model.js';
import Quotation from '../src/models/quotation.model.js';
import SalesOrder from '../src/models/salesOrder.model.js';
import DeliveryChallan from '../src/models/deliveryChallan.model.js';
import CreditNote from '../src/models/creditNote.model.js';
import PurchaseOrder from '../src/models/purchaseOrder.model.js';
import GRN from '../src/models/grn.model.js';
import PurchaseBill from '../src/models/purchaseBill.model.js';
import DebitNote from '../src/models/debitNote.model.js';

describe('Phase 2: Sales & Purchases Transactional Core Integration', () => {
  let tenantA, userA, tokenA;
  let tenantB, userB, tokenB;
  let warehouseA, categoryA, unitA;
  let productA, productB;
  let customerA, supplierA;

  beforeAll(async () => {
    // 1. Setup Tenant A
    const resA = await createTenantAndUser({
      tenantCode: 'P2-ORG-A',
      businessName: 'Apex Trade Enterprises Ltd',
      email: 'admin@apextrade.com',
    });
    tenantA = resA.tenant;
    userA = resA.user;
    tokenA = resA.token;

    // 2. Setup Tenant B (for multi-tenant isolation verification)
    const resB = await createTenantAndUser({
      tenantCode: 'P2-ORG-B',
      businessName: 'Zenith Logistics Global',
      email: 'admin@zenithlogistics.com',
    });
    tenantB = resB.tenant;
    userB = resB.user;
    tokenB = resB.token;

    // 3. Create Warehouse for Tenant A
    const whRes = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        warehouseName: 'Jaipur Central Godown',
        warehouseCode: 'JPR-WH-01',
        city: 'Jaipur',
        state: 'Rajasthan',
        stateCode: '08',
      });
    warehouseA = whRes.body.data;

    // 4. Create Category and Unit for Tenant A
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Industrial Electronics' });
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
        name: 'Sharma Electronics Traders',
        businessName: 'Sharma Electronics Traders',
        phone: '9829012345',
        email: 'sharma@electronics.com',
        GSTIN: '08AAAAA0000A1Z5',
        state: 'Rajasthan',
        stateCode: '08',
        billingAddress: '42 MI Road, Jaipur',
      });
    customerA = custRes.body.data;

    // 6. Create Supplier Party for Tenant A
    const supRes = await request(app)
      .post('/api/parties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        partyType: 'supplier',
        name: 'National Component Distributors',
        businessName: 'National Component Distributors',
        phone: '9811098765',
        email: 'sales@natcomponents.com',
        GSTIN: '27BBBBB1111B1Z2',
        state: 'Maharashtra',
        stateCode: '27',
        billingAddress: '101 Andheri Industrial Estate, Mumbai',
      });
    supplierA = supRes.body.data;

    // 7. Create Products for Tenant A
    // Product A: 18% GST, initial stock 50 units
    const p1Res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Industrial Relay 24V DC',
        SKU: 'RELAY-24V-IND',
        categoryId: categoryA._id,
        unitId: unitA._id,
        sellingPrice: 1000,
        purchasePrice: 600,
        gstRate: 18,
        productType: 'goods',
        trackInventory: true,
      });
    productA = p1Res.body.data;

    // Product B: 12% GST, initial stock 30 units
    const p2Res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Digital Multimeter Pro',
        SKU: 'DMM-PRO-500',
        categoryId: categoryA._id,
        unitId: unitA._id,
        sellingPrice: 2000,
        purchasePrice: 1200,
        gstRate: 12,
        productType: 'goods',
        trackInventory: true,
      });
    productB = p2Res.body.data;

    // Seed initial inventory stock for testing sales deductions
    await Inventory.create({
      tenantId: tenantA._id,
      productId: productA._id,
      warehouseId: warehouseA._id,
      quantity: 50,
      availableQuantity: 50,
      reservedQuantity: 0,
    });

    await Inventory.create({
      tenantId: tenantA._id,
      productId: productB._id,
      warehouseId: warehouseA._id,
      quantity: 30,
      availableQuantity: 30,
      reservedQuantity: 0,
    });
  });

  describe('1. Sales Core: Quotation -> Sales Order -> Invoice -> Post -> Credit Note', () => {
    let quotationId;
    let salesOrderId;
    let invoiceId;
    let invoiceItemId;

    it('should create a valid Quotation for Tenant A', async () => {
      const res = await request(app)
        .post('/api/sales/quotations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partyId: customerA._id,
          warehouseId: warehouseA._id,
          quotationDate: '2026-11-25',
          validUntil: '2026-12-15',
          placeOfSupply: 'Rajasthan',
          items: [
            {
              productId: productA._id,
              quantity: 10,
              unitPrice: 1000,
              discount: 500, // ₹500 commercial discount
              description: 'Industrial Relays for client project',
            },
          ],
          notes: 'Standard quotation with commercial discount',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      quotationId = res.body.data._id;

      expect(res.body.data.quotationNumber).toMatch(/^QTN/);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].taxableValue).toBe(9500); // 10 * 1000 - 500 = 9500
      expect(res.body.data.isInterState).toBe(true);
      expect(res.body.data.igstTotal).toBe(1710); // 18% of 9500 (inter-state Maharashtra -> Rajasthan)
      expect(res.body.data.grandTotal).toBe(11210);
    });

    it('should retrieve quotations list and single quotation by ID', async () => {
      const listRes = await request(app)
        .get('/api/sales/quotations')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.quotations).toHaveLength(1);
      expect(listRes.body.data.quotations[0]._id).toBe(quotationId);

      const getRes = await request(app)
        .get(`/api/sales/quotations/${quotationId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data._id).toBe(quotationId);
    });

    it('should update quotation details', async () => {
      const res = await request(app)
        .put(`/api/sales/quotations/${quotationId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          notes: 'Updated terms: Payment within 30 days',
          status: 'sent',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated terms: Payment within 30 days');
      expect(res.body.data.status).toBe('sent');
    });

    it('should convert quotation to Sales Order', async () => {
      const res = await request(app)
        .post(`/api/sales/quotations/${quotationId}/convert-to-order`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          expectedDeliveryDate: '2026-12-10',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      salesOrderId = res.body.data._id;

      expect(res.body.data.orderNumber).toMatch(/^SO/);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.grandTotal).toBe(11210);

      // Verify quotation status updated to 'converted_to_order'
      const quoteCheck = await Quotation.findById(quotationId);
      expect(quoteCheck.status).toBe('converted_to_order');
    });

    it('should retrieve sales orders list and single order', async () => {
      const listRes = await request(app)
        .get('/api/sales/orders')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.salesOrders.length).toBeGreaterThanOrEqual(1);

      const getRes = await request(app)
        .get(`/api/sales/orders/${salesOrderId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data._id).toBe(salesOrderId);
    });

    it('should convert Sales Order to Sales Invoice', async () => {
      const res = await request(app)
        .post(`/api/sales/orders/${salesOrderId}/convert-to-invoice`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          invoiceDate: '2026-11-25',
          dueDate: '2026-12-25',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      invoiceId = res.body.data._id;
      invoiceItemId = res.body.data.items[0]._id;

      expect(res.body.data.invoiceNumber).toMatch(/^INV/);
      expect(res.body.data.invoiceStatus).toBe('draft');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.grandTotal).toBe(11210);
    });

    it('should post and finalize Sales Invoice, reducing inventory stock atomically', async () => {
      const invBefore = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      expect(invBefore.quantity).toBe(50);

      const res = await request(app)
        .post(`/api/sales/invoices/${invoiceId}/post`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoiceStatus).toBe('posted');

      // Verify inventory stock decreased from 50 to 40 (10 units deducted)
      const invAfter = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      expect(invAfter.quantity).toBe(40);
      expect(invAfter.availableQuantity).toBe(40);

      // Verify stock movement record was logged
      const movement = await StockMovement.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        referenceId: new mongoose.Types.ObjectId(invoiceId),
      });
      expect(movement).toBeDefined();
      expect(movement.movementType).toBe('sales');
      expect(movement.quantity).toBe(10);
    });

    it('should create a Sales Return / Credit Note and restore warehouse stock', async () => {
      const res = await request(app)
        .post(`/api/sales/invoices/${invoiceId}/returns`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          reason: 'sales_return',
          items: [
            {
              invoiceItemId: String(invoiceItemId),
              returnedQuantity: 2,
            },
          ],
          remarks: '2 units defective - returned by client',
          restoreStock: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const creditNote = res.body.data;
      expect(creditNote).toBeDefined();
      expect(creditNote.creditNoteNumber).toMatch(/^CN/);

      // Post the credit note to commit stock restoration
      const postCnRes = await request(app)
        .post(`/api/sales/credit-notes/${creditNote._id}/post`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(postCnRes.status).toBe(200);
      expect(postCnRes.body.data.status).toBe('posted');

      // 2 returned out of 10 items (rate = 950 after discount)
      // Taxable = 1900, GST 18% = 342, Grand Total = 2242
      expect(postCnRes.body.data.taxableAmount).toBe(1900);
      expect(postCnRes.body.data.isInterState).toBe(true);
      expect(postCnRes.body.data.igstTotal).toBe(342);
      expect(postCnRes.body.data.grandTotal).toBe(2242);

      // Verify warehouse stock increased back by 2 (from 40 to 42)
      const invAfterReturn = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      expect(invAfterReturn.quantity).toBe(42);
      expect(invAfterReturn.availableQuantity).toBe(42);
    });

    it('should create and convert Delivery Challan', async () => {
      const dcRes = await request(app)
        .post('/api/sales/challans')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partyId: String(customerA._id),
          warehouseId: String(warehouseA._id),
          challanDate: '2026-11-25',
          vehicleNumber: 'RJ-14-GA-9999',
          items: [
            {
              productId: String(productB._id),
              quantity: 5,
              unitPrice: 2000,
            },
          ],
          notes: 'Material sent for client site inspection',
        });

      expect(dcRes.status).toBe(201);
      expect(dcRes.body.data.challanNumber).toMatch(/^DC/);
      const challanId = dcRes.body.data._id;

      const convRes = await request(app)
        .post(`/api/sales/challans/${challanId}/convert-to-invoice`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          invoiceDate: '2026-11-25',
        });

      expect([200, 201]).toContain(convRes.status);
      expect(convRes.body.data.invoiceNumber).toMatch(/^INV/);
      expect(convRes.body.data.invoiceStatus).toBe('draft');
    });
  });

  describe('2. Purchases Core: Purchase Order -> GRN -> Purchase Bill -> Debit Note', () => {
    let purchaseOrderId;
    let purchaseBillId;
    let purchaseBillItemId;

    it('should create a Purchase Order for Supplier A', async () => {
      const res = await request(app)
        .post('/api/purchases/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partyId: String(supplierA._id),
          warehouseId: String(warehouseA._id),
          orderDate: '2026-11-25',
          expectedDeliveryDate: '2026-12-05',
          items: [
            {
              productId: String(productA._id),
              quantity: 50,
              unitPrice: 550,
              discount: 0,
              description: 'Fresh manufacturing batch from vendor',
            },
          ],
          notes: 'PO approved under bulk procurement agreement',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      purchaseOrderId = res.body.data._id;

      expect(res.body.data.purchaseOrderNumber).toMatch(/^PO/);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.taxableAmount).toBe(27500); // 50 * 550
      expect(res.body.data.igstTotal).toBe(4950); // 18% IGST (Maharashtra to Rajasthan)
      expect(res.body.data.grandTotal).toBe(32450);
    });

    it('should approve the Purchase Order', async () => {
      const res = await request(app)
        .post(`/api/purchases/orders/${purchaseOrderId}/approve`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    it('should create and post Goods Receipt Note (GRN), atomically increasing warehouse stock', async () => {
      const invBefore = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      const stockBefore = invBefore.quantity; // currently 42

      const grnRes = await request(app)
        .post('/api/purchases/grn')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          supplierId: String(supplierA._id),
          warehouseId: String(warehouseA._id),
          purchaseOrderId: String(purchaseOrderId),
          supplierChallanNumber: 'SUP-CHALLAN-8891',
          receiptDate: '2026-11-25',
          items: [
            {
              productId: String(productA._id),
              receivedQuantity: 50,
              acceptedQuantity: 48,
              rejectedQuantity: 2,
              remarks: '2 units defective in transit',
            },
          ],
          remarks: 'Inspection completed at godown dock',
        });

      expect(grnRes.status).toBe(201);
      expect(grnRes.body.data.grnNumber).toMatch(/^GRN/);
      const grnId = grnRes.body.data._id;

      // Post the GRN to commit stock change
      const postRes = await request(app)
        .post(`/api/purchases/grn/${grnId}/post`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(postRes.status).toBe(200);
      expect(postRes.body.data.status).toBe('posted');

      // Verify warehouse stock increased by 48 (accepted quantity)
      const invAfter = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      expect(invAfter.quantity).toBe(stockBefore + 48);
    });

    it('should create and post Purchase Bill against supplier', async () => {
      const res = await request(app)
        .post('/api/purchases/bills')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          supplierId: String(supplierA._id),
          supplierInvoiceNumber: 'INV-VENDOR-2026-099',
          warehouseId: String(warehouseA._id),
          billDate: '2026-11-25',
          dueDate: '2026-12-25',
          placeOfSupply: 'Rajasthan',
          items: [
            {
              productId: String(productA._id),
              quantity: 48,
              unitPrice: 550,
              discount: 0,
            },
          ],
          notes: 'Bill matching accepted GRN quantity',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.billNumber).toMatch(/^BILL/);
      expect(res.body.data.billStatus).toBe('draft');

      purchaseBillId = res.body.data._id;
      purchaseBillItemId = res.body.data.items[0]._id;

      // Post the purchase bill
      const postRes = await request(app)
        .post(`/api/purchases/bills/${purchaseBillId}/post`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(postRes.status).toBe(200);
      expect(postRes.body.data.billStatus).toBe('posted');
    });

    it('should create Purchase Return (Debit Note) and reduce warehouse stock', async () => {
      const invBefore = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      const stockBefore = invBefore.quantity;

      const retRes = await request(app)
        .post('/api/purchases/returns')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          billId: String(purchaseBillId),
          reason: 'purchase_return',
          items: [
            {
              billItemId: String(purchaseBillItemId),
              returnedQuantity: 3,
            },
          ],
          remarks: 'Return 3 units defective component to vendor',
        });

      expect(retRes.status).toBe(201);
      expect(retRes.body.success).toBe(true);
      expect(retRes.body.data.debitNoteNumber).toMatch(/^DN/);
      const debitNoteId = retRes.body.data._id;

      // Post the Debit Note to commit stock reduction
      const postRes = await request(app)
        .post(`/api/purchases/returns/${debitNoteId}/post`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(postRes.status).toBe(200);
      expect(postRes.body.data.status).toBe('posted');

      // Verify stock reduced by 3 units
      const invAfter = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      expect(invAfter.quantity).toBe(stockBefore - 3);
    });
  });

  describe('3. Multi-Tenant Isolation & Security', () => {
    it('Tenant B cannot view Tenant A sales invoices', async () => {
      const res = await request(app)
        .get('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data.invoices).toHaveLength(0);
    });

    it('Tenant B cannot view Tenant A quotations or orders', async () => {
      const qRes = await request(app)
        .get('/api/sales/quotations')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(qRes.status).toBe(200);
      expect(qRes.body.data.quotations).toHaveLength(0);

      const oRes = await request(app)
        .get('/api/sales/orders')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(oRes.status).toBe(200);
      expect(oRes.body.data.salesOrders).toHaveLength(0);
    });

    it('Tenant B cannot view Tenant A purchase bills or GRNs', async () => {
      const bRes = await request(app)
        .get('/api/purchases/bills')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(bRes.status).toBe(200);
      expect(bRes.body.data.bills).toHaveLength(0);

      const gRes = await request(app)
        .get('/api/purchases/grn')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(gRes.status).toBe(200);
      expect(gRes.body.data.grns).toHaveLength(0);
    });

    it('Tenant B cannot access or modify Tenant A invoice by direct ID', async () => {
      const aInv = await SalesInvoice.findOne({ tenantId: tenantA._id });
      expect(aInv).toBeDefined();

      const res = await request(app)
        .get(`/api/sales/invoices/${aInv._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });
  });

  describe('4. Business Logic & Validation Constraints', () => {
    it('should reject invoice creation referencing non-existent party or warehouse', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partyId: String(fakeId),
          warehouseId: String(warehouseA._id),
          invoiceDate: '2026-11-25',
          items: [
            {
              productId: String(productA._id),
              quantity: 1,
              unitPrice: 1000,
            },
          ],
        });

      expect([400, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject quotation with negative quantity or unit price', async () => {
      const res = await request(app)
        .post('/api/sales/quotations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partyId: String(customerA._id),
          warehouseId: String(warehouseA._id),
          items: [
            {
              productId: String(productA._id),
              quantity: -5,
              unitPrice: 1000,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject credit note when return quantity exceeds invoiced quantity', async () => {
      // Create a small posted invoice with 2 items
      const invRes = await request(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partyId: String(customerA._id),
          warehouseId: String(warehouseA._id),
          invoiceDate: '2026-11-25',
          items: [
            {
              productId: String(productA._id),
              quantity: 2,
              unitPrice: 1000,
            },
          ],
        });

      expect(invRes.status).toBe(201);
      const inv = invRes.body.data;
      await request(app)
        .post(`/api/sales/invoices/${inv._id}/post`)
        .set('Authorization', `Bearer ${tokenA}`);

      const itemId = inv.items[0]._id;

      // Attempt to return 5 items (only 2 were billed)
      const retRes = await request(app)
        .post(`/api/sales/invoices/${inv._id}/returns`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          reason: 'sales_return',
          items: [
            {
              invoiceItemId: String(itemId),
              returnedQuantity: 5,
            },
          ],
        });

      expect(retRes.status).toBe(400);
      expect(retRes.body.success).toBe(false);
    });

    it('should cancel invoice and restore product inventory', async () => {
      // 1. Create and post invoice with 4 units of product A
      const invRes = await request(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partyId: String(customerA._id),
          warehouseId: String(warehouseA._id),
          invoiceDate: '2026-11-25',
          items: [
            {
              productId: String(productA._id),
              quantity: 4,
              unitPrice: 1000,
            },
          ],
        });

      expect(invRes.status).toBe(201);
      const invId = invRes.body.data._id;
      await request(app)
        .post(`/api/sales/invoices/${invId}/post`)
        .set('Authorization', `Bearer ${tokenA}`);

      const invMid = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      const stockMid = invMid.quantity;

      // 2. Cancel invoice
      const cancelRes = await request(app)
        .post(`/api/sales/invoices/${invId}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ cancellationReason: 'Client requested cancellation of full order' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.invoiceStatus).toBe('cancelled');

      // 3. Verify stock restored by 4 units
      const invFinal = await Inventory.findOne({
        tenantId: tenantA._id,
        productId: productA._id,
        warehouseId: warehouseA._id,
      });
      expect(invFinal.quantity).toBe(stockMid + 4);
    });
  });
});
