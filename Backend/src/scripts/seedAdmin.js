import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

import Tenant from '../modules/tenants/tenant.model.js';
import User from '../modules/users/user.model.js';

export const seedAdmin = async () => {
  const adminName = process.env.ADMIN_NAME || 'Platform Administrator';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@aurelle.com').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const tenantCode = (process.env.ADMIN_TENANT_CODE || 'AURELLE').toUpperCase().trim();

  // 1. Ensure Tenant exists
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
    console.log(` Created Tenant '${tenant.businessName}' (Code: ${tenant.tenantCode})`);
  } else {
    tenant.isActive = true;
    tenant.subscriptionStatus = 'active';
    await tenant.save();
    console.log(` Verified Tenant '${tenant.businessName}' (Code: ${tenant.tenantCode})`);
  }

  // 2. Ensure User exists
  let user = await User.findOne({ email: adminEmail }).select('+password');

  if (!user) {
    user = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword, // will be hashed once by userSchema pre-save hook
      phone: '9876543210',
      role: 'super_admin',
      isSuperAdmin: true,
      tenantId: tenant._id,
      isActive: true,
    });
    console.log(` Created Super Admin User '${user.name}' (${user.email})`);
  } else {
    user.name = adminName;
    user.role = 'super_admin';
    user.isSuperAdmin = true;
    user.tenantId = tenant._id;
    user.isActive = true;
    user.password = adminPassword; // triggers isModified('password') to re-hash once
    await user.save();
    console.log(` Updated Super Admin User '${user.name}' (${user.email})`);
  }

  return { tenant, user };
};

// Execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(' Connected to MongoDB Atlas');
    const result = await seedAdmin();
    console.log('\n=============================================');
    console.log(' Admin created/verified successfully!');
    console.log(' Organization Code:', result.tenant.tenantCode);
    console.log(' Admin Email:     ', result.user.email);
    console.log(' Admin Role:      ', result.user.role);
    console.log(' Is Super Admin:  ', result.user.isSuperAdmin);
    console.log('=============================================\n');
  } catch (err) {
    console.error(' Error seeding admin:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log(' Disconnected from MongoDB Atlas');
  }
}
