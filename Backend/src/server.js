import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import app from './app.js';
import connectDB from './config/database.js';
import { seedAdmin } from './scripts/seedAdmin.js';

const PORT = process.env.PORT || 5000;

let server;

const startServer = async () => {
  try {
    // Attempt database connection
    await connectDB();
    await seedAdmin().catch((err) => console.warn('⚠️ Admin seed warning:', err.message));
  } catch (error) {
    console.warn('⚠️  Proceeding server startup without active MongoDB connection.');
  }

  server = app.listen(PORT, () => {
    console.log(`🚀 ArthaGST Backend running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error closing MongoDB connection:', err.message);
        process.exit(1);
      }
    });

    // Force close after 10 seconds if hanging
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
