import { calculateInvoiceTotals, round2 } from '../services/calculationService';

export const DEMO_BUSINESS = {
  id: 'biz-sharma-traders',
  businessName: 'Sharma Traders',
  legalName: 'Sharma Traders Enterprises',
  businessType: 'Wholesale & Retail',
  constitution: 'Proprietorship',
  gstRegistered: true,
  gstin: '08AABCS1234F1Z5 (DEMO)',
  pan: 'AABCS1234F (DEMO)',
  registrationType: 'Regular',
  address: '42, Johari Bazaar Main Road, Near Badi Chaupar',
  city: 'Jaipur',
  state: 'Rajasthan',
  pincode: '302003',
  country: 'India',
  phone: '+91 98290 11223',
  email: 'accounts@sharmatraders.demo',
  website: 'www.sharmatraders.demo',
  currency: 'INR',
  financialYear: '2026-27',
  invoicePrefix: 'ST/26-27/',
  invoiceTemplate: 'Classic GST Pro',
  bankName: 'HDFC Bank Ltd.',
  accountNumber: '50200048192011',
  ifscCode: 'HDFC0000142',
  branchName: 'MI Road, Jaipur',
  upiId: 'sharmatraders@hdfcbank',
  terms:
    '1. Goods once sold will not be taken back without prior approval.\n2. Interest @ 18% p.a. will be charged on overdue invoices beyond due date.\n3. Subject to Jaipur Jurisdiction only. (Simulated Demo Business Record)',
};

const categories = [
  { id: 'cat-1', name: 'Electronics', description: 'LEDs, switches, cables and electrical accessories', hsnDefault: '8536' },
  { id: 'cat-2', name: 'Grocery', description: 'Staples, edible oils, pulses and packaged foods', hsnDefault: '1006' },
  { id: 'cat-3', name: 'Stationery', description: 'Office paper, registers, pens and filing supplies', hsnDefault: '4802' },
  { id: 'cat-4', name: 'Home Appliances', description: 'Ceiling fans, mixer grinders, irons and kettles', hsnDefault: '8414' },
  { id: 'cat-5', name: 'Hardware', description: 'Fasteners, locks, hinges and hand tools', hsnDefault: '8301' },
  { id: 'cat-6', name: 'Packaging', description: 'Corrugated boxes, BOPP tapes and stretch film', hsnDefault: '4819' },
];

const units = [
  { id: 'unit-1', name: 'Pieces', shortName: 'PCS', uqc: 'PCS-PIECES' },
  { id: 'unit-2', name: 'Boxes', shortName: 'BOX', uqc: 'BOX-BOXES' },
  { id: 'unit-3', name: 'Kilograms', shortName: 'KG', uqc: 'KGS-KILOGRAMS' },
  { id: 'unit-4', name: 'Litres', shortName: 'LTR', uqc: 'LTR-LITRES' },
  { id: 'unit-5', name: 'Packets', shortName: 'PKT', uqc: 'PAC-PACKETS' },
  { id: 'unit-6', name: 'Meters', shortName: 'MTR', uqc: 'MTR-METERS' },
  { id: 'unit-7', name: 'Sets', shortName: 'SET', uqc: 'SET-SETS' },
  { id: 'unit-8', name: 'Dozen', shortName: 'DOZ', uqc: 'DOZ-DOZENS' },
];

const warehouses = [
  { id: 'wh-1', name: 'Jaipur Main Godown', code: 'JPR-01', city: 'Jaipur', state: 'Rajasthan', manager: 'Rakesh Verma', capacity: '12,000 sq.ft', isPrimary: true },
  { id: 'wh-2', name: 'Sitapura Industrial Hub', code: 'JPR-02', city: 'Jaipur', state: 'Rajasthan', manager: 'Manoj Kumawat', capacity: '8,500 sq.ft', isPrimary: false },
  { id: 'wh-3', name: 'Vishwakarma Depot', code: 'JPR-03', city: 'Jaipur', state: 'Rajasthan', manager: 'Suresh Meena', capacity: '5,000 sq.ft', isPrimary: false },
];

const products = [
  // Electronics (6)
  { id: 'prod-1', name: 'Havells 9W LED Bulb Cool Day Light', sku: 'EL-HAV-001', barcode: '8901234001011', hsn: '8539', category: 'Electronics', brand: 'Havells', unit: 'PCS', purchasePrice: 62, sellingPrice: 85, mrp: 110, gstRate: 12, cessRate: 0, openingStock: 240, stock: 185, minStock: 40, warehouseId: 'wh-1', archived: false },
  { id: 'prod-2', name: 'Polycab 1.5 sq.mm FR PVC Wire (90m Coil)', sku: 'EL-POL-002', barcode: '8901234001028', hsn: '8544', category: 'Electronics', brand: 'Polycab', unit: 'BOX', purchasePrice: 1290, sellingPrice: 1580, mrp: 1850, gstRate: 18, cessRate: 0, openingStock: 65, stock: 42, minStock: 15, warehouseId: 'wh-1', archived: false },
  { id: 'prod-3', name: 'Anchor Roma 6A Modular Switch', sku: 'EL-ANC-003', barcode: '8901234001035', hsn: '8536', category: 'Electronics', brand: 'Anchor', unit: 'BOX', purchasePrice: 380, sellingPrice: 495, mrp: 600, gstRate: 18, cessRate: 0, openingStock: 90, stock: 64, minStock: 20, warehouseId: 'wh-1', archived: false },
  { id: 'prod-4', name: 'Syska 20W LED Batten Tube Light', sku: 'EL-SYS-004', barcode: '8901234001042', hsn: '8539', category: 'Electronics', brand: 'Syska', unit: 'PCS', purchasePrice: 145, sellingPrice: 195, mrp: 260, gstRate: 12, cessRate: 0, openingStock: 150, stock: 8, minStock: 25, warehouseId: 'wh-2', archived: false },
  { id: 'prod-5', name: 'Luminous 1100VA Eco Volt Inverter', sku: 'EL-LUM-005', barcode: '8901234001059', hsn: '8504', category: 'Electronics', brand: 'Luminous', unit: 'PCS', purchasePrice: 4650, sellingPrice: 5490, mrp: 6490, gstRate: 18, cessRate: 0, openingStock: 18, stock: 11, minStock: 5, warehouseId: 'wh-2', archived: false },
  { id: 'prod-6', name: 'APC 600VA Back-UPS Power Backup', sku: 'EL-APC-006', barcode: '8901234001066', hsn: '8504', category: 'Electronics', brand: 'APC', unit: 'PCS', purchasePrice: 2450, sellingPrice: 2950, mrp: 3450, gstRate: 18, cessRate: 0, openingStock: 22, stock: 0, minStock: 6, warehouseId: 'wh-1', archived: false },

  // Grocery (6)
  { id: 'prod-7', name: 'Fortune Sunlite Refined Sunflower Oil 15L Tin', sku: 'GR-FOR-007', barcode: '8901234002018', hsn: '1512', category: 'Grocery', brand: 'Fortune', unit: 'PCS', purchasePrice: 1880, sellingPrice: 2140, mrp: 2350, gstRate: 5, cessRate: 0, openingStock: 75, stock: 48, minStock: 15, warehouseId: 'wh-1', archived: false },
  { id: 'prod-8', name: 'India Gate Basmati Rice Classic (25kg Bag)', sku: 'GR-IND-008', barcode: '8901234002025', hsn: '1006', category: 'Grocery', brand: 'India Gate', unit: 'PKT', purchasePrice: 2250, sellingPrice: 2620, mrp: 2950, gstRate: 5, cessRate: 0, openingStock: 90, stock: 54, minStock: 20, warehouseId: 'wh-1', archived: false },
  { id: 'prod-9', name: 'Tata Salt Iodized (1kg x 25 Pack)', sku: 'GR-TAT-009', barcode: '8901234002032', hsn: '2501', category: 'Grocery', brand: 'Tata', unit: 'BOX', purchasePrice: 510, sellingPrice: 600, mrp: 700, gstRate: 0, cessRate: 0, openingStock: 110, stock: 72, minStock: 20, warehouseId: 'wh-3', archived: false },
  { id: 'prod-10', name: 'Aashirvaad Shudh Chakki Atta (10kg)', sku: 'GR-AAS-010', barcode: '8901234002049', hsn: '1101', category: 'Grocery', brand: 'Aashirvaad', unit: 'PKT', purchasePrice: 365, sellingPrice: 430, mrp: 485, gstRate: 5, cessRate: 0, openingStock: 140, stock: 14, minStock: 30, warehouseId: 'wh-3', archived: false },
  { id: 'prod-11', name: 'MDH Garam Masala 100g (Box of 20)', sku: 'GR-MDH-011', barcode: '8901234002056', hsn: '0910', category: 'Grocery', brand: 'MDH', unit: 'BOX', purchasePrice: 1180, sellingPrice: 1420, mrp: 1680, gstRate: 5, cessRate: 0, openingStock: 45, stock: 26, minStock: 10, warehouseId: 'wh-3', archived: false },
  { id: 'prod-12', name: 'Tata Tea Gold 1kg Commercial Pack', sku: 'GR-TAT-012', barcode: '8901234002063', hsn: '0902', category: 'Grocery', brand: 'Tata', unit: 'PKT', purchasePrice: 445, sellingPrice: 525, mrp: 610, gstRate: 5, cessRate: 0, openingStock: 80, stock: 5, minStock: 15, warehouseId: 'wh-3', archived: false },

  // Stationery (5)
  { id: 'prod-13', name: 'JK Copier A4 75 GSM Paper (500 Sheets)', sku: 'ST-JKC-013', barcode: '8901234003015', hsn: '4802', category: 'Stationery', brand: 'JK Paper', unit: 'PKT', purchasePrice: 215, sellingPrice: 265, mrp: 320, gstRate: 12, cessRate: 0, openingStock: 320, stock: 210, minStock: 50, warehouseId: 'wh-1', archived: false },
  { id: 'prod-14', name: 'Classmate Long Register 300 Pages (Pack of 12)', sku: 'ST-CLA-014', barcode: '8901234003022', hsn: '4820', category: 'Stationery', brand: 'Classmate', unit: 'DOZ', purchasePrice: 580, sellingPrice: 710, mrp: 840, gstRate: 12, cessRate: 0, openingStock: 60, stock: 38, minStock: 12, warehouseId: 'wh-1', archived: false },
  { id: 'prod-15', name: 'Reynolds Trimax Gel Pen Blue (Box of 10)', sku: 'ST-REY-015', barcode: '8901234003039', hsn: '9608', category: 'Stationery', brand: 'Reynolds', unit: 'BOX', purchasePrice: 310, sellingPrice: 390, mrp: 450, gstRate: 18, cessRate: 0, openingStock: 95, stock: 68, minStock: 20, warehouseId: 'wh-1', archived: false },
  { id: 'prod-16', name: 'Kangaro HD-10D Stapler (Pack of 10)', sku: 'ST-KAN-016', barcode: '8901234003046', hsn: '8472', category: 'Stationery', brand: 'Kangaro', unit: 'BOX', purchasePrice: 490, sellingPrice: 615, mrp: 750, gstRate: 18, cessRate: 0, openingStock: 40, stock: 29, minStock: 10, warehouseId: 'wh-1', archived: false },
  { id: 'prod-17', name: 'Solo Lever Arch Box File Foolscap (Pack of 6)', sku: 'ST-SOL-017', barcode: '8901234003053', hsn: '4820', category: 'Stationery', brand: 'Solo', unit: 'SET', purchasePrice: 540, sellingPrice: 680, mrp: 810, gstRate: 18, cessRate: 0, openingStock: 50, stock: 0, minStock: 10, warehouseId: 'wh-1', archived: false },

  // Home Appliances (5)
  { id: 'prod-18', name: 'Crompton HighSpeed 1200mm Ceiling Fan', sku: 'HA-CRO-018', barcode: '8901234004012', hsn: '8414', category: 'Home Appliances', brand: 'Crompton', unit: 'PCS', purchasePrice: 1480, sellingPrice: 1820, mrp: 2290, gstRate: 18, cessRate: 0, openingStock: 48, stock: 31, minStock: 10, warehouseId: 'wh-2', archived: false },
  { id: 'prod-19', name: 'Bajaj Rex 500W Mixer Grinder (3 Jars)', sku: 'HA-BAJ-019', barcode: '8901234004029', hsn: '8509', category: 'Home Appliances', brand: 'Bajaj', unit: 'PCS', purchasePrice: 1950, sellingPrice: 2390, mrp: 2995, gstRate: 18, cessRate: 0, openingStock: 35, stock: 22, minStock: 8, warehouseId: 'wh-2', archived: false },
  { id: 'prod-20', name: 'Philips GC1905 Steam Iron 1440W', sku: 'HA-PHI-020', barcode: '8901234004036', hsn: '8516', category: 'Home Appliances', brand: 'Philips', unit: 'PCS', purchasePrice: 1220, sellingPrice: 1520, mrp: 1895, gstRate: 18, cessRate: 0, openingStock: 40, stock: 25, minStock: 8, warehouseId: 'wh-2', archived: false },
  { id: 'prod-21', name: 'Prestige PKOSS 1.5L Electric Kettle', sku: 'HA-PRE-021', barcode: '8901234004043', hsn: '8516', category: 'Home Appliances', brand: 'Prestige', unit: 'PCS', purchasePrice: 640, sellingPrice: 825, mrp: 1145, gstRate: 18, cessRate: 0, openingStock: 55, stock: 4, minStock: 12, warehouseId: 'wh-2', archived: false },
  { id: 'prod-22', name: 'Voltas 1.5 Ton 3-Star Split AC Inverter', sku: 'HA-VOL-022', barcode: '8901234004050', hsn: '8415', category: 'Home Appliances', brand: 'Voltas', unit: 'PCS', purchasePrice: 26800, sellingPrice: 31500, mrp: 36990, gstRate: 28, cessRate: 0, openingStock: 10, stock: 6, minStock: 3, warehouseId: 'wh-2', archived: false },

  // Hardware (5)
  { id: 'prod-23', name: 'Godrej Nav-Tal 7 Levers Brass Padlock', sku: 'HW-GOD-023', barcode: '8901234005019', hsn: '8301', category: 'Hardware', brand: 'Godrej', unit: 'PCS', purchasePrice: 340, sellingPrice: 435, mrp: 525, gstRate: 18, cessRate: 0, openingStock: 120, stock: 88, minStock: 25, warehouseId: 'wh-1', archived: false },
  { id: 'prod-24', name: 'Bosch 13mm Impact Drill Kit GSB 500W', sku: 'HW-BOS-024', barcode: '8901234005026', hsn: '8467', category: 'Hardware', brand: 'Bosch', unit: 'SET', purchasePrice: 2380, sellingPrice: 2890, mrp: 3450, gstRate: 18, cessRate: 0, openingStock: 24, stock: 16, minStock: 5, warehouseId: 'wh-2', archived: false },
  { id: 'prod-25', name: 'Asian Paints TruCare Interior Primer 20L', sku: 'HW-ASI-025', barcode: '8901234005033', hsn: '3209', category: 'Hardware', brand: 'Asian Paints', unit: 'PCS', purchasePrice: 2150, sellingPrice: 2590, mrp: 3050, gstRate: 18, cessRate: 0, openingStock: 30, stock: 19, minStock: 8, warehouseId: 'wh-2', archived: false },
  { id: 'prod-26', name: 'Taparia Combination Plier 8-Inch Heavy Duty', sku: 'HW-TAP-026', barcode: '8901234005040', hsn: '8203', category: 'Hardware', brand: 'Taparia', unit: 'PCS', purchasePrice: 185, sellingPrice: 245, mrp: 310, gstRate: 18, cessRate: 0, openingStock: 100, stock: 74, minStock: 20, warehouseId: 'wh-1', archived: false },
  { id: 'prod-27', name: 'SS 304 Butt Hinges 4-Inch (Box of 20)', sku: 'HW-HIN-027', barcode: '8901234005057', hsn: '8302', category: 'Hardware', brand: 'Dorset', unit: 'BOX', purchasePrice: 780, sellingPrice: 980, mrp: 1200, gstRate: 18, cessRate: 0, openingStock: 45, stock: 33, minStock: 10, warehouseId: 'wh-1', archived: false },

  // Packaging (5)
  { id: 'prod-28', name: '3-Ply Corrugated Shipping Box 14x10x8 (Pack of 25)', sku: 'PK-BOX-028', barcode: '8901234006016', hsn: '4819', category: 'Packaging', brand: 'PackPro', unit: 'PKT', purchasePrice: 650, sellingPrice: 820, mrp: 980, gstRate: 12, cessRate: 0, openingStock: 110, stock: 76, minStock: 25, warehouseId: 'wh-3', archived: false },
  { id: 'prod-29', name: 'Wonder BOPP Transparent Packing Tape 48mm (72 Rolls)', sku: 'PK-WON-029', barcode: '8901234006023', hsn: '3919', category: 'Packaging', brand: 'Wonder', unit: 'BOX', purchasePrice: 1420, sellingPrice: 1750, mrp: 2100, gstRate: 18, cessRate: 0, openingStock: 45, stock: 29, minStock: 10, warehouseId: 'wh-3', archived: false },
  { id: 'prod-30', name: 'Bubble Wrap Roll 1m x 50m Heavy Cushion', sku: 'PK-BUB-030', barcode: '8901234006030', hsn: '3920', category: 'Packaging', brand: 'PackPro', unit: 'PCS', purchasePrice: 790, sellingPrice: 990, mrp: 1250, gstRate: 18, cessRate: 0, openingStock: 35, stock: 21, minStock: 8, warehouseId: 'wh-3', archived: false },
  { id: 'prod-31', name: 'LLDPE Stretch Film Roll 500mm x 3kg', sku: 'PK-STR-031', barcode: '8901234006047', hsn: '3920', category: 'Packaging', brand: 'FlexiWrap', unit: 'PCS', purchasePrice: 410, sellingPrice: 530, mrp: 650, gstRate: 18, cessRate: 0, openingStock: 60, stock: 44, minStock: 12, warehouseId: 'wh-3', archived: false },
  { id: 'prod-32', name: 'Thermal Shipping Labels 4x6 (1000 Labels Roll)', sku: 'PK-LBL-032', barcode: '8901234006054', hsn: '4821', category: 'Packaging', brand: 'ZebraDemo', unit: 'PCS', purchasePrice: 280, sellingPrice: 365, mrp: 450, gstRate: 18, cessRate: 0, openingStock: 85, stock: 58, minStock: 15, warehouseId: 'wh-3', archived: false },
];

