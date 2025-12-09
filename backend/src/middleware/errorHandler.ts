import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = req.requestId || 'unknown';
  const isProduction = process.env.NODE_ENV === 'production';

  // Log error with request context
  console.error(JSON.stringify({
    requestId,
    error: err.message,
    stack: isProduction ? undefined : err.stack,
    path: req.path,
    method: req.method,
  }));

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId,
    });
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: isProduction ? undefined : (err as any).errors,
      requestId,
    });
  }

  // Default error - hide details in production
  res.status(500).json({
    error: isProduction ? 'Internal server error' : err.message,
    requestId,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
