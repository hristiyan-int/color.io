import { supabase } from './supabase';
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  getComplementary,
  getAnalogous,
  getTriadic,
  getSplitComplementary,
  lighten,
  darken,
  saturate,
  desaturate,
  deltaE,
  createColorFromHsl,
  createColorFromHex,
} from '@/utils/colors';
import type { Color, HSL, RGB, Palette, PaletteColor, FeedPalette } from '@/types';

// ============================================
// Types
// ============================================

export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'
  | 'square';

export interface HarmonySuggestion {
  type: HarmonyType;
  name: string;
  description: string;
  colors: Color[];
}

export interface PaletteCompletionSuggestion {
  type: 'lighter' | 'darker' | 'saturated' | 'desaturated' | 'harmony' | 'gap-fill';
  name: string;
  color: Color;
  reason: string;
}

export interface GradientStop {
  color: Color;
  position: number; // 0-100
}

export interface GradientSuggestion {
  name: string;
  stops: GradientStop[];
  cssGradient: string;
}

export interface SimilarPaletteResult {
  palette: FeedPalette;
  similarity: number; // 0-100, higher is more similar
}

// ============================================
// Color Harmony Suggestions
// ============================================

/**
 * Get all harmony suggestions for a base color
 */
export function getHarmonySuggestions(baseColor: Color): HarmonySuggestion[] {
  const baseHsl = baseColor.hsl;
  const suggestions: HarmonySuggestion[] = [];

  // Complementary
  const complementaryHsl = getComplementary(baseHsl);
  suggestions.push({
    type: 'complementary',
    name: 'Complementary',
    description: 'Colors opposite on the color wheel. High contrast, vibrant.',
    colors: [baseColor, createColorFromHsl(complementaryHsl)],
  });

  // Analogous
  const [analogous1, analogous2] = getAnalogous(baseHsl);
  suggestions.push({
    type: 'analogous',
    name: 'Analogous',
    description: 'Colors next to each other. Harmonious and pleasing.',
    colors: [
      createColorFromHsl(analogous2),
      baseColor,
      createColorFromHsl(analogous1),
    ],
  });

  // Triadic
  const [triadic1, triadic2] = getTriadic(baseHsl);
  suggestions.push({
    type: 'triadic',
    name: 'Triadic',
    description: 'Three colors evenly spaced. Balanced and vibrant.',
    colors: [
      baseColor,
      createColorFromHsl(triadic1),
      createColorFromHsl(triadic2),
    ],
  });

  // Split-complementary
  const [split1, split2] = getSplitComplementary(baseHsl);
  suggestions.push({
    type: 'split-complementary',
    name: 'Split-Complementary',
    description: 'Base color + two adjacent to its complement. Vibrant yet balanced.',
    colors: [
      baseColor,
      createColorFromHsl(split1),
      createColorFromHsl(split2),
    ],
  });

  // Tetradic (rectangle)
  const tetradicHsl: HSL[] = [
    baseHsl,
    { h: (baseHsl.h + 60) % 360, s: baseHsl.s, l: baseHsl.l },
    { h: (baseHsl.h + 180) % 360, s: baseHsl.s, l: baseHsl.l },
    { h: (baseHsl.h + 240) % 360, s: baseHsl.s, l: baseHsl.l },
  ];
  suggestions.push({
    type: 'tetradic',
    name: 'Tetradic (Rectangle)',
    description: 'Four colors forming a rectangle. Rich and complex.',
    colors: tetradicHsl.map((hsl) => createColorFromHsl(hsl)),
  });

  // Square
  const squareHsl: HSL[] = [
    baseHsl,
    { h: (baseHsl.h + 90) % 360, s: baseHsl.s, l: baseHsl.l },
    { h: (baseHsl.h + 180) % 360, s: baseHsl.s, l: baseHsl.l },
    { h: (baseHsl.h + 270) % 360, s: baseHsl.s, l: baseHsl.l },
  ];
  suggestions.push({
    type: 'square',
    name: 'Square',
    description: 'Four colors evenly spaced. Dynamic and bold.',
    colors: squareHsl.map((hsl) => createColorFromHsl(hsl)),
  });

  return suggestions;
}

// ============================================
// Palette Completion Suggestions
// ============================================

/**
 * Suggest colors to complete/enhance an existing palette
 */