const batches = [
  { id: 'bat-1', productId: 'prod-7', productName: 'Fortune Sunlite Refined Sunflower Oil 15L Tin', batchNo: 'FOR-26A1', mfgDate: '2026-03-10', expiryDate: '2026-12-15', qty: 28, warehouseId: 'wh-1' },
  { id: 'bat-2', productId: 'prod-7', productName: 'Fortune Sunlite Refined Sunflower Oil 15L Tin', batchNo: 'FOR-26B4', mfgDate: '2026-07-05', expiryDate: '2027-07-04', qty: 20, warehouseId: 'wh-1' },
  { id: 'bat-3', productId: 'prod-8', productName: 'India Gate Basmati Rice Classic (25kg Bag)', batchNo: 'IGB-2605', mfgDate: '2026-05-12', expiryDate: '2027-05-11', qty: 54, warehouseId: 'wh-1' },
  { id: 'bat-4', productId: 'prod-10', productName: 'Aashirvaad Shudh Chakki Atta (10kg)', batchNo: 'AAS-2609', mfgDate: '2026-09-01', expiryDate: '2026-12-05', qty: 14, warehouseId: 'wh-3' },
  { id: 'bat-5', productId: 'prod-11', productName: 'MDH Garam Masala 100g (Box of 20)', batchNo: 'MDH-2604', mfgDate: '2026-04-18', expiryDate: '2026-12-28', qty: 26, warehouseId: 'wh-3' },
  { id: 'bat-6', productId: 'prod-12', productName: 'Tata Tea Gold 1kg Commercial Pack', batchNo: 'TTG-2608', mfgDate: '2026-08-14', expiryDate: '2027-08-13', qty: 5, warehouseId: 'wh-3' },
  { id: 'bat-7', productId: 'prod-25', productName: 'Asian Paints TruCare Interior Primer 20L', batchNo: 'AP-2606', mfgDate: '2026-06-20', expiryDate: '2028-06-19', qty: 19, warehouseId: 'wh-2' },
];

const customers = [
  { id: 'cust-1', name: 'Rajeshwari Hardware & Electricals', businessName: 'Rajeshwari Hardware & Electricals', mobile: '9829144510', email: 'orders@rajeshwarihw.demo', gstin: '08AABCR4412K1Z8 (DEMO)', registrationType: 'Regular', billingAddress: '19, Gopalpura Bypass Road, Jaipur', shippingAddress: '19, Gopalpura Bypass Road, Jaipur', state: 'Rajasthan', openingBalance: 0, creditLimit: 300000, paymentTerms: 'Net 15', status: 'Active' },
  { id: 'cust-2', name: 'Pinkcity Supermart Pvt Ltd', businessName: 'Pinkcity Supermart Pvt Ltd', mobile: '9829088741', email: 'procurement@pinkcitymart.demo', gstin: '08AADCP9918M1Z2 (DEMO)', registrationType: 'Regular', billingAddress: 'Plot 8, Vaishali Nagar Sector 4, Jaipur', shippingAddress: 'Plot 8, Vaishali Nagar Sector 4, Jaipur', state: 'Rajasthan', openingBalance: 12000, creditLimit: 500000, paymentTerms: 'Net 30', status: 'Active' },
  { id: 'cust-3', name: 'Mewar Agro & Kirana Kendra', businessName: 'Mewar Agro & Kirana Kendra', mobile: '9414166230', email: 'mewar.kirana@demo.in', gstin: '08BBCPM3124R1Z1 (DEMO)', registrationType: 'Composition', billingAddress: '112, Bapu Bazaar, Udaipur', shippingAddress: '112, Bapu Bazaar, Udaipur', state: 'Rajasthan', openingBalance: 0, creditLimit: 150000, paymentTerms: 'Net 15', status: 'Active' },
  { id: 'cust-4', name: 'Aravalli Office Solutions', businessName: 'Aravalli Office Solutions', mobile: '9799234100', email: 'billing@aravallioffice.demo', gstin: '08AAECA7741D1Z9 (DEMO)', registrationType: 'Regular', billingAddress: '3rd Floor, Tonk Road Trade Tower, Jaipur', shippingAddress: '3rd Floor, Tonk Road Trade Tower, Jaipur', state: 'Rajasthan', openingBalance: 0, creditLimit: 250000, paymentTerms: 'Net 30', status: 'Active' },
  { id: 'cust-5', name: 'Mahalaxmi Traders - Delhi', businessName: 'Mahalaxmi Traders', mobile: '9811223344', email: 'accounts@mahalaxmidelhi.demo', gstin: '07AAHFM5520G1Z4 (DEMO)', registrationType: 'Regular', billingAddress: '45, Chawri Bazar, Old Delhi', shippingAddress: '45, Chawri Bazar, Old Delhi', state: 'Delhi', openingBalance: 15000, creditLimit: 400000, paymentTerms: 'Net 30', status: 'Active' },
  { id: 'cust-6', name: 'Surya Electricals & Appliances', businessName: 'Surya Electricals', mobile: '9820112299', email: 'surya.elec@demo.in', gstin: '27AADCS8831N1Z6 (DEMO)', registrationType: 'Regular', billingAddress: 'Unit 14, Andheri MIDC, Mumbai', shippingAddress: 'Unit 14, Andheri MIDC, Mumbai', state: 'Maharashtra', openingBalance: 0, creditLimit: 600000, paymentTerms: 'Net 30', status: 'Active' },
  { id: 'cust-7', name: 'Narmada Packaging Corp', businessName: 'Narmada Packaging Corp', mobile: '9825044180', email: 'purchase@narmadapack.demo', gstin: '24AAECN6623L1Z3 (DEMO)', registrationType: 'Regular', billingAddress: 'GIDC Phase II, Vatva, Ahmedabad', shippingAddress: 'GIDC Phase II, Vatva, Ahmedabad', state: 'Gujarat', openingBalance: 0, creditLimit: 350000, paymentTerms: 'Net 15', status: 'Active' },
  { id: 'cust-8', name: 'Kaveri Tech Park Facility Mgmt', businessName: 'Kaveri Tech Park', mobile: '9900118877', email: 'fm@kaveritech.demo', gstin: '29AABCK9102E1Z7 (DEMO)', registrationType: 'Regular', billingAddress: 'Whitefield Main Road, Bengaluru', shippingAddress: 'Whitefield Main Road, Bengaluru', state: 'Karnataka', openingBalance: 0, creditLimit: 450000, paymentTerms: 'Net 30', status: 'Active' },
  { id: 'cust-9', name: 'Bikaner Bhujia & Sweets House', businessName: 'Bikaner Sweets House', mobile: '9414033901', email: 'bikanersweets@demo.in', gstin: '08ABCFB1209Q1Z2 (DEMO)', registrationType: 'Regular', billingAddress: 'Station Road, Bikaner', shippingAddress: 'Station Road, Bikaner', state: 'Rajasthan', openingBalance: 0, creditLimit: 200000, paymentTerms: 'Immediate', status: 'Active' },
  { id: 'cust-10', name: 'Ganga Enterprises Lucknow', businessName: 'Ganga Enterprises', mobile: '9415022188', email: 'ganga.lko@demo.in', gstin: '09AAEFG3301P1Z5 (DEMO)', registrationType: 'Regular', billingAddress: 'Aminabad Market, Lucknow', shippingAddress: 'Aminabad Market, Lucknow', state: 'Uttar Pradesh', openingBalance: 0, creditLimit: 250000, paymentTerms: 'Net 15', status: 'Active' },
  { id: 'cust-11', name: 'Anand General Store (Walk-in)', businessName: 'Anand General Store', mobile: '9828411902', email: 'anand.store@demo.in', gstin: '', registrationType: 'Unregistered / Consumer', billingAddress: 'Sanganer Gate, Jaipur', shippingAddress: 'Sanganer Gate, Jaipur', state: 'Rajasthan', openingBalance: 0, creditLimit: 50000, paymentTerms: 'Immediate', status: 'Active' },
  { id: 'cust-12', name: 'Vikram Singh Rathore (Consumer)', businessName: 'Vikram Singh Rathore', mobile: '9784512098', email: 'vikram.r@demo.in', gstin: '', registrationType: 'Unregistered / Consumer', billingAddress: 'C-Scheme, Ashok Marg, Jaipur', shippingAddress: 'C-Scheme, Ashok Marg, Jaipur', state: 'Rajasthan', openingBalance: 0, creditLimit: 25000, paymentTerms: 'Immediate', status: 'Active' },
  { id: 'cust-13', name: 'Kota Coaching Hostel Group', businessName: 'Kota Hostel Group', mobile: '9414499011', email: 'stores@kotahostels.demo', gstin: '08AADCK5401M1Z8 (DEMO)', registrationType: 'Regular', billingAddress: 'Vigyan Nagar, Kota', shippingAddress: 'Vigyan Nagar, Kota', state: 'Rajasthan', openingBalance: 0, creditLimit: 400000, paymentTerms: 'Net 30', status: 'Active' },
  { id: 'cust-14', name: 'Gurgaon Corporate Hub LLP', businessName: 'Gurgaon Corporate Hub LLP', mobile: '9810455821', email: 'admin@ggnhub.demo', gstin: '06AAFCG4421H1Z1 (DEMO)', registrationType: 'Regular', billingAddress: 'Cyber City Phase II, Gurugram', shippingAddress: 'Cyber City Phase II, Gurugram', state: 'Haryana', openingBalance: 0, creditLimit: 300000, paymentTerms: 'Net 15', status: 'Active' },
  { id: 'cust-15', name: 'Marwar Builders & Contractors', businessName: 'Marwar Builders', mobile: '9414177822', email: 'billing@marwarbuilders.demo', gstin: '08AABCM8812T1Z4 (DEMO)', registrationType: 'Regular', billingAddress: 'Pal Road, Jodhpur', shippingAddress: 'Pal Road, Jodhpur', state: 'Rajasthan', openingBalance: 0, creditLimit: 500000, paymentTerms: 'Net 30', status: 'Active' },
  { id: 'cust-16', name: 'Retail Walk-in Counter', businessName: 'Cash Counter Customer', mobile: '9000000000', email: 'pos@sharmatraders.demo', gstin: '', registrationType: 'Unregistered / Consumer', billingAddress: 'Johari Bazaar Counter, Jaipur', shippingAddress: 'Johari Bazaar Counter, Jaipur', state: 'Rajasthan', openingBalance: 0, creditLimit: 0, paymentTerms: 'Immediate', status: 'Active' },
];

