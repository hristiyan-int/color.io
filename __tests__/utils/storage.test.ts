import { storageUtils, STORAGE_KEYS, storage } from '../../src/utils/storage';

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(),
    getAllKeys: jest.fn(() => []),
    clearAll: jest.fn(),
    remove: jest.fn(),
  })),
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(),
    getAllKeys: jest.fn(() => []),
    clearAll: jest.fn(),
    remove: jest.fn(),
  })),
}));

describe('Storage Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('STORAGE_KEYS', () => {
    it('should have all required keys', () => {
      expect(STORAGE_KEYS.PALETTE_HISTORY).toBe('palette_history');
      expect(STORAGE_KEYS.DELETED_PALETTES).toBe('deleted_palettes');
      expect(STORAGE_KEYS.RECENT_SEARCHES).toBe('recent_searches');
      expect(STORAGE_KEYS.APP_SETTINGS).toBe('app_settings');
      expect(STORAGE_KEYS.LAST_EXTRACTION).toBe('last_extraction');
      expect(STORAGE_KEYS.COLOR_CACHE).toBe('color_cache');
    });
  });

  describe('getJSON', () => {
    it('should parse and return JSON data', () => {
      const mockData = { foo: 'bar', count: 42 };
      (storage.getString as jest.Mock).mockReturnValue(JSON.stringify(mockData));

      const result = storageUtils.getJSON('test-key');

      expect(result).toEqual(mockData);
      expect(storage.getString).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', () => {
      (storage.getString as jest.Mock).mockReturnValue(undefined);

      const result = storageUtils.getJSON('non-existent');

      expect(result).toBeNull();
    });

    it('should return null on JSON parse error', () => {
      (storage.getString as jest.Mock).mockReturnValue('invalid json {{{');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = storageUtils.getJSON('invalid-key');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        user: {
          id: '123',
          preferences: {
            theme: 'dark',
            notifications: true,
          },
        },
        palettes: [
          { id: 'p1', colors: ['#fff', '#000'] },
          { id: 'p2', colors: ['#f00', '#0f0', '#00f'] },
        ],
      };

      (storage.getString as jest.Mock).mockReturnValue(JSON.stringify(complexData));

      const result = storageUtils.getJSON('complex-key');

      expect(result).toEqual(complexData);
    });

    it('should handle arrays', () => {
      const arrayData = [1, 2, 3, 'four', { five: 5 }];
      (storage.getString as jest.Mock).mockReturnValue(JSON.stringify(arrayData));

      const result = storageUtils.getJSON<(number | string | object)[]>('array-key');

      expect(result).toEqual(arrayData);
    });
  });

  describe('setJSON', () => {
    it('should stringify and store JSON data', () => {
      const data = { name: 'test', value: 123 };

      const result = storageUtils.setJSON('test-key', data);

      expect(result).toBe(true);
      expect(storage.set).toHaveBeenCalledWith('test-key', JSON.stringify(data));
    });

    it('should handle arrays', () => {
      const data = ['item1', 'item2', 'item3'];

      const result = storageUtils.setJSON('array-key', data);

      expect(result).toBe(true);
      expect(storage.set).toHaveBeenCalledWith('array-key', JSON.stringify(data));
    });

    it('should return false on error', () => {
      (storage.set as jest.Mock).mockImplementation(() => {
        throw new Error('Storage full');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = storageUtils.setJSON('test-key', { data: 'test' });

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle null values', () => {
      // Reset the mock to ensure clean state and make it not throw
      (storage.set as jest.Mock).mockClear();
      (storage.set as jest.Mock).mockImplementation(() => undefined);

      const result = storageUtils.setJSON('null-key', null);

      // The function stores stringified null
      expect(storage.set).toHaveBeenCalledWith('null-key', 'null');
      // Result should be true if no error occurred
      expect(result).toBe(true);
    });

    it('should handle primitive values', () => {
      storageUtils.setJSON('number-key', 42);
      expect(storage.set).toHaveBeenCalledWith('number-key', '42');

      storageUtils.setJSON('string-key', 'hello');
      expect(storage.set).toHaveBeenCalledWith('string-key', '"hello"');

      storageUtils.setJSON('boolean-key', true);
      expect(storage.set).toHaveBeenCalledWith('boolean-key', 'true');
    });
  });

  describe('remove', () => {
    it('should remove key from storage', () => {
      storageUtils.remove('test-key');

      expect(storage.remove).toHaveBeenCalledWith('test-key');
    });
  });

  describe('clearAll', () => {
    it('should clear all storage', () => {
      storageUtils.clearAll();

      expect(storage.clearAll).toHaveBeenCalled();
    });
  });

  describe('has', () => {
    it('should return true when key exists', () => {
      (storage.contains as jest.Mock).mockReturnValue(true);

      const result = storageUtils.has('existing-key');

      expect(result).toBe(true);
      expect(storage.contains).toHaveBeenCalledWith('existing-key');
    });

    it('should return false when key does not exist', () => {
      (storage.contains as jest.Mock).mockReturnValue(false);

      const result = storageUtils.has('non-existent-key');

      expect(result).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle palette history workflow', () => {
      const history = [
        { id: '1', colors: ['#ff0000'], createdAt: '2024-01-01' },
        { id: '2', colors: ['#00ff00'], createdAt: '2024-01-02' },
      ];

      // Save history
      storageUtils.setJSON(STORAGE_KEYS.PALETTE_HISTORY, history);
      expect(storage.set).toHaveBeenCalledWith(
        STORAGE_KEYS.PALETTE_HISTORY,
        JSON.stringify(history)
      );

      // Load history
      (storage.getString as jest.Mock).mockReturnValue(JSON.stringify(history));
      const loaded = storageUtils.getJSON(STORAGE_KEYS.PALETTE_HISTORY);
      expect(loaded).toEqual(history);
    });

    it('should handle app settings workflow', () => {
      const settings = {
        theme: 'dark',
        language: 'en',
        notifications: {
          push: true,
          email: false,
        },
      };

      // Save settings
      storageUtils.setJSON(STORAGE_KEYS.APP_SETTINGS, settings);

      // Check if exists
      (storage.contains as jest.Mock).mockReturnValue(true);
      expect(storageUtils.has(STORAGE_KEYS.APP_SETTINGS)).toBe(true);

      // Load settings
      (storage.getString as jest.Mock).mockReturnValue(JSON.stringify(settings));
      const loaded = storageUtils.getJSON(STORAGE_KEYS.APP_SETTINGS);
      expect(loaded).toEqual(settings);

      // Clear settings
      storageUtils.remove(STORAGE_KEYS.APP_SETTINGS);
      expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.APP_SETTINGS);
    });
  });
});
