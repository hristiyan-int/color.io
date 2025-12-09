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

export type SlotStatus = 'available' | 'reserved' | 'blocked';

// ============================================
// Palette Types
// ============================================

export interface PaletteColor {
  id: string;
  hex: string;
  rgb: RGB;
  hsl: HSL;
  position: number;
  name?: string;
}

export interface Palette {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  colors: PaletteColor[];
  tags?: Tag[];
  sourceImageUrl?: string;
  thumbnailUrl?: string;
  isPublic: boolean;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaletteCreate {
  name: string;
  description?: string;
  colors: Omit<PaletteColor, 'id'>[];
  sourceImageUrl?: string;
  isPublic?: boolean;
  tagIds?: string[];
}

export interface PaletteUpdate {
  name?: string;
  description?: string;
  colors?: Omit<PaletteColor, 'id'>[];
  isPublic?: boolean;
  tagIds?: string[];
}

// ============================================
// User Types
// ============================================

export interface Profile {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
}

export interface UserStats {
  palettesCount: number;
  followersCount: number;
  followingCount: number;
}

export interface User extends Profile {
  email: string;
  stats: UserStats;
}

// ============================================
// Auth Types
// ============================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresAt: number;
}

// ============================================
// Social Types
// ============================================

export interface Like {
  userId: string;
  paletteId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  paletteId: string;
  content: string;
  createdAt: string;
  user: Pick<Profile, 'username' | 'displayName' | 'avatarUrl'>;
}

export interface Follow {
  followerId: string;
  followingId: string;
  createdAt: string;
}

// ============================================
// Tag Types
// ============================================

export type TagCategory = 'mood' | 'style' | 'season' | 'purpose';

export interface Tag {
  id: string;
  name: string;
  category?: TagCategory;
  usageCount: number;
}

// ============================================
// Feed Types
// ============================================

export type FeedType = 'trending' | 'recent' | 'following';

export interface FeedPalette extends Palette {
  user: Pick<Profile, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  isLiked: boolean;
  commentsCount: number;
}

export interface FeedResponse {
  palettes: FeedPalette[];
  nextCursor?: string;
  hasMore: boolean;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

// ============================================
// Image Types
// ============================================

export interface ImageAsset {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

export interface ExtractionOptions {
  colorCount?: number;
  quality?: 'low' | 'medium' | 'high';
  includeTransparent?: boolean;
}

export interface ExtractionResult {
  colors: Color[];
  dominantColor: Color;
  processingTime: number;
}

// ============================================
// Export Types
// ============================================

export type ExportFormat = 'png' | 'pdf' | 'css' | 'scss' | 'tailwind' | 'ase' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeSourceImage?: boolean;
  includeColorCodes?: boolean;
  colorFormat?: 'hex' | 'rgb' | 'hsl';
}

// ============================================
// Storage Types (MMKV)
// ============================================

export interface StoredPalette extends Omit<Palette, 'userId'> {
  syncedAt?: string;
  isLocal: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultColorCount: number;
  defaultExportFormat: ExportFormat;
  showColorNames: boolean;
  hapticFeedback: boolean;
}