const suppliers = [
  { id: 'sup-1', name: 'Havells India Distribution Hub', contactPerson: 'Sanjeev Kapoor', mobile: '9811044501', email: 'dist.north@havellsdemo.in', gstin: '08AAACH1122A1Z5 (DEMO)', pan: 'AAACH1122A', address: 'RIICO Industrial Area, Bhiwadi', state: 'Rajasthan', openingBalance: 0, status: 'Active' },
  { id: 'sup-2', name: 'Polycab Regional Depot', contactPerson: 'Deepak Nair', mobile: '9820433210', email: 'jaipur.depot@polycabdemo.in', gstin: '24AAACP2233B1Z8 (DEMO)', pan: 'AAACP2233B', address: 'Halol GIDC, Panchmahal', state: 'Gujarat', openingBalance: 0, status: 'Active' },
  { id: 'sup-3', name: 'Adani Wilmar Wholesale Agency', contactPerson: 'Mahesh Khandelwal', mobile: '9829211400', email: 'orders@wilmaragency.demo', gstin: '08AABCA3344C1Z2 (DEMO)', pan: 'AABCA3344C', address: 'Vishwakarma Industrial Area, Jaipur', state: 'Rajasthan', openingBalance: 18500, status: 'Active' },
  { id: 'sup-4', name: 'ITC Foods & Paper Stockist', contactPerson: 'Anurag Tiwari', mobile: '9829077611', email: 'stockist@itcdemo.in', gstin: '08AAACI4455D1Z9 (DEMO)', pan: 'AAACI4455D', address: 'Sitapura Phase I, Jaipur', state: 'Rajasthan', openingBalance: 0, status: 'Active' },
  { id: 'sup-5', name: 'Crompton Greaves Appliances Dist.', contactPerson: 'Prakash Joshi', mobile: '9822088912', email: 'supply@cromptondemo.in', gstin: '27AAACC5566E1Z4 (DEMO)', pan: 'AAACC5566E', address: 'Kanjurmarg East, Mumbai', state: 'Maharashtra', openingBalance: 0, status: 'Active' },
  { id: 'sup-6', name: 'Godrej & Boyce Hardware Supply', contactPerson: 'Ritu Deshmukh', mobile: '9820199331', email: 'hardware@godrejdemo.in', gstin: '27AAACG6677F1Z1 (DEMO)', pan: 'AAACG6677F', address: 'Vikhroli West, Mumbai', state: 'Maharashtra', openingBalance: 0, status: 'Active' },
  { id: 'sup-7', name: 'JK Paper Merchants Delhi', contactPerson: 'Harish Bansal', mobile: '9810377120', email: 'sales@jkpaperdemo.in', gstin: '07AAACJ7788G1Z7 (DEMO)', pan: 'AAACJ7788G', address: 'Okhla Phase III, New Delhi', state: 'Delhi', openingBalance: 0, status: 'Active' },
  { id: 'sup-8', name: 'PackPro Corrugation & Tapes', contactPerson: 'Nitin Agarwal', mobile: '9829366450', email: 'billing@packpro.demo', gstin: '08AABCP8899H1Z3 (DEMO)', pan: 'AABCP8899H', address: 'Bagru Industrial Area, Jaipur', state: 'Rajasthan', openingBalance: 0, status: 'Active' },
  { id: 'sup-9', name: 'Voltas Commercial Cooling Ltd', contactPerson: 'Vikash Verma', mobile: '9818822411', email: 'ac.supply@voltasdemo.in', gstin: '06AAACV9900J1Z6 (DEMO)', pan: 'AAACV9900J', address: 'Udyog Vihar, Gurugram', state: 'Haryana', openingBalance: 0, status: 'Active' },
  { id: 'sup-10', name: 'Luminous Power Technologies Dist.', contactPerson: 'Ashok Saini', mobile: '9829512340', email: 'jaipur@luminousdemo.in', gstin: '08AAACL1010K1Z2 (DEMO)', pan: 'AAACL1010K', address: '22 Godam Industrial Estate, Jaipur', state: 'Rajasthan', openingBalance: 0, status: 'Active' },
  { id: 'sup-11', name: 'Asian Paints Depot Jaipur', contactPerson: 'Kunal Mehta', mobile: '9829644123', email: 'depot@asiandemo.in', gstin: '08AAACA1212L1Z8 (DEMO)', pan: 'AAACA1212L', address: 'Sanganer Industrial Area, Jaipur', state: 'Rajasthan', openingBalance: 0, status: 'Active' },
  { id: 'sup-12', name: 'Bosch Power Tools India', contactPerson: 'Siddharth Rao', mobile: '9900244890', email: 'tools@boschdemo.in', gstin: '29AAACB1414M1Z1 (DEMO)', pan: 'AAACB1414M', address: 'Adugodi, Bengaluru', state: 'Karnataka', openingBalance: 0, status: 'Active' },
];

const prodById = Object.fromEntries(products.map((p) => [p.id, p]));
const custById = Object.fromEntries(customers.map((c) => [c.id, c]));
const supById = Object.fromEntries(suppliers.map((s) => [s.id, s]));

function buildInvoice(spec) {
  const cust = custById[spec.customerId];
  const rawItems = spec.items.map((it) => {
    const p = prodById[it.productId];
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      hsn: p.hsn,
      unit: p.unit,
      qty: it.qty,
      rate: it.rate ?? p.sellingPrice,
      discountPct: it.discountPct || 0,
      gstRate: p.gstRate,
      cessRate: p.cessRate || 0,
    };
  });

  const totals = calculateInvoiceTotals({
    items: rawItems,
    sellerState: DEMO_BUSINESS.state,
    placeOfSupply: cust.state,
    shipping: spec.shipping || 0,
    otherCharges: spec.otherCharges || 0,
    roundOffEnabled: true,
    priceInclusive: false,
  });

  const amountPaid =
    spec.paymentStatus === 'Paid'
      ? totals.grandTotal
      : spec.paymentStatus === 'Partial'
      ? Math.round(totals.grandTotal * (spec.partialRatio || 0.5))
      : 0;

  return {
    id: spec.id,
    invoiceNumber: spec.invoiceNumber,
    date: spec.date,
    dueDate: spec.dueDate,
    financialYear: '2026-27',
    invoiceType: spec.invoiceType || 'Tax Invoice',
    customerId: cust.id,
    customerName: cust.name,
    customerGstin: cust.gstin,
    customerState: cust.state,
    placeOfSupply: cust.state,
    registrationType: cust.registrationType,
    billingAddress: cust.billingAddress,
    shippingAddress: cust.shippingAddress,
    paymentMethod: spec.paymentMethod || 'NEFT',
    status: spec.status || 'Finalized', // 'Finalized' | 'Draft' | 'Cancelled'
    paymentStatus: spec.status === 'Cancelled' ? 'Cancelled' : spec.status === 'Draft' ? 'Draft' : spec.paymentStatus,
    amountPaid: spec.status === 'Cancelled' || spec.status === 'Draft' ? 0 : amountPaid,
    notes: spec.notes || 'Thank you for your business.',
    ...totals,
  };
}

const today = new Date().toISOString().slice(0, 10);

const invoiceSpecs = [
  { id: 'inv-1', invoiceNumber: 'ST/26-27/001', date: '2026-04-06', dueDate: '2026-04-21', customerId: 'cust-1', paymentStatus: 'Paid', paymentMethod: 'NEFT', items: [{ productId: 'prod-1', qty: 40 }, { productId: 'prod-2', qty: 8 }, { productId: 'prod-3', qty: 12 }] },
  { id: 'inv-2', invoiceNumber: 'ST/26-27/002', date: '2026-04-14', dueDate: '2026-05-14', customerId: 'cust-2', paymentStatus: 'Paid', paymentMethod: 'UPI', items: [{ productId: 'prod-7', qty: 12 }, { productId: 'prod-8', qty: 10 }, { productId: 'prod-9', qty: 15 }] },
  { id: 'inv-3', invoiceNumber: 'ST/26-27/003', date: '2026-05-03', dueDate: '2026-06-02', customerId: 'cust-5', paymentStatus: 'Paid', paymentMethod: 'NEFT', shipping: 850, items: [{ productId: 'prod-13', qty: 60 }, { productId: 'prod-14', qty: 10 }, { productId: 'prod-15', qty: 18 }] },
  { id: 'inv-4', invoiceNumber: 'ST/26-27/004', date: '2026-05-19', dueDate: '2026-06-18', customerId: 'cust-6', paymentStatus: 'Paid', paymentMethod: 'IMPS', shipping: 1200, items: [{ productId: 'prod-18', qty: 12 }, { productId: 'prod-19', qty: 8 }, { productId: 'prod-20', qty: 10 }] },
  { id: 'inv-5', invoiceNumber: 'ST/26-27/005', date: '2026-06-05', dueDate: '2026-06-20', customerId: 'cust-4', paymentStatus: 'Paid', paymentMethod: 'UPI', items: [{ productId: 'prod-13', qty: 45 }, { productId: 'prod-16', qty: 10 }] },
  { id: 'inv-6', invoiceNumber: 'ST/26-27/006', date: '2026-06-22', dueDate: '2026-07-07', customerId: 'cust-7', paymentStatus: 'Paid', paymentMethod: 'NEFT', shipping: 650, items: [{ productId: 'prod-28', qty: 18 }, { productId: 'prod-29', qty: 8 }, { productId: 'prod-30', qty: 6 }] },
  { id: 'inv-7', invoiceNumber: 'ST/26-27/007', date: '2026-07-08', dueDate: '2026-08-07', customerId: 'cust-8', paymentStatus: 'Paid', paymentMethod: 'NEFT', shipping: 1500, items: [{ productId: 'prod-22', qty: 2 }, { productId: 'prod-5', qty: 4 }] },
  { id: 'inv-8', invoiceNumber: 'ST/26-27/008', date: '2026-07-24', dueDate: '2026-08-08', customerId: 'cust-3', paymentStatus: 'Paid', paymentMethod: 'Cash', items: [{ productId: 'prod-7', qty: 6 }, { productId: 'prod-10', qty: 20 }, { productId: 'prod-11', qty: 6 }] },
  { id: 'inv-9', invoiceNumber: 'ST/26-27/009', date: '2026-08-11', dueDate: '2026-09-10', customerId: 'cust-13', paymentStatus: 'Paid', paymentMethod: 'Cheque', items: [{ productId: 'prod-18', qty: 15 }, { productId: 'prod-1', qty: 60 }] },
  { id: 'inv-10', invoiceNumber: 'ST/26-27/010', date: '2026-08-26', dueDate: '2026-09-25', customerId: 'cust-15', paymentStatus: 'Paid', paymentMethod: 'NEFT', items: [{ productId: 'prod-25', qty: 10 }, { productId: 'prod-23', qty: 20 }, { productId: 'prod-24', qty: 4 }] },
  { id: 'inv-11', invoiceNumber: 'ST/26-27/011', date: '2026-09-09', dueDate: '2026-09-24', customerId: 'cust-10', paymentStatus: 'Paid', paymentMethod: 'IMPS', shipping: 700, items: [{ productId: 'prod-2', qty: 10 }, { productId: 'prod-3', qty: 15 }] },
  { id: 'inv-12', invoiceNumber: 'ST/26-27/012', date: '2026-09-21', dueDate: '2026-10-06', customerId: 'cust-9', paymentStatus: 'Paid', paymentMethod: 'UPI', items: [{ productId: 'prod-7', qty: 10 }, { productId: 'prod-8', qty: 8 }] },
  { id: 'inv-13', invoiceNumber: 'ST/26-27/013', date: '2026-10-04', dueDate: '2026-10-19', customerId: 'cust-14', paymentStatus: 'Partial', partialRatio: 0.6, paymentMethod: 'NEFT', shipping: 500, items: [{ productId: 'prod-13', qty: 50 }, { productId: 'prod-31', qty: 12 }, { productId: 'prod-32', qty: 15 }] },
  { id: 'inv-14', invoiceNumber: 'ST/26-27/014', date: '2026-10-12', dueDate: '2026-11-11', customerId: 'cust-6', paymentStatus: 'Partial', partialRatio: 0.5, paymentMethod: 'NEFT', shipping: 1800, items: [{ productId: 'prod-22', qty: 3 }, { productId: 'prod-20', qty: 12 }] },
  { id: 'inv-15', invoiceNumber: 'ST/26-27/015', date: '2026-10-19', dueDate: '2026-11-03', customerId: 'cust-1', paymentStatus: 'Unpaid', paymentMethod: 'Credit', items: [{ productId: 'prod-2', qty: 12 }, { productId: 'prod-5', qty: 3 }, { productId: 'prod-26', qty: 20 }] },
  { id: 'inv-16', invoiceNumber: 'ST/26-27/016', date: '2026-10-25', dueDate: '2026-11-24', customerId: 'cust-2', paymentStatus: 'Partial', partialRatio: 0.4, paymentMethod: 'UPI', items: [{ productId: 'prod-8', qty: 15 }, { productId: 'prod-11', qty: 10 }, { productId: 'prod-28', qty: 15 }] },
  { id: 'inv-17', invoiceNumber: 'ST/26-27/017', date: '2026-10-28', dueDate: '2026-11-12', customerId: 'cust-11', paymentStatus: 'Paid', paymentMethod: 'Cash', items: [{ productId: 'prod-9', qty: 12 }, { productId: 'prod-10', qty: 18 }] },
  { id: 'inv-18', invoiceNumber: 'ST/26-27/018', date: '2026-11-02', dueDate: '2026-12-02', customerId: 'cust-5', paymentStatus: 'Unpaid', paymentMethod: 'Credit', shipping: 950, items: [{ productId: 'prod-14', qty: 14 }, { productId: 'prod-15', qty: 20 }, { productId: 'prod-16', qty: 12 }] },
  { id: 'inv-19', invoiceNumber: 'ST/26-27/019', date: '2026-11-06', dueDate: '2026-11-21', customerId: 'cust-7', paymentStatus: 'Unpaid', paymentMethod: 'Credit', shipping: 600, items: [{ productId: 'prod-29', qty: 10 }, { productId: 'prod-30', qty: 10 }, { productId: 'prod-31', qty: 10 }] },
  { id: 'inv-20', invoiceNumber: 'ST/26-27/020', date: '2026-11-09', dueDate: '2026-11-09', customerId: 'cust-12', paymentStatus: 'Paid', paymentMethod: 'Card', items: [{ productId: 'prod-19', qty: 1 }, { productId: 'prod-20', qty: 1 }, { productId: 'prod-21', qty: 2 }] },
  { id: 'inv-21', invoiceNumber: 'ST/26-27/021', date: '2026-11-12', dueDate: '2026-12-12', customerId: 'cust-13', paymentStatus: 'Partial', partialRatio: 0.5, paymentMethod: 'NEFT', items: [{ productId: 'prod-4', qty: 35 }, { productId: 'prod-1', qty: 50 }, { productId: 'prod-23', qty: 15 }] },
  { id: 'inv-22', invoiceNumber: 'ST/26-27/022', date: '2026-11-15', dueDate: '2026-12-15', customerId: 'cust-15', paymentStatus: 'Unpaid', paymentMethod: 'Credit', items: [{ productId: 'prod-24', qty: 5 }, { productId: 'prod-25', qty: 8 }, { productId: 'prod-27', qty: 12 }] },
  { id: 'inv-23', invoiceNumber: 'ST/26-27/023', date: '2026-11-17', dueDate: '2026-11-17', customerId: 'cust-16', status: 'Cancelled', paymentStatus: 'Cancelled', paymentMethod: 'UPI', items: [{ productId: 'prod-18', qty: 2 }] },
  { id: 'inv-24', invoiceNumber: 'ST/26-27/024', date: '2026-11-18', dueDate: '2026-12-03', customerId: 'cust-4', status: 'Draft', paymentStatus: 'Draft', paymentMethod: 'Credit', items: [{ productId: 'prod-13', qty: 30 }, { productId: 'prod-15', qty: 10 }] },
  { id: 'inv-25', invoiceNumber: 'ST/26-27/025', date: '2026-11-19', dueDate: '2026-12-04', customerId: 'cust-8', status: 'Draft', paymentStatus: 'Draft', paymentMethod: 'Credit', items: [{ productId: 'prod-5', qty: 2 }, { productId: 'prod-24', qty: 3 }] },
  { id: 'inv-26', invoiceNumber: 'ST/26-27/026', date: today, dueDate: today, customerId: 'cust-2', paymentStatus: 'Paid', paymentMethod: 'UPI', items: [{ productId: 'prod-7', qty: 4 }, { productId: 'prod-8', qty: 5 }, { productId: 'prod-12', qty: 6 }] },
];

