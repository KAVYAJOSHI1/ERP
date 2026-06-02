import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root directory .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { correlationIdMiddleware } from './middleware/correlationId';
import { rateLimitMiddleware } from './middleware/rateLimit';
import proxyRouter from './routes/proxy';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy (required since we run behind nginx or docker proxies)
app.set('trust proxy', 1);

// Global Cors
app.use(cors({
  origin: ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
}));

// Apply global middlewares
app.use(correlationIdMiddleware);
app.use(rateLimitMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Proxy routes under /api prefix
app.use('/api', proxyRouter);

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 API Gateway running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`👉 Access URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
