import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserClaims } from './auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

/**
 * requireRole middleware extracts JWT from Authorization header,
 * decodes the user.role, and returns 403 Forbidden if the role does not match the allowed array.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    let role = req.user?.role;

    if (!role) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as UserClaims;
          role = decoded.role;
          req.user = decoded;
        } catch (error) {
          res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
          return;
        }
      }
    }

    if (!role) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication is required' });
      return;
    }

    if (!allowedRoles.includes(role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Role '${role}' does not have permission.`,
        correlationId: req.correlationId
      });
      return;
    }

    next();
  };
}

// Alias for backwards compatibility
export const rbacMiddleware = requireRole;