export function getPaletteCompletionSuggestions(
  existingColors: Color[],
  maxSuggestions: number = 6
): PaletteCompletionSuggestion[] {
  if (existingColors.length === 0) return [];

  const suggestions: PaletteCompletionSuggestion[] = [];

  // Analyze existing palette
  const hues = existingColors.map((c) => c.hsl.h);
  const lightnesses = existingColors.map((c) => c.hsl.l);
  const saturations = existingColors.map((c) => c.hsl.s);

  const avgLightness = lightnesses.reduce((a, b) => a + b, 0) / lightnesses.length;
  const avgSaturation = saturations.reduce((a, b) => a + b, 0) / saturations.length;
  const minLightness = Math.min(...lightnesses);
  const maxLightness = Math.max(...lightnesses);

  // 1. Lighter/Darker variants of the dominant color
  const dominantColor = existingColors[0];

  if (maxLightness < 85) {
    const lighterHsl = lighten(dominantColor.hsl, 20);
    suggestions.push({
      type: 'lighter',
      name: 'Lighter Variant',
      color: createColorFromHsl(lighterHsl),
      reason: 'Add a lighter shade for highlights and backgrounds',
    });
  }

  if (minLightness > 20) {
    const darkerHsl = darken(dominantColor.hsl, 20);
    suggestions.push({
      type: 'darker',
      name: 'Darker Variant',
      color: createColorFromHsl(darkerHsl),
      reason: 'Add a darker shade for text and emphasis',
    });
  }

  // 2. Saturation variants
  if (avgSaturation > 30) {
    const desatHsl = desaturate(dominantColor.hsl, 30);
    suggestions.push({
      type: 'desaturated',
      name: 'Muted Variant',
      color: createColorFromHsl(desatHsl),
      reason: 'Add a muted tone for subtle elements',
    });
  }

  if (avgSaturation < 80) {
    const satHsl = saturate(dominantColor.hsl, 20);
    suggestions.push({
      type: 'saturated',
      name: 'Vibrant Variant',
      color: createColorFromHsl(satHsl),
      reason: 'Add a vibrant accent color',
    });
  }

  // 3. Harmony-based suggestions
  // Find gaps in the color wheel
  const sortedHues = [...hues].sort((a, b) => a - b);
  const hueGaps: { start: number; end: number; gap: number }[] = [];

  for (let i = 0; i < sortedHues.length; i++) {
    const current = sortedHues[i];
    const next = sortedHues[(i + 1) % sortedHues.length];
    const gap = next > current ? next - current : 360 - current + next;
    hueGaps.push({ start: current, end: next, gap });
  }

  // Sort by gap size and suggest colors in the largest gaps
  hueGaps.sort((a, b) => b.gap - a.gap);

  for (const hueGap of hueGaps.slice(0, 2)) {
    if (hueGap.gap > 60) {
      // Only suggest if gap is significant
      const midHue = (hueGap.start + hueGap.gap / 2) % 360;
      const gapColor: HSL = {
        h: Math.round(midHue),
        s: Math.round(avgSaturation),
        l: Math.round(avgLightness),
      };

      suggestions.push({
        type: 'gap-fill',
        name: 'Gap Fill',
        color: createColorFromHsl(gapColor),
        reason: `Fill the gap in the color wheel (around ${Math.round(midHue)}°)`,
      });
    }
  }

  // 4. Complementary suggestion if missing
  const complementaryHue = (dominantColor.hsl.h + 180) % 360;
  const hasComplementary = hues.some(
    (h) => Math.abs(h - complementaryHue) < 30 || Math.abs(h - complementaryHue) > 330
  );

  if (!hasComplementary) {
    suggestions.push({
      type: 'harmony',
      name: 'Complementary Accent',
      color: createColorFromHsl({
        h: complementaryHue,
        s: dominantColor.hsl.s,
        l: dominantColor.hsl.l,
      }),
      reason: 'Add contrast with a complementary color',
    });
  }

  return suggestions.slice(0, maxSuggestions);
}

// ============================================
// Gradient Generation
// ============================================

/**
 * Generate gradient suggestions from palette colors
 */
export function getGradientSuggestions(colors: Color[]): GradientSuggestion[] {
  if (colors.length < 2) return [];

  const suggestions: GradientSuggestion[] = [];

  // 1. Linear gradient with all colors
  const allColorsStops: GradientStop[] = colors.map((color, index) => ({
    color,
    position: (index / (colors.length - 1)) * 100,
  }));

  suggestions.push({
    name: 'Full Palette Gradient',
    stops: allColorsStops,
    cssGradient: `linear-gradient(90deg, ${colors.map((c, i) => `${c.hex} ${Math.round((i / (colors.length - 1)) * 100)}%`).join(', ')})`,
  });

  // 2. Smooth gradient between first and last
  const smoothStops = generateSmoothGradient(colors[0], colors[colors.length - 1], 5);
  suggestions.push({
    name: 'Smooth Transition',
    stops: smoothStops,
    cssGradient: `linear-gradient(90deg, ${smoothStops.map((s) => `${s.color.hex} ${s.position}%`).join(', ')})`,
  });

  // 3. Duotone gradients (pairs of contrasting colors)
  if (colors.length >= 2) {
    // Find the most contrasting pair
    let maxContrast = 0;
    let contrastPair: [Color, Color] = [colors[0], colors[1]];

    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const contrast = deltaE(colors[i].rgb, colors[j].rgb);
        if (contrast > maxContrast) {
          maxContrast = contrast;
          contrastPair = [colors[i], colors[j]];
        }
      }
    }

    const duotoneStops: GradientStop[] = [
      { color: contrastPair[0], position: 0 },
      { color: contrastPair[1], position: 100 },
    ];

    suggestions.push({
      name: 'High Contrast Duotone',
      stops: duotoneStops,
      cssGradient: `linear-gradient(90deg, ${contrastPair[0].hex} 0%, ${contrastPair[1].hex} 100%)`,
    });
  }

  // 4. Radial gradient suggestion
  if (colors.length >= 2) {
    suggestions.push({
      name: 'Radial Gradient',
      stops: allColorsStops,
      cssGradient: `radial-gradient(circle, ${colors.map((c, i) => `${c.hex} ${Math.round((i / (colors.length - 1)) * 100)}%`).join(', ')})`,
    });
  }

  // 5. Angular gradient (conic)
  if (colors.length >= 3) {
    suggestions.push({
      name: 'Conic Gradient',
      stops: allColorsStops,
      cssGradient: `conic-gradient(from 0deg, ${colors.map((c, i) => `${c.hex} ${Math.round((i / colors.length) * 360)}deg`).join(', ')}, ${colors[0].hex} 360deg)`,
    });
  }

  return suggestions;
}

