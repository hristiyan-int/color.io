import { supabase } from './supabase';
import { createColorFromHex, deltaE, hexToRgb } from '@/utils/colors';
import type { Color, RGB, HSL } from '@/types';

// ============================================
// Types
// ============================================

export type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'seasonal';

export interface TrendingColor {
  color: Color;
  usageCount: number;
  rank: number;
  change?: 'up' | 'down' | 'new' | 'same'; // Position change from previous period
}

export interface ColorCombination {
  colors: Color[];
  usageCount: number;
}

export interface TrendData {
  period: TrendPeriod;
  periodStart: string;
  periodEnd: string;
  colors: TrendingColor[];
  combinations: ColorCombination[];
  season?: string;
}

export interface SeasonalTrend {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  dominantHues: number[]; // Hue ranges that are popular
  avgSaturation: number;
  avgLightness: number;
  topColors: TrendingColor[];
}

// ============================================
// Database Types
// ============================================

interface DbColorTrend {
  id: string;
  hex_code: string;
  rgb_r: number;
  rgb_g: number;
  rgb_b: number;
  hsl_h: number;
  hsl_s: number;
  hsl_l: number;
  usage_count: number;
  period_type: string;
  period_start: string;
  period_end: string;
  color_name: string | null;
}

interface DbCombinationTrend {
  id: string;
  colors: string[];
  color_count: number;
  usage_count: number;
  period_type: string;
  period_start: string;
  period_end: string;
}

// ============================================
// Service Implementation
// ============================================

