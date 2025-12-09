import { act } from '@testing-library/react-native';
import { usePaletteStore } from '../../src/store/paletteStore';
import type { Palette, Color, PaletteColor } from '../../src/types';

// Helper to reset store between tests
const resetStore = () => {
  act(() => {
    usePaletteStore.getState().reset();
    usePaletteStore.getState().setPalettes([]);
  });
};

// Mock data
const mockColor: Color = {
  hex: '#FF6B6B',
  rgb: { r: 255, g: 107, b: 107 },
  hsl: { h: 0, s: 100, l: 71 },
  name: 'Coral Red',
};

const mockPaletteColor: PaletteColor = {
  id: 'color-1',
  hex: '#FF6B6B',
  rgb: { r: 255, g: 107, b: 107 },
  hsl: { h: 0, s: 100, l: 71 },
  position: 0,
  name: 'Coral Red',
};

const mockPalette: Palette = {
  id: 'palette-1',
  userId: 'user-1',
  name: 'Test Palette',
  description: 'A test palette',
  colors: [mockPaletteColor],
  isPublic: false,
  likesCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Palette Store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = usePaletteStore.getState();

      expect(state.currentImage).toBeNull();
      expect(state.extractedColors).toEqual([]);
      expect(state.isExtracting).toBe(false);
      expect(state.editingPalette).toBeNull();
      expect(state.editingColors).toEqual([]);
      expect(state.palettes).toEqual([]);
      expect(state.isLoadingPalettes).toBe(false);
      expect(state.selectedPalette).toBeNull();
    });
  });

  describe('Extraction Actions', () => {
    it('should set current image', () => {
      act(() => {
        usePaletteStore.getState().setCurrentImage('file://test-image.jpg');
      });

      expect(usePaletteStore.getState().currentImage).toBe('file://test-image.jpg');
    });

    it('should clear current image', () => {
      act(() => {
        usePaletteStore.getState().setCurrentImage('file://test.jpg');
        usePaletteStore.getState().setCurrentImage(null);
      });

      expect(usePaletteStore.getState().currentImage).toBeNull();
    });

    it('should set extracted colors', () => {
      const colors: Color[] = [mockColor, { ...mockColor, hex: '#4ECDC4' }];

      act(() => {
        usePaletteStore.getState().setExtractedColors(colors);
      });

      expect(usePaletteStore.getState().extractedColors).toEqual(colors);
    });

    it('should set extracting state', () => {
      act(() => {
        usePaletteStore.getState().setIsExtracting(true);
      });

      expect(usePaletteStore.getState().isExtracting).toBe(true);

      act(() => {
        usePaletteStore.getState().setIsExtracting(false);
      });

      expect(usePaletteStore.getState().isExtracting).toBe(false);
    });
  });

  describe('Editing Actions', () => {
    describe('startEditing', () => {
      it('should start editing with existing palette', () => {
        act(() => {
          usePaletteStore.getState().startEditing(mockPalette);
        });

        const state = usePaletteStore.getState();
        expect(state.editingPalette).toEqual(mockPalette);
        expect(state.editingColors).toHaveLength(1);
        expect(state.editingColors[0].hex).toBe('#FF6B6B');
      });

      it('should start editing with extracted colors when no palette provided', () => {
        const colors: Color[] = [
          mockColor,
          { ...mockColor, hex: '#4ECDC4', name: 'Teal' },
        ];

        act(() => {
          usePaletteStore.getState().setExtractedColors(colors);
          usePaletteStore.getState().startEditing();
        });

        const state = usePaletteStore.getState();
        expect(state.editingPalette).toBeNull();
        expect(state.editingColors).toHaveLength(2);
      });

      it('should assign positions to editing colors', () => {
        const colors: Color[] = [
          mockColor,
          { ...mockColor, hex: '#4ECDC4' },
          { ...mockColor, hex: '#45B7D1' },
        ];

        act(() => {
          usePaletteStore.getState().setExtractedColors(colors);
          usePaletteStore.getState().startEditing();
        });

        const editingColors = usePaletteStore.getState().editingColors;
        expect(editingColors[0].position).toBe(0);
        expect(editingColors[1].position).toBe(1);
        expect(editingColors[2].position).toBe(2);
      });
    });

    describe('updateEditingColor', () => {
      it('should update a color at specific index', () => {
        act(() => {
          usePaletteStore.getState().setExtractedColors([mockColor]);
          usePaletteStore.getState().startEditing();
          usePaletteStore.getState().updateEditingColor(0, { hex: '#000000' });
        });

        expect(usePaletteStore.getState().editingColors[0].hex).toBe('#000000');
      });

      it('should preserve other color properties', () => {
        act(() => {
          usePaletteStore.getState().setExtractedColors([mockColor]);
          usePaletteStore.getState().startEditing();
          usePaletteStore.getState().updateEditingColor(0, { name: 'New Name' });
        });

        const color = usePaletteStore.getState().editingColors[0];
        expect(color.name).toBe('New Name');
        expect(color.hex).toBe('#FF6B6B'); // Preserved
      });
    });

    describe('addEditingColor', () => {
      it('should add a new color', () => {
        act(() => {
          usePaletteStore.getState().setExtractedColors([mockColor]);
          usePaletteStore.getState().startEditing();
          usePaletteStore.getState().addEditingColor({
            hex: '#4ECDC4',
            rgb: { r: 78, g: 205, b: 196 },
            hsl: { h: 176, s: 63, l: 55 },
            name: 'Teal',
          });
        });

        expect(usePaletteStore.getState().editingColors).toHaveLength(2);
      });

      it('should not exceed 8 colors', () => {
        // Create 8 colors
        const colors: Color[] = Array(8).fill(mockColor);

        act(() => {
          usePaletteStore.getState().setExtractedColors(colors);
          usePaletteStore.getState().startEditing();

          // Try to add 9th color
          usePaletteStore.getState().addEditingColor({
            hex: '#000000',
            rgb: { r: 0, g: 0, b: 0 },
            hsl: { h: 0, s: 0, l: 0 },
          });
        });

        expect(usePaletteStore.getState().editingColors).toHaveLength(8);
      });

      it('should assign correct position to new color', () => {
        const colors: Color[] = [mockColor, mockColor];

        act(() => {
          usePaletteStore.getState().setExtractedColors(colors);
          usePaletteStore.getState().startEditing();
          usePaletteStore.getState().addEditingColor({
            hex: '#000000',
            rgb: { r: 0, g: 0, b: 0 },
            hsl: { h: 0, s: 0, l: 0 },
          });
        });

        const editingColors = usePaletteStore.getState().editingColors;
        expect(editingColors[2].position).toBe(2);
      });
    });

    describe('removeEditingColor', () => {
      it('should remove color at index', () => {
        const colors: Color[] = [
          mockColor,
          { ...mockColor, hex: '#4ECDC4' },
          { ...mockColor, hex: '#45B7D1' },
          { ...mockColor, hex: '#FFE66D' },
        ];

        act(() => {
          usePaletteStore.getState().setExtractedColors(colors);
          usePaletteStore.getState().startEditing();
          usePaletteStore.getState().removeEditingColor(1);
        });

        const editingColors = usePaletteStore.getState().editingColors;
        expect(editingColors).toHaveLength(3);
        expect(editingColors[0].hex).toBe('#FF6B6B');
        expect(editingColors[1].hex).toBe('#45B7D1');
      });

      it('should not remove below 3 colors', () => {
        const colors: Color[] = [mockColor, { ...mockColor, hex: '#4ECDC4' }, { ...mockColor, hex: '#45B7D1' }];

        act(() => {
          usePaletteStore.getState().setExtractedColors(colors);
          usePaletteStore.getState().startEditing();
          usePaletteStore.getState().removeEditingColor(0);
        });

        expect(usePaletteStore.getState().editingColors).toHaveLength(3);
      });

      it('should update positions after removal', () => {
        const colors: Color[] = [
          mockColor,
          { ...mockColor, hex: '#4ECDC4' },
          { ...mockColor, hex: '#45B7D1' },
          { ...mockColor, hex: '#FFE66D' },
        ];

        act(() => {
          usePaletteStore.getState().setExtractedColors(colors);
          usePaletteStore.getState().startEditing();
          usePaletteStore.getState().removeEditingColor(0);
        });

        const editingColors = usePaletteStore.getState().editingColors;
        expect(editingColors[0].position).toBe(0);
        expect(editingColors[1].position).toBe(1);
        expect(editingColors[2].position).toBe(2);
      });
    });

    describe('reorderEditingColors', () => {
      it('should reorder colors', () => {
        const colors: Color[] = [
          { ...mockColor, hex: '#FF0000' },
          { ...mockColor, hex: '#00FF00' },
          { ...mockColor, hex: '#0000FF' },
        ];

        act(() => {
          usePaletteStore.getState().setExtractedColors(colors);
          usePaletteStore.getState().startEditing();
          usePaletteStore.getState().reorderEditingColors(0, 2);
        });

        const editingColors = usePaletteStore.getState().editingColors;
        expect(editingColors[0].hex).toBe('#00FF00');
        expect(editingColors[1].hex).toBe('#0000FF');
        expect(editingColors[2].hex).toBe('#FF0000');
      });

      it('should update positions after reorder', () => {
        const colors: Color[] = [
          { ...mockColor, hex: '#FF0000' },
          { ...mockColor, hex: '#00FF00' },
          { ...mockColor, hex: '#0000FF' },
        ];

        act(() => {
          usePaletteStore.getState().setExtractedColors(colors);
          usePaletteStore.getState().startEditing();
          usePaletteStore.getState().reorderEditingColors(2, 0);
        });

        const editingColors = usePaletteStore.getState().editingColors;
        editingColors.forEach((color, index) => {
          expect(color.position).toBe(index);
        });
      });
    });

    describe('clearEditing', () => {
      it('should clear all editing state', () => {
        act(() => {
          usePaletteStore.getState().setCurrentImage('file://test.jpg');
          usePaletteStore.getState().setExtractedColors([mockColor]);
          usePaletteStore.getState().startEditing(mockPalette);
          usePaletteStore.getState().clearEditing();
        });

        const state = usePaletteStore.getState();
        expect(state.editingPalette).toBeNull();
        expect(state.editingColors).toEqual([]);
        expect(state.currentImage).toBeNull();
        expect(state.extractedColors).toEqual([]);
      });
    });
  });

  describe('Library Actions', () => {
    describe('setPalettes', () => {
      it('should set palettes', () => {
        act(() => {
          usePaletteStore.getState().setPalettes([mockPalette]);
        });

        expect(usePaletteStore.getState().palettes).toHaveLength(1);
        expect(usePaletteStore.getState().palettes[0].id).toBe('palette-1');
      });
    });

    describe('addPalette', () => {
      it('should add palette to beginning', () => {
        const newPalette: Palette = { ...mockPalette, id: 'palette-2' };

        act(() => {
          usePaletteStore.getState().setPalettes([mockPalette]);
          usePaletteStore.getState().addPalette(newPalette);
        });

        const palettes = usePaletteStore.getState().palettes;
        expect(palettes).toHaveLength(2);
        expect(palettes[0].id).toBe('palette-2'); // New palette first
        expect(palettes[1].id).toBe('palette-1');
      });
    });

    describe('updatePalette', () => {
      it('should update palette by id', () => {
        act(() => {
          usePaletteStore.getState().setPalettes([mockPalette]);
          usePaletteStore.getState().updatePalette('palette-1', { name: 'Updated Name' });
        });

        expect(usePaletteStore.getState().palettes[0].name).toBe('Updated Name');
      });

      it('should update selected palette if it matches', () => {
        act(() => {
          usePaletteStore.getState().setPalettes([mockPalette]);
          usePaletteStore.getState().selectPalette(mockPalette);
          usePaletteStore.getState().updatePalette('palette-1', { name: 'New Name' });
        });

        expect(usePaletteStore.getState().selectedPalette?.name).toBe('New Name');
      });

      it('should not update selected palette if different id', () => {
        const anotherPalette = { ...mockPalette, id: 'palette-2', name: 'Another' };

        act(() => {
          usePaletteStore.getState().setPalettes([mockPalette, anotherPalette]);
          usePaletteStore.getState().selectPalette(anotherPalette);
          usePaletteStore.getState().updatePalette('palette-1', { name: 'Updated' });
        });

        expect(usePaletteStore.getState().selectedPalette?.name).toBe('Another');
      });
    });

    describe('removePalette', () => {
      it('should remove palette by id', () => {
        act(() => {
          usePaletteStore.getState().setPalettes([mockPalette]);
          usePaletteStore.getState().removePalette('palette-1');
        });

        expect(usePaletteStore.getState().palettes).toHaveLength(0);
      });

      it('should clear selected palette if removed', () => {
        act(() => {
          usePaletteStore.getState().setPalettes([mockPalette]);
          usePaletteStore.getState().selectPalette(mockPalette);
          usePaletteStore.getState().removePalette('palette-1');
        });

        expect(usePaletteStore.getState().selectedPalette).toBeNull();
      });

      it('should keep selected palette if different one removed', () => {
        const anotherPalette = { ...mockPalette, id: 'palette-2' };

        act(() => {
          usePaletteStore.getState().setPalettes([mockPalette, anotherPalette]);
          usePaletteStore.getState().selectPalette(mockPalette);
          usePaletteStore.getState().removePalette('palette-2');
        });

        expect(usePaletteStore.getState().selectedPalette?.id).toBe('palette-1');
      });
    });

    describe('setIsLoadingPalettes', () => {
      it('should set loading state', () => {
        act(() => {
          usePaletteStore.getState().setIsLoadingPalettes(true);
        });

        expect(usePaletteStore.getState().isLoadingPalettes).toBe(true);

        act(() => {
          usePaletteStore.getState().setIsLoadingPalettes(false);
        });

        expect(usePaletteStore.getState().isLoadingPalettes).toBe(false);
      });
    });
  });

  describe('Selection Actions', () => {
    it('should select a palette', () => {
      act(() => {
        usePaletteStore.getState().selectPalette(mockPalette);
      });

      expect(usePaletteStore.getState().selectedPalette).toEqual(mockPalette);
    });

    it('should deselect palette', () => {
      act(() => {
        usePaletteStore.getState().selectPalette(mockPalette);
        usePaletteStore.getState().selectPalette(null);
      });

      expect(usePaletteStore.getState().selectedPalette).toBeNull();
    });
  });

  describe('Reset Action', () => {
    it('should reset extraction and editing state but keep library', () => {
      act(() => {
        usePaletteStore.getState().setPalettes([mockPalette]);
        usePaletteStore.getState().setCurrentImage('file://test.jpg');
        usePaletteStore.getState().setExtractedColors([mockColor]);
        usePaletteStore.getState().setIsExtracting(true);
        usePaletteStore.getState().startEditing(mockPalette);
        usePaletteStore.getState().selectPalette(mockPalette);
        usePaletteStore.getState().reset();
      });

      const state = usePaletteStore.getState();
      expect(state.currentImage).toBeNull();
      expect(state.extractedColors).toEqual([]);
      expect(state.isExtracting).toBe(false);
      expect(state.editingPalette).toBeNull();
      expect(state.editingColors).toEqual([]);
      expect(state.selectedPalette).toBeNull();
      // Library is preserved
      expect(state.palettes).toHaveLength(1);
    });
  });
});
