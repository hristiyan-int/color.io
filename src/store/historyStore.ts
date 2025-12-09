import { create } from 'zustand';
import { storage, STORAGE_KEYS, storageUtils } from '@/utils/storage';
import type { Palette, PaletteColor, Color } from '@/types';

// ============================================
// Types
// ============================================

export interface HistoryEntry {
  id: string;
  colors: PaletteColor[];
  sourceImageUri?: string;
  createdAt: string;
  name?: string;
  savedPaletteId?: string; // If it was saved as a palette
}

export interface DeletedPalette extends Palette {
  deletedAt: string;
  expiresAt: string; // 30 days from deletion
}

interface HistoryState {
  // History of generated palettes
  history: HistoryEntry[];
  maxHistoryItems: number;

  // Deleted palettes (soft delete for restore)
  deletedPalettes: DeletedPalette[];
  deletionRetentionDays: number;

  // Actions - History
  addToHistory: (entry: Omit<HistoryEntry, 'id' | 'createdAt'>) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  markAsSaved: (historyId: string, paletteId: string) => void;

  // Actions - Deleted Palettes
  softDeletePalette: (palette: Palette) => void;
  restorePalette: (id: string) => DeletedPalette | null;
  permanentlyDelete: (id: string) => void;
  cleanupExpiredDeleted: () => void;

  // Actions - Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

// ============================================
// Helper Functions
// ============================================

const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// ============================================
// Store
// ============================================

export const useHistoryStore = create<HistoryState>((set, get) => ({
  // Initial state
  history: [],
  maxHistoryItems: 50,
  deletedPalettes: [],
  deletionRetentionDays: 30,

  // History Actions
  addToHistory: (entry) => {
    const { history, maxHistoryItems, saveToStorage } = get();

    const newEntry: HistoryEntry = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...entry,
    };

    // Add to beginning, limit to max items
    const updatedHistory = [newEntry, ...history].slice(0, maxHistoryItems);

    set({ history: updatedHistory });
    saveToStorage();
  },

  removeFromHistory: (id) => {
    const { history, saveToStorage } = get();
    const updatedHistory = history.filter((h) => h.id !== id);
    set({ history: updatedHistory });
    saveToStorage();
  },

  clearHistory: () => {
    set({ history: [] });
    get().saveToStorage();
  },

  markAsSaved: (historyId, paletteId) => {
    const { history, saveToStorage } = get();
    const updatedHistory = history.map((h) =>
      h.id === historyId ? { ...h, savedPaletteId: paletteId } : h
    );
    set({ history: updatedHistory });
    saveToStorage();
  },

  // Deleted Palettes Actions
  softDeletePalette: (palette) => {
    const { deletedPalettes, deletionRetentionDays, saveToStorage } = get();

    const now = new Date();
    const deletedPalette: DeletedPalette = {
      ...palette,
      deletedAt: now.toISOString(),
      expiresAt: addDays(now, deletionRetentionDays).toISOString(),
    };

    set({ deletedPalettes: [deletedPalette, ...deletedPalettes] });
    saveToStorage();
  },

  restorePalette: (id) => {
    const { deletedPalettes, saveToStorage } = get();
    const palette = deletedPalettes.find((p) => p.id === id);

    if (!palette) return null;

    // Check if expired
    if (new Date(palette.expiresAt) < new Date()) {
      get().permanentlyDelete(id);
      return null;
    }

    // Remove from deleted
    const updatedDeleted = deletedPalettes.filter((p) => p.id !== id);
    set({ deletedPalettes: updatedDeleted });
    saveToStorage();

    // Return the palette (without deleted metadata)
    const { deletedAt, expiresAt, ...restoredPalette } = palette;
    return palette;
  },

  permanentlyDelete: (id) => {
    const { deletedPalettes, saveToStorage } = get();
    const updatedDeleted = deletedPalettes.filter((p) => p.id !== id);
    set({ deletedPalettes: updatedDeleted });
    saveToStorage();
  },

  cleanupExpiredDeleted: () => {
    const { deletedPalettes, saveToStorage } = get();
    const now = new Date();
    const activeDeleted = deletedPalettes.filter(
      (p) => new Date(p.expiresAt) > now
    );

    if (activeDeleted.length !== deletedPalettes.length) {
      set({ deletedPalettes: activeDeleted });
      saveToStorage();
    }
  },

  // Persistence Actions
  loadFromStorage: () => {
    try {
      const historyData = storageUtils.getJSON<HistoryEntry[]>(
        STORAGE_KEYS.PALETTE_HISTORY
      );
      const deletedData = storageUtils.getJSON<DeletedPalette[]>(
        STORAGE_KEYS.DELETED_PALETTES
      );

      set({
        history: historyData || [],
        deletedPalettes: deletedData || [],
      });

      // Cleanup expired on load
      get().cleanupExpiredDeleted();
    } catch (error) {
      console.error('Error loading history from storage:', error);
    }
  },

  saveToStorage: () => {
    const { history, deletedPalettes } = get();
    storageUtils.setJSON(STORAGE_KEYS.PALETTE_HISTORY, history);
    storageUtils.setJSON(STORAGE_KEYS.DELETED_PALETTES, deletedPalettes);
  },
}));

// ============================================
// Selectors
// ============================================

export const historySelectors = {
  /**
   * Get recent history entries
   */
  getRecentHistory: (state: HistoryState, limit: number = 10): HistoryEntry[] =>
    state.history.slice(0, limit),

  /**
   * Get history entry by ID
   */
  getHistoryById: (state: HistoryState, id: string): HistoryEntry | undefined =>
    state.history.find((h) => h.id === id),

  /**
   * Get unsaved history entries
   */
  getUnsavedHistory: (state: HistoryState): HistoryEntry[] =>
    state.history.filter((h) => !h.savedPaletteId),

  /**
   * Get restorable palettes (not expired)
   */
  getRestorablePalettes: (state: HistoryState): DeletedPalette[] => {
    const now = new Date();
    return state.deletedPalettes.filter((p) => new Date(p.expiresAt) > now);
  },

  /**
   * Get days remaining until deletion
   */
  getDaysUntilExpiry: (palette: DeletedPalette): number => {
    const now = new Date();
    const expiry = new Date(palette.expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  },

  /**
   * Check if history is empty
   */
  isHistoryEmpty: (state: HistoryState): boolean => state.history.length === 0,

  /**
   * Check if there are restorable palettes
   */
  hasRestorablePalettes: (state: HistoryState): boolean =>
    historySelectors.getRestorablePalettes(state).length > 0,
};
