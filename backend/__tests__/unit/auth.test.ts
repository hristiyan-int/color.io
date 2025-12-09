import { Request, Response, NextFunction } from 'express';
import { authenticateToken, optionalAuth } from '../../src/middleware/auth';
import { supabaseAdmin } from '../../src/services/supabase';
import type { AuthenticatedRequest } from '../../src/types';

// Mock supabase admin
jest.mock('../../src/services/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

const mockSupabaseAdmin = supabaseAdmin as jest.Mocked<typeof supabaseAdmin>;

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockReq.headers = { authorization: 'Bearer valid-token' };

      (mockSupabaseAdmin!.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authenticateToken(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should reject request without authorization header', async () => {
      mockReq.headers = {};

      await authenticateToken(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', async () => {
      mockReq.headers = { authorization: 'InvalidFormat' };

      await authenticateToken(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    });

    it('should reject request with expired/invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer expired-token' };

      (mockSupabaseAdmin!.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      await authenticateToken(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    });

    it('should handle user without email', async () => {
      const mockUser = { id: 'user-123', email: undefined };
      mockReq.headers = { authorization: 'Bearer valid-token' };

      (mockSupabaseAdmin!.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await authenticateToken(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user?.email).toBe('');
    });

    it('should handle unexpected errors', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token' };

      (mockSupabaseAdmin!.auth.getUser as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      await authenticateToken(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        code: 'AUTH_FAILED',
      });
    });
  });

  describe('optionalAuth', () => {
    it('should attach user when valid token provided', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockReq.headers = { authorization: 'Bearer valid-token' };

      (mockSupabaseAdmin!.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await optionalAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should continue without user when no token', async () => {
      mockReq.headers = {};

      await optionalAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should continue without user when token is invalid', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      (mockSupabaseAdmin!.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await optionalAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should continue on error', async () => {
      mockReq.headers = { authorization: 'Bearer token' };

      (mockSupabaseAdmin!.auth.getUser as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      await optionalAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should handle user without email in optional auth', async () => {
      const mockUser = { id: 'user-123', email: null };
      mockReq.headers = { authorization: 'Bearer valid-token' };

      (mockSupabaseAdmin!.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await optionalAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user?.email).toBe('');
    });
  });
});
