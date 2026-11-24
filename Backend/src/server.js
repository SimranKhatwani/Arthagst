import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import connectDB from './config/database.js';
import { seedAdmin } from './scripts/seedAdmin.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Attempt database connection
    await connectDB();
    await seedAdmin().catch((err) => console.warn('⚠️ Admin seed warning:', err.message));
  } catch (error) {
    console.warn('⚠️  Proceeding server startup without active MongoDB connection.');
  }

  app.listen(PORT, () => {
    console.log(`🚀 ArthaGST Backend running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

startServer();
