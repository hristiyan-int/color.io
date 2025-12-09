// App configuration
export const APP_CONFIG = {
  name: 'Color.io',
  version: '1.0.0',
  scheme: 'colorio',
} as const;

// Color extraction settings
export const EXTRACTION_CONFIG = {
  defaultColorCount: 6,
  minColors: 3,
  maxColors: 8,
  maxImageSize: 200, // Max dimension for processing
  defaultQuality: 'medium' as const,
} as const;

// API configuration
export const API_CONFIG = {
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
} as const;

// Storage keys (MMKV)
export const STORAGE_KEYS = {
  palettes: 'palettes',
  recentPalettes: 'recent_palettes',
  settings: 'settings',
  onboardingComplete: 'onboarding_complete',
} as const;

// Color names dictionary (basic)
export const COLOR_NAMES: Record<string, string> = {
  '#FF0000': 'Red',
  '#FF4500': 'Orange Red',
  '#FF6347': 'Tomato',
  '#FF7F50': 'Coral',
  '#FFA500': 'Orange',
  '#FFD700': 'Gold',
  '#FFFF00': 'Yellow',
  '#ADFF2F': 'Green Yellow',
  '#7FFF00': 'Chartreuse',
  '#00FF00': 'Lime',
  '#00FA9A': 'Medium Spring Green',
  '#00FFFF': 'Cyan',
  '#00CED1': 'Dark Turquoise',
  '#1E90FF': 'Dodger Blue',
  '#0000FF': 'Blue',
  '#8A2BE2': 'Blue Violet',
  '#9400D3': 'Dark Violet',
  '#FF00FF': 'Magenta',
  '#FF1493': 'Deep Pink',
  '#FF69B4': 'Hot Pink',
  '#FFC0CB': 'Pink',
  '#FFFFFF': 'White',
  '#F5F5F5': 'White Smoke',
  '#DCDCDC': 'Gainsboro',
  '#C0C0C0': 'Silver',
  '#A9A9A9': 'Dark Gray',
  '#808080': 'Gray',
  '#696969': 'Dim Gray',
  '#000000': 'Black',
  '#8B4513': 'Saddle Brown',
  '#A0522D': 'Sienna',
  '#D2691E': 'Chocolate',
  '#CD853F': 'Peru',
  '#DEB887': 'Burlywood',
  '#F5DEB3': 'Wheat',
  '#FFE4C4': 'Bisque',
  '#FFDEAD': 'Navajo White',
  '#F0E68C': 'Khaki',
  '#E6E6FA': 'Lavender',
  '#D8BFD8': 'Thistle',
  '#DDA0DD': 'Plum',
  '#EE82EE': 'Violet',
  '#DA70D6': 'Orchid',
  '#BA55D3': 'Medium Orchid',
  '#9932CC': 'Dark Orchid',
  '#4B0082': 'Indigo',
  '#483D8B': 'Dark Slate Blue',
  '#6A5ACD': 'Slate Blue',
  '#7B68EE': 'Medium Slate Blue',
  '#9370DB': 'Medium Purple',
  '#8B008B': 'Dark Magenta',
  '#800080': 'Purple',
  '#C71585': 'Medium Violet Red',
  '#DB7093': 'Pale Violet Red',
  '#DC143C': 'Crimson',
  '#B22222': 'Firebrick',
  '#8B0000': 'Dark Red',
  '#800000': 'Maroon',
  '#006400': 'Dark Green',
  '#008000': 'Green',
  '#228B22': 'Forest Green',
  '#2E8B57': 'Sea Green',
  '#3CB371': 'Medium Sea Green',
  '#20B2AA': 'Light Sea Green',
  '#008B8B': 'Dark Cyan',
  '#008080': 'Teal',
  '#4682B4': 'Steel Blue',
  '#5F9EA0': 'Cadet Blue',
  '#6495ED': 'Cornflower Blue',
  '#00BFFF': 'Deep Sky Blue',
  '#87CEEB': 'Sky Blue',
  '#87CEFA': 'Light Sky Blue',
  '#ADD8E6': 'Light Blue',
  '#B0E0E6': 'Powder Blue',
  '#AFEEEE': 'Pale Turquoise',
  '#E0FFFF': 'Light Cyan',
  '#00008B': 'Dark Blue',
  '#0000CD': 'Medium Blue',
  '#000080': 'Navy',
  '#191970': 'Midnight Blue',
} as const;

// Tag categories
export const TAG_CATEGORIES = {
  mood: ['calm', 'energetic', 'romantic', 'mysterious', 'cheerful', 'melancholic', 'playful', 'serious'],
  style: ['minimalist', 'vintage', 'modern', 'retro', 'elegant', 'rustic', 'industrial', 'bohemian'],
  season: ['spring', 'summer', 'autumn', 'winter'],
  purpose: ['branding', 'web', 'interior', 'fashion', 'art', 'print', 'social media', 'packaging'],
} as const;

// Animation durations (ms)
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Screen dimensions breakpoints
export const BREAKPOINTS = {
  small: 375,
  medium: 414,
  large: 768,
} as const;

// Default app settings
export const DEFAULT_SETTINGS = {
  theme: 'system' as const,
  defaultColorCount: 6,
  defaultExportFormat: 'png' as const,
  showColorNames: true,
  hapticFeedback: true,
} as const;

// Export format options
export const EXPORT_FORMATS = [
  { id: 'png', label: 'Image (PNG)', icon: '🖼️' },
  { id: 'pdf', label: 'PDF Document', icon: '📄' },
  { id: 'css', label: 'CSS Variables', icon: '🎨' },
  { id: 'scss', label: 'SCSS Variables', icon: '🎨' },
  { id: 'tailwind', label: 'Tailwind Config', icon: '💨' },
  { id: 'json', label: 'JSON', icon: '📋' },
] as const;
