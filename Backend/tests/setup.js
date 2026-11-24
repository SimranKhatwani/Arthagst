import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll } from 'vitest';
import '../src/models/index.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_1234567890';
process.env.JWT_EXPIRES_IN = '1d';
process.env.ADMIN_EMAIL = 'admin@artha.com';
process.env.ADMIN_PASSWORD = 'Admin@12345';
process.env.SUPERADMIN_EMAIL = 'superadmin@artha.com';
process.env.SUPERADMIN_PASSWORD = 'Superadmin@12345';
process.env.EINVOICE_PROVIDER = 'mock';
process.env.EWAYBILL_PROVIDER = 'mock';

let replSet;

beforeAll(async () => {
  // Spin up an isolated in-memory MongoDB replica set supporting transactions
  replSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      dbName: 'arthagst_test_db',
    },
  });

  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri);
  console.log('🧪 Connected to isolated in-memory test replica set (Transactions Enabled)');

  // Ensure all collections and indexes exist before transactions run
  for (const model of Object.values(mongoose.models)) {
    try {
      await model.createCollection();
      await model.init();
    } catch (err) {
      // Ignore if already created or index build in progress
    }
  }
}, 60000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
    console.log('🧪 Stopped isolated in-memory test replica set');
  }
}, 60000);
