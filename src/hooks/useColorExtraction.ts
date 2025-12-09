import { useState, useCallback, useRef } from 'react';
import { Image } from 'react-native';
import type { Color, ExtractionOptions, ExtractionResult } from '@/types';
import { extractColorsFromPixels } from '@/utils/colorExtraction';

interface UseColorExtractionResult {
  colors: Color[];
  dominantColor: Color | null;
  isExtracting: boolean;
  error: string | null;
  processingTime: number;
  extractColors: (imageUri: string, options?: ExtractionOptions) => Promise<ExtractionResult | null>;
  clearResults: () => void;
}

interface CachedResult {
  colors: Color[];
  dominantColor: Color;
  processingTime: number;
  timestamp: number;
}

const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

// In-memory cache for color extraction results
const memoryCache = new Map<string, CachedResult>();

/**
 * Generate a cache key from image URI
 */
function getCacheKey(uri: string): string {
  // Use a simple hash of the URI
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    const char = uri.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `extraction_${Math.abs(hash)}`;
}

/**
 * Get cached result if available and not expired
 */
function getCachedResult(uri: string): CachedResult | null {
  try {
    const key = getCacheKey(uri);
    const cached = memoryCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > CACHE_DURATION_MS) {
      memoryCache.delete(key);
      return null;
    }

    return cached;
  } catch {
    return null;
  }
}

/**
 * Cache extraction result
 */
function cacheResult(uri: string, result: ExtractionResult): void {
  try {
    const key = getCacheKey(uri);
    const cached: CachedResult = {
      colors: result.colors,
      dominantColor: result.dominantColor,
      processingTime: result.processingTime,
      timestamp: Date.now(),
    };
    memoryCache.set(key, cached);

    // Limit cache size to prevent memory issues
    if (memoryCache.size > 50) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey) {
        memoryCache.delete(firstKey);
      }
    }
  } catch {
    // Ignore cache errors
  }
}

/**
 * Clear all cached results
 */
export function clearColorExtractionCache(): void {
  memoryCache.clear();
}

/**
 * Hook for extracting colors from images with caching
 */
export function useColorExtraction(): UseColorExtractionResult {
  const [colors, setColors] = useState<Color[]>([]);
  const [dominantColor, setDominantColor] = useState<Color | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState(0);

  const extractionRef = useRef<AbortController | null>(null);

  const extractColors = useCallback(
    async (imageUri: string, options: ExtractionOptions = {}): Promise<ExtractionResult | null> => {
      // Cancel any ongoing extraction
      if (extractionRef.current) {
        extractionRef.current.abort();
      }

      extractionRef.current = new AbortController();
      setError(null);

      // Check cache first
      const cached = getCachedResult(imageUri);
      if (cached) {
        setColors(cached.colors);
        setDominantColor(cached.dominantColor);
        setProcessingTime(cached.processingTime);
        return {
          colors: cached.colors,
          dominantColor: cached.dominantColor,
          processingTime: cached.processingTime,
        };
      }

      setIsExtracting(true);

      try {
        // Load image and get pixel data
        const pixelData = await getImagePixelData(imageUri);

        if (extractionRef.current?.signal.aborted) {
          return null;
        }

        // Extract colors
        const result = await extractColorsFromPixels(pixelData, options);

        if (extractionRef.current?.signal.aborted) {
          return null;
        }

        // Update state
        setColors(result.colors);
        setDominantColor(result.dominantColor);
        setProcessingTime(result.processingTime);

        // Cache result
        cacheResult(imageUri, result);

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to extract colors';
        setError(errorMessage);
        console.error('Color extraction error:', err);
        return null;
      } finally {
        setIsExtracting(false);
      }
    },
    []
  );

  const clearResults = useCallback(() => {
    setColors([]);
    setDominantColor(null);
    setError(null);
    setProcessingTime(0);
  }, []);

  return {
    colors,
    dominantColor,
    isExtracting,
    error,
    processingTime,
    extractColors,
    clearResults,
  };
}

/**
 * Load image and extract pixel data
 * Uses canvas for web, fetch+decode for native
 */
async function getImagePixelData(uri: string): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  // On web, use canvas directly with the image URL
  if (typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
    return decodeImageWithCanvasFromUrl(uri);
  }

  // For React Native, use the existing approach
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      async (width, height) => {
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const base64 = await blobToBase64(blob);
          const pixelData = await decodeImageToPixels(base64, width, height);
          resolve(pixelData);
        } catch (error) {
          reject(error);
        }
      },
      (error) => reject(error)
    );
  });
}

/**
 * Decode image directly from URL using canvas (web only)
 */
async function decodeImageWithCanvasFromUrl(uri: string): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const maxSize = 200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const sampledWidth = Math.floor(img.width * scale);
        const sampledHeight = Math.floor(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = sampledWidth;
        canvas.height = sampledHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, sampledWidth, sampledHeight);
        const imageData = ctx.getImageData(0, 0, sampledWidth, sampledHeight);

        resolve({
          data: imageData.data as unknown as Uint8ClampedArray,
          width: sampledWidth,
          height: sampledHeight,
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = uri;
  });
}

/**
 * Convert blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Decode image to pixel data using canvas (web) or fallback (native)
 */
async function decodeImageToPixels(
  base64: string,
  width: number,
  height: number
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  // Check if we're on web platform with canvas support
  if (typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
    return decodeImageWithCanvas(base64, width, height);
  }

  // Fallback for native platforms - this won't give accurate colors
  // Native apps should use react-native-image-colors or similar
  return decodeImageFallback(base64, width, height);
}

/**
 * Decode image using HTML Canvas (web platform)
 */
async function decodeImageWithCanvas(
  base64: string,
  width: number,
  height: number
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Calculate sample size (max 200x200 for performance)
        const maxSize = 200;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const sampledWidth = Math.floor(img.width * scale);
        const sampledHeight = Math.floor(img.height * scale);

        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = sampledWidth;
        canvas.height = sampledHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, sampledWidth, sampledHeight);

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, sampledWidth, sampledHeight);

        resolve({
          data: imageData.data as unknown as Uint8ClampedArray,
          width: sampledWidth,
          height: sampledHeight,
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Set source - handle both base64 and data URL
    img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
  });
}

/**
 * Fallback decoder for native platforms
 * Note: This gives approximate colors - native apps should use proper image decoding libraries
 */
async function decodeImageFallback(
  base64: string,
  width: number,
  height: number
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const maxSamples = 200 * 200;
  const totalPixels = width * height;
  const sampleRate = Math.max(1, Math.floor(totalPixels / maxSamples));

  const sampledWidth = Math.ceil(width / sampleRate);
  const sampledHeight = Math.ceil(height / sampleRate);
  const pixelCount = sampledWidth * sampledHeight;

  const data = new Uint8ClampedArray(pixelCount * 4);
  const step = Math.max(1, Math.floor(bytes.length / pixelCount));

  for (let i = 0; i < pixelCount; i++) {
    const byteIndex = Math.min((i * step) % (bytes.length - 3), bytes.length - 4);
    const pixelIndex = i * 4;

    data[pixelIndex] = bytes[byteIndex];
    data[pixelIndex + 1] = bytes[byteIndex + 1];
    data[pixelIndex + 2] = bytes[byteIndex + 2];
    data[pixelIndex + 3] = 255;
  }

  return { data, width: sampledWidth, height: sampledHeight };
}
