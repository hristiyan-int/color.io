import type { Request } from 'express';

// ============================================
// Request Types
// ============================================

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// ============================================
// Color Types
// ============================================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface Color {
  hex: string;
  rgb: RGB;
  hsl: HSL;
  name?: string;
  percentage?: number;
}

// ============================================
// Palette Types
// ============================================

export interface PaletteColor {
  hex_code: string;
  rgb_r: number;
  rgb_g: number;
  rgb_b: number;
  hsl_h: number;
  hsl_s: number;
  hsl_l: number;
  position: number;
  name?: string;
}

export interface CreatePaletteInput {
  name: string;
  description?: string;
  colors: PaletteColor[];
  source_image_url?: string;
  is_public?: boolean;
  tags?: string[];
}

export interface UpdatePaletteInput {
  name?: string;
  description?: string;
  colors?: PaletteColor[];
  is_public?: boolean;
  tags?: string[];
}

// ============================================
// Profile Types
// ============================================

export interface UpdateProfileInput {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

// ============================================
// Feed Types
// ============================================

export type FeedType = 'trending' | 'recent' | 'following';

export interface FeedQuery {
  type?: FeedType;
  cursor?: string;
  limit?: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

// ============================================
// Color Extraction Types
// ============================================

export interface ExtractionOptions {
  colorCount?: number;
  quality?: 'low' | 'medium' | 'high';
}

export interface ExtractionResult {
  colors: Color[];
  dominantColor: Color;
  processingTime: number;
}
