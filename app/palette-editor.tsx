import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { usePaletteStore } from '@/store/paletteStore';
import { paletteService } from '@/services/palettes';
import {
  hslToRgb,
  rgbToHex,
  rgbToHsl,
  hexToRgb,
  createColorFromHsl,
  getComplementary,
  getAnalogous,
  getTriadic,
  lighten,
  darken,
  isLightColor,
} from '@/utils/colors';
import type { PaletteColor, HSL, RGB, Color } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWATCH_SIZE = 60;
const SLIDER_WIDTH = SCREEN_WIDTH - 80;

type PreviewMode = 'swatches' | 'gradient' | 'mockup';

interface HistoryState {
  colors: PaletteColor[];
}

export default function PaletteEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ paletteId?: string }>();

  const {
    editingColors,
    editingPalette,
    currentImage,
    startEditing,
    updateEditingColor,
    addEditingColor,
    removeEditingColor,
    reorderEditingColors,
    clearEditing,
  } = usePaletteStore();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('swatches');
  const [paletteName, setPaletteName] = useState(editingPalette?.name || 'My Palette');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Undo/Redo history
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const selectedColor = editingColors[selectedIndex] || null;

  // Initialize editing if needed
  useEffect(() => {
    if (editingColors.length === 0) {
      startEditing(editingPalette || undefined);
    }
    // Save initial state to history
    if (editingColors.length > 0 && history.length === 0) {
      setHistory([{ colors: [...editingColors] }]);
      setHistoryIndex(0);
    }
  }, []);

  // Save state to history when colors change
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ colors: [...editingColors] });
    // Keep only last 20 states
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [editingColors, history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const prevState = history[historyIndex - 1];
    setHistoryIndex(historyIndex - 1);
    // Restore colors from history
    prevState.colors.forEach((color, index) => {
      updateEditingColor(index, color);
    });
  }, [canUndo, history, historyIndex, updateEditingColor]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const nextState = history[historyIndex + 1];
    setHistoryIndex(historyIndex + 1);
    nextState.colors.forEach((color, index) => {
      updateEditingColor(index, color);
    });
  }, [canRedo, history, historyIndex, updateEditingColor]);

  // Color adjustment handlers
  const handleHueChange = useCallback((value: number) => {
    if (!selectedColor) return;
    const newHsl: HSL = { ...selectedColor.hsl, h: Math.round(value) };
    const newRgb = hslToRgb(newHsl);
    const newHex = rgbToHex(newRgb);
    updateEditingColor(selectedIndex, {
      hsl: newHsl,
      rgb: newRgb,
      hex: newHex,
    });
  }, [selectedColor, selectedIndex, updateEditingColor]);

  const handleSaturationChange = useCallback((value: number) => {
    if (!selectedColor) return;
    const newHsl: HSL = { ...selectedColor.hsl, s: Math.round(value) };
    const newRgb = hslToRgb(newHsl);
    const newHex = rgbToHex(newRgb);
    updateEditingColor(selectedIndex, {
      hsl: newHsl,
      rgb: newRgb,
      hex: newHex,
    });
  }, [selectedColor, selectedIndex, updateEditingColor]);

  const handleLightnessChange = useCallback((value: number) => {
    if (!selectedColor) return;
    const newHsl: HSL = { ...selectedColor.hsl, l: Math.round(value) };
    const newRgb = hslToRgb(newHsl);
    const newHex = rgbToHex(newRgb);
    updateEditingColor(selectedIndex, {
      hsl: newHsl,
      rgb: newRgb,
      hex: newHex,
    });
  }, [selectedColor, selectedIndex, updateEditingColor]);

  // Add color from suggestions
  const handleAddSuggestion = useCallback((hsl: HSL) => {
    if (editingColors.length >= 8) {
      Alert.alert('Maximum Colors', 'You can have up to 8 colors in a palette');
      return;
    }
    const color = createColorFromHsl(hsl);
    addEditingColor({
      hex: color.hex,
      rgb: color.rgb,
      hsl: color.hsl,
      name: color.name,
    });
    saveToHistory();
    setShowSuggestions(false);
  }, [editingColors.length, addEditingColor, saveToHistory]);

  // Remove selected color
  const handleRemoveColor = useCallback(() => {
    if (editingColors.length <= 3) {
      Alert.alert('Minimum Colors', 'A palette must have at least 3 colors');
      return;
    }
    removeEditingColor(selectedIndex);
    saveToHistory();
    if (selectedIndex >= editingColors.length - 1) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
  }, [editingColors.length, selectedIndex, removeEditingColor, saveToHistory]);

  // Generate color suggestions
  const suggestions = useMemo(() => {
    if (!selectedColor) return [];
    const hsl = selectedColor.hsl;
    return [
      { label: 'Complementary', hsl: getComplementary(hsl) },
      { label: 'Analogous 1', hsl: getAnalogous(hsl)[0] },
      { label: 'Analogous 2', hsl: getAnalogous(hsl)[1] },
      { label: 'Triadic 1', hsl: getTriadic(hsl)[0] },
      { label: 'Triadic 2', hsl: getTriadic(hsl)[1] },
      { label: 'Lighter', hsl: lighten(hsl, 15) },
      { label: 'Darker', hsl: darken(hsl, 15) },
    ];
  }, [selectedColor]);

  // Save palette
  const handleSave = useCallback(async () => {
    if (!paletteName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your palette');
      return;
    }

    setIsSaving(true);
    try {
      const colorsToSave = editingColors.map((c, index) => ({
        hex: c.hex,
        rgb: c.rgb,
        hsl: c.hsl,
        position: index,
        name: c.name,
      }));

      if (editingPalette) {
        await paletteService.updatePalette(editingPalette.id, {
          name: paletteName,
          colors: colorsToSave,
        });
      } else {
        await paletteService.createPalette({
          name: paletteName,
          colors: colorsToSave,
          sourceImageUrl: currentImage || undefined,
        });
      }

      clearEditing();
      Alert.alert('Success', 'Palette saved successfully', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/library') },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save palette');
    } finally {
      setIsSaving(false);
    }
  }, [paletteName, editingColors, editingPalette, currentImage, clearEditing, router]);

  // Move color in the list
  const handleMoveColor = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= editingColors.length) return;
    reorderEditingColors(fromIndex, toIndex);
    setSelectedIndex(toIndex);
    saveToHistory();
  }, [editingColors.length, reorderEditingColors, saveToHistory]);

  // Render gradient preview
  const gradientColors = editingColors.map(c => c.hex);
  const gradientStyle = useMemo(() => {
    if (gradientColors.length < 2) return {};
    const stops = gradientColors.map((color, i) =>
      `${color} ${(i / (gradientColors.length - 1)) * 100}%`
    ).join(', ');
    return { background: `linear-gradient(90deg, ${stops})` };
  }, [gradientColors]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <Text style={styles.headerButtonText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Palette</Text>
          <Pressable
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Palette Name Input */}
          <View style={styles.nameSection}>
            <Text style={styles.sectionLabel}>Palette Name</Text>
            <TextInput
              style={styles.nameInput}
              value={paletteName}
              onChangeText={setPaletteName}
              placeholder="Enter palette name"
              placeholderTextColor="#666"
              maxLength={100}
            />
          </View>

          {/* Preview Mode Toggle */}
          <View style={styles.previewModeSection}>
            {(['swatches', 'gradient', 'mockup'] as PreviewMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[
                  styles.previewModeButton,
                  previewMode === mode && styles.previewModeButtonActive,
                ]}
                onPress={() => setPreviewMode(mode)}
              >
                <Text
                  style={[
                    styles.previewModeText,
                    previewMode === mode && styles.previewModeTextActive,
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Preview */}
          <View style={styles.previewSection}>
            {previewMode === 'swatches' && (
              <View style={styles.swatchesPreview}>
                {editingColors.map((color, index) => (
                  <Pressable
                    key={color.id}
                    onPress={() => setSelectedIndex(index)}
                    style={[
                      styles.previewSwatch,
                      { backgroundColor: color.hex },
                      selectedIndex === index && styles.previewSwatchSelected,
                    ]}
                  >
                    {selectedIndex === index && (
                      <View style={[
                        styles.checkmark,
                        { backgroundColor: isLightColor(color.rgb) ? '#000' : '#fff' }
                      ]}>
                        <Text style={{ color: isLightColor(color.rgb) ? '#fff' : '#000', fontSize: 10 }}>
                          {index + 1}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {previewMode === 'gradient' && (
              <View style={styles.gradientPreview}>
                {editingColors.map((color, index) => (
                  <View
                    key={color.id}
                    style={[styles.gradientStrip, { backgroundColor: color.hex, flex: 1 }]}
                  />
                ))}
              </View>
            )}

            {previewMode === 'mockup' && (
              <View style={styles.mockupPreview}>
                <View style={[styles.mockupHeader, { backgroundColor: editingColors[0]?.hex || '#333' }]}>
                  <View style={styles.mockupDot} />
                  <View style={styles.mockupDot} />
                  <View style={styles.mockupDot} />
                </View>
                <View style={[styles.mockupBody, { backgroundColor: editingColors[1]?.hex || '#fff' }]}>
                  <View style={[styles.mockupButton, { backgroundColor: editingColors[2]?.hex || '#007AFF' }]} />
                  <View style={styles.mockupLines}>
                    <View style={[styles.mockupLine, { backgroundColor: editingColors[3]?.hex || '#ccc' }]} />
                    <View style={[styles.mockupLine, { backgroundColor: editingColors[4]?.hex || '#ccc', width: '60%' }]} />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Color Reorder Controls */}
          <View style={styles.reorderSection}>
            <Text style={styles.sectionLabel}>Reorder Colors</Text>
            <View style={styles.reorderButtons}>
              <Pressable
                style={[styles.reorderButton, selectedIndex === 0 && styles.reorderButtonDisabled]}
                onPress={() => handleMoveColor(selectedIndex, selectedIndex - 1)}
                disabled={selectedIndex === 0}
              >
                <Text style={styles.reorderButtonText}>Move Left</Text>
              </Pressable>
              <Pressable
                style={[styles.reorderButton, selectedIndex === editingColors.length - 1 && styles.reorderButtonDisabled]}
                onPress={() => handleMoveColor(selectedIndex, selectedIndex + 1)}
                disabled={selectedIndex === editingColors.length - 1}
              >
                <Text style={styles.reorderButtonText}>Move Right</Text>
              </Pressable>
            </View>
          </View>

          {/* Selected Color Info */}
          {selectedColor && (
            <Animated.View entering={FadeInDown} style={styles.colorInfo}>
              <View style={styles.colorInfoHeader}>
                <View style={[styles.colorInfoPreview, { backgroundColor: selectedColor.hex }]} />
                <View style={styles.colorInfoDetails}>
                  <Text style={styles.colorInfoHex}>{selectedColor.hex}</Text>
                  <Text style={styles.colorInfoName}>{selectedColor.name || 'Custom Color'}</Text>
                </View>
                <Pressable style={styles.removeButton} onPress={handleRemoveColor}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>

              {/* HSL Sliders */}
              <View style={styles.slidersSection}>
                <ColorSlider
                  label="Hue"
                  value={selectedColor.hsl.h}
                  min={0}
                  max={360}
                  onChange={handleHueChange}
                  onChangeEnd={saveToHistory}
                  gradientColors={['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']}
                />
                <ColorSlider
                  label="Saturation"
                  value={selectedColor.hsl.s}
                  min={0}
                  max={100}
                  onChange={handleSaturationChange}
                  onChangeEnd={saveToHistory}
                  gradientColors={[
                    rgbToHex(hslToRgb({ ...selectedColor.hsl, s: 0 })),
                    rgbToHex(hslToRgb({ ...selectedColor.hsl, s: 100 })),
                  ]}
                />
                <ColorSlider
                  label="Lightness"
                  value={selectedColor.hsl.l}
                  min={0}
                  max={100}
                  onChange={handleLightnessChange}
                  onChangeEnd={saveToHistory}
                  gradientColors={[
                    '#000000',
                    rgbToHex(hslToRgb({ ...selectedColor.hsl, l: 50 })),
                    '#FFFFFF',
                  ]}
                />
              </View>
            </Animated.View>
          )}

          {/* Undo/Redo */}
          <View style={styles.historySection}>
            <Pressable
              style={[styles.historyButton, !canUndo && styles.historyButtonDisabled]}
              onPress={handleUndo}
              disabled={!canUndo}
            >
              <Text style={styles.historyButtonText}>Undo</Text>
            </Pressable>
            <Pressable
              style={[styles.historyButton, !canRedo && styles.historyButtonDisabled]}
              onPress={handleRedo}
              disabled={!canRedo}
            >
              <Text style={styles.historyButtonText}>Redo</Text>
            </Pressable>
          </View>

          {/* Color Suggestions */}
          <View style={styles.suggestionsSection}>
            <Pressable
              style={styles.suggestionsHeader}
              onPress={() => setShowSuggestions(!showSuggestions)}
            >
              <Text style={styles.sectionLabel}>Color Suggestions</Text>
              <Text style={styles.suggestionsToggle}>{showSuggestions ? '−' : '+'}</Text>
            </Pressable>

            {showSuggestions && (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.suggestionsList}>
                {suggestions.map((suggestion, index) => {
                  const rgb = hslToRgb(suggestion.hsl);
                  const hex = rgbToHex(rgb);
                  return (
                    <Pressable
                      key={index}
                      style={styles.suggestionItem}
                      onPress={() => handleAddSuggestion(suggestion.hsl)}
                    >
                      <View style={[styles.suggestionColor, { backgroundColor: hex }]} />
                      <Text style={styles.suggestionLabel}>{suggestion.label}</Text>
                      <Text style={styles.suggestionHex}>{hex}</Text>
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// Color Slider Component
interface ColorSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onChangeEnd?: () => void;
  gradientColors: string[];
}

function ColorSlider({ label, value, min, max, onChange, onChangeEnd, gradientColors }: ColorSliderProps) {
  const position = useSharedValue((value - min) / (max - min) * SLIDER_WIDTH);
  const isActive = useSharedValue(false);

  const handleChange = useCallback((x: number) => {
    const clampedX = Math.max(0, Math.min(SLIDER_WIDTH, x));
    const newValue = min + (clampedX / SLIDER_WIDTH) * (max - min);
    onChange(newValue);
  }, [min, max, onChange]);

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      isActive.value = true;
      const newX = e.x;
      position.value = Math.max(0, Math.min(SLIDER_WIDTH, newX));
      runOnJS(handleChange)(newX);
    })
    .onUpdate((e) => {
      const newX = e.x;
      position.value = Math.max(0, Math.min(SLIDER_WIDTH, newX));
      runOnJS(handleChange)(newX);
    })
    .onEnd(() => {
      isActive.value = false;
      if (onChangeEnd) {
        runOnJS(onChangeEnd)();
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.value - 12 },
      { scale: withSpring(isActive.value ? 1.2 : 1) },
    ],
  }));

  // Update position when value changes externally
  useEffect(() => {
    position.value = ((value - min) / (max - min)) * SLIDER_WIDTH;
  }, [value, min, max]);

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{Math.round(value)}{max === 360 ? '°' : '%'}</Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View style={styles.sliderTrackContainer}>
          <View style={styles.sliderTrack}>
            {gradientColors.map((color, index) => (
              <View
                key={index}
                style={[
                  styles.sliderGradientPart,
                  {
                    backgroundColor: color,
                    flex: 1,
                    marginLeft: index === 0 ? 0 : -1,
                  },
                ]}
              />
            ))}
          </View>
          <Animated.View style={[styles.sliderThumb, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#FF6B6B',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  nameSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  previewModeSection: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 8,
  },
  previewModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  previewModeButtonActive: {
    backgroundColor: '#333',
    borderColor: '#fff',
  },
  previewModeText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  previewModeTextActive: {
    color: '#fff',
  },
  previewSection: {
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  swatchesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
    justifyContent: 'center',
  },
  previewSwatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  previewSwatchSelected: {
    borderColor: '#fff',
  },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientPreview: {
    flexDirection: 'row',
    height: 120,
  },
  gradientStrip: {
    height: '100%',
  },
  mockupPreview: {
    padding: 16,
  },
  mockupHeader: {
    height: 32,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  mockupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  mockupBody: {
    padding: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    minHeight: 80,
  },
  mockupButton: {
    width: 80,
    height: 28,
    borderRadius: 6,
    marginBottom: 12,
  },
  mockupLines: {
    gap: 8,
  },
  mockupLine: {
    height: 8,
    borderRadius: 4,
    width: '80%',
  },
  reorderSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reorderButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  reorderButtonDisabled: {
    opacity: 0.4,
  },
  reorderButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  colorInfo: {
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
  },
  colorInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorInfoPreview: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
  },
  colorInfoDetails: {
    flex: 1,
  },
  colorInfoHex: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'monospace',
  },
  colorInfoName: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  removeButton: {
    backgroundColor: '#FF6B6B20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeButtonText: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  slidersSection: {
    gap: 16,
  },
  sliderContainer: {
    gap: 8,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  sliderValue: {
    fontSize: 13,
    color: '#fff',
    fontFamily: 'monospace',
  },
  sliderTrackContainer: {
    height: 32,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  sliderGradientPart: {
    height: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  historySection: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 12,
  },
  historyButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  historyButtonDisabled: {
    opacity: 0.4,
  },
  historyButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  suggestionsSection: {
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  suggestionsToggle: {
    fontSize: 24,
    color: '#888',
    fontWeight: '300',
  },
  suggestionsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    borderRadius: 8,
    padding: 12,
  },
  suggestionColor: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 12,
  },
  suggestionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  suggestionHex: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'monospace',
  },
});