const invoices = invoiceSpecs.map(buildInvoice);

function buildPurchase(spec) {
  const sup = supById[spec.supplierId];
  const rawItems = spec.items.map((it) => {
    const p = prodById[it.productId];
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      hsn: p.hsn,
      unit: p.unit,
      qty: it.qty,
      rate: it.rate ?? p.purchasePrice,
      discountPct: it.discountPct || 0,
      gstRate: p.gstRate,
      cessRate: 0,
    };
  });
  const totals = calculateInvoiceTotals({
    items: rawItems,
    sellerState: sup.state,
    placeOfSupply: DEMO_BUSINESS.state,
    shipping: spec.shipping || 0,
    otherCharges: 0,
    roundOffEnabled: true,
  });
  const amountPaid =
    spec.paymentStatus === 'Paid'
      ? totals.grandTotal
      : spec.paymentStatus === 'Partial'
      ? Math.round(totals.grandTotal * 0.5)
      : 0;

  return {
    id: spec.id,
    billNumber: spec.billNumber,
    supplierInvoiceNo: spec.supplierInvoiceNo,
    date: spec.date,
    dueDate: spec.dueDate,
    financialYear: '2026-27',
    supplierId: sup.id,
    supplierName: sup.name,
    supplierGstin: sup.gstin,
    supplierState: sup.state,
    status: 'Received',
    paymentStatus: spec.paymentStatus,
    amountPaid,
    paymentMethod: spec.paymentMethod || 'NEFT',
    itcEligible: true,
    ...totals,
  };
}

const purchases = [
  buildPurchase({ id: 'pur-1', billNumber: 'PB/26-27/001', supplierInvoiceNo: 'HAV/RAJ/26-081', date: '2026-04-02', dueDate: '2026-05-02', supplierId: 'sup-1', paymentStatus: 'Paid', items: [{ productId: 'prod-1', qty: 180 }, { productId: 'prod-4', qty: 80 }] }),
  buildPurchase({ id: 'pur-2', billNumber: 'PB/26-27/002', supplierInvoiceNo: 'POL/GJ/26-192', date: '2026-04-10', dueDate: '2026-05-10', supplierId: 'sup-2', paymentStatus: 'Paid', shipping: 1100, items: [{ productId: 'prod-2', qty: 45 }, { productId: 'prod-3', qty: 60 }] }),
  buildPurchase({ id: 'pur-3', billNumber: 'PB/26-27/003', supplierInvoiceNo: 'AWL/JPR/411', date: '2026-05-04', dueDate: '2026-05-19', supplierId: 'sup-3', paymentStatus: 'Paid', items: [{ productId: 'prod-7', qty: 50 }, { productId: 'prod-8', qty: 60 }, { productId: 'prod-9', qty: 70 }] }),
  buildPurchase({ id: 'pur-4', billNumber: 'PB/26-27/004', supplierInvoiceNo: 'ITC/STP/882', date: '2026-05-18', dueDate: '2026-06-17', supplierId: 'sup-4', paymentStatus: 'Paid', items: [{ productId: 'prod-10', qty: 80 }, { productId: 'prod-14', qty: 40 }] }),
  buildPurchase({ id: 'pur-5', billNumber: 'PB/26-27/005', supplierInvoiceNo: 'CRM/MH/510', date: '2026-06-08', dueDate: '2026-07-08', supplierId: 'sup-5', paymentStatus: 'Paid', shipping: 1400, items: [{ productId: 'prod-18', qty: 35 }, { productId: 'prod-19', qty: 25 }, { productId: 'prod-20', qty: 25 }] }),
  buildPurchase({ id: 'pur-6', billNumber: 'PB/26-27/006', supplierInvoiceNo: 'JKP/DL/339', date: '2026-06-25', dueDate: '2026-07-25', supplierId: 'sup-7', paymentStatus: 'Paid', shipping: 900, items: [{ productId: 'prod-13', qty: 240 }, { productId: 'prod-15', qty: 60 }, { productId: 'prod-16', qty: 25 }] }),
  buildPurchase({ id: 'pur-7', billNumber: 'PB/26-27/007', supplierInvoiceNo: 'PKP/JPR/104', date: '2026-07-12', dueDate: '2026-08-11', supplierId: 'sup-8', paymentStatus: 'Paid', items: [{ productId: 'prod-28', qty: 80 }, { productId: 'prod-29', qty: 30 }, { productId: 'prod-30', qty: 25 }, { productId: 'prod-31', qty: 40 }] }),
  buildPurchase({ id: 'pur-8', billNumber: 'PB/26-27/008', supplierInvoiceNo: 'VOL/HR/771', date: '2026-07-29', dueDate: '2026-08-28', supplierId: 'sup-9', paymentStatus: 'Paid', shipping: 2200, items: [{ productId: 'prod-22', qty: 8 }] }),
  buildPurchase({ id: 'pur-9', billNumber: 'PB/26-27/009', supplierInvoiceNo: 'GOD/MH/902', date: '2026-08-14', dueDate: '2026-09-13', supplierId: 'sup-6', paymentStatus: 'Paid', shipping: 750, items: [{ productId: 'prod-23', qty: 80 }, { productId: 'prod-27', qty: 35 }] }),
  buildPurchase({ id: 'pur-10', billNumber: 'PB/26-27/010', supplierInvoiceNo: 'LUM/JPR/219', date: '2026-09-04', dueDate: '2026-10-04', supplierId: 'sup-10', paymentStatus: 'Paid', items: [{ productId: 'prod-5', qty: 14 }, { productId: 'prod-6', qty: 10 }] }),
  buildPurchase({ id: 'pur-11', billNumber: 'PB/26-27/011', supplierInvoiceNo: 'ASN/JPR/615', date: '2026-09-19', dueDate: '2026-10-19', supplierId: 'sup-11', paymentStatus: 'Paid', items: [{ productId: 'prod-25', qty: 22 }] }),
  buildPurchase({ id: 'pur-12', billNumber: 'PB/26-27/012', supplierInvoiceNo: 'BSH/KA/442', date: '2026-10-06', dueDate: '2026-11-05', supplierId: 'sup-12', paymentStatus: 'Partial', shipping: 800, items: [{ productId: 'prod-24', qty: 18 }, { productId: 'prod-26', qty: 60 }] }),
  buildPurchase({ id: 'pur-13', billNumber: 'PB/26-27/013', supplierInvoiceNo: 'AWL/JPR/589', date: '2026-10-22', dueDate: '2026-11-21', supplierId: 'sup-3', paymentStatus: 'Unpaid', items: [{ productId: 'prod-7', qty: 25 }, { productId: 'prod-11', qty: 25 }, { productId: 'prod-12', qty: 30 }] }),
  buildPurchase({ id: 'pur-14', billNumber: 'PB/26-27/014', supplierInvoiceNo: 'CRM/MH/840', date: '2026-11-03', dueDate: '2026-12-03', supplierId: 'sup-5', paymentStatus: 'Unpaid', shipping: 950, items: [{ productId: 'prod-18', qty: 18 }, { productId: 'prod-21', qty: 20 }] }),
  buildPurchase({ id: 'pur-15', billNumber: 'PB/26-27/015', supplierInvoiceNo: 'JKP/DL/518', date: '2026-11-11', dueDate: '2026-12-11', supplierId: 'sup-7', paymentStatus: 'Partial', items: [{ productId: 'prod-13', qty: 100 }, { productId: 'prod-17', qty: 25 }] }),
  buildPurchase({ id: 'pur-16', billNumber: 'PB/26-27/016', supplierInvoiceNo: 'PKP/JPR/229', date: '2026-11-16', dueDate: '2026-12-16', supplierId: 'sup-8', paymentStatus: 'Unpaid', items: [{ productId: 'prod-32', qty: 50 }, { productId: 'prod-28', qty: 30 }] }),
];

// Generate matching payments for Paid & Partial invoices and purchases
const payments = [];
let paySeq = 1;
invoices.forEach((inv) => {
  if (inv.amountPaid > 0 && inv.status !== 'Cancelled' && inv.status !== 'Draft') {
    payments.push({
      id: `pay-in-${paySeq}`,
      paymentNumber: `RCPT/26-27/${String(paySeq).padStart(3, '0')}`,
      type: 'Payment In',
      date: inv.date,
      partyId: inv.customerId,
      partyName: inv.customerName,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amountPaid,
      method: inv.paymentMethod === 'Credit' ? 'NEFT' : inv.paymentMethod,
      accountName: inv.paymentMethod === 'Cash' ? 'Petty Cash Counter' : inv.paymentMethod === 'UPI' ? 'Business UPI Wallet' : 'HDFC Bank Current A/c',
      referenceNo: inv.paymentMethod === 'Cash' ? `CASH-${paySeq}` : `UTR2611${String(1000 + paySeq)}`,
      status: 'Completed',
      notes: `Payment received against ${inv.invoiceNumber}`,
    });
    paySeq++;
  }
});

purchases.forEach((pur) => {
  if (pur.amountPaid > 0) {
    payments.push({
      id: `pay-out-${paySeq}`,
      paymentNumber: `PYMT/26-27/${String(paySeq).padStart(3, '0')}`,
      type: 'Payment Out',
      date: pur.date,
      partyId: pur.supplierId,
      partyName: pur.supplierName,
      invoiceId: pur.id,
      invoiceNumber: pur.billNumber,
      amount: pur.amountPaid,
      method: pur.paymentMethod || 'NEFT',
      accountName: 'HDFC Bank Current A/c',
      referenceNo: `NEFT26${String(4000 + paySeq)}`,
      status: 'Completed',
      notes: `Supplier settlement for ${pur.supplierInvoiceNo}`,
    });
    paySeq++;
  }
});

