import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  suggestionsService,
  type HarmonySuggestion,
  type PaletteCompletionSuggestion,
  type GradientSuggestion,
  type SimilarPaletteResult,
} from '@/services/suggestions';
import { isLightColor } from '@/utils/colors';
import type { Color, PaletteColor, FeedPalette } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// Color Harmony Section
// ============================================

interface ColorHarmonySectionProps {
  baseColor: Color;
  onSelectColors?: (colors: Color[]) => void;
}

export function ColorHarmonySection({ baseColor, onSelectColors }: ColorHarmonySectionProps) {
  const [suggestions, setSuggestions] = useState<HarmonySuggestion[]>([]);
  const [selectedHarmony, setSelectedHarmony] = useState<string | null>(null);

  useEffect(() => {
    const harmonies = suggestionsService.getHarmonySuggestions(baseColor);
    setSuggestions(harmonies);
  }, [baseColor]);

  const handleSelect = useCallback(
    (harmony: HarmonySuggestion) => {
      setSelectedHarmony(harmony.type);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelectColors?.(harmony.colors);
    },
    [onSelectColors]
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Color Harmonies</Text>
      <Text style={styles.sectionSubtitle}>Based on color theory</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {suggestions.map((harmony, index) => (
          <Animated.View
            key={harmony.type}
            entering={FadeInDown.delay(index * 50).springify()}
          >
            <Pressable
              style={({ pressed }) => [
                styles.harmonyCard,
                selectedHarmony === harmony.type && styles.harmonyCardSelected,
                pressed && styles.harmonyCardPressed,
              ]}
              onPress={() => handleSelect(harmony)}
            >
              <View style={styles.harmonySwatches}>
                {harmony.colors.map((color, i) => (
                  <View
                    key={i}
                    style={[styles.harmonySwatch, { backgroundColor: color.hex }]}
                  />
                ))}
              </View>
              <Text style={styles.harmonyName}>{harmony.name}</Text>
              <Text style={styles.harmonyDescription} numberOfLines={2}>
                {harmony.description}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================
// Palette Completion Section
// ============================================

interface PaletteCompletionSectionProps {
  existingColors: Color[];
  onAddColor?: (color: Color) => void;
}

export function PaletteCompletionSection({
  existingColors,
  onAddColor,
}: PaletteCompletionSectionProps) {
  const [suggestions, setSuggestions] = useState<PaletteCompletionSuggestion[]>([]);

  useEffect(() => {
    if (existingColors.length === 0) {
      setSuggestions([]);
      return;
    }
    const completions = suggestionsService.getPaletteCompletionSuggestions(existingColors);
    setSuggestions(completions);
  }, [existingColors]);

  const handleAddColor = useCallback(
    async (suggestion: PaletteCompletionSuggestion) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAddColor?.(suggestion.color);
    },
    [onAddColor]
  );

  const handleCopyColor = useCallback(async (hex: string) => {
    await Clipboard.setStringAsync(hex);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Suggested Colors</Text>
      <Text style={styles.sectionSubtitle}>Enhance your palette</Text>
      <View style={styles.completionGrid}>
        {suggestions.map((suggestion, index) => {
          const textColor = isLightColor(suggestion.color.rgb) ? '#000' : '#fff';
          return (
            <Animated.View
              key={`${suggestion.type}-${index}`}
              entering={FadeIn.delay(index * 75)}
              layout={Layout.springify()}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.completionCard,
                  { backgroundColor: suggestion.color.hex },
                  pressed && styles.completionCardPressed,
                ]}
                onPress={() => handleAddColor(suggestion)}
                onLongPress={() => handleCopyColor(suggestion.color.hex)}
              >
                <View style={styles.completionContent}>
                  <Text style={[styles.completionName, { color: textColor }]}>
                    {suggestion.name}
                  </Text>
                  <Text style={[styles.completionHex, { color: textColor }]}>
                    {suggestion.color.hex}
                  </Text>
                </View>
                <Text
                  style={[styles.completionReason, { color: textColor }]}
                  numberOfLines={2}
                >
                  {suggestion.reason}
                </Text>
                <View style={[styles.addButton, { borderColor: textColor }]}>
                  <Text style={[styles.addButtonText, { color: textColor }]}>+ Add</Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// ============================================
// Gradient Suggestions Section
// ============================================

interface GradientSuggestionsSectionProps {
  colors: Color[];
  onSelectGradient?: (gradient: GradientSuggestion) => void;
}

export function GradientSuggestionsSection({
  colors,
  onSelectGradient,
}: GradientSuggestionsSectionProps) {
  const [gradients, setGradients] = useState<GradientSuggestion[]>([]);

  useEffect(() => {
    if (colors.length < 2) {
      setGradients([]);
      return;
    }
    const suggestions = suggestionsService.getGradientSuggestions(colors);
    setGradients(suggestions);
  }, [colors]);

  const handleCopyGradient = useCallback(async (cssGradient: string) => {
    await Clipboard.setStringAsync(cssGradient);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  if (gradients.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Gradient Suggestions</Text>
      <Text style={styles.sectionSubtitle}>Long press to copy CSS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {gradients.map((gradient, index) => (
          <Animated.View
            key={gradient.name}
            entering={FadeInDown.delay(index * 75).springify()}
          >
            <Pressable
              style={({ pressed }) => [
                styles.gradientCard,
                pressed && styles.gradientCardPressed,
              ]}
              onPress={() => onSelectGradient?.(gradient)}
              onLongPress={() => handleCopyGradient(gradient.cssGradient)}
            >
              <LinearGradient
                colors={gradient.stops.map((s) => s.color.hex) as [string, string, ...string[]]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.gradientPreview}
              />
              <Text style={styles.gradientName}>{gradient.name}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================
// Similar Palettes Section
// ============================================

interface SimilarPalettesSectionProps {
  colors: Color[];
  onSelectPalette?: (palette: FeedPalette) => void;
}

export function SimilarPalettesSection({
  colors,
  onSelectPalette,
}: SimilarPalettesSectionProps) {
  const [results, setResults] = useState<SimilarPaletteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (colors.length === 0) {
      setResults([]);
      return;
    }

    let isMounted = true;

    const fetchSimilar = async () => {
      setIsLoading(true);
      try {
        const similar = await suggestionsService.findSimilarPalettes(colors, 8);
        if (isMounted) {
          setResults(similar);
        }
      } catch (error) {
        console.error('Error fetching similar palettes:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSimilar();

    return () => {
      isMounted = false;
    };
  }, [colors]);

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Similar Palettes</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#888" />
          <Text style={styles.loadingText}>Finding similar palettes...</Text>
        </View>
      </View>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Similar Palettes</Text>
      <Text style={styles.sectionSubtitle}>You might also like</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {results.map(({ palette, similarity }, index) => (
          <Animated.View
            key={palette.id}
            entering={FadeInDown.delay(index * 75).springify()}
          >
            <Pressable
              style={({ pressed }) => [
                styles.similarCard,
                pressed && styles.similarCardPressed,
              ]}
              onPress={() => onSelectPalette?.(palette)}
            >
              <View style={styles.similarSwatches}>
                {palette.colors.slice(0, 5).map((color, i) => (
                  <View
                    key={i}
                    style={[styles.similarSwatch, { backgroundColor: color.hex }]}
                  />
                ))}
              </View>
              <View style={styles.similarInfo}>
                <Text style={styles.similarName} numberOfLines={1}>
                  {palette.name}
                </Text>
                <Text style={styles.similarMeta}>
                  by @{palette.user.username}
                </Text>
                <View style={styles.similarStats}>
                  <Text style={styles.similarSimilarity}>
                    {Math.round(similarity)}% match
                  </Text>
                  <Text style={styles.similarLikes}>
                    {palette.likesCount} likes
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================
// Combined Suggestions Component
// ============================================

interface ColorSuggestionsProps {
  colors: (Color | PaletteColor)[];
  onAddColor?: (color: Color) => void;
  onSelectHarmony?: (colors: Color[]) => void;
  onSelectGradient?: (gradient: GradientSuggestion) => void;
  onSelectPalette?: (palette: FeedPalette) => void;
  showHarmonies?: boolean;
  showCompletions?: boolean;
  showGradients?: boolean;
  showSimilar?: boolean;
}

export function ColorSuggestions({
  colors,
  onAddColor,
  onSelectHarmony,
  onSelectGradient,
  onSelectPalette,
  showHarmonies = true,
  showCompletions = true,
  showGradients = true,
  showSimilar = true,
}: ColorSuggestionsProps) {
  // Convert to Color type if needed
  const normalizedColors: Color[] = colors.map((c) => ({
    hex: c.hex,
    rgb: c.rgb,
    hsl: c.hsl,
    name: 'name' in c ? c.name : undefined,
  }));

  const baseColor = normalizedColors[0];

  if (normalizedColors.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {showHarmonies && baseColor && (
        <ColorHarmonySection
          baseColor={baseColor}
          onSelectColors={onSelectHarmony}
        />
      )}

      {showCompletions && (
        <PaletteCompletionSection
          existingColors={normalizedColors}
          onAddColor={onAddColor}
        />
      )}

      {showGradients && (
        <GradientSuggestionsSection
          colors={normalizedColors}
          onSelectGradient={onSelectGradient}
        />
      )}

      {showSimilar && (
        <SimilarPalettesSection
          colors={normalizedColors}
          onSelectPalette={onSelectPalette}
        />
      )}
    </View>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
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

  // Harmony styles
  harmonyCard: {
    width: 160,
    backgroundColor: '#252525',
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  harmonyCardSelected: {
    borderColor: '#4A90D9',
  },
  harmonyCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  harmonySwatches: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  harmonySwatch: {
    flex: 1,
  },
  harmonyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  harmonyDescription: {
    fontSize: 11,
    color: '#888',
    lineHeight: 14,
  },

  // Completion styles
  completionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  completionCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    borderRadius: 16,
    padding: 12,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  completionCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  completionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  completionName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  completionHex: {
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.8,
  },
  completionReason: {
    fontSize: 11,
    opacity: 0.8,
    marginTop: 4,
    lineHeight: 14,
  },
  addButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Gradient styles
  gradientCard: {
    width: 200,
    backgroundColor: '#252525',
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  gradientPreview: {
    height: 80,
  },
  gradientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    padding: 12,
  },

  // Similar palettes styles
  similarCard: {
    width: 180,
    backgroundColor: '#252525',
    borderRadius: 16,
    overflow: 'hidden',
  },
  similarCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  similarSwatches: {
    flexDirection: 'row',
    height: 60,
  },
  similarSwatch: {
    flex: 1,
  },
  similarInfo: {
    padding: 12,
  },
  similarName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  similarMeta: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  similarStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  similarSimilarity: {
    fontSize: 11,
    color: '#4A90D9',
    fontWeight: '600',
  },
  similarLikes: {
    fontSize: 11,
    color: '#888',
  },

  // Loading styles
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
  },
});

export default ColorSuggestions;