/**
 * Generate smooth gradient stops between two colors
 */
function generateSmoothGradient(
  startColor: Color,
  endColor: Color,
  steps: number
): GradientStop[] {
  const stops: GradientStop[] = [];

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(startColor.rgb.r + (endColor.rgb.r - startColor.rgb.r) * t);
    const g = Math.round(startColor.rgb.g + (endColor.rgb.g - startColor.rgb.g) * t);
    const b = Math.round(startColor.rgb.b + (endColor.rgb.b - startColor.rgb.b) * t);

    const rgb: RGB = { r, g, b };
    const hex = rgbToHex(rgb);
    const hsl = rgbToHsl(rgb);

    stops.push({
      color: { hex, rgb, hsl },
      position: t * 100,
    });
  }

  return stops;
}

// ============================================
// Similar Palettes
// ============================================

/**
 * Find palettes similar to the given colors
 */
export async function findSimilarPalettes(
  colors: Color[],
  limit: number = 10
): Promise<SimilarPaletteResult[]> {
  const { data: { user } } = await supabase.auth.getUser();

  // Get all public palettes with their colors
  const { data: palettes, error } = await supabase
    .from('palettes')
    .select(`
      *,
      palette_colors (*),
      profiles!palettes_user_id_fkey (id, username, display_name, avatar_url)
    `)
    .eq('is_public', true)
    .limit(200); // Get a reasonable amount to compare

  if (error) throw new Error(error.message);
  if (!palettes || palettes.length === 0) return [];

  // Calculate similarity scores
  const results: SimilarPaletteResult[] = [];

  for (const dbPalette of palettes) {
    const paletteColors: Color[] = (dbPalette.palette_colors || [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((c: any) => ({
        hex: c.hex_code,
        rgb: { r: c.rgb_r, g: c.rgb_g, b: c.rgb_b },
        hsl: { h: c.hsl_h, s: c.hsl_s, l: c.hsl_l },
      }));

    if (paletteColors.length === 0) continue;

    const similarity = calculatePaletteSimilarity(colors, paletteColors);

    if (similarity > 30) {
      // Only include if similarity > 30%
      const feedPalette: FeedPalette = {
        id: dbPalette.id,
        userId: dbPalette.user_id,
        name: dbPalette.name,
        description: dbPalette.description || undefined,
        colors: paletteColors.map((c, i) => ({
          id: (dbPalette.palette_colors as any[])[i]?.id || '',
          ...c,
          position: i,
        })),
        sourceImageUrl: dbPalette.source_image_url || undefined,
        thumbnailUrl: dbPalette.thumbnail_url || undefined,
        isPublic: dbPalette.is_public,
        likesCount: dbPalette.likes_count,
        createdAt: dbPalette.created_at,
        updatedAt: dbPalette.updated_at,
        user: {
          id: dbPalette.profiles.id,
          username: dbPalette.profiles.username,
          displayName: dbPalette.profiles.display_name || undefined,
          avatarUrl: dbPalette.profiles.avatar_url || undefined,
        },
        isLiked: false, // Will be updated if needed
        commentsCount: 0,
      };

      results.push({ palette: feedPalette, similarity });
    }
  }

  // Sort by similarity and return top results
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, limit);
}

/**
 * Calculate similarity between two palettes (0-100)
 */
function calculatePaletteSimilarity(colors1: Color[], colors2: Color[]): number {
  if (colors1.length === 0 || colors2.length === 0) return 0;

  // For each color in palette 1, find the best match in palette 2
  let totalSimilarity = 0;

  for (const c1 of colors1) {
    let bestMatch = 0;
    for (const c2 of colors2) {
      const distance = deltaE(c1.rgb, c2.rgb);
      // Convert distance to similarity (0-100)
      // DeltaE of 0 = 100% similar, DeltaE of 100+ = 0% similar
      const similarity = Math.max(0, 100 - distance);
      bestMatch = Math.max(bestMatch, similarity);
    }
    totalSimilarity += bestMatch;
  }

  // Average similarity across all colors in palette 1
  return totalSimilarity / colors1.length;
}

// ============================================
// Export Service
// ============================================

export const suggestionsService = {
  getHarmonySuggestions,
  getPaletteCompletionSuggestions,
  getGradientSuggestions,
  findSimilarPalettes,
  calculatePaletteSimilarity,
};