const bankAccounts = [
  { id: 'acc-1', name: 'HDFC Bank Current A/c', type: 'Bank', accountNo: 'XXXX-92011', ifsc: 'HDFC0000142', openingBalance: 1285000, balance: 1482400 },
  { id: 'acc-2', name: 'ICICI Business Banking', type: 'Bank', accountNo: 'XXXX-44109', ifsc: 'ICIC0000048', openingBalance: 420000, balance: 448500 },
  { id: 'acc-3', name: 'Petty Cash Counter', type: 'Cash', accountNo: 'CASH-JPR-01', ifsc: '—', openingBalance: 145000, balance: 162300 },
  { id: 'acc-4', name: 'Business UPI Wallet', type: 'UPI', accountNo: 'sharmatraders@hdfcbank', ifsc: 'UPI', openingBalance: 64500, balance: 98250 },
];

const expenses = [
  { id: 'exp-1', expenseNumber: 'EXP/26-27/001', date: '2026-04-05', category: 'Rent & Warehouse Lease', title: 'Johari Bazaar Showroom & Godown Rent (Apr)', vendorName: 'Khandelwal Properties', vendorGstin: '08AAACK9912R1Z2 (DEMO)', amount: 45000, gstRate: 18, cgst: 4050, sgst: 4050, igst: 0, totalAmount: 53100, paymentMethod: 'NEFT', recurring: true, itcEligible: true, status: 'Paid', notes: 'Monthly lease invoice' },
  { id: 'exp-2', expenseNumber: 'EXP/26-27/002', date: '2026-05-05', category: 'Rent & Warehouse Lease', title: 'Johari Bazaar Showroom & Godown Rent (May)', vendorName: 'Khandelwal Properties', vendorGstin: '08AAACK9912R1Z2 (DEMO)', amount: 45000, gstRate: 18, cgst: 4050, sgst: 4050, igst: 0, totalAmount: 53100, paymentMethod: 'NEFT', recurring: true, itcEligible: true, status: 'Paid', notes: 'Monthly lease invoice' },
  { id: 'exp-3', expenseNumber: 'EXP/26-27/003', date: '2026-06-10', category: 'Electricity & Utilities', title: 'JVVNL Commercial Electricity Bill', vendorName: 'JVVNL Jaipur', vendorGstin: '', amount: 11400, gstRate: 0, cgst: 0, sgst: 0, igst: 0, totalAmount: 11400, paymentMethod: 'UPI', recurring: true, itcEligible: false, status: 'Paid', notes: 'Meter #JPR8812' },
  { id: 'exp-4', expenseNumber: 'EXP/26-27/004', date: '2026-06-30', category: 'Staff Salaries & Wages', title: 'Staff Payroll - June 2026 (5 Employees)', vendorName: 'Internal Payroll', vendorGstin: '', amount: 118000, gstRate: 0, cgst: 0, sgst: 0, igst: 0, totalAmount: 118000, paymentMethod: 'NEFT', recurring: true, itcEligible: false, status: 'Paid', notes: 'Direct salary transfer' },
  { id: 'exp-5', expenseNumber: 'EXP/26-27/005', date: '2026-07-14', category: 'Freight & Logistics', title: 'Jaipur-Mumbai & Delhi Tempo Dispatch', vendorName: 'Marudhara Roadlines', vendorGstin: '08AABCM3310T1Z6 (DEMO)', amount: 14200, gstRate: 5, cgst: 355, sgst: 355, igst: 0, totalAmount: 14910, paymentMethod: 'UPI', recurring: false, itcEligible: true, status: 'Paid', notes: 'LR #MR-4012 to 4019' },
  { id: 'exp-6', expenseNumber: 'EXP/26-27/006', date: '2026-08-05', category: 'Rent & Warehouse Lease', title: 'Sitapura Hub Monthly Rent (Aug)', vendorName: 'RIICO Warehouse Trust', vendorGstin: '08AAACR5511E1Z4 (DEMO)', amount: 28000, gstRate: 18, cgst: 2520, sgst: 2520, igst: 0, totalAmount: 33040, paymentMethod: 'NEFT', recurring: true, itcEligible: true, status: 'Paid', notes: '' },
  { id: 'exp-7', expenseNumber: 'EXP/26-27/007', date: '2026-08-22', category: 'Software & Telecom', title: 'Airtel Leased Line & Billing Cloud Renewal', vendorName: 'Bharti Airtel Ltd', vendorGstin: '08AAACB2894G1Z9 (DEMO)', amount: 4200, gstRate: 18, cgst: 378, sgst: 378, igst: 0, totalAmount: 4956, paymentMethod: 'Card', recurring: true, itcEligible: true, status: 'Paid', notes: 'Quarterly plan' },
  { id: 'exp-8', expenseNumber: 'EXP/26-27/008', date: '2026-09-12', category: 'Professional & CA Fees', title: 'Quarterly GST Audit & Compliance Retainer', vendorName: 'M.K. Jain & Associates CA', vendorGstin: '08AAHFM1102D1Z3 (DEMO)', amount: 15000, gstRate: 18, cgst: 1350, sgst: 1350, igst: 0, totalAmount: 17700, paymentMethod: 'NEFT', recurring: false, itcEligible: true, status: 'Paid', notes: 'Q2 Filing Retainer' },
  { id: 'exp-9', expenseNumber: 'EXP/26-27/009', date: '2026-09-28', category: 'Repairs & Maintenance', title: 'Godown Forklift & AC Servicing', vendorName: 'Jaipur Mech Works', vendorGstin: '08BKCJM4412P1Z1 (DEMO)', amount: 6800, gstRate: 18, cgst: 612, sgst: 612, igst: 0, totalAmount: 8024, paymentMethod: 'Cash', recurring: false, itcEligible: true, status: 'Paid', notes: '' },
  { id: 'exp-10', expenseNumber: 'EXP/26-27/010', date: '2026-10-05', category: 'Rent & Warehouse Lease', title: 'Johari Bazaar Showroom Rent (Oct)', vendorName: 'Khandelwal Properties', vendorGstin: '08AAACK9912R1Z2 (DEMO)', amount: 45000, gstRate: 18, cgst: 4050, sgst: 4050, igst: 0, totalAmount: 53100, paymentMethod: 'NEFT', recurring: true, itcEligible: true, status: 'Paid', notes: '' },
  { id: 'exp-11', expenseNumber: 'EXP/26-27/011', date: '2026-10-18', category: 'Marketing & Promotion', title: 'Diwali Wholesale Product Catalogue Printing', vendorName: 'Pinkcity Offset Printers', vendorGstin: '08AABCP7120F1Z5 (DEMO)', amount: 9500, gstRate: 12, cgst: 570, sgst: 570, igst: 0, totalAmount: 10640, paymentMethod: 'UPI', recurring: false, itcEligible: true, status: 'Paid', notes: '1,000 copies' },
  { id: 'exp-12', expenseNumber: 'EXP/26-27/012', date: '2026-10-31', category: 'Staff Salaries & Wages', title: 'Staff Payroll & Diwali Bonus (Oct)', vendorName: 'Internal Payroll', vendorGstin: '', amount: 142000, gstRate: 0, cgst: 0, sgst: 0, igst: 0, totalAmount: 142000, paymentMethod: 'NEFT', recurring: true, itcEligible: false, status: 'Paid', notes: '' },
  { id: 'exp-13', expenseNumber: 'EXP/26-27/013', date: '2026-11-05', category: 'Rent & Warehouse Lease', title: 'Johari Bazaar Showroom Rent (Nov)', vendorName: 'Khandelwal Properties', vendorGstin: '08AAACK9912R1Z2 (DEMO)', amount: 45000, gstRate: 18, cgst: 4050, sgst: 4050, igst: 0, totalAmount: 53100, paymentMethod: 'NEFT', recurring: true, itcEligible: true, status: 'Paid', notes: '' },
  { id: 'exp-14', expenseNumber: 'EXP/26-27/014', date: '2026-11-10', category: 'Office & Packaging Supplies', title: 'Printer Toner & Thermal Billing Rolls', vendorName: 'Shree Office Mart', vendorGstin: '08AAACS4421N1Z7 (DEMO)', amount: 3600, gstRate: 18, cgst: 324, sgst: 324, igst: 0, totalAmount: 4248, paymentMethod: 'Cash', recurring: false, itcEligible: true, status: 'Paid', notes: '' },
  { id: 'exp-15', expenseNumber: 'EXP/26-27/015', date: '2026-11-14', category: 'Freight & Logistics', title: 'Local E-Rickshaw & Loader Delivery Charges', vendorName: 'Jaipur City Logistics', vendorGstin: '', amount: 4800, gstRate: 0, cgst: 0, sgst: 0, igst: 0, totalAmount: 4800, paymentMethod: 'Cash', recurring: false, itcEligible: false, status: 'Paid', notes: '' },
  { id: 'exp-16', expenseNumber: 'EXP/26-27/016', date: '2026-11-18', category: 'Bank & Payment Charges', title: 'POS Terminal & Gateway MDR Charges', vendorName: 'HDFC Merchant Services', vendorGstin: '08AAACH2702H1Z8 (DEMO)', amount: 1850, gstRate: 18, cgst: 166.5, sgst: 166.5, igst: 0, totalAmount: 2183, paymentMethod: 'NEFT', recurring: false, itcEligible: true, status: 'Paid', notes: 'Auto-debited' },
];

function buildSimpleDoc(spec, type) {
  const cust = custById[spec.customerId];
  const rawItems = spec.items.map((it) => {
    const p = prodById[it.productId];
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      hsn: p.hsn,
      unit: p.unit,
      qty: it.qty,
      rate: it.rate ?? p.sellingPrice,
      discountPct: it.discountPct || 0,
      gstRate: p.gstRate,
      cessRate: 0,
    };
  });
  const totals = calculateInvoiceTotals({
    items: rawItems,
    sellerState: DEMO_BUSINESS.state,
    placeOfSupply: cust.state,
    shipping: 0,
    otherCharges: 0,
    roundOffEnabled: true,
  });
  return {
    ...spec,
    docType: type,
    customerName: cust.name,
    customerGstin: cust.gstin,
    customerState: cust.state,
    placeOfSupply: cust.state,
    ...totals,
  };
}

const quotations = [
  buildSimpleDoc({ id: 'qt-1', quotationNumber: 'QT/26-27/001', date: '2026-10-08', validUntil: '2026-10-23', customerId: 'cust-1', status: 'Converted', items: [{ productId: 'prod-2', qty: 10 }, { productId: 'prod-3', qty: 20 }] }, 'Quotation'),
  buildSimpleDoc({ id: 'qt-2', quotationNumber: 'QT/26-27/002', date: '2026-10-15', validUntil: '2026-10-30', customerId: 'cust-6', status: 'Sent', items: [{ productId: 'prod-22', qty: 4 }, { productId: 'prod-18', qty: 10 }] }, 'Quotation'),
  buildSimpleDoc({ id: 'qt-3', quotationNumber: 'QT/26-27/003', date: '2026-10-24', validUntil: '2026-11-08', customerId: 'cust-8', status: 'Accepted', items: [{ productId: 'prod-5', qty: 6 }, { productId: 'prod-6', qty: 8 }] }, 'Quotation'),
  buildSimpleDoc({ id: 'qt-4', quotationNumber: 'QT/26-27/004', date: '2026-11-01', validUntil: '2026-11-16', customerId: 'cust-13', status: 'Sent', items: [{ productId: 'prod-1', qty: 100 }, { productId: 'prod-4', qty: 40 }] }, 'Quotation'),
  buildSimpleDoc({ id: 'qt-5', quotationNumber: 'QT/26-27/005', date: '2026-11-05', validUntil: '2026-11-20', customerId: 'cust-15', status: 'Draft', items: [{ productId: 'prod-25', qty: 15 }, { productId: 'prod-24', qty: 5 }] }, 'Quotation'),
  buildSimpleDoc({ id: 'qt-6', quotationNumber: 'QT/26-27/006', date: '2026-11-10', validUntil: '2026-11-25', customerId: 'cust-2', status: 'Accepted', items: [{ productId: 'prod-7', qty: 15 }, { productId: 'prod-8', qty: 12 }] }, 'Quotation'),
  buildSimpleDoc({ id: 'qt-7', quotationNumber: 'QT/26-27/007', date: '2026-11-14', validUntil: '2026-11-29', customerId: 'cust-14', status: 'Sent', items: [{ productId: 'prod-13', qty: 80 }, { productId: 'prod-28', qty: 20 }] }, 'Quotation'),
  buildSimpleDoc({ id: 'qt-8', quotationNumber: 'QT/26-27/008', date: '2026-11-18', validUntil: '2026-12-03', customerId: 'cust-4', status: 'Expired', items: [{ productId: 'prod-15', qty: 25 }, { productId: 'prod-16', qty: 15 }] }, 'Quotation'),
];

const salesOrders = [
  buildSimpleDoc({ id: 'so-1', orderNumber: 'SO/26-27/001', date: '2026-11-04', expectedDelivery: '2026-11-10', customerId: 'cust-6', status: 'Invoiced', items: [{ productId: 'prod-22', qty: 2 }, { productId: 'prod-20', qty: 10 }] }, 'Sales Order'),
  buildSimpleDoc({ id: 'so-2', orderNumber: 'SO/26-27/002', date: '2026-11-09', expectedDelivery: '2026-11-16', customerId: 'cust-8', status: 'Confirmed', items: [{ productId: 'prod-5', qty: 5 }, { productId: 'prod-2', qty: 10 }] }, 'Sales Order'),
  buildSimpleDoc({ id: 'so-3', orderNumber: 'SO/26-27/003', date: '2026-11-12', expectedDelivery: '2026-11-20', customerId: 'cust-2', status: 'Processing', items: [{ productId: 'prod-7', qty: 12 }, { productId: 'prod-8', qty: 15 }] }, 'Sales Order'),
  buildSimpleDoc({ id: 'so-4', orderNumber: 'SO/26-27/004', date: '2026-11-15', expectedDelivery: '2026-11-24', customerId: 'cust-13', status: 'Confirmed', items: [{ productId: 'prod-18', qty: 12 }, { productId: 'prod-1', qty: 50 }] }, 'Sales Order'),
  buildSimpleDoc({ id: 'so-5', orderNumber: 'SO/26-27/005', date: '2026-11-18', expectedDelivery: '2026-11-27', customerId: 'cust-7', status: 'Pending', items: [{ productId: 'prod-28', qty: 25 }, { productId: 'prod-29', qty: 10 }] }, 'Sales Order'),
  buildSimpleDoc({ id: 'so-6', orderNumber: 'SO/26-27/006', date: '2026-11-20', expectedDelivery: '2026-11-28', customerId: 'cust-15', status: 'Confirmed', items: [{ productId: 'prod-23', qty: 20 }, { productId: 'prod-25', qty: 8 }] }, 'Sales Order'),
];

