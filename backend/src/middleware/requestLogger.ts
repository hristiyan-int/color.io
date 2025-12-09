import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Generate unique request ID
  req.requestId = crypto.randomUUID().slice(0, 8);

  // Add to response headers for debugging
  res.setHeader('X-Request-ID', req.requestId);

  const start = Date.now();

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent')?.slice(0, 50),
      ip: req.ip || req.socket.remoteAddress,
    };

    // Log errors and slow requests in production, everything in dev
    if (process.env.NODE_ENV === 'production') {
      if (res.statusCode >= 400 || duration > 1000) {
        console.log(JSON.stringify(logData));
      }
    } else {
      console.log(`[${logData.requestId}] ${logData.method} ${logData.path} ${logData.status} ${logData.duration}`);
    }
  });

  next();
}
