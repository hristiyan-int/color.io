import {
  extractColorsFromPixels,
  parseImageData,
  generatePaletteFromColor,
} from '../../src/utils/colorExtraction';
import type { RGB } from '../../src/types';

describe('Color Extraction Utilities', () => {
  // Helper to create test image data - using small sizes for fast tests
  const createSolidColorImage = (r: number, g: number, b: number, size: number = 5) => {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    return { data, width: size, height: size };
  };

  const createMultiColorImage = (colors: RGB[]) => {
    const pixelsPerColor = 25; // Reduced from 100
    const totalPixels = colors.length * pixelsPerColor;
    const data = new Uint8ClampedArray(totalPixels * 4);

    colors.forEach((color, colorIndex) => {
      for (let i = 0; i < pixelsPerColor; i++) {
        const pixelIndex = colorIndex * pixelsPerColor + i;
        data[pixelIndex * 4] = color.r;
        data[pixelIndex * 4 + 1] = color.g;
        data[pixelIndex * 4 + 2] = color.b;
        data[pixelIndex * 4 + 3] = 255;
      }
    });

    return { data, width: 5, height: Math.ceil(totalPixels / 5) };
  };

  describe('parseImageData', () => {
    it('should create pixel data object from raw data', () => {
      const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
      const result = parseImageData(data, 2, 1);

      expect(result).toEqual({ data, width: 2, height: 1 });
    });
  });

  describe('extractColorsFromPixels', () => {
    it('should extract dominant color and include metadata', async () => {
      const pixels = createSolidColorImage(255, 0, 0);
      const result = await extractColorsFromPixels(pixels, { colorCount: 1 });

      expect(result.colors).toHaveLength(1);
      expect(result.dominantColor).toBeDefined();
      expect(result.dominantColor.rgb.r).toBeCloseTo(255, -1);
      expect(result.dominantColor.rgb.g).toBeCloseTo(0, -1);
      expect(result.dominantColor.rgb.b).toBeCloseTo(0, -1);
      // Check metadata is included
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.dominantColor.name).toBeDefined();
      expect(result.dominantColor.percentage).toBeGreaterThan(0);
    });

    it('should extract multiple distinct colors and respect colorCount', async () => {
      const testColors: RGB[] = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
      ];
      const pixels = createMultiColorImage(testColors);
      const result = await extractColorsFromPixels(pixels, { colorCount: 2 });

      expect(result.colors.length).toBeGreaterThan(0);
      expect(result.colors.length).toBeLessThanOrEqual(2);
    });

    it('should throw error for empty image', async () => {
      const emptyData = new Uint8ClampedArray(0);
      const pixels = { data: emptyData, width: 0, height: 0 };

      await expect(extractColorsFromPixels(pixels)).rejects.toThrow('No valid colors found');
    });

    it('should handle transparent pixels correctly', async () => {
      // Fully transparent - should throw
      const transparentData = new Uint8ClampedArray(25 * 4);
      for (let i = 0; i < 25; i++) {
        transparentData[i * 4] = 255;
        transparentData[i * 4 + 1] = 0;
        transparentData[i * 4 + 2] = 0;
        transparentData[i * 4 + 3] = 0;
      }
      await expect(extractColorsFromPixels({ data: transparentData, width: 5, height: 5 })).rejects.toThrow();

      // With includeTransparent option - should work
      const mixedData = new Uint8ClampedArray(50 * 4);
      for (let i = 0; i < 25; i++) {
        mixedData[i * 4] = 255;
        mixedData[i * 4 + 1] = 0;
        mixedData[i * 4 + 2] = 0;
        mixedData[i * 4 + 3] = 255;
      }
      for (let i = 25; i < 50; i++) {
        mixedData[i * 4] = 0;
        mixedData[i * 4 + 1] = 255;
        mixedData[i * 4 + 2] = 0;
        mixedData[i * 4 + 3] = 100;
      }
      const result = await extractColorsFromPixels(
        { data: mixedData, width: 5, height: 10 },
        { includeTransparent: true }
      );
      expect(result.colors.length).toBeGreaterThan(0);
    });

    it('should process larger images', async () => {
      // 20x20 = 400 pixels (reduced from 500x500 = 250,000)
      const pixels = createSolidColorImage(100, 150, 200, 20);
      const result = await extractColorsFromPixels(pixels);

      expect(result.colors).toBeDefined();
      expect(result.colors.length).toBeGreaterThan(0);
    });
  });

  describe('generatePaletteFromColor', () => {
    const baseColor: RGB = { r: 255, g: 100, b: 100 };

    it('should generate palettes of various sizes with correct properties', () => {
      // Test single color
      const single = generatePaletteFromColor(baseColor, 1);
      expect(single).toHaveLength(1);
      expect(single[0].rgb).toEqual(baseColor);

      // Test complementary (2 colors)
      const complementary = generatePaletteFromColor(baseColor, 2);
      expect(complementary).toHaveLength(2);
      const hueDiff = Math.abs((complementary[1].hsl.h - complementary[0].hsl.h + 360) % 360 - 180);
      expect(hueDiff).toBeLessThanOrEqual(5);

      // Test larger palette with proper format
      const palette = generatePaletteFromColor(baseColor, 5);
      expect(palette).toHaveLength(5);
      palette.forEach((color) => {
        expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
        expect(color.rgb.r).toBeGreaterThanOrEqual(0);
        expect(color.rgb.r).toBeLessThanOrEqual(255);
        expect(color.hsl.h).toBeGreaterThanOrEqual(0);
        expect(color.hsl.h).toBeLessThanOrEqual(360);
      });

      // Should have diverse hues
      const uniqueHues = new Set(palette.map((c) => Math.round(c.hsl.h / 10)));
      expect(uniqueHues.size).toBeGreaterThan(1);
    });

    it('should handle edge cases: grayscale and white', () => {
      const gray: RGB = { r: 128, g: 128, b: 128 };
      const grayPalette = generatePaletteFromColor(gray, 3);
      expect(grayPalette).toHaveLength(3);

      const white: RGB = { r: 255, g: 255, b: 255 };
      const whitePalette = generatePaletteFromColor(white, 3);
      expect(whitePalette).toHaveLength(3);
      whitePalette.forEach((color) => {
        expect(color.hsl.s).toBe(0);
      });
    });
  });
});
