import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authMiddleware } from '../middleware/auth';
import { rbacMiddleware } from '../middleware/rbac';

const router = Router();

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8080';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:8081';
const PROCUREMENT_SERVICE_URL = process.env.PROCUREMENT_SERVICE_URL || 'http://localhost:8082';
const FINANCE_SERVICE_URL = process.env.FINANCE_SERVICE_URL || 'http://localhost:8083';
const INTELLIGENCE_SERVICE_URL = process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:8084';
// Helper to configure proxy forwarding and headers injection
const createServiceProxy = (target: string, pathRewritePattern: string) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: {
      [pathRewritePattern]: '', // strips the prefix (e.g., /api/auth -> /auth or /api/inventory -> /inventory)
    },
    on: {
      proxyReq: (proxyReq, req: any) => {
        // Propagate X-Correlation-ID
        if (req.correlationId) {
          proxyReq.setHeader('X-Correlation-ID', req.correlationId);
        }
        // Inject decrypted JWT user details so downstream microservices don't have to verify signature
        if (req.user) {
          proxyReq.setHeader('X-User-Id', req.user.sub);
          proxyReq.setHeader('X-User-Email', req.user.email);
          proxyReq.setHeader('X-User-Role', req.user.role);
        }
      },
      error: (err, req, res: any) => {
        console.error(`Proxy error forwarding to target ${target}:`, err);
        res.status(502).json({
          error: 'Bad Gateway',
          message: 'Target microservice is unavailable or threw an error.',
          correlationId: (req as any).correlationId
        });
      }
    }
  });
};

// 1. Auth Service Routes (No auth check in Gateway for register/login, but we can pass all under /api/auth to Auth Service)
// Note: Auth service can internally check JWT if it needs to (like for logout or refresh)
router.all('/auth*', createServiceProxy(AUTH_SERVICE_URL, '^/api'));

// 2. Inventory Service Routing
router.get(
  '/inventory*', 
  authMiddleware, 
  rbacMiddleware(['admin', 'warehouse_manager', 'viewer']), 
  createServiceProxy(INVENTORY_SERVICE_URL, '^/api')
);
router.post(
  '/inventory*', 
  authMiddleware, 
  rbacMiddleware(['admin', 'warehouse_manager']), 
  createServiceProxy(INVENTORY_SERVICE_URL, '^/api')
);
router.put(
  '/inventory*', 
  authMiddleware, 
  rbacMiddleware(['admin', 'warehouse_manager']), 
  createServiceProxy(INVENTORY_SERVICE_URL, '^/api')
);
router.delete(
  '/inventory*', 
  authMiddleware, 
  rbacMiddleware(['admin', 'warehouse_manager']), 
  createServiceProxy(INVENTORY_SERVICE_URL, '^/api')
);

// 3. Procurement Service Routing
router.get(
  '/procurement*', 
  authMiddleware, 
  rbacMiddleware(['admin', 'procurement_manager', 'viewer']), 
  createServiceProxy(PROCUREMENT_SERVICE_URL, '^/api')
);
router.post(
  '/procurement*', 
  authMiddleware, 
  rbacMiddleware(['admin', 'procurement_manager']), 
  createServiceProxy(PROCUREMENT_SERVICE_URL, '^/api')
);

// 5. Finance Service Routing
router.get(
  '/finance*', 
  authMiddleware, 
  rbacMiddleware(['admin', 'finance_manager', 'viewer']), 
  createServiceProxy(FINANCE_SERVICE_URL, '^/api')
);
router.post(
  '/finance*', 
  authMiddleware, 
  rbacMiddleware(['admin', 'finance_manager']), 
  createServiceProxy(FINANCE_SERVICE_URL, '^/api')
);

// 6. Intelligence Service Routing
router.get(
  '/intelligence*', 
  authMiddleware, 
  rbacMiddleware(['admin', 'warehouse_manager', 'procurement_manager', 'production_manager', 'finance_manager', 'viewer']), 
  createServiceProxy(INTELLIGENCE_SERVICE_URL, '^/api')
);

export default router;
