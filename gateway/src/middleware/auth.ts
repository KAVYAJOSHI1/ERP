import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis } from './rateLimit'; // reuse Redis connection

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

export interface UserClaims {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserClaims;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Public routes do not need authentication (handled in router, or proxy passes)
  // But gateway routes that proxy to backend should generally check authentication.
  // We'll apply this selectively or universally except for /auth/login, /auth/register
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register') || req.path.startsWith('/auth/refresh')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserClaims;
    
    // Check if token JTI is blacklisted in Redis
    const isRevoked = await redis.exists(`revoked_token:${decoded.jti}`);
    if (isRevoked) {
      res.status(401).json({ error: 'Unauthorized', message: 'Token has been revoked' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}
