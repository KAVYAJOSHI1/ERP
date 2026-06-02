import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory to restrict endpoints to specific user roles
 * @param allowedRoles Array of strings corresponding to roles (e.g. ['admin', 'procurement_manager'])
 */
export function rbacMiddleware(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // If request path is public, it skips auth, so req.user might be undefined
    // For protected routes, this runs after authMiddleware.
    if (!req.user) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication is required for this resource' 
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Role '${req.user.role}' does not have permission.`,
        correlationId: req.correlationId
      });
      return;
    }

    next();
  };
}
