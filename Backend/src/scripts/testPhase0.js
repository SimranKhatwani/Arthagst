const baseUrl = 'http://localhost:5000/api';

console.log('🚀 Phase 0 Live Integration Tests running against', baseUrl);

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
  }
}

try {
  // Step 0: Login as Tenant A Owner (ARTHA)
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantCode: 'ARTHA',
      email: 'admin@artha.com',
      password: 'Admin@12345',
    }),
  });
  const loginData = await loginRes.json();
  const tokenA = loginData.data?.token;
  const ownerA = loginData.data?.user;
  const tenantA = loginData.data?.tenant;

  assert(loginRes.status === 200 && tokenA, 'Tenant A Owner login successful');

  const headersA = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenA}`,
  };

  // Login Tenant B (or register if not already there)
  let tokenB = null;
  const loginBRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantCode: 'TENANTB',
      email: 'bob@tenantb.com',
      password: 'Password@123',
    }),
  });
  if (loginBRes.status === 200) {
    const loginBData = await loginBRes.json();
    tokenB = loginBData.data?.token;
  } else {
    // Register Tenant B
    const regBRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Tenant B Logistics',
        ownerName: 'Bob Builder',
        email: 'bob@tenantb.com',
        password: 'Password@123',
        phone: '9876543210',
        tenantCode: 'TENANTB',
      }),
    });
    const regBData = await regBRes.json();
    tokenB = regBData.data?.token;
  }

  const headersB = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenB}`,
  };
  assert(Boolean(tokenB), 'Tenant B Owner token acquired');

  console.log('\n--- Test 1: List Staff ---');
  const listRes = await fetch(`${baseUrl}/users`, { headers: headersA });
  const listData = await listRes.json();
  assert(listRes.status === 200 && Array.isArray(listData.data?.users), 'List staff returned status 200 and users array');
  assert(!listData.data?.users?.some((u) => u.password), 'Passwords excluded from staff list');

  console.log('\n--- Test 2: Create Staff ---');
  const staffEmail = `sales.${Date.now()}@artha.com`;
  const createRes = await fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      name: 'Priya Sharma',
      email: staffEmail,
      password: 'StaffPassword@123',
      phone: '9876543211',
      role: 'sales',
      permissions: ['sales:read', 'sales:create'],
    }),
  });
  const createData = await createRes.json();
  const staffId = createData.data?._id;
  assert(createRes.status === 201 && staffId, `Staff created successfully (ID: ${staffId})`);
  assert(!createData.data?.password, 'Password hash not returned in create response');

  console.log('\n--- Test 3: Duplicate Staff Email Check ---');
  const dupRes = await fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      name: 'Priya Sharma Duplicate',
      email: staffEmail,
      password: 'AnotherPassword@123',
      role: 'sales',
    }),
  });
  assert(dupRes.status === 409 || dupRes.status === 400, `Duplicate email rejected with status ${dupRes.status}`);

  console.log('\n--- Test 4: Update Staff Details ---');
  const updateRes = await fetch(`${baseUrl}/users/${staffId}`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({
      name: 'Priya Verma',
      phone: '9876549999',
    }),
  });
  const updateData = await updateRes.json();
  assert(updateRes.status === 200 && updateData.data?.name === 'Priya Verma', 'Staff name updated to Priya Verma');

  console.log('\n--- Test 5: Update Staff Role and Permissions ---');
  const updateRoleRes = await fetch(`${baseUrl}/users/${staffId}`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({
      role: 'accountant',
      permissions: ['sales:*', 'banking:*', 'gst:*'],
    }),
  });
  const updateRoleData = await updateRoleRes.json();
  assert(updateRoleRes.status === 200 && updateRoleData.data?.role === 'accountant', 'Staff role updated to accountant');

  console.log('\n--- Test 6: Deactivate and Reactivate Staff ---');
  // Deactivate
  const deactRes = await fetch(`${baseUrl}/users/${staffId}/status`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ isActive: false }),
  });
  const deactData = await deactRes.json();
  assert(deactRes.status === 200 && deactData.data?.isActive === false, 'Staff successfully deactivated');

  // Verify deactivated staff cannot log in
  const staffLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantCode: 'ARTHA',
      email: staffEmail,
      password: 'StaffPassword@123',
    }),
  });
  assert(staffLoginRes.status === 403, `Deactivated staff blocked from login (status ${staffLoginRes.status})`);

  // Reactivate
  const reactRes = await fetch(`${baseUrl}/users/${staffId}/status`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ isActive: true }),
  });
  const reactData = await reactRes.json();
  assert(reactRes.status === 200 && reactData.data?.isActive === true, 'Staff successfully reactivated');

  console.log('\n--- Test 7: Prevent Owner Deletion or Deactivation ---');
  const ownerDeactRes = await fetch(`${baseUrl}/users/${ownerA._id}/status`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ isActive: false }),
  });
  assert(ownerDeactRes.status === 400, `Owner deactivation blocked with status ${ownerDeactRes.status}`);

  const ownerDelRes = await fetch(`${baseUrl}/users/${ownerA._id}`, {
    method: 'DELETE',
    headers: headersA,
  });
  assert(ownerDelRes.status === 400, `Owner deletion blocked with status ${ownerDelRes.status}`);

  console.log('\n--- Test 8: Fetch Tenant Profile ---');
  const profileRes = await fetch(`${baseUrl}/tenants/me`, { headers: headersA });
  const profileData = await profileRes.json();
  assert(profileRes.status === 200 && profileData.data?.tenantCode === 'ARTHA', 'Tenant profile retrieved (/api/tenants/me)');

  console.log('\n--- Test 9: Update Tenant Profile ---');
  const updateProfRes = await fetch(`${baseUrl}/tenants/me`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      businessName: 'ArthaGST Enterprise Corp',
      businessType: 'Retail & Distribution',
      city: 'Bengaluru',
      state: 'Karnataka',
      stateCode: '29',
      pincode: '560001',
      GSTIN: '29AABCU9603R1Z2',
    }),
  });
  const updateProfData = await updateProfRes.json();
  assert(
    updateProfRes.status === 200 &&
      updateProfData.data?.businessName === 'ArthaGST Enterprise Corp' &&
      updateProfData.data?.PAN === 'AABCU9603R',
    'Tenant profile updated and PAN automatically derived from GSTIN'
  );

  console.log('\n--- Test 10: Reject Invalid GSTIN/PAN ---');
  const invalidGstinRes = await fetch(`${baseUrl}/tenants/me`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      GSTIN: 'INVALID_GSTIN_123',
    }),
  });
  assert(invalidGstinRes.status === 400, `Invalid GSTIN rejected with status ${invalidGstinRes.status}`);

  const invalidPanRes = await fetch(`${baseUrl}/tenants/me`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      PAN: '12345_BAD_PAN',
    }),
  });
  assert(invalidPanRes.status === 400, `Invalid PAN rejected with status ${invalidPanRes.status}`);

  console.log('\n--- Test 11: Fetch Organization Settings ---');
  const settingsRes = await fetch(`${baseUrl}/settings`, { headers: headersA });
  const settingsData = await settingsRes.json();
  assert(settingsRes.status === 200 && settingsData.data?.invoicePreferences?.invoicePrefix === 'INV', 'Settings retrieved and default initialized');

  console.log('\n--- Test 12 & 13: Update Organization Settings and Verify Persistence ---');
  const updateSettingsRes = await fetch(`${baseUrl}/settings`, {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({
      invoicePreferences: {
        invoicePrefix: 'AGST-INV',
        defaultNotes: 'Thank you for choosing ArthaGST.',
        termsAndConditions: 'All disputes subject to Bengaluru jurisdiction.',
      },
      branding: {
        primaryColor: '#6366f1',
        logoUrl: 'https://cdn.arthagst.com/logo.png',
      },
      paymentInformation: {
        upiId: 'arthagst@icici',
        defaultPaymentInstructions: 'Pay directly via UPI ID arthagst@icici',
      },
      generalPreferences: {
        dateFormat: 'DD/MM/YYYY',
        currency: 'INR',
        currencySymbol: '₹',
      },
    }),
  });
  const updateSettingsData = await updateSettingsRes.json();
  assert(
    updateSettingsRes.status === 200 &&
      updateSettingsData.data?.invoicePreferences?.invoicePrefix === 'AGST-INV' &&
      updateSettingsData.data?.paymentInformation?.upiId === 'arthagst@icici',
    'Organization settings updated via PUT API'
  );

  // Read back via GET /settings to verify persistence
  const verifySettingsRes = await fetch(`${baseUrl}/settings`, { headers: headersA });
  const verifySettingsData = await verifySettingsRes.json();
  assert(
    verifySettingsRes.status === 200 &&
      verifySettingsData.data?.invoicePreferences?.invoicePrefix === 'AGST-INV' &&
      verifySettingsData.data?.branding?.primaryColor === '#6366f1' &&
      verifySettingsData.data?.paymentInformation?.upiId === 'arthagst@icici',
    'Settings verified persistently saved and read back via GET /api/settings'
  );

  console.log('\n--- Test 14: Tenant Isolation ---');
  // Tenant B attempts to fetch Tenant A's staff member by ID
  const crossStaffRes = await fetch(`${baseUrl}/users/${staffId}`, { headers: headersB });
  assert(crossStaffRes.status === 404, `Cross-tenant staff read blocked with status ${crossStaffRes.status} (Not Found)`);

  // Tenant B attempts to update Tenant A's staff member
  const crossUpdateRes = await fetch(`${baseUrl}/users/${staffId}`, {
    method: 'PATCH',
    headers: headersB,
    body: JSON.stringify({ name: 'Hacked Name' }),
  });
  assert(crossUpdateRes.status === 404, `Cross-tenant staff update blocked with status ${crossUpdateRes.status}`);

  // Tenant B fetches /tenants/me -> receives Tenant B, not Tenant A
  const tenantBProfRes = await fetch(`${baseUrl}/tenants/me`, { headers: headersB });
  const tenantBProfData = await tenantBProfRes.json();
  assert(tenantBProfData.data?.tenantCode === 'TENANTB', 'Tenant B profile isolated from Tenant A');

  // Tenant B fetches /settings -> receives Tenant B's settings, not Tenant A's
  const tenantBSettingsRes = await fetch(`${baseUrl}/settings`, { headers: headersB });
  const tenantBSettingsData = await tenantBSettingsRes.json();
  assert(
    tenantBSettingsData.data?.invoicePreferences?.invoicePrefix === 'INV',
    'Tenant B settings isolated (default INV, not Tenant A\'s AGST-INV)'
  );

  console.log('\n--- Test 15: Unauthorized Access & Role Enforcement ---');
  // Staff member login
  const staffAuthRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantCode: 'ARTHA',
      email: staffEmail,
      password: 'StaffPassword@123',
    }),
  });
  const staffAuthData = await staffAuthRes.json();
  const staffToken = staffAuthData.data?.token;
  const staffHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${staffToken}`,
  };

  // Staff attempts to access /users (Admin/Owner only)
  const staffUsersRes = await fetch(`${baseUrl}/users`, { headers: staffHeaders });
  assert(staffUsersRes.status === 403, `Staff access to /api/users blocked with 403 Forbidden (status ${staffUsersRes.status})`);

  // Staff attempts to update tenant profile
  const staffProfRes = await fetch(`${baseUrl}/tenants/me`, {
    method: 'PUT',
    headers: staffHeaders,
    body: JSON.stringify({ businessName: 'Malicious Rename' }),
  });
  assert(staffProfRes.status === 403, `Staff access to PUT /api/tenants/me blocked with 403 Forbidden`);

  // Attempt to promote user to super_admin
  const promoteRes = await fetch(`${baseUrl}/users/${staffId}`, {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ role: 'super_admin' }),
  });
  assert(promoteRes.status === 400 || promoteRes.status === 403, `Promotion to super_admin blocked with status ${promoteRes.status}`);

  // Clean up created staff
  const delStaffRes = await fetch(`${baseUrl}/users/${staffId}`, {
    method: 'DELETE',
    headers: headersA,
  });
  assert(delStaffRes.status === 200, 'Test staff member deleted cleanly');

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log(`========================================`);
} catch (err) {
  console.error('Unhandled test runner error:', err);
  testsFailed++;
} finally {
  process.exit(testsFailed > 0 ? 1 : 0);
}
