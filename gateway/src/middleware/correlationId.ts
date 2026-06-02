import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerName = 'x-correlation-id';
  let correlationId = req.headers[headerName] as string;

  if (!correlationId) {
    correlationId = crypto.randomUUID();
  }

  // Ensure request has it
  req.correlationId = correlationId;
  req.headers[headerName] = correlationId;

  // Add to response header
  res.setHeader(headerName, correlationId);

  next();
}
