import { createMMKV, type MMKV } from 'react-native-mmkv';

// Create storage instance
export const storage: MMKV = createMMKV({
  id: 'color-io-storage',
});

// Storage keys
export const STORAGE_KEYS = {
  PALETTE_HISTORY: 'palette_history',
  DELETED_PALETTES: 'deleted_palettes',
  RECENT_SEARCHES: 'recent_searches',
  APP_SETTINGS: 'app_settings',
  LAST_EXTRACTION: 'last_extraction',
  COLOR_CACHE: 'color_cache',
} as const;

// Generic storage helpers
export const storageUtils = {
  /**
   * Get JSON data from storage
   */
  getJSON<T>(key: string): T | null {
    try {
      const data = storage.getString(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error reading ${key} from storage:`, error);
      return null;
    }
  },

  /**
   * Set JSON data to storage
   */
  setJSON<T>(key: string, value: T): boolean {
    try {
      storage.set(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing ${key} to storage:`, error);
      return false;
    }
  },

  /**
   * Remove key from storage
   */
  remove(key: string): void {
    storage.remove(key);
  },

  /**
   * Clear all storage
   */
  clearAll(): void {
    storage.clearAll();
  },

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return storage.contains(key);
  },
};
