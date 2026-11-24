import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

import connectDB from '../config/database.js';
import Tenant from '../models/tenant.model.js';
import User from '../models/user.model.js';

export const seedAdmin = async () => {
  // 1. Organization Admin Credentials from .env
  const adminName = process.env.ADMIN_NAME || 'Platform Administrator';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@artha.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const tenantCode = (process.env.ADMIN_TENANT_CODE || 'ARTHA').toUpperCase().trim();

  // 2. Super Admin Credentials from .env
  const superAdminName = process.env.SUPERADMIN_NAME || 'Platform Super Administrator';
  const superAdminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@artha.com').toLowerCase().trim();
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'Superadmin@12345';

  // 3. Ensure Organization Tenant exists
  let tenant = await Tenant.findOne({ tenantCode });
  if (!tenant) {
    tenant = await Tenant.create({
      businessName: 'Aurelle Tech Enterprises',
      tenantCode,
      ownerName: adminName,
      email: adminEmail,
      phone: '9876543210',
      subscriptionStatus: 'active',
      isActive: true,
      GSTIN: '27AABCA1234F1Z5',
      PAN: 'AABCA1234F',
      businessAddress: '101 Corporate Towers, Bandra Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '400051',
      country: 'India',
    });
    console.log(`✅ Created Tenant '${tenant.businessName}' (Code: ${tenant.tenantCode})`);
  } else {
    tenant.isActive = true;
    tenant.subscriptionStatus = 'active';
    await tenant.save();
    console.log(`✅ Verified Tenant '${tenant.businessName}' (Code: ${tenant.tenantCode})`);
  }

  // 4. Ensure Organization Admin User exists
  let adminUser = await User.findOne({ email: adminEmail }).select('+password');
  if (!adminUser) {
    adminUser = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      phone: '9876543210',
      role: 'owner',
      isSuperAdmin: false,
      tenantId: tenant._id,
      isActive: true,
    });
    console.log(`✅ Created Organization Admin User '${adminUser.name}' (${adminUser.email})`);
  } else {
    adminUser.name = adminName;
    adminUser.tenantId = tenant._id;
    adminUser.role = 'owner';
    adminUser.isActive = true;
    adminUser.password = adminPassword; // Pre-save hook hashes updated password
    await adminUser.save();
    console.log(`✅ Updated Organization Admin User '${adminUser.name}' (${adminUser.email})`);
  }

  // 5. Ensure Super Admin User exists
  let superAdminUser = await User.findOne({ email: superAdminEmail }).select('+password');
  if (!superAdminUser) {
    superAdminUser = await User.create({
      name: superAdminName,
      email: superAdminEmail,
      password: superAdminPassword,
      phone: '9876543211',
      role: 'super_admin',
      isSuperAdmin: true,
      tenantId: tenant._id,
      isActive: true,
    });
    console.log(`✅ Created Super Admin User '${superAdminUser.name}' (${superAdminUser.email})`);
  } else {
    superAdminUser.name = superAdminName;
    superAdminUser.role = 'super_admin';
    superAdminUser.isSuperAdmin = true;
    superAdminUser.isActive = true;
    superAdminUser.password = superAdminPassword; // Pre-save hook hashes updated password
    await superAdminUser.save();
    console.log(`✅ Updated Super Admin User '${superAdminUser.name}' (${superAdminUser.email})`);
  }

  return { tenant, adminUser, superAdminUser };
};

// Execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await connectDB();
    const result = await seedAdmin();
    console.log('\n=============================================');
    console.log('✅ Credentials Synced Successfully from .env:');
    console.log('  Organization Code:   ', result.tenant.tenantCode);
    console.log('  Org Admin Email:     ', result.adminUser.email);
    console.log('  Super Admin Email:   ', result.superAdminUser.email);
    console.log('  Super Admin Role:    ', result.superAdminUser.role);
    console.log('  Is Super Admin:      ', result.superAdminUser.isSuperAdmin);
    console.log('=============================================\n');
  } catch (err) {
    console.error('❌ Error seeding credentials:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas');
  }
}
