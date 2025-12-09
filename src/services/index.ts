export { supabase } from './supabase';
export { authService } from './auth';
export { paletteService } from './palettes';
export { exportService } from './exportService';
export { communityService } from './community';
export { tagsService } from './tags';
export { suggestionsService } from './suggestions';
export { trendsService } from './trends';
export type {
  HarmonyType,
  HarmonySuggestion,
  PaletteCompletionSuggestion,
  GradientStop,
  GradientSuggestion,
  SimilarPaletteResult,
} from './suggestions';
export type {
  TrendPeriod,
  TrendingColor,
  ColorCombination,
  TrendData,
  SeasonalTrend,
} from './trends';