export const trendsService = {
  /**
   * Get trending colors for a specific period
   */
  async getTrendingColors(
    period: TrendPeriod = 'weekly',
    limit: number = 20
  ): Promise<TrendingColor[]> {
    // Try to use the database function first
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_trending_colors',
      {
        p_period_type: period,
        p_limit: limit,
      }
    );

    if (!rpcError && rpcData && rpcData.length > 0) {
      return rpcData.map((row: any, index: number) => ({
        color: {
          hex: row.hex_code,
          rgb: { r: row.rgb_r, g: row.rgb_g, b: row.rgb_b },
          hsl: { h: row.hsl_h, s: row.hsl_s, l: row.hsl_l },
          name: row.color_name || undefined,
        },
        usageCount: row.usage_count,
        rank: index + 1,
      }));
    }

    // Fallback: Calculate trends from palette_colors directly
    return this.calculateTrendingColorsFromPalettes(period, limit);
  },

  /**
   * Fallback: Calculate trending colors directly from recent palettes
   */
  async calculateTrendingColorsFromPalettes(
    period: TrendPeriod,
    limit: number
  ): Promise<TrendingColor[]> {
    const periodDays = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      seasonal: 90,
    };

    const daysBack = periodDays[period] || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get colors from public palettes
    const { data, error } = await supabase
      .from('palette_colors')
      .select(`
        hex_code,
        rgb_r,
        rgb_g,
        rgb_b,
        hsl_h,
        hsl_s,
        hsl_l,
        name,
        palettes!inner (
          is_public,
          created_at,
          deleted_at
        )
      `)
      .eq('palettes.is_public', true)
      .is('palettes.deleted_at', null)
      .gte('palettes.created_at', startDate.toISOString());

    if (error) throw new Error(error.message);

    // Aggregate colors by hex code (group similar colors)
    const colorCounts = new Map<string, {
      color: Color;
      count: number;
    }>();

    for (const row of data || []) {
      const hex = row.hex_code;
      const existing = colorCounts.get(hex);

      if (existing) {
        existing.count++;
      } else {
        colorCounts.set(hex, {
          color: {
            hex,
            rgb: { r: row.rgb_r, g: row.rgb_g, b: row.rgb_b },
            hsl: { h: row.hsl_h, s: row.hsl_s, l: row.hsl_l },
            name: row.name || undefined,
          },
          count: 1,
        });
      }
    }

    // Also group similar colors (deltaE < 15)
    const groupedColors = groupSimilarColors(Array.from(colorCounts.values()));

    // Sort by count and return top N
    const sorted = groupedColors
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return sorted.map((item, index) => ({
      color: item.color,
      usageCount: item.count,
      rank: index + 1,
    }));
  },

  /**
   * Get trending color combinations
   */
  async getTrendingCombinations(
    period: TrendPeriod = 'weekly',
    limit: number = 10
  ): Promise<ColorCombination[]> {
    const { data, error } = await supabase
      .from('combination_trends')
      .select('*')
      .eq('period_type', period)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching combination trends:', error);
      return [];
    }

    return (data || []).map((row: DbCombinationTrend) => ({
      colors: row.colors.map((hex) => createColorFromHex(hex)),
      usageCount: row.usage_count,
    }));
  },

  /**
   * Get full trend data for a period
   */
  async getTrendData(period: TrendPeriod = 'weekly'): Promise<TrendData> {
    const [colors, combinations] = await Promise.all([
      this.getTrendingColors(period, 20),
      this.getTrendingCombinations(period, 10),
    ]);

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (period) {
      case 'daily':
        periodStart = new Date(now.setHours(0, 0, 0, 0));
        periodEnd = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'weekly':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - now.getDay());
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 6);
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'seasonal':
        const month = now.getMonth();
        const seasonStart = Math.floor(month / 3) * 3;
        periodStart = new Date(now.getFullYear(), seasonStart, 1);
        periodEnd = new Date(now.getFullYear(), seasonStart + 3, 0);
        break;
    }

    const season = getCurrentSeason();

    return {
      period,
      periodStart: periodStart!.toISOString().split('T')[0],
      periodEnd: periodEnd!.toISOString().split('T')[0],
      colors,
      combinations,
      season,
    };
  },

  /**
   * Get seasonal color trends and insights
   */
  async getSeasonalTrends(): Promise<SeasonalTrend> {
    const season = getCurrentSeason() as 'spring' | 'summer' | 'autumn' | 'winter';
    const trendingColors = await this.getTrendingColors('seasonal', 50);

    // Analyze hue distribution
    const hues = trendingColors.map((t) => t.color.hsl.h);
    const saturations = trendingColors.map((t) => t.color.hsl.s);
    const lightnesses = trendingColors.map((t) => t.color.hsl.l);

    // Find dominant hue ranges (peaks in histogram)
    const hueHistogram = new Array(12).fill(0);
    hues.forEach((h) => {
      const bucket = Math.floor(h / 30);
      hueHistogram[bucket]++;
    });

    const dominantHues: number[] = [];
    hueHistogram.forEach((count, index) => {
      if (count >= trendingColors.length * 0.1) {
        dominantHues.push(index * 30 + 15);
      }
    });

    return {
      season,
      dominantHues,
      avgSaturation: saturations.length > 0
        ? Math.round(saturations.reduce((a, b) => a + b, 0) / saturations.length)
        : 50,
      avgLightness: lightnesses.length > 0
        ? Math.round(lightnesses.reduce((a, b) => a + b, 0) / lightnesses.length)
        : 50,
      topColors: trendingColors.slice(0, 10),
    };
  },

  /**
   * Refresh trends (trigger calculation)
   * This should be called by a cron job or admin action
   */
  async refreshTrends(): Promise<{ weekly: number; monthly: number }> {
    const [weekly, monthly] = await Promise.all([
      supabase.rpc('calculate_weekly_color_trends'),
      supabase.rpc('calculate_monthly_color_trends'),
    ]);

    return {
      weekly: weekly.data || 0,
      monthly: monthly.data || 0,
    };
  },
};

// ============================================
// Helper Functions
// ============================================

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

function groupSimilarColors(
  colors: { color: Color; count: number }[]
): { color: Color; count: number }[] {
  const groups: { color: Color; count: number }[] = [];

  for (const item of colors) {
    // Find if there's an existing group with similar color
    const existingGroup = groups.find((g) =>
      deltaE(g.color.rgb, item.color.rgb) < 15
    );

    if (existingGroup) {
      // Merge into existing group
      existingGroup.count += item.count;
      // Keep the color with higher count as representative
    } else {
      groups.push({ ...item });
    }
  }

  return groups;
}

export default trendsService;
