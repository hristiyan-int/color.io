import { act } from '@testing-library/react-native';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/services/auth';
import type { User } from '../../src/types';

// Mock the auth service
jest.mock('../../src/services/auth', () => ({
  authService: {
    getCurrentUser: jest.fn(),
    getUserStats: jest.fn(),
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock user data
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: 'https://example.com/avatar.jpg',
  bio: 'Test bio',
  createdAt: new Date().toISOString(),
  stats: {
    palettesCount: 10,
    followersCount: 5,
    followingCount: 3,
  },
};

const mockStats = {
  palettesCount: 10,
  followersCount: 5,
  followingCount: 3,
};

// Helper to reset store between tests
const resetStore = () => {
  act(() => {
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,
    });
  });
};

describe('Auth Store', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should initialize with user when authenticated', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthService.getUserStats.mockResolvedValue(mockStats);

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual({ ...mockUser, stats: mockStats });
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should initialize without user when not authenticated', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should handle initialization error gracefully', async () => {
      mockAuthService.getCurrentUser.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should set loading state during initialization', async () => {
      mockAuthService.getCurrentUser.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 100))
      );

      const initPromise = act(async () => {
        useAuthStore.getState().initialize();
      });

      // Check loading state immediately
      expect(useAuthStore.getState().isLoading).toBe(true);

      await initPromise;
    });
  });

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      mockAuthService.signIn.mockResolvedValue(mockUser);
      mockAuthService.getUserStats.mockResolvedValue(mockStats);

      await act(async () => {
        await useAuthStore.getState().signIn({ email: 'test@example.com', password: 'password' });
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual({ ...mockUser, stats: mockStats });
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should handle sign in error', async () => {
      const errorMessage = 'Invalid credentials';
      mockAuthService.signIn.mockRejectedValue(new Error(errorMessage));

      await expect(
        act(async () => {
          await useAuthStore.getState().signIn({ email: 'test@example.com', password: 'wrong' });
        })
      ).rejects.toThrow(errorMessage);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.error).toBe(errorMessage);
      expect(state.isLoading).toBe(false);
    });

    it('should set loading state during sign in', async () => {
      mockAuthService.signIn.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockUser), 100))
      );
      mockAuthService.getUserStats.mockResolvedValue(mockStats);

      const signInPromise = useAuthStore.getState().signIn({ email: 'test@example.com', password: 'password' });

      expect(useAuthStore.getState().isLoading).toBe(true);

      await act(async () => {
        await signInPromise;
      });

      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should clear previous error on new sign in attempt', async () => {
      // First, set an error
      act(() => {
        useAuthStore.setState({ error: 'Previous error' });
      });

      mockAuthService.signIn.mockResolvedValue(mockUser);
      mockAuthService.getUserStats.mockResolvedValue(mockStats);

      await act(async () => {
        await useAuthStore.getState().signIn({ email: 'test@example.com', password: 'password' });
      });

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('signUp', () => {
    it('should sign up successfully', async () => {
      mockAuthService.signUp.mockResolvedValue(mockUser);

      await act(async () => {
        await useAuthStore.getState().signUp({
          email: 'new@example.com',
          username: 'newuser',
          password: 'password123',
        });
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should handle sign up error', async () => {
      const errorMessage = 'Email already exists';
      mockAuthService.signUp.mockRejectedValue(new Error(errorMessage));

      await expect(
        act(async () => {
          await useAuthStore.getState().signUp({
            email: 'existing@example.com',
            username: 'existinguser',
            password: 'password',
          });
        })
      ).rejects.toThrow(errorMessage);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.error).toBe(errorMessage);
    });

    it('should handle non-Error exceptions', async () => {
      mockAuthService.signUp.mockRejectedValue('String error');

      try {
        await act(async () => {
          await useAuthStore.getState().signUp({
            email: 'test@example.com',
            username: 'testuser',
            password: 'password',
          });
        });
      } catch (e) {
        // Expected to throw
      }

      // When a non-Error is thrown, the message defaults to 'Failed to sign up'
      expect(useAuthStore.getState().error).toBe('Failed to sign up');
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      // First, set a user
      act(() => {
        useAuthStore.setState({ user: mockUser });
      });

      mockAuthService.signOut.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should handle sign out error', async () => {
      act(() => {
        useAuthStore.setState({ user: mockUser });
      });

      const errorMessage = 'Sign out failed';
      mockAuthService.signOut.mockRejectedValue(new Error(errorMessage));

      await expect(
        act(async () => {
          await useAuthStore.getState().signOut();
        })
      ).rejects.toThrow(errorMessage);

      const state = useAuthStore.getState();
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('resetPassword', () => {
    it('should send reset password email successfully', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().resetPassword('test@example.com');
      });

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('test@example.com');
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should handle reset password error', async () => {
      const errorMessage = 'User not found';
      mockAuthService.resetPassword.mockRejectedValue(new Error(errorMessage));

      await expect(
        act(async () => {
          await useAuthStore.getState().resetPassword('unknown@example.com');
        })
      ).rejects.toThrow(errorMessage);

      expect(useAuthStore.getState().error).toBe(errorMessage);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      act(() => {
        useAuthStore.setState({ user: mockUser });
      });

      const updatedProfile = {
        id: mockUser.id,
        username: mockUser.username,
        displayName: 'Updated Name',
        bio: 'Updated bio',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        createdAt: mockUser.createdAt,
      };

      mockAuthService.updateProfile.mockResolvedValue(updatedProfile);

      await act(async () => {
        await useAuthStore.getState().updateProfile({
          displayName: 'Updated Name',
          bio: 'Updated bio',
        });
      });

      const state = useAuthStore.getState();
      expect(state.user?.displayName).toBe('Updated Name');
      expect(state.user?.bio).toBe('Updated bio');
    });

    it('should not update if no user is logged in', async () => {
      await act(async () => {
        await useAuthStore.getState().updateProfile({ displayName: 'New Name' });
      });

      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
    });

    it('should handle update profile error', async () => {
      act(() => {
        useAuthStore.setState({ user: mockUser });
      });

      const errorMessage = 'Update failed';
      mockAuthService.updateProfile.mockRejectedValue(new Error(errorMessage));

      await expect(
        act(async () => {
          await useAuthStore.getState().updateProfile({ displayName: 'New Name' });
        })
      ).rejects.toThrow(errorMessage);

      expect(useAuthStore.getState().error).toBe(errorMessage);
    });

    it('should keep existing user data when profile update returns null', async () => {
      act(() => {
        useAuthStore.setState({ user: mockUser });
      });

      mockAuthService.updateProfile.mockResolvedValue(null);

      await act(async () => {
        await useAuthStore.getState().updateProfile({ displayName: 'New Name' });
      });

      // User should remain unchanged when update returns null
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });

  describe('clearError', () => {
    it('should clear error', () => {
      act(() => {
        useAuthStore.setState({ error: 'Some error' });
      });

      expect(useAuthStore.getState().error).toBe('Some error');

      act(() => {
        useAuthStore.getState().clearError();
      });

      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