const deliveryChallans = [
  buildSimpleDoc({ id: 'dc-1', challanNumber: 'DC/26-27/001', date: '2026-10-12', customerId: 'cust-6', vehicleNo: 'RJ-14-GC-4412', transporter: 'VRL Logistics', status: 'Delivered', items: [{ productId: 'prod-22', qty: 3 }, { productId: 'prod-20', qty: 12 }] }, 'Delivery Challan'),
  buildSimpleDoc({ id: 'dc-2', challanNumber: 'DC/26-27/002', date: '2026-10-25', customerId: 'cust-2', vehicleNo: 'RJ-14-TB-9012', transporter: 'Local Delivery Van', status: 'Delivered', items: [{ productId: 'prod-8', qty: 15 }, { productId: 'prod-11', qty: 10 }] }, 'Delivery Challan'),
  buildSimpleDoc({ id: 'dc-3', challanNumber: 'DC/26-27/003', date: '2026-11-06', customerId: 'cust-7', vehicleNo: 'GJ-01-HT-7710', transporter: 'Gati KWE', status: 'In Transit', items: [{ productId: 'prod-29', qty: 10 }, { productId: 'prod-30', qty: 10 }] }, 'Delivery Challan'),
  buildSimpleDoc({ id: 'dc-4', challanNumber: 'DC/26-27/004', date: '2026-11-12', customerId: 'cust-13', vehicleNo: 'RJ-20-PA-3109', transporter: 'SafeExpress', status: 'Delivered', items: [{ productId: 'prod-4', qty: 35 }, { productId: 'prod-1', qty: 50 }] }, 'Delivery Challan'),
  buildSimpleDoc({ id: 'dc-5', challanNumber: 'DC/26-27/005', date: '2026-11-16', customerId: 'cust-15', vehicleNo: 'RJ-19-GA-6620', transporter: 'Marudhara Transport', status: 'Dispatched', items: [{ productId: 'prod-24', qty: 5 }, { productId: 'prod-25', qty: 8 }] }, 'Delivery Challan'),
  buildSimpleDoc({ id: 'dc-6', challanNumber: 'DC/26-27/006', date: '2026-11-19', customerId: 'cust-1', vehicleNo: 'RJ-14-EV-1102', transporter: 'Self Pickup', status: 'Delivered', items: [{ productId: 'prod-2', qty: 6 }, { productId: 'prod-3', qty: 10 }] }, 'Delivery Challan'),
];

const creditNotes = [
  buildSimpleDoc({ id: 'cn-1', creditNoteNumber: 'CN/26-27/001', date: '2026-06-28', invoiceId: 'inv-4', invoiceNumber: 'ST/26-27/004', customerId: 'cust-6', reason: 'Transit damage on 1 unit', restoreStock: false, status: 'Issued', items: [{ productId: 'prod-20', qty: 1 }] }, 'Credit Note'),
  buildSimpleDoc({ id: 'cn-2', creditNoteNumber: 'CN/26-27/002', date: '2026-08-18', invoiceId: 'inv-9', invoiceNumber: 'ST/26-27/009', customerId: 'cust-13', reason: 'Excess quantity returned', restoreStock: true, status: 'Issued', items: [{ productId: 'prod-1', qty: 10 }] }, 'Credit Note'),
  buildSimpleDoc({ id: 'cn-3', creditNoteNumber: 'CN/26-27/003', date: '2026-09-25', invoiceId: 'inv-11', invoiceNumber: 'ST/26-27/011', customerId: 'cust-10', reason: 'Post-sale rate difference', restoreStock: false, status: 'Issued', items: [{ productId: 'prod-3', qty: 2 }] }, 'Credit Note'),
  buildSimpleDoc({ id: 'cn-4', creditNoteNumber: 'CN/26-27/004', date: '2026-10-20', invoiceId: 'inv-13', invoiceNumber: 'ST/26-27/013', customerId: 'cust-14', reason: 'Returned unopened cartons', restoreStock: true, status: 'Issued', items: [{ productId: 'prod-13', qty: 5 }] }, 'Credit Note'),
  buildSimpleDoc({ id: 'cn-5', creditNoteNumber: 'CN/26-27/005', date: '2026-11-14', invoiceId: 'inv-16', invoiceNumber: 'ST/26-27/016', customerId: 'cust-2', reason: 'Short expiry batch return', restoreStock: true, status: 'Issued', items: [{ productId: 'prod-11', qty: 2 }] }, 'Credit Note'),
];

const debitNotes = [
  buildSimpleDoc({ id: 'dn-1', debitNoteNumber: 'DN/26-27/001', date: '2026-07-15', invoiceId: 'inv-6', invoiceNumber: 'ST/26-27/006', customerId: 'cust-7', reason: 'Additional freight recovery', status: 'Issued', items: [{ productId: 'prod-28', qty: 1 }] }, 'Debit Note'),
  buildSimpleDoc({ id: 'dn-2', debitNoteNumber: 'DN/26-27/002', date: '2026-09-12', invoiceId: 'inv-10', invoiceNumber: 'ST/26-27/010', customerId: 'cust-15', reason: 'Price revision upward', status: 'Issued', items: [{ productId: 'prod-24', qty: 1 }] }, 'Debit Note'),
  buildSimpleDoc({ id: 'dn-3', debitNoteNumber: 'DN/26-27/003', date: '2026-10-29', invoiceId: 'inv-15', invoiceNumber: 'ST/26-27/015', customerId: 'cust-1', reason: 'Late payment interest charge', status: 'Issued', items: [{ productId: 'prod-26', qty: 2 }] }, 'Debit Note'),
  buildSimpleDoc({ id: 'dn-4', debitNoteNumber: 'DN/26-27/004', date: '2026-11-11', invoiceId: 'inv-18', invoiceNumber: 'ST/26-27/018', customerId: 'cust-5', reason: 'Special packing charges', status: 'Issued', items: [{ productId: 'prod-16', qty: 1 }] }, 'Debit Note'),
];

const purchaseReturns = [
  { id: 'pr-1', returnNumber: 'PR/26-27/001', date: '2026-08-20', purchaseId: 'pur-9', billNumber: 'PB/26-27/009', supplierId: 'sup-6', supplierName: 'Godrej & Boyce Hardware Supply', reason: 'Defective padlock batch', taxableValue: 1700, cgst: 0, sgst: 0, igst: 306, grandTotal: 2006, status: 'Completed', items: [{ productId: 'prod-23', name: 'Godrej Nav-Tal 7 Levers Brass Padlock', qty: 5, rate: 340, gstRate: 18 }] },
  { id: 'pr-2', returnNumber: 'PR/26-27/002', date: '2026-10-12', purchaseId: 'pur-12', billNumber: 'PB/26-27/012', supplierId: 'sup-12', supplierName: 'Bosch Power Tools India', reason: 'Wrong voltage model delivered', taxableValue: 2380, cgst: 0, sgst: 0, igst: 428.4, grandTotal: 2808, status: 'Completed', items: [{ productId: 'prod-24', name: 'Bosch 13mm Impact Drill Kit GSB 500W', qty: 1, rate: 2380, gstRate: 18 }] },
];

const grns = [
  { id: 'grn-1', grnNumber: 'GRN/26-27/001', date: '2026-10-06', poReference: 'PO-26-081', supplierId: 'sup-12', supplierName: 'Bosch Power Tools India', warehouseId: 'wh-2', items: [{ productId: 'prod-24', productName: 'Bosch 13mm Impact Drill Kit GSB 500W', orderedQty: 20, receivedQty: 18, damagedQty: 1, missingQty: 1 }], status: 'Completed', notes: '1 damaged unit reported to supplier' },
  { id: 'grn-2', grnNumber: 'GRN/26-27/002', date: '2026-10-22', poReference: 'PO-26-094', supplierId: 'sup-3', supplierName: 'Adani Wilmar Wholesale Agency', warehouseId: 'wh-1', items: [{ productId: 'prod-7', productName: 'Fortune Sunlite Refined Sunflower Oil 15L Tin', orderedQty: 25, receivedQty: 25, damagedQty: 0, missingQty: 0 }], status: 'Completed', notes: 'All tins intact' },
  { id: 'grn-3', grnNumber: 'GRN/26-27/003', date: '2026-11-03', poReference: 'PO-26-102', supplierId: 'sup-5', supplierName: 'Crompton Greaves Appliances Dist.', warehouseId: 'wh-2', items: [{ productId: 'prod-18', productName: 'Crompton HighSpeed 1200mm Ceiling Fan', orderedQty: 20, receivedQty: 18, damagedQty: 0, missingQty: 2 }], status: 'Completed', notes: '2 fans pending in next dispatch' },
  { id: 'grn-4', grnNumber: 'GRN/26-27/004', date: '2026-11-11', poReference: 'PO-26-111', supplierId: 'sup-7', supplierName: 'JK Paper Merchants Delhi', warehouseId: 'wh-1', items: [{ productId: 'prod-13', productName: 'JK Copier A4 75 GSM Paper (500 Sheets)', orderedQty: 100, receivedQty: 100, damagedQty: 0, missingQty: 0 }], status: 'Completed', notes: 'Verified count' },
  { id: 'grn-5', grnNumber: 'GRN/26-27/005', date: '2026-11-16', poReference: 'PO-26-118', supplierId: 'sup-8', supplierName: 'PackPro Corrugation & Tapes', warehouseId: 'wh-3', items: [{ productId: 'prod-32', productName: 'Thermal Shipping Labels 4x6 (1000 Labels Roll)', orderedQty: 50, receivedQty: 50, damagedQty: 0, missingQty: 0 }], status: 'Completed', notes: 'Received at Vishwakarma Depot' },
];

const stockMovements = [
  { id: 'sm-1', date: '2026-11-03', productId: 'prod-18', productName: 'Crompton HighSpeed 1200mm Ceiling Fan', sku: 'HA-CRO-018', warehouseId: 'wh-2', warehouseName: 'Sitapura Industrial Hub', type: 'Purchase', qtyChange: 18, reference: 'PB/26-27/014', notes: 'GRN/26-27/003 received' },
  { id: 'sm-2', date: '2026-11-06', productId: 'prod-29', productName: 'Wonder BOPP Transparent Packing Tape 48mm (72 Rolls)', sku: 'PK-WON-029', warehouseId: 'wh-3', warehouseName: 'Vishwakarma Depot', type: 'Sale', qtyChange: -10, reference: 'ST/26-27/019', notes: 'Dispatched to Narmada Packaging' },
  { id: 'sm-3', date: '2026-11-11', productId: 'prod-13', productName: 'JK Copier A4 75 GSM Paper (500 Sheets)', sku: 'ST-JKC-013', warehouseId: 'wh-1', warehouseName: 'Jaipur Main Godown', type: 'Purchase', qtyChange: 100, reference: 'PB/26-27/015', notes: 'Restock from JK Paper' },
  { id: 'sm-4', date: '2026-11-12', productId: 'prod-4', productName: 'Syska 20W LED Batten Tube Light', sku: 'EL-SYS-004', warehouseId: 'wh-2', warehouseName: 'Sitapura Industrial Hub', type: 'Sale', qtyChange: -35, reference: 'ST/26-27/021', notes: 'Sold to Kota Hostel Group' },
  { id: 'sm-5', date: '2026-11-14', productId: 'prod-11', productName: 'MDH Garam Masala 100g (Box of 20)', sku: 'GR-MDH-011', warehouseId: 'wh-3', warehouseName: 'Vishwakarma Depot', type: 'Return In', qtyChange: 2, reference: 'CN/26-27/005', notes: 'Sales return accepted back' },
  { id: 'sm-6', date: '2026-11-16', productId: 'prod-32', productName: 'Thermal Shipping Labels 4x6 (1000 Labels Roll)', sku: 'PK-LBL-032', warehouseId: 'wh-3', warehouseName: 'Vishwakarma Depot', type: 'Purchase', qtyChange: 50, reference: 'PB/26-27/016', notes: 'PackPro supply' },
  { id: 'sm-7', date: '2026-11-18', productId: 'prod-12', productName: 'Tata Tea Gold 1kg Commercial Pack', sku: 'GR-TAT-012', warehouseId: 'wh-3', warehouseName: 'Vishwakarma Depot', type: 'Damaged', qtyChange: -3, reference: 'ADJ-26-014', notes: 'Moisture damage during monsoon inspection' },
];

