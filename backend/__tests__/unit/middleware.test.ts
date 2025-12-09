import { AppError, errorHandler } from '../../src/middleware/errorHandler.js';
import { requestLogger } from '../../src/middleware/requestLogger.js';
import type { Request, Response, NextFunction } from 'express';

// Mock request/response objects
function createMockReq(overrides: any = {}): Partial<Request> {
  return {
    method: 'GET',
    path: '/test',
    get: jest.fn().mockReturnValue('test-user-agent'),
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' } as any,
    headers: {},
    ...overrides,
  };
}

function createMockRes(): Partial<Response> & { _status?: number; _json?: any } {
  const res: any = {
    _status: 200,
    _json: null,
    _headers: {},
    statusCode: 200,
    status: jest.fn().mockImplementation(function (code: number) {
      res._status = code;
      res.statusCode = code;
      return res;
    }),
    json: jest.fn().mockImplementation(function (data: any) {
      res._json = data;
      return res;
    }),
    setHeader: jest.fn().mockImplementation(function (name: string, value: string) {
      res._headers[name] = value;
      return res;
    }),
    on: jest.fn().mockImplementation(function (event: string, callback: Function) {
      if (event === 'finish') {
        // Simulate finish event after a tick
        setTimeout(callback, 0);
      }
      return res;
    }),
  };
  return res;
}

describe('AppError', () => {
  it('should create error with message and status code', () => {
    const error = new AppError('Test error', 400);

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBeUndefined();
  });

  it('should create error with optional code', () => {
    const error = new AppError('Test error', 401, 'UNAUTHORIZED');

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should be an instance of Error', () => {
    const error = new AppError('Test', 500);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should capture stack trace', () => {
    const error = new AppError('Test', 500);

    expect(error.stack).toBeDefined();
  });
});

describe('errorHandler', () => {
  const mockNext = jest.fn() as NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    // Save original env
    process.env.NODE_ENV = 'test';
  });

  it('should handle AppError with correct status and message', () => {
    const error = new AppError('Not found', 404, 'NOT_FOUND');
    const req = createMockReq({ requestId: 'test-123' }) as Request;
    const res = createMockRes() as Response;

    errorHandler(error, req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not found',
      code: 'NOT_FOUND',
      requestId: 'test-123',
    });
  });

  it('should handle Zod validation errors', () => {
    const zodError = {
      name: 'ZodError',
      message: 'Validation error',
      errors: [{ path: ['name'], message: 'Required' }],
    };
    const req = createMockReq({ requestId: 'test-456' }) as Request;
    const res = createMockRes() as Response;

    errorHandler(zodError as any, req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((res as any)._json.error).toBe('Validation failed');
    expect((res as any)._json.requestId).toBe('test-456');
  });

  it('should hide error details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Sensitive error details');
    const req = createMockReq({ requestId: 'test-789' }) as Request;
    const res = createMockRes() as Response;

    errorHandler(error, req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect((res as any)._json.error).toBe('Internal server error');
    expect((res as any)._json.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('should show error details in development', () => {
    process.env.NODE_ENV = 'development';

    const error = new Error('Detailed error message');
    const req = createMockReq({ requestId: 'test-dev' }) as Request;
    const res = createMockRes() as Response;

    errorHandler(error, req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect((res as any)._json.error).toBe('Detailed error message');
    expect((res as any)._json.stack).toBeDefined();
  });

  it('should include requestId when available', () => {
    const error = new AppError('Test', 400);
    const req = createMockReq({ requestId: 'custom-id-123' }) as Request;
    const res = createMockRes() as Response;

    errorHandler(error, req, res, mockNext);

    expect((res as any)._json.requestId).toBe('custom-id-123');
  });

  it('should use "unknown" when requestId not available', () => {
    const error = new AppError('Test', 400);
    const req = createMockReq({}) as Request;
    const res = createMockRes() as Response;

    errorHandler(error, req, res, mockNext);

    expect((res as any)._json.requestId).toBe('unknown');
  });
});

describe('requestLogger', () => {
  it('should add requestId to request', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const next = jest.fn();

    requestLogger(req, res, next);

    expect((req as any).requestId).toBeDefined();
    expect(typeof (req as any).requestId).toBe('string');
    expect((req as any).requestId.length).toBe(8);
  });

  it('should set X-Request-ID header', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const next = jest.fn();

    requestLogger(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
  });

  it('should call next()', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const next = jest.fn();

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should register finish event listener', () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;
    const next = jest.fn();

    requestLogger(req, res, next);

    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });
});
