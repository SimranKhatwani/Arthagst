import { createStaffSchema, updateStaffSchema, updateStatusSchema, queryStaffSchema } from '../validators/user.validation.js';
import { updateTenantProfileSchema } from '../validators/tenant.validation.js';
import { updateSettingsSchema } from '../validators/settings.validation.js';
import app from '../app.js';

console.log('🧪 Controlled Verification of Phase 0 Schemas, Rules, and Routes...\n');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

// 1. Staff Creation Validation
console.log('--- 1. Staff Creation Validation ---');
const validStaff = createStaffSchema.safeParse({
  name: 'Priya Sharma',
  email: 'priya@artha.com',
  password: 'Password@123',
  phone: '9876543210',
  role: 'accountant',
  permissions: ['sales:*', 'banking:*'],
});
assert(validStaff.success, 'Valid staff creation payload accepted');

const invalidStaffRole = createStaffSchema.safeParse({
  name: 'Priya Sharma',
  email: 'priya@artha.com',
  password: 'Password@123',
  role: 'super_admin', // Forbidden!
});
assert(!invalidStaffRole.success, 'Forbidden role "super_admin" rejected in staff creation schema');

const shortPasswordStaff = createStaffSchema.safeParse({
  name: 'Priya Sharma',
  email: 'priya@artha.com',
  password: '123',
});
assert(!shortPasswordStaff.success, 'Short password (<6 chars) rejected');

// 2. Staff Status & Update Validation
console.log('\n--- 2. Staff Status & Update Validation ---');
const validStatus = updateStatusSchema.safeParse({ isActive: false });
assert(validStatus.success && validStatus.data.isActive === false, 'isActive boolean status validated');

const invalidStatus = updateStatusSchema.safeParse({ isActive: 'not_a_boolean' });
assert(!invalidStatus.success, 'Non-boolean isActive status rejected');

// 3. Tenant Business Profile Validation
console.log('\n--- 3. Tenant Business Profile Validation ---');
const validTenantUpdate = updateTenantProfileSchema.safeParse({
  businessName: 'ArthaGST Enterprise Corp',
  businessType: 'Retail & Distribution',
  city: 'Bengaluru',
  state: 'Karnataka',
  stateCode: '29',
  pincode: '560001',
  GSTIN: '29AABCU9603R1Z2',
  PAN: 'AABCU9603R',
});
assert(validTenantUpdate.success, 'Valid GSTIN & PAN tenant profile payload accepted');

const invalidGSTIN = updateTenantProfileSchema.safeParse({
  GSTIN: 'INVALID_GSTIN_123',
});
assert(!invalidGSTIN.success, 'Invalid GSTIN rejected by Zod schema');

const invalidPAN = updateTenantProfileSchema.safeParse({
  PAN: 'INVALID_PAN',
});
assert(!invalidPAN.success, 'Invalid PAN rejected by Zod schema');

const invalidStateCode = updateTenantProfileSchema.safeParse({
  stateCode: '299', // Must be 2 digits
});
assert(!invalidStateCode.success, 'Invalid stateCode (>2 digits) rejected');

// 4. Organization Settings Validation
console.log('\n--- 4. Organization Settings Validation ---');
const validSettings = updateSettingsSchema.safeParse({
  invoicePreferences: {
    invoicePrefix: 'AGST-INV',
    defaultNotes: 'Thank you for your business.',
    termsAndConditions: 'Disputes subject to local jurisdiction.',
  },
  branding: {
    primaryColor: '#4f46e5',
    logoUrl: 'https://cdn.arthagst.com/logo.png',
  },
  paymentInformation: {
    upiId: 'arthagst@icici',
    defaultPaymentInstructions: 'Pay via UPI or bank transfer.',
  },
  generalPreferences: {
    dateFormat: 'DD/MM/YYYY',
    currency: 'INR',
  },
});
assert(validSettings.success, 'Valid organization settings payload accepted');

const invalidUPI = updateSettingsSchema.safeParse({
  paymentInformation: {
    upiId: 'invalid_upi_without_at_symbol',
  },
});
assert(!invalidUPI.success, 'Invalid UPI ID (missing @bank) rejected');

const invalidColor = updateSettingsSchema.safeParse({
  branding: {
    primaryColor: 'not_a_hex_color',
  },
});
assert(!invalidColor.success, 'Invalid primary color (non-hex) rejected');

// 5. Express Route Registration Verification
console.log('\n--- 5. Express Route Registration Verification ---');
function extractPaths(stack, current = '') {
  let paths = [];
  for (const layer of stack) {
    if (layer.route) {
      const p = (current + (layer.route.path || '')).replace(/\/+/g, '/');
      const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase()).join(', ');
      paths.push(`${methods} ${p}`);
    } else if (layer.handle?.stack) {
      const p = (current + (layer.rawPath || '')).replace(/\/+/g, '/');
      paths = paths.concat(extractPaths(layer.handle.stack, p));
    }
  }
  return paths;
}

const allPaths = extractPaths(app.router.stack);

const expectedEndpoints = [
  'GET /api/users',
  'POST /api/users',
  'GET /api/users/:id',
  'PATCH /api/users/:id',
  'PATCH /api/users/:id/status',
  'DELETE /api/users/:id',
  'GET /api/tenants/me',
  'PUT /api/tenants/me',
  'GET /api/settings',
  'PUT /api/settings',
  'PATCH /api/settings',
];

for (const ep of expectedEndpoints) {
  const found = allPaths.some(p => p === ep || p.includes(ep.split(' ')[1]));
  assert(found, `Endpoint registered: ${ep}`);
}

console.log(`\n========================================`);
console.log(`CONTROLLED TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log(`========================================`);

process.exit(failed > 0 ? 1 : 0);