const eInvoices = [
  { id: 'einv-1', invoiceId: 'inv-4', invoiceNumber: 'ST/26-27/004', customerName: 'Surya Electricals & Appliances', gstin: '27AADCS8831N1Z6 (DEMO)', grandTotal: invoices.find((i) => i.id === 'inv-4')?.grandTotal || 59840, irn: 'DEMO-IRN-8f42b910e4c17a9b30192d7c4a1b9e02f1234567', ackNo: 'DEMO-ACK-112600048291', ackDate: '2026-05-19 14:22:10', status: 'Generated (Demo)', qrPayload: 'DEMO-EINV|08AABCS1234F1Z5|27AADCS8831N1Z6|ST/26-27/004' },
  { id: 'einv-2', invoiceId: 'inv-7', invoiceNumber: 'ST/26-27/007', customerName: 'Kaveri Tech Park Facility Mgmt', gstin: '29AABCK9102E1Z7 (DEMO)', grandTotal: invoices.find((i) => i.id === 'inv-7')?.grandTotal || 102020, irn: 'DEMO-IRN-4c19a722d9e44b1081725e6f8c3d1a90b7712345', ackNo: 'DEMO-ACK-112600079104', ackDate: '2026-07-08 11:05:44', status: 'Generated (Demo)', qrPayload: 'DEMO-EINV|08AABCS1234F1Z5|29AABCK9102E1Z7|ST/26-27/007' },
  { id: 'einv-3', invoiceId: 'inv-14', invoiceNumber: 'ST/26-27/014', customerName: 'Surya Electricals & Appliances', gstin: '27AADCS8831N1Z6 (DEMO)', grandTotal: invoices.find((i) => i.id === 'inv-14')?.grandTotal || 144500, irn: 'DEMO-IRN-2a88c501f1b32d9048127c3a9e5b1d82a9901122', ackNo: 'DEMO-ACK-112600148220', ackDate: '2026-10-12 16:40:12', status: 'Generated (Demo)', qrPayload: 'DEMO-EINV|08AABCS1234F1Z5|27AADCS8831N1Z6|ST/26-27/014' },
];

const eWayBills = [
  { id: 'ewb-1', ewbNumber: 'DEMO-EWB-741088920145', invoiceId: 'inv-4', invoiceNumber: 'ST/26-27/004', customerName: 'Surya Electricals & Appliances', transporter: 'VRL Logistics Ltd (Demo)', vehicleNo: 'RJ-14-GC-4412', mode: 'Road', distanceKm: 1148, generatedDate: '2026-05-19', validUntil: '2026-05-30', status: 'Active (Demo)' },
  { id: 'ewb-2', ewbNumber: 'DEMO-EWB-741092441088', invoiceId: 'inv-7', invoiceNumber: 'ST/26-27/007', customerName: 'Kaveri Tech Park Facility Mgmt', transporter: 'SafeExpress Pvt Ltd (Demo)', vehicleNo: 'KA-01-AG-8821', mode: 'Road', distanceKm: 1920, generatedDate: '2026-07-08', validUntil: '2026-07-22', status: 'Active (Demo)' },
  { id: 'ewb-3', ewbNumber: 'DEMO-EWB-741099310244', invoiceId: 'inv-14', invoiceNumber: 'ST/26-27/014', customerName: 'Surya Electricals & Appliances', transporter: 'VRL Logistics Ltd (Demo)', vehicleNo: 'MH-04-DK-2290', mode: 'Road', distanceKm: 1148, generatedDate: '2026-10-12', validUntil: '2026-10-24', status: 'Active (Demo)' },
  { id: 'ewb-4', ewbNumber: 'DEMO-EWB-741102884120', invoiceId: 'inv-18', invoiceNumber: 'ST/26-27/018', customerName: 'Mahalaxmi Traders - Delhi', transporter: 'Jaipur-Delhi Cargo (Demo)', vehicleNo: 'DL-1L-AB-5519', mode: 'Road', distanceKm: 280, generatedDate: '2026-11-02', validUntil: '2026-11-05', status: 'Active (Demo)' },
];

const gstr2bRecords = [
  { id: '2b-1', supplierName: 'Havells India Distribution Hub', gstin: '08AAACH1122A1Z5 (DEMO)', invoiceNo: 'HAV/RAJ/26-081', date: '2026-04-02', taxable2B: 22760, tax2B: 2731.2, booksTaxable: 22760, booksTax: 2731.2, matchStatus: 'Matched', itcEligible: true },
  { id: '2b-2', supplierName: 'Crompton Greaves Appliances Dist.', gstin: '27AAACC5566E1Z4 (DEMO)', invoiceNo: 'CRM/MH/840', date: '2026-11-03', taxable2B: 40390, tax2B: 7270.2, booksTaxable: 40390, booksTax: 7270.2, matchStatus: 'Matched', itcEligible: true },
  { id: '2b-3', supplierName: 'JK Paper Merchants Delhi', gstin: '07AAACJ7788G1Z7 (DEMO)', invoiceNo: 'JKP/DL/518', date: '2026-11-11', taxable2B: 33750, tax2B: 4950, booksTaxable: 33750, booksTax: 4800, matchStatus: 'Tax Mismatch', itcEligible: true },
  { id: '2b-4', supplierName: 'PackPro Corrugation & Tapes', gstin: '08AABCP8899H1Z3 (DEMO)', invoiceNo: 'PKP/JPR/229', date: '2026-11-16', taxable2B: 0, tax2B: 0, booksTaxable: 33500, booksTax: 4860, matchStatus: 'Missing in GSTR-2B', itcEligible: false },
  { id: '2b-5', supplierName: 'Metro Courier Services (Unrecorded)', gstin: '08AAACM8110P1Z9 (DEMO)', invoiceNo: 'MCS/JPR/902', date: '2026-11-14', taxable2B: 6400, tax2B: 1152, booksTaxable: 0, booksTax: 0, matchStatus: 'Missing in Books', itcEligible: false },
  { id: '2b-6', supplierName: 'Adani Wilmar Wholesale Agency', gstin: '08AABCA3344C1Z9 (DEMO)', invoiceNo: 'AWL/JPR/589', date: '2026-10-22', taxable2B: 89850, tax2B: 4492.5, booksTaxable: 89850, booksTax: 4492.5, matchStatus: 'GSTIN Mismatch', itcEligible: true },
];

const gstCalendar = [
  { id: 'cal-1', period: 'October 2026', returnType: 'GSTR-1', dueDate: '2026-11-11', prepStatus: 'Ready', filingStatus: 'Demo Prepared' },
  { id: 'cal-2', period: 'October 2026', returnType: 'GSTR-3B', dueDate: '2026-11-20', prepStatus: 'Ready', filingStatus: 'Demo Prepared' },
  { id: 'cal-3', period: 'November 2026', returnType: 'GSTR-1', dueDate: '2026-12-11', prepStatus: 'In Progress', filingStatus: 'Pending' },
  { id: 'cal-4', period: 'November 2026', returnType: 'GSTR-2B Recon', dueDate: '2026-12-14', prepStatus: 'Pending Review', filingStatus: 'Pending' },
  { id: 'cal-5', period: 'November 2026', returnType: 'GSTR-3B', dueDate: '2026-12-20', prepStatus: 'Not Started', filingStatus: 'Upcoming' },
  { id: 'cal-6', period: 'December 2026', returnType: 'GSTR-1', dueDate: '2027-01-11', prepStatus: 'Scheduled', filingStatus: 'Upcoming' },
];

const journalEntries = [
  {
    id: 'je-1',
    entryNumber: 'JV/26-27/001',
    date: '2026-04-01',
    voucherType: 'Journal',
    narration: 'Opening capital and asset balances brought forward for FY 2026-27',
    lines: [
      { accountCode: '1002', accountName: 'HDFC Bank Current A/c', debit: 1285000, credit: 0 },
      { accountCode: '3001', accountName: 'Proprietor Capital Account', debit: 0, credit: 1285000 },
    ],
  },
  {
    id: 'je-2',
    entryNumber: 'CN/26-27/001-C',
    date: '2026-10-15',
    voucherType: 'Contra',
    narration: 'Cash deposit from shop counter into HDFC Current Account',
    lines: [
      { accountCode: '1002', accountName: 'HDFC Bank Current A/c', debit: 50000, credit: 0 },
      { accountCode: '1001', accountName: 'Cash in Hand', debit: 0, credit: 50000 },
    ],
  },
  {
    id: 'je-3',
    entryNumber: 'JV/26-27/002',
    date: '2026-11-01',
    voucherType: 'Journal',
    narration: 'Depreciation provision on office computers and warehouse racks',
    lines: [
      { accountCode: '5100', accountName: 'Operating & Administrative Expenses', debit: 12500, credit: 0 },
      { accountCode: '1500', accountName: 'Furniture, Fixtures & Computers', debit: 0, credit: 12500 },
    ],
  },
];

const notifications = [
  { id: 'notif-1', category: 'Low Stock', title: 'Out of Stock: APC 600VA Back-UPS Power Backup', message: 'Current stock is 0 PCS (Minimum level: 6 PCS). Raise a purchase order with Luminous/APC supplier.', date: '2026-11-21', read: false },
  { id: 'notif-2', category: 'Low Stock', title: 'Out of Stock: Solo Lever Arch Box File Foolscap', message: 'Current stock is 0 SET (Minimum level: 10 SET).', date: '2026-11-21', read: false },
  { id: 'notif-3', category: 'Low Stock', title: 'Low Stock Alert: Prestige 1.5L Electric Kettle', message: 'Only 4 PCS remaining in Sitapura Industrial Hub (Min stock: 12 PCS).', date: '2026-11-20', read: false },
  { id: 'notif-4', category: 'Low Stock', title: 'Low Stock Alert: Syska 20W LED Batten Tube Light', message: '8 PCS left against minimum threshold of 25 PCS.', date: '2026-11-20', read: false },
  { id: 'notif-5', category: 'Expiry', title: 'Batch Expiry Alert: Aashirvaad Chakki Atta (10kg)', message: 'Batch AAS-2609 (14 PKT) expires on 05 Dec 2026.', date: '2026-11-19', read: false },
  { id: 'notif-6', category: 'Expiry', title: 'Batch Expiry Alert: Fortune Sunflower Oil 15L', message: 'Batch FOR-26A1 (28 PCS) expires on 15 Dec 2026.', date: '2026-11-19', read: true },
  { id: 'notif-7', category: 'Payment', title: 'Overdue Receivable: Rajeshwari Hardware', message: 'Invoice ST/26-27/015 is overdue since 03 Nov 2026.', date: '2026-11-18', read: false },
  { id: 'notif-8', category: 'Payment', title: 'Partial Payment Received: Pinkcity Supermart', message: '40% settlement received for ST/26-27/016 via UPI.', date: '2026-11-18', read: true },
  { id: 'notif-9', category: 'GST', title: 'GSTR-3B Due Reminder (Nov 2026 Period)', message: 'Review Output GST vs Eligible ITC before 20 Dec 2026.', date: '2026-11-17', read: false },
  { id: 'notif-10', category: 'GST', title: 'GSTR-2B Reconciliation Mismatch Detected', message: '1 Tax Mismatch and 1 Missing in GSTR-2B item found in Nov recon.', date: '2026-11-16', read: true },
  { id: 'notif-11', category: 'Integration', title: 'Demo Mode: IRP & E-Way Bill Sandbox Active', message: 'E-Invoice IRN and E-Way Bill actions generate simulated demo records locally.', date: '2026-11-15', read: true },
  { id: 'notif-12', category: 'Subscription', title: 'Growth Plan Active — Next Renewal 31 Mar 2027', message: 'Sharma Traders is on the Growth Annual SaaS plan (Demo).', date: '2026-11-10', read: true },
];

const users = [
  { id: 'usr-1', name: 'Anil Sharma', email: 'anil@sharmatraders.demo', mobile: '9829011223', role: 'Owner', status: 'Active', lastLogin: '2026-11-21 09:15 AM' },
  { id: 'usr-2', name: 'Priya Maheshwari', email: 'priya.ca@sharmatraders.demo', mobile: '9829144500', role: 'Accountant', status: 'Active', lastLogin: '2026-11-21 08:42 AM' },
  { id: 'usr-3', name: 'Rohit Jangid', email: 'rohit.pos@sharmatraders.demo', mobile: '9784022110', role: 'Billing Clerk', status: 'Active', lastLogin: '2026-11-20 06:30 PM' },
  { id: 'usr-4', name: 'Rakesh Verma', email: 'rakesh.wh@sharmatraders.demo', mobile: '9414255601', role: 'Warehouse Manager', status: 'Active', lastLogin: '2026-11-20 04:10 PM' },
  { id: 'usr-5', name: 'M.K. Jain (Auditor)', email: 'audit@mkjain.demo', mobile: '9829099881', role: 'Viewer', status: 'Inactive', lastLogin: '2026-10-31 05:00 PM' },
];

