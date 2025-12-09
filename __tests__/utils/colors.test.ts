import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  deltaE,
  getComplementary,
  getAnalogous,
  getTriadic,
  getSplitComplementary,
  lighten,
  darken,
  saturate,
  desaturate,
  getContrastRatio,
  isLightColor,
  getTextColor,
  createColorFromHex,
  createColorFromRgb,
  createColorFromHsl,
} from '../../src/utils/colors';
import type { RGB, HSL } from '../../src/types';

describe('Color Utility Functions', () => {
  describe('hexToRgb', () => {
    it('should convert valid HEX to RGB', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should handle HEX without hash', () => {
      expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('should handle lowercase HEX', () => {
      expect(hexToRgb('#ff6b6b')).toEqual({ r: 255, g: 107, b: 107 });
    });

    it('should convert common colors correctly', () => {
      expect(hexToRgb('#FF6B6B')).toEqual({ r: 255, g: 107, b: 107 }); // Coral
      expect(hexToRgb('#4ECDC4')).toEqual({ r: 78, g: 205, b: 196 }); // Teal
      expect(hexToRgb('#45B7D1')).toEqual({ r: 69, g: 183, b: 209 }); // Sky blue
    });

    it('should throw error for invalid HEX', () => {
      expect(() => hexToRgb('#GG0000')).toThrow('Invalid HEX color');
      expect(() => hexToRgb('#FF00')).toThrow('Invalid HEX color');
      expect(() => hexToRgb('')).toThrow('Invalid HEX color');
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to HEX', () => {
      expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#FF0000');
      expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00FF00');
      expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000FF');
      expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#FFFFFF');
      expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    });

    it('should pad single-digit hex values', () => {
      expect(rgbToHex({ r: 1, g: 2, b: 3 })).toBe('#010203');
      expect(rgbToHex({ r: 15, g: 15, b: 15 })).toBe('#0F0F0F');
    });

    it('should clamp values to 0-255 range', () => {
      expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe('#FF0080');
    });

    it('should handle decimal values by rounding', () => {
      // Math.round: 127.5 -> 128 (0x80), 127.4 -> 127 (0x7F), 127.6 -> 128 (0x80)
      expect(rgbToHex({ r: 127.5, g: 127.4, b: 127.6 })).toBe('#807F80');
    });
  });

  describe('rgbToHsl', () => {
    it('should convert primary colors correctly', () => {
      expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 }); // Red
      expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 }); // Green
      expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 }); // Blue
    });

    it('should handle grayscale colors', () => {
      expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 }); // White
      expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 }); // Black
      expect(rgbToHsl({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, l: 50 }); // Gray
    });

    it('should handle secondary colors', () => {
      expect(rgbToHsl({ r: 255, g: 255, b: 0 })).toEqual({ h: 60, s: 100, l: 50 }); // Yellow
      expect(rgbToHsl({ r: 0, g: 255, b: 255 })).toEqual({ h: 180, s: 100, l: 50 }); // Cyan
      expect(rgbToHsl({ r: 255, g: 0, b: 255 })).toEqual({ h: 300, s: 100, l: 50 }); // Magenta
    });
  });

  describe('hslToRgb', () => {
    it('should convert primary colors correctly', () => {
      expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 }); // Red
      expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 }); // Green
      expect(hslToRgb({ h: 240, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 }); // Blue
    });

    it('should handle grayscale (saturation = 0)', () => {
      expect(hslToRgb({ h: 0, s: 0, l: 100 })).toEqual({ r: 255, g: 255, b: 255 }); // White
      expect(hslToRgb({ h: 0, s: 0, l: 0 })).toEqual({ r: 0, g: 0, b: 0 }); // Black
      expect(hslToRgb({ h: 180, s: 0, l: 50 })).toEqual({ r: 128, g: 128, b: 128 }); // Gray
    });

    it('should be reversible with rgbToHsl', () => {
      const testColors: RGB[] = [
        { r: 255, g: 107, b: 107 },
        { r: 78, g: 205, b: 196 },
        { r: 100, g: 150, b: 200 },
      ];

      testColors.forEach((rgb) => {
        const hsl = rgbToHsl(rgb);
        const backToRgb = hslToRgb(hsl);
        // Allow tolerance of ±3 due to rounding in HSL conversion
        expect(Math.abs(backToRgb.r - rgb.r)).toBeLessThanOrEqual(3);
        expect(Math.abs(backToRgb.g - rgb.g)).toBeLessThanOrEqual(3);
        expect(Math.abs(backToRgb.b - rgb.b)).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('deltaE', () => {
    it('should return 0 for identical colors', () => {
      const color = { r: 255, g: 107, b: 107 };
      expect(deltaE(color, color)).toBe(0);
    });

    it('should return a high value for very different colors', () => {
      const white = { r: 255, g: 255, b: 255 };
      const black = { r: 0, g: 0, b: 0 };
      expect(deltaE(white, black)).toBeGreaterThan(90);
    });

    it('should return moderate values for similar colors', () => {
      const red1 = { r: 255, g: 0, b: 0 };
      const red2 = { r: 230, g: 20, b: 20 };
      const delta = deltaE(red1, red2);
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThan(20);
    });

    it('should be symmetric', () => {
      const color1 = { r: 100, g: 150, b: 200 };
      const color2 = { r: 200, g: 100, b: 150 };
      expect(deltaE(color1, color2)).toBeCloseTo(deltaE(color2, color1));
    });
  });

  describe('Color harmony functions', () => {
    const baseColor: HSL = { h: 30, s: 70, l: 50 };

    describe('getComplementary', () => {
      it('should return color 180 degrees opposite', () => {
        expect(getComplementary(baseColor)).toEqual({ h: 210, s: 70, l: 50 });
        expect(getComplementary({ h: 0, s: 50, l: 50 })).toEqual({ h: 180, s: 50, l: 50 });
        expect(getComplementary({ h: 270, s: 50, l: 50 })).toEqual({ h: 90, s: 50, l: 50 });
      });
    });

    describe('getAnalogous', () => {
      it('should return colors +/- 30 degrees', () => {
        const result = getAnalogous(baseColor);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ h: 60, s: 70, l: 50 });
        expect(result[1]).toEqual({ h: 0, s: 70, l: 50 });
      });

      it('should handle wrap-around', () => {
        const result = getAnalogous({ h: 350, s: 50, l: 50 });
        expect(result[0].h).toBe(20);
        expect(result[1].h).toBe(320);
      });
    });

    describe('getTriadic', () => {
      it('should return colors at 120 and 240 degrees', () => {
        const result = getTriadic(baseColor);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ h: 150, s: 70, l: 50 });
        expect(result[1]).toEqual({ h: 270, s: 70, l: 50 });
      });
    });

    describe('getSplitComplementary', () => {
      it('should return colors at 150 and 210 degrees', () => {
        const result = getSplitComplementary(baseColor);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ h: 180, s: 70, l: 50 });
        expect(result[1]).toEqual({ h: 240, s: 70, l: 50 });
      });
    });
  });

  describe('lighten and darken', () => {
    it('should lighten color by specified amount', () => {
      const color: HSL = { h: 200, s: 50, l: 50 };
      expect(lighten(color, 20)).toEqual({ h: 200, s: 50, l: 70 });
    });

    it('should not exceed 100% lightness', () => {
      const color: HSL = { h: 200, s: 50, l: 90 };
      expect(lighten(color, 20)).toEqual({ h: 200, s: 50, l: 100 });
    });

    it('should darken color by specified amount', () => {
      const color: HSL = { h: 200, s: 50, l: 50 };
      expect(darken(color, 20)).toEqual({ h: 200, s: 50, l: 30 });
    });

    it('should not go below 0% lightness', () => {
      const color: HSL = { h: 200, s: 50, l: 10 };
      expect(darken(color, 20)).toEqual({ h: 200, s: 50, l: 0 });
    });
  });

  describe('saturate and desaturate', () => {
    it('should saturate color by specified amount', () => {
      const color: HSL = { h: 200, s: 50, l: 50 };
      expect(saturate(color, 20)).toEqual({ h: 200, s: 70, l: 50 });
    });

    it('should not exceed 100% saturation', () => {
      const color: HSL = { h: 200, s: 90, l: 50 };
      expect(saturate(color, 20)).toEqual({ h: 200, s: 100, l: 50 });
    });

    it('should desaturate color by specified amount', () => {
      const color: HSL = { h: 200, s: 50, l: 50 };
      expect(desaturate(color, 20)).toEqual({ h: 200, s: 30, l: 50 });
    });

    it('should not go below 0% saturation', () => {
      const color: HSL = { h: 200, s: 10, l: 50 };
      expect(desaturate(color, 20)).toEqual({ h: 200, s: 0, l: 50 });
    });
  });

  describe('getContrastRatio', () => {
    it('should return 21 for black and white', () => {
      const white = { r: 255, g: 255, b: 255 };
      const black = { r: 0, g: 0, b: 0 };
      expect(getContrastRatio(white, black)).toBeCloseTo(21, 0);
    });

    it('should return 1 for identical colors', () => {
      const color = { r: 128, g: 128, b: 128 };
      expect(getContrastRatio(color, color)).toBe(1);
    });

    it('should be symmetric', () => {
      const color1 = { r: 100, g: 150, b: 200 };
      const color2 = { r: 200, g: 100, b: 50 };
      expect(getContrastRatio(color1, color2)).toBeCloseTo(
        getContrastRatio(color2, color1)
      );
    });
  });

  describe('isLightColor', () => {
    it('should return true for white', () => {
      expect(isLightColor({ r: 255, g: 255, b: 255 })).toBe(true);
    });

    it('should return false for black', () => {
      expect(isLightColor({ r: 0, g: 0, b: 0 })).toBe(false);
    });

    it('should return true for light colors', () => {
      expect(isLightColor({ r: 255, g: 255, b: 0 })).toBe(true); // Yellow
      expect(isLightColor({ r: 255, g: 200, b: 200 })).toBe(true); // Light pink
    });

    it('should return false for dark colors', () => {
      expect(isLightColor({ r: 0, g: 0, b: 128 })).toBe(false); // Dark blue
      expect(isLightColor({ r: 50, g: 50, b: 50 })).toBe(false); // Dark gray
    });
  });

  describe('getTextColor', () => {
    it('should return black for light backgrounds', () => {
      expect(getTextColor({ r: 255, g: 255, b: 255 })).toEqual({ r: 0, g: 0, b: 0 });
      expect(getTextColor({ r: 255, g: 255, b: 0 })).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should return white for dark backgrounds', () => {
      expect(getTextColor({ r: 0, g: 0, b: 0 })).toEqual({ r: 255, g: 255, b: 255 });
      expect(getTextColor({ r: 50, g: 50, b: 50 })).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  describe('Color object creation functions', () => {
    describe('createColorFromHex', () => {
      it('should create a complete color object', () => {
        const color = createColorFromHex('#FF6B6B', 'Coral Red');
        expect(color.hex).toBe('#FF6B6B');
        expect(color.rgb).toEqual({ r: 255, g: 107, b: 107 });
        expect(color.hsl).toBeDefined();
        expect(color.name).toBe('Coral Red');
      });

      it('should normalize hex to uppercase', () => {
        const color = createColorFromHex('#ff6b6b');
        expect(color.hex).toBe('#FF6B6B');
      });
    });

    describe('createColorFromRgb', () => {
      it('should create a complete color object', () => {
        const color = createColorFromRgb({ r: 255, g: 107, b: 107 }, 'Coral');
        expect(color.hex).toBe('#FF6B6B');
        expect(color.rgb).toEqual({ r: 255, g: 107, b: 107 });
        expect(color.hsl).toBeDefined();
        expect(color.name).toBe('Coral');
      });
    });

    describe('createColorFromHsl', () => {
      it('should create a complete color object', () => {
        const color = createColorFromHsl({ h: 0, s: 100, l: 50 }, 'Red');
        expect(color.hex).toBe('#FF0000');
        expect(color.rgb).toEqual({ r: 255, g: 0, b: 0 });
        expect(color.hsl).toEqual({ h: 0, s: 100, l: 50 });
        expect(color.name).toBe('Red');
      });
    });
  });
});
