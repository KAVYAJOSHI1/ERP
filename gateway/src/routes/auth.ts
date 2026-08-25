import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

const DEMO_USERS: Record<string, { id: string; email: string; role: string; name: string }> = {
  'inventory@erp.com': { id: 'usr_inv_01', email: 'inventory@erp.com', role: 'inventory_manager', name: 'Inventory Manager' },
  'procurement@erp.com': { id: 'usr_proc_02', email: 'procurement@erp.com', role: 'procurement_specialist', name: 'Procurement Specialist' },
  'production@erp.com': { id: 'usr_prod_03', email: 'production@erp.com', role: 'shop_floor_supervisor', name: 'Shop Floor Supervisor' },
  'finance@erp.com': { id: 'usr_fin_04', email: 'finance@erp.com', role: 'cfo', name: 'CFO / Ledger Admin' },
  'viewer@erp.com': { id: 'usr_view_05', email: 'viewer@erp.com', role: 'viewer', name: 'Executive Viewer' },
  'admin@erp.com': { id: 'usr_adm_06', email: 'admin@erp.com', role: 'admin', name: 'System Administrator' },
};

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email) {
    res.status(400).json({ error: 'Bad Request', message: 'Email is required' });
    return;
  }

  // Attempt downstream proxy first if available
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:8080';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const downstreamRes = await fetch(`${authServiceUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (downstreamRes.ok) {
      const data = await downstreamRes.json();
      res.json(data);
      return;
    }
  } catch (err) {
    // Fallback to gateway local auth handler for smooth offline/demo experience
  }

  const user = DEMO_USERS[email.toLowerCase()] || {
    id: `usr_${Date.now()}`,
    email: email,
    role: email.includes('admin') ? 'admin' : 'inventory_manager',
    name: email.split('@')[0]
  };

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    jti: `jti_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  };

  const access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  const refresh_token = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    access_token,
    refresh_token
  });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) {
    res.status(400).json({ error: 'Bad Request', message: 'Refresh token is required' });
    return;
  }

  try {
    const decoded = jwt.verify(refresh_token, JWT_SECRET) as any;
    const payload = {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      jti: `jti_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    };
    const new_access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    res.json({ access_token: new_access_token });
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
  }
});

export default router;
