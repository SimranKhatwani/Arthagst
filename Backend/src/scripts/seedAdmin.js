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
  // 1. Super Admin Credentials from .env
  const superAdminName = process.env.SUPERADMIN_NAME || 'Platform Super Administrator';
  const superAdminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@artha.com').toLowerCase().trim();
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'Superadmin@12345';

  // 2. Ensure Super Admin User exists
  let superAdminUser = await User.findOne({ email: superAdminEmail }).select('+password');
  if (!superAdminUser) {
    superAdminUser = await User.create({
      name: superAdminName,
      email: superAdminEmail,
      password: superAdminPassword,
      phone: '9876543211',
      role: 'super_admin',
      isSuperAdmin: true,
      tenantId: null,
      isActive: true,
    });
    console.log(`✅ Created Super Admin User '${superAdminUser.name}' (${superAdminUser.email})`);
  } else {
    superAdminUser.name = superAdminName;
    superAdminUser.role = 'super_admin';
    superAdminUser.isSuperAdmin = true;
    superAdminUser.isActive = true;
    superAdminUser.tenantId = null;
    await superAdminUser.save();
    console.log(`✅ Verified Super Admin User '${superAdminUser.name}' (${superAdminUser.email})`);
  }

  return { superAdminUser };
};

// Execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await connectDB();
    const result = await seedAdmin();
    console.log('\n=============================================');
    console.log('✅ Super Admin Synced Successfully from .env:');
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
