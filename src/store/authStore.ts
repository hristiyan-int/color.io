import { create } from 'zustand';
import { authService } from '@/services/auth';
import type { User, LoginCredentials, RegisterCredentials } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signUp: (credentials: RegisterCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl'>>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true });
      const user = await authService.getCurrentUser();

      if (user) {
        const stats = await authService.getUserStats(user.id);
        user.stats = stats;
      }

      set({ user, isInitialized: true });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ isInitialized: true });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (credentials: LoginCredentials) => {
    try {
      set({ isLoading: true, error: null });
      const user = await authService.signIn(credentials);

      if (user) {
        const stats = await authService.getUserStats(user.id);
        user.stats = stats;
      }

      set({ user });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign in';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (credentials: RegisterCredentials) => {
    try {
      set({ isLoading: true, error: null });
      const user = await authService.signUp(credentials);
      set({ user });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign up';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true, error: null });
      await authService.signOut();
      set({ user: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign out';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  resetPassword: async (email: string) => {
    try {
      set({ isLoading: true, error: null });
      await authService.resetPassword(email);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;

    try {
      set({ isLoading: true, error: null });
      const updatedProfile = await authService.updateProfile(user.id, updates);

      if (updatedProfile) {
        set({
          user: {
            ...user,
            ...updatedProfile,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
