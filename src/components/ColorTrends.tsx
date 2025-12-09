import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInRight,
  Layout,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  trendsService,
  type TrendingColor,
  type TrendData,
  type TrendPeriod,
  type SeasonalTrend,
} from '@/services/trends';
import { isLightColor } from '@/utils/colors';
import type { Color } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// Period Selector
// ============================================

interface PeriodSelectorProps {
  selected: TrendPeriod;
  onSelect: (period: TrendPeriod) => void;
}

function PeriodSelector({ selected, onSelect }: PeriodSelectorProps) {
  const periods: { value: TrendPeriod; label: string }[] = [
    { value: 'weekly', label: 'This Week' },
    { value: 'monthly', label: 'This Month' },
    { value: 'seasonal', label: 'Season' },
  ];

  return (
    <View style={styles.periodSelector}>
      {periods.map((period) => (
        <Pressable
          key={period.value}
          style={[
            styles.periodButton,
            selected === period.value && styles.periodButtonActive,
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onSelect(period.value);
          }}
        >
          <Text
            style={[
              styles.periodButtonText,
              selected === period.value && styles.periodButtonTextActive,
            ]}
          >
            {period.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ============================================
// Trending Color Card
// ============================================

interface TrendingColorCardProps {
  trend: TrendingColor;
  onPress?: (color: Color) => void;
  compact?: boolean;
}

function TrendingColorCard({
  trend,
  onPress,
  compact = false,
}: TrendingColorCardProps) {
  const textColor = isLightColor(trend.color.rgb) ? '#000' : '#fff';

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(trend.color.hex);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [trend.color.hex]);

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.compactCard,
          { backgroundColor: trend.color.hex },
          pressed && styles.cardPressed,
        ]}
        onPress={() => onPress?.(trend.color)}
        onLongPress={handleCopy}
      >
        <Text style={[styles.compactRank, { color: textColor }]}>
          #{trend.rank}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.trendCard,
        { backgroundColor: trend.color.hex },
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress?.(trend.color)}
      onLongPress={handleCopy}
    >
      <View style={styles.trendRankContainer}>
        <Text style={[styles.trendRank, { color: textColor }]}>
          {trend.rank}
        </Text>
      </View>
      <View style={styles.trendInfo}>
        <Text style={[styles.trendHex, { color: textColor }]}>
          {trend.color.hex}
        </Text>
        {trend.color.name && (
          <Text style={[styles.trendName, { color: textColor }]} numberOfLines={1}>
            {trend.color.name}
          </Text>
        )}
        <Text style={[styles.trendUsage, { color: textColor }]}>
          {trend.usageCount} uses
        </Text>
      </View>
      {trend.change && trend.change !== 'same' && (
        <View
          style={[
            styles.changeBadge,
            trend.change === 'up' && styles.changeBadgeUp,
            trend.change === 'down' && styles.changeBadgeDown,
            trend.change === 'new' && styles.changeBadgeNew,
          ]}
        >
          <Text style={styles.changeBadgeText}>
            {trend.change === 'up' ? '↑' : trend.change === 'down' ? '↓' : 'NEW'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ============================================
// Trending Colors Grid
// ============================================

interface TrendingColorsGridProps {
  colors: TrendingColor[];
  onSelectColor?: (color: Color) => void;
  showAll?: boolean;
}

export function TrendingColorsGrid({
  colors,
  onSelectColor,
  showAll = false,
}: TrendingColorsGridProps) {
  const displayColors = showAll ? colors : colors.slice(0, 12);

  return (
    <View style={styles.grid}>
      {displayColors.map((trend, index) => (
        <Animated.View
          key={trend.color.hex}
          entering={FadeInDown.delay(index * 30).springify()}
          layout={Layout.springify()}
        >
          <TrendingColorCard
            trend={trend}
            onPress={onSelectColor}
            compact={!showAll}
          />
        </Animated.View>
      ))}
    </View>
  );
}

// ============================================
// Top Trending List
// ============================================

interface TopTrendingListProps {
  colors: TrendingColor[];
  onSelectColor?: (color: Color) => void;
}

export function TopTrendingList({
  colors,
  onSelectColor,
}: TopTrendingListProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalScroll}
    >
      {colors.slice(0, 10).map((trend, index) => (
        <Animated.View
          key={trend.color.hex}
          entering={SlideInRight.delay(index * 50).springify()}
        >
          <TrendingColorCard trend={trend} onPress={onSelectColor} />
        </Animated.View>
      ))}
    </ScrollView>
  );
}

// ============================================
// Seasonal Insights Card
// ============================================

interface SeasonalInsightsCardProps {
  seasonal: SeasonalTrend;
}

function SeasonalInsightsCard({ seasonal }: SeasonalInsightsCardProps) {
  const seasonEmojis = {
    spring: '🌸',
    summer: '☀️',
    autumn: '🍂',
    winter: '❄️',
  };

  const seasonNames = {
    spring: 'Spring',
    summer: 'Summer',
    autumn: 'Autumn',
    winter: 'Winter',
  };

  return (
    <View style={styles.insightsCard}>
      <View style={styles.insightsHeader}>
        <Text style={styles.insightsEmoji}>
          {seasonEmojis[seasonal.season]}
        </Text>
        <Text style={styles.insightsTitle}>
          {seasonNames[seasonal.season]} Color Trends
        </Text>
      </View>

      <View style={styles.insightsStats}>
        <View style={styles.insightsStat}>
          <Text style={styles.insightsStatValue}>
            {Math.round(seasonal.avgSaturation)}%
          </Text>
          <Text style={styles.insightsStatLabel}>Avg Saturation</Text>
        </View>
        <View style={styles.insightsStat}>
          <Text style={styles.insightsStatValue}>
            {Math.round(seasonal.avgLightness)}%
          </Text>
          <Text style={styles.insightsStatLabel}>Avg Lightness</Text>
        </View>
        <View style={styles.insightsStat}>
          <Text style={styles.insightsStatValue}>
            {seasonal.dominantHues.length}
          </Text>
          <Text style={styles.insightsStatLabel}>Popular Hue Ranges</Text>
        </View>
      </View>

      <View style={styles.dominantHues}>
        <Text style={styles.dominantHuesLabel}>Dominant Hue Ranges:</Text>
        <View style={styles.hueIndicators}>
          {seasonal.dominantHues.map((hue) => (
            <View
              key={hue}
              style={[
                styles.hueIndicator,
                { backgroundColor: `hsl(${hue}, 70%, 50%)` },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ============================================
// Main Color Trends Component
// ============================================

interface ColorTrendsProps {
  onSelectColor?: (color: Color) => void;
}

export function ColorTrends({ onSelectColor }: ColorTrendsProps) {
  const [period, setPeriod] = useState<TrendPeriod>('weekly');
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [seasonalData, setSeasonalData] = useState<SeasonalTrend | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTrends = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [trends, seasonal] = await Promise.all([
        trendsService.getTrendData(period),
        period === 'seasonal' ? trendsService.getSeasonalTrends() : null,
      ]);

      setTrendData(trends);
      if (seasonal) {
        setSeasonalData(seasonal);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  if (isLoading && !trendData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>Loading trends...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchTrends(true)}
          tintColor="#4A90D9"
        />
      }
    >
      {/* Period Selector */}
      <PeriodSelector selected={period} onSelect={setPeriod} />

      {/* Period Info */}
      {trendData && (
        <Animated.View entering={FadeIn} style={styles.periodInfo}>
          <Text style={styles.periodInfoText}>
            {period === 'weekly' && `Week of ${formatDate(trendData.periodStart)}`}
            {period === 'monthly' && `${getMonthName(trendData.periodStart)} ${new Date(trendData.periodStart).getFullYear()}`}
            {period === 'seasonal' && `${capitalizeFirst(trendData.season || '')} Season`}
          </Text>
        </Animated.View>
      )}

      {/* Seasonal Insights (only for seasonal period) */}
      {period === 'seasonal' && seasonalData && (
        <Animated.View entering={FadeInDown.delay(100)}>
          <SeasonalInsightsCard seasonal={seasonalData} />
        </Animated.View>
      )}

      {/* Trending Colors */}
      {trendData && trendData.colors.length > 0 ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Colors</Text>
            <Text style={styles.sectionSubtitle}>
              Most used in community palettes
            </Text>
            <TopTrendingList
              colors={trendData.colors}
              onSelectColor={onSelectColor}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Trending</Text>
            <TrendingColorsGrid
              colors={trendData.colors}
              onSelectColor={onSelectColor}
              showAll
            />
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No Trends Yet</Text>
          <Text style={styles.emptyDescription}>
            Not enough data to show trends for this period.
            {'\n'}Check back later!
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ============================================
// Helper Functions
// ============================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getMonthName(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'long' });
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: '#333',
  },
  periodButtonActive: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  periodButtonTextActive: {
    color: '#fff',
  },

  // Period Info
  periodInfo: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  periodInfoText: {
    fontSize: 13,
    color: '#666',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  horizontalScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // Trend Card
  trendCard: {
    width: 140,
    height: 100,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  trendRankContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trendRank: {
    fontSize: 12,
    fontWeight: '700',
  },
  trendInfo: {
    alignItems: 'flex-start',
  },
  trendHex: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  trendName: {
    fontSize: 11,
    marginTop: 2,
  },
  trendUsage: {
    fontSize: 10,
    opacity: 0.7,
    marginTop: 2,
  },
  changeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  changeBadgeUp: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
  },
  changeBadgeDown: {
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
  },
  changeBadgeNew: {
    backgroundColor: 'rgba(255, 193, 7, 0.8)',
  },
  changeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  // Compact Card
  compactCard: {
    width: (SCREEN_WIDTH - 40 - 24) / 4,
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactRank: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },

  // Insights Card
  insightsCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#252525',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  insightsEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  insightsStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  insightsStat: {
    alignItems: 'center',
  },
  insightsStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A90D9',
  },
  insightsStatLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  dominantHues: {
    marginTop: 8,
  },
  dominantHuesLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  hueIndicators: {
    flexDirection: 'row',
    gap: 8,
  },
  hueIndicator: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ColorTrends;
