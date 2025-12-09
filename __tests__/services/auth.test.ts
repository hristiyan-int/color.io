import { authService } from '../../src/services/auth';
import { supabase } from '../../src/services/supabase';

// Mock supabase
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// Helper to create mock query builder
const createMockQueryBuilder = (data: any, error: any = null) => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error }),
});

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('should sign up a new user successfully', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };
      const profile = {
        id: 'user-123',
        username: 'testuser',
        display_name: 'testuser',
        avatar_url: null,
        bio: null,
        created_at: new Date().toISOString(),
      };

      (mockSupabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: authUser },
        error: null,
      });

      const mockQueryBuilder = createMockQueryBuilder(profile);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await authService.signUp({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-123');
      expect(result?.username).toBe('testuser');
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should throw error when auth signup fails', async () => {
      (mockSupabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Email already exists' },
      });

      await expect(
        authService.signUp({
          email: 'existing@example.com',
          username: 'testuser',
          password: 'password',
        })
      ).rejects.toThrow('Email already exists');
    });

    it('should throw error when user is not returned', async () => {
      (mockSupabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        authService.signUp({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password',
        })
      ).rejects.toThrow('Failed to create user');
    });

    it('should throw error when profile creation fails', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };

      (mockSupabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: authUser },
        error: null,
      });

      const mockQueryBuilder = createMockQueryBuilder(null, { message: 'Profile creation failed' });
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      await expect(
        authService.signUp({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password',
        })
      ).rejects.toThrow('Profile creation failed');
    });
  });

  describe('signIn', () => {
    it('should sign in an existing user', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };
      const profile = {
        id: 'user-123',
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        created_at: new Date().toISOString(),
      };

      (mockSupabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: authUser },
        error: null,
      });

      const mockQueryBuilder = createMockQueryBuilder(profile);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result).not.toBeNull();
      expect(result?.email).toBe('test@example.com');
      expect(result?.displayName).toBe('Test User');
    });

    it('should throw error on invalid credentials', async () => {
      (mockSupabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(
        authService.signIn({
          email: 'test@example.com',
          password: 'wrong',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error when user is not returned', async () => {
      (mockSupabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        authService.signIn({
          email: 'test@example.com',
          password: 'password',
        })
      ).rejects.toThrow('Failed to sign in');
    });

    it('should return null when profile not found', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };

      (mockSupabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: authUser },
        error: null,
      });

      const mockQueryBuilder = createMockQueryBuilder(null, { code: 'PGRST116' });
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'password',
      });

      expect(result).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      (mockSupabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });

      await expect(authService.signOut()).resolves.not.toThrow();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should throw error on sign out failure', async () => {
      (mockSupabase.auth.signOut as jest.Mock).mockResolvedValue({
        error: { message: 'Sign out failed' },
      });

      await expect(authService.signOut()).rejects.toThrow('Sign out failed');
    });
  });

  describe('resetPassword', () => {
    it('should send reset password email', async () => {
      (mockSupabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        error: null,
      });

      await expect(authService.resetPassword('test@example.com')).resolves.not.toThrow();
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: 'colorio://reset-password' }
      );
    });

    it('should throw error on reset password failure', async () => {
      (mockSupabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        error: { message: 'User not found' },
      });

      await expect(authService.resetPassword('unknown@example.com')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully', async () => {
      (mockSupabase.auth.updateUser as jest.Mock).mockResolvedValue({ error: null });

      await expect(authService.updatePassword('newpassword')).resolves.not.toThrow();
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword',
      });
    });

    it('should throw error on update password failure', async () => {
      (mockSupabase.auth.updateUser as jest.Mock).mockResolvedValue({
        error: { message: 'Password too weak' },
      });

      await expect(authService.updatePassword('123')).rejects.toThrow('Password too weak');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };
      const profile = {
        id: 'user-123',
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: null,
        bio: null,
        created_at: new Date().toISOString(),
      };

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: authUser },
      });

      const mockQueryBuilder = createMockQueryBuilder(profile);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await authService.getCurrentUser();

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-123');
    });

    it('should return null when not authenticated', async () => {
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const result = await authService.getCurrentUser();

      expect(result).toBeNull();
    });

    it('should return null when profile not found', async () => {
      const authUser = { id: 'user-123', email: 'test@example.com' };

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: authUser },
      });

      const mockQueryBuilder = createMockQueryBuilder(null);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await authService.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('getProfile', () => {
    it('should return profile by user id', async () => {
      const profile = {
        id: 'user-123',
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        created_at: new Date().toISOString(),
      };

      const mockQueryBuilder = createMockQueryBuilder(profile);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await authService.getProfile('user-123');

      expect(result).not.toBeNull();
      expect(result?.username).toBe('testuser');
      expect(result?.displayName).toBe('Test User');
      expect(result?.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should return null when profile not found', async () => {
      const mockQueryBuilder = createMockQueryBuilder(null, { code: 'PGRST116' });
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await authService.getProfile('non-existent');

      expect(result).toBeNull();
    });

    it('should handle null optional fields', async () => {
      const profile = {
        id: 'user-123',
        username: 'testuser',
        display_name: null,
        avatar_url: null,
        bio: null,
        created_at: new Date().toISOString(),
      };

      const mockQueryBuilder = createMockQueryBuilder(profile);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await authService.getProfile('user-123');

      expect(result?.displayName).toBeUndefined();
      expect(result?.avatarUrl).toBeUndefined();
      expect(result?.bio).toBeUndefined();
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updatedProfile = {
        id: 'user-123',
        username: 'testuser',
        display_name: 'Updated Name',
        avatar_url: 'https://example.com/new-avatar.jpg',
        bio: 'Updated bio',
        created_at: new Date().toISOString(),
      };

      const mockQueryBuilder = createMockQueryBuilder(updatedProfile);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await authService.updateProfile('user-123', {
        displayName: 'Updated Name',
        bio: 'Updated bio',
      });

      expect(result).not.toBeNull();
      expect(result?.displayName).toBe('Updated Name');
      expect(result?.bio).toBe('Updated bio');
    });

    it('should throw error on update failure', async () => {
      const mockQueryBuilder = createMockQueryBuilder(null, { message: 'Update failed' });
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      await expect(
        authService.updateProfile('user-123', { displayName: 'New Name' })
      ).rejects.toThrow('Update failed');
    });

    it('should throw generic error when no data and no error message', async () => {
      const mockQueryBuilder = createMockQueryBuilder(null, null);
      (mockSupabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      await expect(
        authService.updateProfile('user-123', { displayName: 'New Name' })
      ).rejects.toThrow('Failed to update profile');
    });
  });

  describe('getUserStats', () => {
    it('should return user stats', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 10, error: null }),
      });

      (mockSupabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await authService.getUserStats('user-123');

      expect(result.palettesCount).toBe(10);
      expect(result.followersCount).toBe(10);
      expect(result.followingCount).toBe(10);
    });

    it('should return 0 when counts are null', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: null, error: null }),
      });

      (mockSupabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await authService.getUserStats('user-123');

      expect(result.palettesCount).toBe(0);
      expect(result.followersCount).toBe(0);
      expect(result.followingCount).toBe(0);
    });
  });

  describe('onAuthStateChange', () => {
    it('should subscribe to auth state changes', async () => {
      const mockUnsubscribe = jest.fn();
      const mockCallback = jest.fn();

      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });

      authService.onAuthStateChange(mockCallback);

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });
  });

  describe('mapToUser', () => {
    it('should map profile to user correctly', () => {
      const profile = {
        id: 'user-123',
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Test bio',
        createdAt: new Date().toISOString(),
      };

      const result = authService.mapToUser(profile, 'test@example.com');

      expect(result.id).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.username).toBe('testuser');
      expect(result.stats).toEqual({
        palettesCount: 0,
        followersCount: 0,
        followingCount: 0,
      });
    });
  });
});
