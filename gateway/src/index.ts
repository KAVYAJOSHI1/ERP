import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import promBundle from 'express-prom-bundle';

// Load environment variables from root directory .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { correlationIdMiddleware } from './middleware/correlationId';
import { rateLimitMiddleware } from './middleware/rateLimit';
import proxyRouter from './routes/proxy';
import iotTelemetryRoutes from './routes/iotTelemetry';
import { connectKafka } from './config/kafka';
import { initAlertsHub } from './ws/alertsHub';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy (required since we run behind nginx or docker proxies)
app.set('trust proxy', 1);

// Global Cors
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
}));

// Body parsing (must come before any route that reads req.body)
app.use(express.json());

// Apply global middlewares
app.use(correlationIdMiddleware);
app.use(rateLimitMiddleware);

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  promClient: {
    collectDefaultMetrics: {}
  }
});
app.use(metricsMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Aggregate health endpoint — polls all downstream services and returns their status
const DOWNSTREAM_SERVICES = [
  { name: 'auth-service',         url: `${process.env.AUTH_SERVICE_URL        || 'http://localhost:8080'}/health` },
  { name: 'inventory-service',    url: `${process.env.INVENTORY_SERVICE_URL   || 'http://localhost:8081'}/health` },
  { name: 'procurement-service',  url: `${process.env.PROCUREMENT_SERVICE_URL || 'http://localhost:8082'}/health` },
  { name: 'finance-service',      url: `${process.env.FINANCE_SERVICE_URL     || 'http://localhost:8083'}/health` },
  { name: 'intelligence-service', url: `${process.env.INTELLIGENCE_SERVICE_URL|| 'http://localhost:8084'}/health` },
];

function pingService(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

app.get('/health/services', async (_req, res) => {
  const results = await Promise.all(
    DOWNSTREAM_SERVICES.map(async (svc) => {
      const up = await pingService(svc.url);
      return { name: svc.name, status: up ? 'UP' : 'DOWN' };
    })
  );
  const allUp = results.every((r) => r.status === 'UP');
  res.json({
    gateway: 'UP',
    overall: allUp ? 'UP' : 'DEGRADED',
    services: results,
    timestamp: new Date().toISOString(),
  });
});

// IoT telemetry ingestion
app.use('/api/iot', iotTelemetryRoutes);

// Proxy routes under /api prefix
app.use('/api', proxyRouter);

// Start Server — use raw HTTP server so WebSocket can share the same port
connectKafka().catch((err) => console.error('Failed to connect Kafka producer:', err));

const server = http.createServer(app);
initAlertsHub(server);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`API Gateway running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`HTTP : http://localhost:${PORT}`);
  console.log(`WS   : ws://localhost:${PORT}/ws/alerts`);
  console.log(`====================================================`);
});