const auditLogs = [
  { id: 'aud-1', user: 'Anil Sharma', action: 'Created Invoice', module: 'Sales', recordRef: 'ST/26-27/026', timestamp: '2026-11-21 09:20:11', prevValue: '—', newValue: 'Finalized · UPI Paid' },
  { id: 'aud-2', user: 'Priya Maheshwari', action: 'Updated GSTR-2B', module: 'GST', recordRef: 'JKP/DL/518', timestamp: '2026-11-20 17:45:02', prevValue: 'Unverified', newValue: 'Tax Mismatch Flagged' },
  { id: 'aud-3', user: 'Rohit Jangid', action: 'Saved Draft Invoice', module: 'Sales', recordRef: 'ST/26-27/025', timestamp: '2026-11-19 16:12:40', prevValue: '—', newValue: 'Draft for Kaveri Tech Park' },
  { id: 'aud-4', user: 'Anil Sharma', action: 'Cancelled Invoice', module: 'Sales', recordRef: 'ST/26-27/023', timestamp: '2026-11-17 15:08:29', prevValue: 'Finalized', newValue: 'Cancelled (Customer changed order)' },
  { id: 'aud-5', user: 'Rakesh Verma', action: 'Stock Damage Entry', module: 'Inventory', recordRef: 'ADJ-26-014', timestamp: '2026-11-18 11:30:00', prevValue: '8 PCS', newValue: '5 PCS (-3 Damaged)' },
  { id: 'aud-6', user: 'Rakesh Verma', action: 'Recorded GRN', module: 'Purchases', recordRef: 'GRN/26-27/005', timestamp: '2026-11-16 14:15:22', prevValue: 'Ordered: 50', newValue: 'Received: 50 PCS' },
  { id: 'aud-7', user: 'Priya Maheshwari', action: 'Issued Credit Note', module: 'Sales Returns', recordRef: 'CN/26-27/005', timestamp: '2026-11-14 13:05:18', prevValue: '—', newValue: 'Issued against ST/26-27/016' },
  { id: 'aud-8', user: 'Rohit Jangid', action: 'Recorded Payment In', module: 'Payments', recordRef: 'RCPT/26-27/017', timestamp: '2026-11-12 18:10:04', prevValue: 'Unpaid', newValue: 'Partial Payment Recorded' },
  { id: 'aud-9', user: 'Anil Sharma', action: 'Created Purchase Bill', module: 'Purchases', recordRef: 'PB/26-27/015', timestamp: '2026-11-11 12:44:50', prevValue: '—', newValue: 'JK Paper Merchants Delhi' },
  { id: 'aud-10', user: 'Priya Maheshwari', action: 'Recorded Expense', module: 'Expenses', recordRef: 'EXP/26-27/013', timestamp: '2026-11-05 10:20:00', prevValue: '—', newValue: '₹53,100 Showroom Rent' },
  { id: 'aud-11', user: 'Anil Sharma', action: 'Generated Demo E-Way Bill', module: 'E-Way Bill', recordRef: 'DEMO-EWB-741102884120', timestamp: '2026-11-02 15:32:10', prevValue: 'Pending', newValue: 'Active (Demo)' },
  { id: 'aud-12', user: 'Priya Maheshwari', action: 'Posted Journal Entry', module: 'Accounting', recordRef: 'JV/26-27/002', timestamp: '2026-11-01 09:50:12', prevValue: '—', newValue: 'Depreciation ₹12,500' },
  { id: 'aud-13', user: 'Anil Sharma', action: 'Generated Demo IRN', module: 'E-Invoice', recordRef: 'ST/26-27/014', timestamp: '2026-10-12 16:40:12', prevValue: 'Not Generated', newValue: 'Generated (Demo)' },
  { id: 'aud-14', user: 'Rakesh Verma', action: 'Updated Min Stock', module: 'Inventory', recordRef: 'HA-PRE-021', timestamp: '2026-10-10 11:05:33', prevValue: 'Min: 8', newValue: 'Min: 12' },
  { id: 'aud-15', user: 'Anil Sharma', action: 'Added Customer', module: 'Parties', recordRef: 'cust-15', timestamp: '2026-10-05 14:22:09', prevValue: '—', newValue: 'Marwar Builders & Contractors' },
  { id: 'aud-16', user: 'Priya Maheshwari', action: 'Updated GST Preferences', module: 'Settings', recordRef: 'GST-CONFIG', timestamp: '2026-04-01 10:00:00', prevValue: 'Exclusive', newValue: 'Tax Exclusive + Auto Round-Off' },
];

const settings = {
  gst: {
    compositionScheme: false,
    reverseChargeDefault: false,
    priceInclusiveDefault: false,
    autoPlaceOfSupply: true,
    eInvoiceThresholdLakhs: 500,
    eWayBillThreshold: 50000,
  },
  invoice: {
    prefix: 'ST/26-27/',
    nextNumber: 27,
    defaultDueDays: 15,
    roundOffEnabled: true,
    showBankDetails: true,
    showHsnColumn: true,
    showSignatureBox: true,
    template: 'Classic GST Pro',
  },
  financial: {
    financialYear: '2026-27',
    booksBeginDate: '2026-04-01',
    decimalPlaces: 2,
    lockBeforeDate: '2026-03-31',
  },
  inventory: {
    trackBatches: true,
    trackWarehouses: true,
    allowNegativeStock: false,
    lowStockAlertDays: 45,
    valuationMethod: 'Weighted Average',
  },
  notifications: {
    lowStockEmail: true,
    expiryAlerts: true,
    gstDueReminders: true,
    overduePaymentReminders: true,
  },
  integrations: {
    irpSandboxMode: true,
    ewayBillSandboxMode: true,
    upiStaticQrEnabled: true,
    whatsappInvoiceShare: false,
  },
};

const superAdminData = {
  tenants: [
    { id: 'ten-1', businessName: 'Sharma Traders', owner: 'Anil Sharma', city: 'Jaipur', state: 'Rajasthan', plan: 'Growth', status: 'Active', users: 5, invoicesCount: 26, mrr: 1999, joinedDate: '2026-04-01', renewalDate: '2027-03-31' },
    { id: 'ten-2', businessName: 'Kaveri Electricals Pvt Ltd', owner: 'Ramesh Rao', city: 'Bengaluru', state: 'Karnataka', plan: 'Enterprise', status: 'Active', users: 14, invoicesCount: 412, mrr: 4999, joinedDate: '2026-02-14', renewalDate: '2027-02-13' },
    { id: 'ten-3', businessName: 'Patel Agro Distributors', owner: 'Kiran Patel', city: 'Ahmedabad', state: 'Gujarat', plan: 'Growth', status: 'Active', users: 6, invoicesCount: 185, mrr: 1999, joinedDate: '2026-05-10', renewalDate: '2027-05-09' },
    { id: 'ten-4', businessName: 'Nanda Stationery & Books', owner: 'Vikas Nanda', city: 'New Delhi', state: 'Delhi', plan: 'Starter', status: 'Trial', users: 2, invoicesCount: 19, mrr: 0, joinedDate: '2026-11-10', renewalDate: '2026-11-24' },
    { id: 'ten-5', businessName: 'Deccan Pharma Agency', owner: 'Srinivas Reddy', city: 'Hyderabad', state: 'Telangana', plan: 'Enterprise', status: 'Active', users: 18, invoicesCount: 640, mrr: 4999, joinedDate: '2026-01-20', renewalDate: '2027-01-19' },
    { id: 'ten-6', businessName: 'Choudhary Hardware Mart', owner: 'Mahendra Choudhary', city: 'Jodhpur', state: 'Rajasthan', plan: 'Starter', status: 'Active', users: 3, invoicesCount: 94, mrr: 799, joinedDate: '2026-06-18', renewalDate: '2027-06-17' },
    { id: 'ten-7', businessName: 'Sagar Foods & Spices', owner: 'Neha Kulkarni', city: 'Pune', state: 'Maharashtra', plan: 'Growth', status: 'Trial', users: 4, invoicesCount: 31, mrr: 0, joinedDate: '2026-11-12', renewalDate: '2026-11-26' },
    { id: 'ten-8', businessName: 'Kashi Textile Emporium', owner: 'Alok Mishra', city: 'Varanasi', state: 'Uttar Pradesh', plan: 'Starter', status: 'Expired', users: 2, invoicesCount: 52, mrr: 0, joinedDate: '2025-10-01', renewalDate: '2026-10-01' },
    { id: 'ten-9', businessName: 'Bengaluru Packaging Hub', owner: 'Arjun Hegde', city: 'Bengaluru', state: 'Karnataka', plan: 'Growth', status: 'Active', users: 7, invoicesCount: 228, mrr: 1999, joinedDate: '2026-03-22', renewalDate: '2027-03-21' },
    { id: 'ten-10', businessName: 'Malwa Steel & Pipes', owner: 'Devendra Tiwari', city: 'Indore', state: 'Madhya Pradesh', plan: 'Enterprise', status: 'Active', users: 11, invoicesCount: 345, mrr: 4999, joinedDate: '2026-04-28', renewalDate: '2027-04-27' },
  ],
  plans: [
    { id: 'plan-1', name: 'Starter', audience: 'For small shops & solo proprietors', monthlyPrice: 799, annualPrice: 7990, maxUsers: 3, maxInvoices: 150, maxWarehouses: 1, features: ['GST Invoicing & POS', 'GSTR-1 & GSTR-3B Summary', 'Up to 500 SKUs', 'Email Support'] },
    { id: 'plan-2', name: 'Growth', audience: 'For scaling wholesalers & distributors', monthlyPrice: 1999, annualPrice: 19990, maxUsers: 10, maxInvoices: 2500, maxWarehouses: 5, features: ['Multi-Warehouse & Batches', 'GSTR-2B Reconciliation', 'E-Invoice & E-Way Bill Demo', 'Accounting Ledgers & P&L'] },
    { id: 'plan-3', name: 'Enterprise', audience: 'For multi-branch SMEs & manufacturers', monthlyPrice: 4999, annualPrice: 49990, maxUsers: 50, maxInvoices: 25000, maxWarehouses: 25, features: ['Unlimited SKUs & Branches', 'Custom Role Permissions', 'Dedicated CA Audit Portal', 'Priority SLA Support'] },
  ],
  platformPayments: [
    { id: 'pp-1', txnId: 'SUB-TXN-9012', tenant: 'Deccan Pharma Agency', plan: 'Enterprise', amount: 49990, cycle: 'Annual', date: '2026-11-01', method: 'UPI Autopay', status: 'Settled' },
    { id: 'pp-2', txnId: 'SUB-TXN-9013', tenant: 'Sharma Traders', plan: 'Growth', amount: 19990, cycle: 'Annual', date: '2026-11-04', method: 'NEFT', status: 'Settled' },
    { id: 'pp-3', txnId: 'SUB-TXN-9014', tenant: 'Kaveri Electricals Pvt Ltd', plan: 'Enterprise', amount: 4999, cycle: 'Monthly', date: '2026-11-10', method: 'Card', status: 'Settled' },
    { id: 'pp-4', txnId: 'SUB-TXN-9015', tenant: 'Patel Agro Distributors', plan: 'Growth', amount: 1999, cycle: 'Monthly', date: '2026-11-12', method: 'UPI', status: 'Settled' },
    { id: 'pp-5', txnId: 'SUB-TXN-9016', tenant: 'Kashi Textile Emporium', plan: 'Starter', amount: 799, cycle: 'Monthly', date: '2026-11-15', method: 'Card', status: 'Failed' },
  ],
  tickets: [
    { id: 'tkt-1', ticketNo: 'SUP-401', tenant: 'Patel Agro Distributors', subject: 'Need guidance on HSN 8-digit validation for exports', priority: 'Medium', status: 'Open', created: '2026-11-20' },
    { id: 'tkt-2', ticketNo: 'SUP-402', tenant: 'Sharma Traders', subject: 'Configure custom thermal 80mm receipt footer', priority: 'Low', status: 'Resolved', created: '2026-11-18' },
    { id: 'tkt-3', ticketNo: 'SUP-403', tenant: 'Deccan Pharma Agency', subject: 'Batch expiry report CSV export column order', priority: 'High', status: 'In Progress', created: '2026-11-19' },
  ],
  announcements: [
    { id: 'ann-1', title: 'FY 2026-27 GSTR-2B Reconciliation Rules Updated', target: 'All Active Tenants', date: '2026-11-15', status: 'Published' },
    { id: 'ann-2', title: 'Scheduled Maintenance Window: Sunday 02:00 AM IST', target: 'Platform-wide', date: '2026-11-10', status: 'Published' },
  ],
  featureFlags: [
    { id: 'ff-1', key: 'pos_split_payment', name: 'POS Split Tender Payments', description: 'Allow Cash + UPI + Card split tender in POS Billing', enabled: true },
    { id: 'ff-2', key: 'gstr2b_auto_recon', name: 'GSTR-2B Smart Matching', description: 'Highlight tax and GSTIN mismatches in GSTR-2B recon', enabled: true },
    { id: 'ff-3', key: 'einvoice_qr_preview', name: 'E-Invoice Simulated IRN & QR', description: 'Enable simulated IRP QR preview on tax invoices', enabled: true },
    { id: 'ff-4', key: 'multi_currency_export', name: 'Multi-Currency Export Invoices', description: 'Beta support for USD/EUR export invoices', enabled: false },
  ],
  platformAuditLogs: [
    { id: 'pa-1', actor: 'Platform SuperAdmin', action: 'Updated Feature Flag', target: 'pos_split_payment', timestamp: '2026-11-20 14:10', detail: 'Enabled globally' },
    { id: 'pa-2', actor: 'Platform SuperAdmin', action: 'Suspended Expired Tenant', target: 'Kashi Textile Emporium', timestamp: '2026-11-16 09:00', detail: 'Payment retry failed 3x' },
    { id: 'pa-3', actor: 'Platform SuperAdmin', action: 'Published Announcement', target: 'GSTR-2B Rules Update', timestamp: '2026-11-15 11:30', detail: 'Sent to 10 tenants' },
  ],
};

export function createInitialDemoState() {
  return {
    version: '1.0.0',
    isAuthenticated: false,
    onboardingCompleted: true,
    currentUser: null,
    currentTenant: null,
    business: { ...DEMO_BUSINESS },
    categories: [...categories],
    units: [...units],
    warehouses: [...warehouses],
    products: [...products],
    batches: [...batches],
    customers: [...customers],
    suppliers: [...suppliers],
    invoices: [...invoices],
    quotations: [...quotations],
    salesOrders: [...salesOrders],
    deliveryChallans: [...deliveryChallans],
    creditNotes: [...creditNotes],
    debitNotes: [...debitNotes],
    purchases: [...purchases],
    purchaseReturns: [...purchaseReturns],
    grns: [...grns],
    payments: [...payments],
    bankAccounts: [...bankAccounts],
    expenses: [...expenses],
    stockMovements: [...stockMovements],
    eInvoices: [...eInvoices],
    eWayBills: [...eWayBills],
    gstr2bRecords: [...gstr2bRecords],
    gstCalendar: [...gstCalendar],
    journalEntries: [...journalEntries],
    notifications: [...notifications],
    users: [...users],
    auditLogs: [...auditLogs],
    settings: JSON.parse(JSON.stringify(settings)),
    posHeldBills: [],
    superAdmin: JSON.parse(JSON.stringify(superAdminData)),
  };
}
