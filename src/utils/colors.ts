import type { RGB, HSL, Color } from '@/types';

/**
 * Convert HEX color to RGB
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid HEX color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to HEX color
 */
export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb({ h, s, l }: HSL): RGB {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Calculate Delta E (color distance) using CIE76 formula
 */
export function deltaE(color1: RGB, color2: RGB): number {
  // Convert to Lab color space (simplified)
  const toLab = (rgb: RGB) => {
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

    const f = (t: number) =>
      t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116;

    return {
      l: 116 * f(y) - 16,
      a: 500 * (f(x) - f(y)),
      b: 200 * (f(y) - f(z)),
    };
  };

  const lab1 = toLab(color1);
  const lab2 = toLab(color2);

  return Math.sqrt(
    Math.pow(lab2.l - lab1.l, 2) +
    Math.pow(lab2.a - lab1.a, 2) +
    Math.pow(lab2.b - lab1.b, 2)
  );
}

/**
 * Get complementary color
 */
export function getComplementary(hsl: HSL): HSL {
  return {
    h: (hsl.h + 180) % 360,
    s: hsl.s,
    l: hsl.l,
  };
}

/**
 * Get analogous colors
 */
export function getAnalogous(hsl: HSL): [HSL, HSL] {
  return [
    { h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l },
    { h: (hsl.h + 330) % 360, s: hsl.s, l: hsl.l },
  ];
}

/**
 * Get triadic colors
 */
export function getTriadic(hsl: HSL): [HSL, HSL] {
  return [
    { h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l },
    { h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l },
  ];
}

/**
 * Get split-complementary colors
 */
export function getSplitComplementary(hsl: HSL): [HSL, HSL] {
  return [
    { h: (hsl.h + 150) % 360, s: hsl.s, l: hsl.l },
    { h: (hsl.h + 210) % 360, s: hsl.s, l: hsl.l },
  ];
}

/**
 * Lighten a color
 */
export function lighten(hsl: HSL, amount: number): HSL {
  return {
    h: hsl.h,
    s: hsl.s,
    l: Math.min(100, hsl.l + amount),
  };
}

/**
 * Darken a color
 */
export function darken(hsl: HSL, amount: number): HSL {
  return {
    h: hsl.h,
    s: hsl.s,
    l: Math.max(0, hsl.l - amount),
  };
}

/**
 * Saturate a color
 */
export function saturate(hsl: HSL, amount: number): HSL {
  return {
    h: hsl.h,
    s: Math.min(100, hsl.s + amount),
    l: hsl.l,
  };
}

/**
 * Desaturate a color
 */
export function desaturate(hsl: HSL, amount: number): HSL {
  return {
    h: hsl.h,
    s: Math.max(0, hsl.s - amount),
    l: hsl.l,
  };
}

/**
 * Get contrast ratio between two colors (WCAG)
 */
export function getContrastRatio(color1: RGB, color2: RGB): number {
  const getLuminance = (rgb: RGB) => {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine if color is light or dark
 */
export function isLightColor(rgb: RGB): boolean {
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5;
}

/**
 * Get appropriate text color (black or white) for a background
 */
export function getTextColor(backgroundColor: RGB): RGB {
  return isLightColor(backgroundColor)
    ? { r: 0, g: 0, b: 0 }
    : { r: 255, g: 255, b: 255 };
}

/**
 * Create a full Color object from HEX
 */
export function createColorFromHex(hex: string, name?: string): Color {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  return { hex: hex.toUpperCase(), rgb, hsl, name };
}

/**
 * Create a full Color object from RGB
 */
export function createColorFromRgb(rgb: RGB, name?: string): Color {
  const hex = rgbToHex(rgb);
  const hsl = rgbToHsl(rgb);
  return { hex, rgb, hsl, name };
}

/**
 * Create a full Color object from HSL
 */
export function createColorFromHsl(hsl: HSL, name?: string): Color {
  const rgb = hslToRgb(hsl);
  const hex = rgbToHex(rgb);
  return { hex, rgb, hsl, name };
}
