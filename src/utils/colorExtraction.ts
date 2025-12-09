import type { RGB, Color, ExtractionOptions, ExtractionResult } from '@/types';
import { rgbToHex, rgbToHsl, deltaE, createColorFromRgb } from './colors';
import { getColorName } from './colorNames';

interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface ColorBucket {
  colors: RGB[];
  min: RGB;
  max: RGB;
}

interface ColorCluster {
  centroid: RGB;
  colors: RGB[];
  percentage: number;
}

const MAX_PROCESS_SIZE = 200;
const DELTA_E_THRESHOLD = 10;
const K_MEANS_ITERATIONS = 8;

/**
 * Extract dominant colors from an image using Median Cut + K-Means
 */
export async function extractColorsFromPixels(
  pixels: PixelData,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const {
    colorCount = 6,
    includeTransparent = false,
  } = options;

  // Sample pixels from image data
  const colors = samplePixels(pixels, includeTransparent);

  if (colors.length === 0) {
    throw new Error('No valid colors found in image');
  }

  // Step 1: Use Median Cut to get initial color buckets
  const buckets = medianCut(colors, colorCount * 2);

  // Step 2: Get centroids from buckets
  const initialCentroids = buckets.map((bucket) => calculateCentroid(bucket.colors));

  // Step 3: Refine with K-Means
  const clusters = kMeans(colors, initialCentroids, K_MEANS_ITERATIONS);

  // Step 4: Calculate percentages and filter similar colors
  const sortedClusters = clusters
    .map((cluster) => ({
      ...cluster,
      percentage: (cluster.colors.length / colors.length) * 100,
    }))
    .filter((cluster) => cluster.percentage > 0.5) // Remove tiny clusters
    .sort((a, b) => b.percentage - a.percentage);

  // Step 5: Filter out similar colors
  const filteredColors = filterSimilarColors(sortedClusters, DELTA_E_THRESHOLD);

  // Step 6: Convert to Color objects with names
  const resultColors: Color[] = filteredColors
    .slice(0, colorCount)
    .map((cluster) => {
      const rgb = cluster.centroid;
      const hex = rgbToHex(rgb);
      const hsl = rgbToHsl(rgb);
      const name = getColorName(rgb);
      return {
        hex,
        rgb,
        hsl,
        name,
        percentage: Math.round(cluster.percentage * 10) / 10,
      };
    });

  const processingTime = Date.now() - startTime;

  return {
    colors: resultColors,
    dominantColor: resultColors[0],
    processingTime,
  };
}

/**
 * Sample pixels from image data, skipping transparent pixels if needed
 */
function samplePixels(pixels: PixelData, includeTransparent: boolean): RGB[] {
  const { data, width, height } = pixels;
  const colors: RGB[] = [];

  // Calculate step for sampling (to reduce computation for large images)
  const totalPixels = width * height;
  const maxSamples = MAX_PROCESS_SIZE * MAX_PROCESS_SIZE;
  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / maxSamples)));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip transparent pixels unless explicitly included
      if (!includeTransparent && a < 128) {
        continue;
      }

      colors.push({ r, g, b });
    }
  }

  return colors;
}

/**
 * Median Cut Algorithm - Recursively splits color space into buckets
 */
function medianCut(colors: RGB[], depth: number): ColorBucket[] {
  if (colors.length === 0) return [];
  if (depth === 0 || colors.length < 2) {
    return [createBucket(colors)];
  }

  const bucket = createBucket(colors);

  // Find the channel with the largest range
  const ranges = {
    r: bucket.max.r - bucket.min.r,
    g: bucket.max.g - bucket.min.g,
    b: bucket.max.b - bucket.min.b,
  };

  const maxChannel = (Object.keys(ranges) as (keyof RGB)[]).reduce(
    (max, channel) => (ranges[channel] > ranges[max] ? channel : max),
    'r' as keyof RGB
  );

  // Sort colors by the channel with largest range
  const sorted = [...colors].sort((a, b) => a[maxChannel] - b[maxChannel]);

  // Split at median
  const mid = Math.floor(sorted.length / 2);
  const left = sorted.slice(0, mid);
  const right = sorted.slice(mid);

  // Recursively split
  return [
    ...medianCut(left, depth - 1),
    ...medianCut(right, depth - 1),
  ];
}

/**
 * Create a color bucket with min/max bounds
 */
function createBucket(colors: RGB[]): ColorBucket {
  const min: RGB = { r: 255, g: 255, b: 255 };
  const max: RGB = { r: 0, g: 0, b: 0 };

  for (const color of colors) {
    min.r = Math.min(min.r, color.r);
    min.g = Math.min(min.g, color.g);
    min.b = Math.min(min.b, color.b);
    max.r = Math.max(max.r, color.r);
    max.g = Math.max(max.g, color.g);
    max.b = Math.max(max.b, color.b);
  }

  return { colors, min, max };
}

/**
 * Calculate the centroid (average color) of a set of colors
 */
