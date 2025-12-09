import { create } from 'zustand';
import type { Palette, PaletteColor, Color, ExtractionResult } from '@/types';

interface PaletteState {
  // Current extraction state
  currentImage: string | null;
  extractedColors: Color[];
  isExtracting: boolean;

  // Palette editing state
  editingPalette: Palette | null;
  editingColors: PaletteColor[];

  // Library state
  palettes: Palette[];
  isLoadingPalettes: boolean;

  // Selected palette for detail view
  selectedPalette: Palette | null;

  // Actions - Extraction
  setCurrentImage: (uri: string | null) => void;
  setExtractedColors: (colors: Color[]) => void;
  setIsExtracting: (isExtracting: boolean) => void;

  // Actions - Editing
  startEditing: (palette?: Palette) => void;
  updateEditingColor: (index: number, color: Partial<PaletteColor>) => void;
  addEditingColor: (color: Omit<PaletteColor, 'id' | 'position'>) => void;
  removeEditingColor: (index: number) => void;
  reorderEditingColors: (fromIndex: number, toIndex: number) => void;
  clearEditing: () => void;

  // Actions - Library
  setPalettes: (palettes: Palette[]) => void;
  addPalette: (palette: Palette) => void;
  updatePalette: (id: string, updates: Partial<Palette>) => void;
  removePalette: (id: string) => void;
  setIsLoadingPalettes: (isLoading: boolean) => void;

  // Actions - Selection
  selectPalette: (palette: Palette | null) => void;

  // Actions - Reset
  reset: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const usePaletteStore = create<PaletteState>((set, get) => ({
  // Initial state
  currentImage: null,
  extractedColors: [],
  isExtracting: false,
  editingPalette: null,
  editingColors: [],
  palettes: [],
  isLoadingPalettes: false,
  selectedPalette: null,

  // Extraction actions
  setCurrentImage: (uri) => set({ currentImage: uri }),

  setExtractedColors: (colors) => set({ extractedColors: colors }),

  setIsExtracting: (isExtracting) => set({ isExtracting }),

  // Editing actions
  startEditing: (palette) => {
    if (palette) {
      set({
        editingPalette: palette,
        editingColors: [...palette.colors],
      });
    } else {
      // Start with extracted colors if available
      const { extractedColors } = get();
      const editingColors: PaletteColor[] = extractedColors.map((color, index) => ({
        id: generateId(),
        hex: color.hex,
        rgb: color.rgb,
        hsl: color.hsl,
        position: index,
        name: color.name,
      }));

      set({
        editingPalette: null,
        editingColors,
      });
    }
  },

  updateEditingColor: (index, updates) => {
    const { editingColors } = get();
    const newColors = [...editingColors];
    newColors[index] = { ...newColors[index], ...updates };
    set({ editingColors: newColors });
  },

  addEditingColor: (color) => {
    const { editingColors } = get();
    if (editingColors.length >= 8) return; // Max 8 colors

    const newColor: PaletteColor = {
      id: generateId(),
      position: editingColors.length,
      ...color,
    };

    set({ editingColors: [...editingColors, newColor] });
  },

  removeEditingColor: (index) => {
    const { editingColors } = get();
    if (editingColors.length <= 3) return; // Min 3 colors

    const newColors = editingColors
      .filter((_, i) => i !== index)
      .map((color, i) => ({ ...color, position: i }));

    set({ editingColors: newColors });
  },

  reorderEditingColors: (fromIndex, toIndex) => {
    const { editingColors } = get();
    const newColors = [...editingColors];
    const [removed] = newColors.splice(fromIndex, 1);
    newColors.splice(toIndex, 0, removed);

    // Update positions
    const reorderedColors = newColors.map((color, i) => ({
      ...color,
      position: i,
    }));

    set({ editingColors: reorderedColors });
  },

  clearEditing: () => {
    set({
      editingPalette: null,
      editingColors: [],
      currentImage: null,
      extractedColors: [],
    });
  },

  // Library actions
  setPalettes: (palettes) => set({ palettes }),

  addPalette: (palette) => {
    const { palettes } = get();
    set({ palettes: [palette, ...palettes] });
  },

  updatePalette: (id, updates) => {
    const { palettes, selectedPalette } = get();
    const updatedPalettes = palettes.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );

    set({
      palettes: updatedPalettes,
      selectedPalette:
        selectedPalette?.id === id
          ? { ...selectedPalette, ...updates }
          : selectedPalette,
    });
  },

  removePalette: (id) => {
    const { palettes, selectedPalette } = get();
    set({
      palettes: palettes.filter((p) => p.id !== id),
      selectedPalette: selectedPalette?.id === id ? null : selectedPalette,
    });
  },

  setIsLoadingPalettes: (isLoading) => set({ isLoadingPalettes: isLoading }),

  // Selection actions
  selectPalette: (palette) => set({ selectedPalette: palette }),

  // Reset
  reset: () => {
    set({
      currentImage: null,
      extractedColors: [],
      isExtracting: false,
      editingPalette: null,
      editingColors: [],
      selectedPalette: null,
    });
  },
}));
