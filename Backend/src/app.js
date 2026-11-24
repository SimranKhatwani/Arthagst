import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import sanitizeMiddleware from './middleware/sanitizeMiddleware.js';

const app = express();

// Trust reverse proxy (for rate limiting, IP resolution behind load balancers)
app.set('trust proxy', 1);

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // REST API standard
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Cross-Origin Resource Sharing
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
};
app.use(cors(corsOptions));

// HTTP request logger
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsers with payload limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization against NoSQL injection ($ and .)
app.use(sanitizeMiddleware);

// Rate limiter on general API endpoints
app.use('/api', apiLimiter);

// Central API Routes
app.use('/api', routes);

// 404 Route Not Found Handler
app.use(notFound);

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
