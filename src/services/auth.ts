import { supabase } from './supabase';
import type { User, Profile, LoginCredentials, RegisterCredentials } from '@/types';

export const authService = {
  /**
   * Sign up a new user
   */
  async signUp({ email, username, password }: RegisterCredentials): Promise<User | null> {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error('Failed to create user');
    }

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        username,
        display_name: username,
      })
      .select()
      .single();

    if (profileError) {
      throw new Error(profileError.message);
    }

    return this.mapToUser(profile, email);
  },

  /**
   * Sign in an existing user
   */
  async signIn({ email, password }: LoginCredentials): Promise<User | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Failed to sign in');
    }

    const profile = await this.getProfile(data.user.id);
    return profile ? this.mapToUser(profile, email) : null;
  },

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'colorio://reset-password',
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Update password
   */
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Get the current user
   */
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const profile = await this.getProfile(user.id);
    return profile ? this.mapToUser(profile, user.email || '') : null;
  },

  /**
   * Get a user profile by ID
   */
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name || undefined,
      avatarUrl: data.avatar_url || undefined,
      bio: data.bio || undefined,
      createdAt: data.created_at,
    };
  },

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: Partial<Pick<Profile, 'displayName' | 'bio' | 'avatarUrl'>>
  ): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: updates.displayName,
        bio: updates.bio,
        avatar_url: updates.avatarUrl,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update profile');
    }

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name || undefined,
      avatarUrl: data.avatar_url || undefined,
      bio: data.bio || undefined,
      createdAt: data.created_at,
    };
  },

  /**
   * Get user stats
   */
  async getUserStats(userId: string) {
    const [palettesResult, followersResult, followingResult] = await Promise.all([
      supabase
        .from('palettes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    return {
      palettesCount: palettesResult.count || 0,
      followersCount: followersResult.count || 0,
      followingCount: followingResult.count || 0,
    };
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await this.getProfile(session.user.id);
        if (profile) {
          callback(this.mapToUser(profile, session.user.email || ''));
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },

  /**
   * Map database profile to User type
   */
  mapToUser(profile: Profile, email: string): User {
    return {
      ...profile,
      email,
      stats: {
        palettesCount: 0,
        followersCount: 0,
        followingCount: 0,
      },
    };
  },
};
