import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Environment variables (to be set in app.config.js or .env)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Custom storage adapter for React Native using expo-secure-store
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error getting item from secure store:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error setting item in secure store:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing item from secure store:', error);
    }
  },
};

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types (generated from Supabase schema)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
        };
      };
      palettes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          source_image_url: string | null;
          thumbnail_url: string | null;
          is_public: boolean;
          likes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          source_image_url?: string | null;
          thumbnail_url?: string | null;
          is_public?: boolean;
          likes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          source_image_url?: string | null;
          thumbnail_url?: string | null;
          is_public?: boolean;
          likes_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      palette_colors: {
        Row: {
          id: string;
          palette_id: string;
          hex_code: string;
          rgb_r: number;
          rgb_g: number;
          rgb_b: number;
          hsl_h: number;
          hsl_s: number;
          hsl_l: number;
          position: number;
          name: string | null;
        };
        Insert: {
          id?: string;
          palette_id: string;
          hex_code: string;
          rgb_r: number;
          rgb_g: number;
          rgb_b: number;
          hsl_h: number;
          hsl_s: number;
          hsl_l: number;
          position: number;
          name?: string | null;
        };
        Update: {
          id?: string;
          palette_id?: string;
          hex_code?: string;
          rgb_r?: number;
          rgb_g?: number;
          rgb_b?: number;
          hsl_h?: number;
          hsl_s?: number;
          hsl_l?: number;
          position?: number;
          name?: string | null;
        };
      };
      likes: {
        Row: {
          user_id: string;
          palette_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          palette_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          palette_id?: string;
          created_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          palette_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          palette_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          palette_id?: string;
          content?: string;
          created_at?: string;
        };
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          usage_count: number;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          usage_count?: number;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string | null;
          usage_count?: number;
        };
      };
      palette_tags: {
        Row: {
          palette_id: string;
          tag_id: string;
        };
        Insert: {
          palette_id: string;
          tag_id: string;
        };
        Update: {
          palette_id?: string;
          tag_id?: string;
        };
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
