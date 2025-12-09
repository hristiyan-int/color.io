import { Router } from 'express';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import type { RGB, Color } from '../types/index.js';

export const colorsRouter = Router();

// Color extraction utilities
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function deltaE(c1: RGB, c2: RGB): number {
  // Simplified color distance using weighted RGB
  const rMean = (c1.r + c2.r) / 2;
  const dR = c1.r - c2.r;
  const dG = c1.g - c2.g;
  const dB = c1.b - c2.b;

  return Math.sqrt(
    (2 + rMean / 256) * dR * dR +
    4 * dG * dG +
    (2 + (255 - rMean) / 256) * dB * dB
  );
}

// K-means clustering for color extraction
function kMeansClustering(pixels: RGB[], k: number, iterations: number = 10): RGB[] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels;

  // Initialize centroids using k-means++
  const centroids: RGB[] = [];
  centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);

  for (let i = 1; i < k; i++) {
    const distances = pixels.map((pixel) => {
      const minDist = Math.min(...centroids.map((c) => deltaE(pixel, c)));
      return minDist * minDist;
    });
    const sum = distances.reduce((a, b) => a + b, 0);
    let target = Math.random() * sum;
    for (let j = 0; j < pixels.length; j++) {
      target -= distances[j];
      if (target <= 0) {
        centroids.push(pixels[j]);
        break;
      }
    }
  }

  // Run k-means iterations
  for (let iter = 0; iter < iterations; iter++) {
    // Assign pixels to nearest centroid
    const clusters: RGB[][] = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let nearestIdx = 0;
      for (let i = 0; i < centroids.length; i++) {
        const dist = deltaE(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }
      clusters[nearestIdx].push(pixel);
    }

    // Update centroids
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        centroids[i] = {
          r: Math.round(clusters[i].reduce((s, p) => s + p.r, 0) / clusters[i].length),
          g: Math.round(clusters[i].reduce((s, p) => s + p.g, 0) / clusters[i].length),
          b: Math.round(clusters[i].reduce((s, p) => s + p.b, 0) / clusters[i].length),
        };
      }
    }
  }

  return centroids;
}

// Filter similar colors
function filterSimilarColors(colors: Color[], threshold: number = 25): Color[] {
  const filtered: Color[] = [];

  for (const color of colors) {
    const isSimilar = filtered.some(
      (existing) => deltaE(color.rgb, existing.rgb) < threshold
    );
    if (!isSimilar) {
      filtered.push(color);
    }
  }

  return filtered;
}

// Validation schema
const extractSchema = z.object({
  imageBase64: z.string().optional(),
  imageUrl: z.string().url().optional(),
  colorCount: z.number().min(3).max(10).default(6),
  quality: z.enum(['low', 'medium', 'high']).default('medium'),
}).refine((data) => data.imageBase64 || data.imageUrl, {
  message: 'Either imageBase64 or imageUrl is required',
});

/**
 * POST /api/colors/extract
 * Extract dominant colors from an image
 */
colorsRouter.post('/extract', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const validated = extractSchema.parse(req.body);
    const { imageBase64, imageUrl, colorCount, quality } = validated;

    // Determine resize dimensions based on quality
    const maxDimension = quality === 'low' ? 100 : quality === 'medium' ? 150 : 200;

    // Load image
    let imageBuffer: Buffer;

    if (imageBase64) {
      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageUrl) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new AppError('Failed to fetch image', 400);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      throw new AppError('No image provided', 400);
    }

    // Process image with sharp
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new AppError('Invalid image', 400);
    }

    // Resize for processing
    const resizedImage = await image
      .resize(maxDimension, maxDimension, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Extract pixel data
    const { data, info } = resizedImage;
    const pixels: RGB[] = [];

    for (let i = 0; i < data.length; i += info.channels) {
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
      });
    }

    // Run k-means clustering with more clusters than needed
    const clusters = kMeansClustering(pixels, colorCount + 4, 15);

    // Convert to Color objects
    let colors: Color[] = clusters.map((rgb) => {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      return {
        hex: rgbToHex(rgb.r, rgb.g, rgb.b),
        rgb,
        hsl,
      };
    });

    // Filter similar colors
    colors = filterSimilarColors(colors);

    // Sort by luminance (most vibrant/saturated first)
    colors.sort((a, b) => {
      // Prioritize saturated colors
      const scoreA = a.hsl.s * 0.6 + (50 - Math.abs(a.hsl.l - 50)) * 0.4;
      const scoreB = b.hsl.s * 0.6 + (50 - Math.abs(b.hsl.l - 50)) * 0.4;
      return scoreB - scoreA;
    });

    // Take requested number of colors
    colors = colors.slice(0, colorCount);

    // Determine dominant color (most saturated that's not too light/dark)
    const dominantColor = colors.reduce((best, color) => {
      const score = color.hsl.s * (color.hsl.l > 20 && color.hsl.l < 80 ? 1 : 0.5);
      const bestScore = best.hsl.s * (best.hsl.l > 20 && best.hsl.l < 80 ? 1 : 0.5);
      return score > bestScore ? color : best;
    }, colors[0]);

    const processingTime = Date.now() - startTime;

    res.json({
      data: {
        colors,
        dominantColor,
        processingTime,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (error instanceof AppError) throw error;
    console.error('Color extraction error:', error);
    throw new AppError('Failed to extract colors', 500);
  }
});
