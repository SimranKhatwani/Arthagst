import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { seedDefaultAccounts } from '../services/accounting.seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const TARGET_TENANT_ID = new mongoose.Types.ObjectId('6b066d4d089724b55709390d'); // AURELLE-01
const TARGET_TENANT_CODE = 'AURELLE-01';
const PRESERVED_USERS = ['pooja.owner@aurelle.com', 'superadmin@artha.com'];

async function cleanData() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const db = mongoose.connection.db;

  // 1. Verify target tenant exists
  const targetTenant = await db.collection('tenants').findOne({ _id: TARGET_TENANT_ID });
  if (!targetTenant) {
    throw new Error(`Target tenant ${TARGET_TENANT_CODE} (${TARGET_TENANT_ID}) not found! Aborting.`);
  }
  console.log(`Found target user tenant: ${targetTenant.businessName} (${targetTenant.tenantCode})`);

  // 2. Clear fake tenants
  const deletedTenants = await db.collection('tenants').deleteMany({ _id: { $ne: TARGET_TENANT_ID } });
  console.log(`Deleted ${deletedTenants.deletedCount} fake tenants. Kept: ${TARGET_TENANT_CODE}`);

  // 3. Clear fake users
  const deletedUsers = await db.collection('users').deleteMany({ email: { $nin: PRESERVED_USERS } });
  console.log(`Deleted ${deletedUsers.deletedCount} fake users. Kept: ${PRESERVED_USERS.join(', ')}`);

  // Update superadmin to have tenantId = null so it's a true platform-wide superadmin
  await db.collection('users').updateOne(
    { email: 'superadmin@artha.com' },
    { $set: { tenantId: null, role: 'super_admin', isSuperAdmin: true } }
  );
  console.log(`Updated superadmin@artha.com tenantId to null.`);

  // 4. Clean tenant-partitioned collections
  const tenantScopedCollections = [
    'units',
    'warehouses',
    'categories',
    'products',
    'parties',
    'subscriptions',
    'subscriptioninvoices',
    'notifications',
    'auditlogs'
  ];

  for (const colName of tenantScopedCollections) {
    const col = db.collection(colName);
    const res = await col.deleteMany({ tenantId: { $ne: TARGET_TENANT_ID } });
    const remaining = await col.countDocuments();
    console.log(`Collection [${colName}]: Deleted ${res.deletedCount} fake records. Remaining for AURELLE-01: ${remaining}`);
  }

  // Restore active status for user's product & category
  await db.collection('products').updateMany(
    { tenantId: TARGET_TENANT_ID },
    { $set: { isDeleted: false, isActive: true } }
  );
  await db.collection('categories').updateMany(
    { tenantId: TARGET_TENANT_ID },
    { $set: { isDeleted: false, isActive: true } }
  );
  console.log(`Ensured AURELLE-01 products and categories are active and not deleted.`);

  // 5. Clear collections that only contained fake/test transactions
  const purelyFakeCollections = [
    'salesinvoices',
    'salesorders',
    'quotations',
    'purchasebills',
    'purchaseorders',
    'deliverychallans',
    'grns',
    'creditnotes',
    'debitnotes',
    'payments',
    'expenses',
    'expensecategories',
    'bankaccounts',
    'inventories',
    'stockmovements',
    'journalentries',
    'journalsequences',
    'salessequences',
    'purchasesequences',
    'expensesequences',
    'paymentsequences',
    'settings',
    'tickets',
    'gstreturnperiods',
    'gstr2bimports'
  ];

  for (const colName of purelyFakeCollections) {
    const col = db.collection(colName);
    const countBefore = await col.countDocuments();
    if (countBefore > 0) {
      await col.deleteMany({});
      console.log(`Collection [${colName}]: Deleted all ${countBefore} fake records.`);
    } else {
      console.log(`Collection [${colName}]: Already empty (0 records).`);
    }
  }

  // 6. Clean accounts and seed standard Chart of Accounts for AURELLE-01
  await db.collection('accounts').deleteMany({ tenantId: { $ne: TARGET_TENANT_ID } });
  const existingAccountsCount = await db.collection('accounts').countDocuments({ tenantId: TARGET_TENANT_ID });
  if (existingAccountsCount === 0) {
    console.log(`Seeding standard Chart of Accounts for ${TARGET_TENANT_CODE}...`);
    await seedDefaultAccounts(TARGET_TENANT_ID);
    const newAccountsCount = await db.collection('accounts').countDocuments({ tenantId: TARGET_TENANT_ID });
    console.log(`Seeded ${newAccountsCount} standard COA accounts for ${TARGET_TENANT_CODE}.`);
  } else {
    console.log(`${TARGET_TENANT_CODE} already has ${existingAccountsCount} accounts.`);
  }

  // 7. Verify platform system collections (plans, platformsettings, featureflags, subscriptionsequences)
  console.log('\n=== Platform Metadata Status ===');
  console.log('plans:', await db.collection('plans').countDocuments());
  console.log('platformsettings:', await db.collection('platformsettings').countDocuments());
  console.log('featureflags:', await db.collection('featureflags').countDocuments());
  console.log('subscriptionsequences:', await db.collection('subscriptionsequences').countDocuments());

  console.log('\n=== Final Database Summary ===');
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    if (count > 0) {
      console.log(`  - ${col.name}: ${count} document(s)`);
    }
  }

  await mongoose.disconnect();
  console.log('\nData cleanup completed successfully.');
}

cleanData().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