function calculateCentroid(colors: RGB[]): RGB {
  if (colors.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }

  const sum = colors.reduce(
    (acc, color) => ({
      r: acc.r + color.r,
      g: acc.g + color.g,
      b: acc.b + color.b,
    }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: Math.round(sum.r / colors.length),
    g: Math.round(sum.g / colors.length),
    b: Math.round(sum.b / colors.length),
  };
}

/**
 * K-Means clustering to refine color centroids
 */
function kMeans(colors: RGB[], initialCentroids: RGB[], iterations: number): ColorCluster[] {
  let centroids = [...initialCentroids];

  for (let i = 0; i < iterations; i++) {
    // Assign each color to nearest centroid
    const clusters: RGB[][] = centroids.map(() => []);

    for (const color of colors) {
      let minDistance = Infinity;
      let nearestIndex = 0;

      for (let j = 0; j < centroids.length; j++) {
        const distance = colorDistance(color, centroids[j]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = j;
        }
      }

      clusters[nearestIndex].push(color);
    }

    // Recalculate centroids
    centroids = clusters.map((cluster, index) =>
      cluster.length > 0 ? calculateCentroid(cluster) : centroids[index]
    );
  }

  // Create final clusters
  const finalClusters: ColorCluster[] = centroids.map((centroid) => ({
    centroid,
    colors: [],
    percentage: 0,
  }));

  // Final assignment
  for (const color of colors) {
    let minDistance = Infinity;
    let nearestIndex = 0;

    for (let j = 0; j < centroids.length; j++) {
      const distance = colorDistance(color, centroids[j]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = j;
      }
    }

    finalClusters[nearestIndex].colors.push(color);
  }

  return finalClusters.filter((cluster) => cluster.colors.length > 0);
}

/**
 * Simple Euclidean distance between two RGB colors
 */
function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * Filter out colors that are too similar using Delta E
 */
function filterSimilarColors(
  clusters: ColorCluster[],
  threshold: number
): ColorCluster[] {
  const result: ColorCluster[] = [];

  for (const cluster of clusters) {
    let isTooSimilar = false;

    for (const existing of result) {
      const distance = deltaE(cluster.centroid, existing.centroid);
      if (distance < threshold) {
        // Merge into existing cluster (add percentages)
        existing.percentage += cluster.percentage;
        isTooSimilar = true;
        break;
      }
    }

    if (!isTooSimilar) {
      result.push(cluster);
    }
  }

  return result;
}

/**
 * Parse image data from a canvas-like context
 * This is a helper for when we have raw pixel data
 */
export function parseImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): PixelData {
  return { data, width, height };
}

/**
 * Adjust extracted colors based on a reference color
 * Useful for creating harmonious palettes
 */
export function adjustPaletteToReference(
  colors: Color[],
  referenceColor: Color
): Color[] {
  const refHsl = referenceColor.hsl;

  return colors.map((color) => {
    // Slightly shift hue towards reference
    const hueDiff = (refHsl.h - color.hsl.h + 540) % 360 - 180;
    const newHue = (color.hsl.h + hueDiff * 0.1 + 360) % 360;

    const newHsl = {
      h: Math.round(newHue),
      s: color.hsl.s,
      l: color.hsl.l,
    };

    return createColorFromRgb(color.rgb, color.name);
  });
}

/**
 * Generate a palette from a single color using color theory
 */
export function generatePaletteFromColor(baseColor: RGB, count: number = 5): Color[] {
  const baseHsl = rgbToHsl(baseColor);
  const colors: Color[] = [createColorFromRgb(baseColor)];

  if (count <= 1) return colors;

  // Add complementary
  if (count >= 2) {
    const complementaryHsl = {
      h: (baseHsl.h + 180) % 360,
      s: baseHsl.s,
      l: baseHsl.l,
    };
    colors.push({
      hex: rgbToHex(hslToRgbHelper(complementaryHsl)),
      rgb: hslToRgbHelper(complementaryHsl),
      hsl: complementaryHsl,
    });
  }

  // Add analogous
  if (count >= 3) {
    const analogous1 = {
      h: (baseHsl.h + 30) % 360,
      s: baseHsl.s,
      l: baseHsl.l,
    };
    colors.push({
      hex: rgbToHex(hslToRgbHelper(analogous1)),
      rgb: hslToRgbHelper(analogous1),
      hsl: analogous1,
    });
  }

  if (count >= 4) {
    const analogous2 = {
      h: (baseHsl.h + 330) % 360,
      s: baseHsl.s,
      l: baseHsl.l,
    };
    colors.push({
      hex: rgbToHex(hslToRgbHelper(analogous2)),
      rgb: hslToRgbHelper(analogous2),
      hsl: analogous2,
    });
  }

  // Add triadic
  if (count >= 5) {
    const triadic = {
      h: (baseHsl.h + 120) % 360,
      s: baseHsl.s,
      l: baseHsl.l,
    };
    colors.push({
      hex: rgbToHex(hslToRgbHelper(triadic)),
      rgb: hslToRgbHelper(triadic),
      hsl: triadic,
    });
  }

  return colors.slice(0, count);
}

// Helper function - duplicated to avoid circular dependency
function hslToRgbHelper(hsl: { h: number; s: number; l: number }): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

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
