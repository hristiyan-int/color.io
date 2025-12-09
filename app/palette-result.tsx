import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useColorExtraction } from '@/hooks/useColorExtraction';
import { usePaletteStore } from '@/store/paletteStore';
import { paletteService } from '@/services/palettes';
import { isLightColor } from '@/utils/colors';
import { ExportBottomSheet, ShareBottomSheet, TagSelector } from '@/components';
import type { Color, Tag } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWATCH_SIZE = (SCREEN_WIDTH - 48 - 40) / 6; // 6 swatches with gaps

interface ColorSwatchProps {
  color: Color;
  index: number;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function ColorSwatch({ color, index, isSelected, onPress, onLongPress }: ColorSwatchProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.15 : 1, {
      damping: 12,
      stiffness: 180,
    });
  }, [isSelected]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.swatchPressable}
      >
        <Animated.View
          style={[
            styles.swatch,
            { backgroundColor: color.hex },
            isSelected && styles.swatchSelected,
            animatedStyle,
          ]}
        >
          {isSelected && (
            <View style={[
              styles.swatchCheck,
              { backgroundColor: isLightColor(color.rgb) ? '#000' : '#fff' }
            ]}>
              <Text style={{ color: isLightColor(color.rgb) ? '#fff' : '#000', fontSize: 10 }}>
                ✓
              </Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function PaletteResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUri: string }>();
  const { colors, dominantColor, isExtracting, error, processingTime, extractColors } = useColorExtraction();
  const { setExtractedColors, setCurrentImage, startEditing, addPalette } = usePaletteStore();

  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [showSourceImage, setShowSourceImage] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [paletteName, setPaletteName] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const selectedColor = colors[selectedColorIndex] || null;

  useEffect(() => {
    if (params.imageUri) {
      extractColors(params.imageUri, { colorCount: 6, quality: 'high' });
      setCurrentImage(params.imageUri);
    }
  }, [params.imageUri]);

  // Update store when colors are extracted
  useEffect(() => {
    if (colors.length > 0) {
      setExtractedColors(colors);
    }
  }, [colors]);

  const handleCopyHex = useCallback(async () => {
    if (selectedColor) {
      await Clipboard.setStringAsync(selectedColor.hex);
      Alert.alert('Copied!', `${selectedColor.hex} copied to clipboard`);
    }
  }, [selectedColor]);

  const handleCopyRgb = useCallback(async () => {
    if (selectedColor) {
      const rgbString = `rgb(${selectedColor.rgb.r}, ${selectedColor.rgb.g}, ${selectedColor.rgb.b})`;
      await Clipboard.setStringAsync(rgbString);
      Alert.alert('Copied!', `${rgbString} copied to clipboard`);
    }
  }, [selectedColor]);

  const handleCopyHsl = useCallback(async () => {
    if (selectedColor) {
      const hslString = `hsl(${selectedColor.hsl.h}, ${selectedColor.hsl.s}%, ${selectedColor.hsl.l}%)`;
      await Clipboard.setStringAsync(hslString);
      Alert.alert('Copied!', `${hslString} copied to clipboard`);
    }
  }, [selectedColor]);

  const handleSwatchLongPress = useCallback(async (color: Color) => {
    await Clipboard.setStringAsync(color.hex);
    Alert.alert('Copied!', `${color.hex} copied to clipboard`);
  }, []);

  const handleSave = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  const handleSaveConfirm = useCallback(async () => {
    if (!paletteName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your palette');
      return;
    }

    setIsSaving(true);
    try {
      const colorsToSave = colors.map((c, index) => ({
        hex: c.hex,
        rgb: c.rgb,
        hsl: c.hsl,
        position: index,
        name: c.name,
      }));

      const savedPalette = await paletteService.createPalette({
        name: paletteName.trim(),
        colors: colorsToSave,
        sourceImageUrl: params.imageUri,
        tagIds: selectedTags.map((t) => t.id),
      });

      addPalette(savedPalette);
      setShowSaveModal(false);
      setPaletteName('');
      setSelectedTags([]);

      Alert.alert('Success', 'Palette saved successfully!', [
        { text: 'View Library', onPress: () => router.replace('/(tabs)/library') },
        { text: 'Create Another', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save palette');
    } finally {
      setIsSaving(false);
    }
  }, [paletteName, colors, params.imageUri, selectedTags, addPalette, router]);

  const handleCustomize = useCallback(() => {
    // Store the extracted colors and navigate to editor
    startEditing();
    router.push('/palette-editor');
  }, [startEditing, router]);

  const handleShare = useCallback(() => {
    setShowShareSheet(true);
  }, []);

  const handleExport = useCallback(() => {
    setShowExportSheet(true);
  }, []);

  if (isExtracting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Extracting colors...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Extraction Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Text style={styles.headerButtonIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Palette</Text>
        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Source Image (collapsible) */}
        {params.imageUri && (
          <Pressable
            style={styles.sourceImageContainer}
            onPress={() => setShowSourceImage(!showSourceImage)}
          >
            {showSourceImage ? (
              <Animated.View entering={FadeIn}>
                <Image
                  source={{ uri: params.imageUri }}
                  style={styles.sourceImage}
                  resizeMode="cover"
                />
                <View style={styles.sourceImageOverlay}>
                  <Text style={styles.sourceImageText}>Tap to hide</Text>
                </View>
              </Animated.View>
            ) : (
              <View style={styles.sourceImageCollapsed}>
                <Text style={styles.sourceImageCollapsedText}>Tap to show source image</Text>
              </View>
            )}
          </Pressable>
        )}

        {/* Color Swatches */}
        <View style={styles.swatchesSection}>
          <View style={styles.swatchesRow}>
            {colors.map((color, index) => (
              <ColorSwatch
                key={color.hex + index}
                color={color}
                index={index}
                isSelected={selectedColorIndex === index}
                onPress={() => setSelectedColorIndex(index)}
                onLongPress={() => handleSwatchLongPress(color)}
              />
            ))}
          </View>
          <Text style={styles.swatchHint}>Long press to copy HEX</Text>
        </View>

        {/* Color Details */}
        {selectedColor && (
          <Animated.View
            entering={FadeInDown.springify()}
            style={styles.colorDetails}
          >
            <View style={styles.colorDetailsHeader}>
              <View
                style={[styles.colorPreview, { backgroundColor: selectedColor.hex }]}
              />
              <View style={styles.colorDetailsInfo}>
                <Text style={styles.colorName}>{selectedColor.name || 'Unknown'}</Text>
                {selectedColor.percentage && (
                  <Text style={styles.colorPercentage}>
                    {selectedColor.percentage}% of image
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.colorCodes}>
              <Pressable style={styles.colorCode} onPress={handleCopyHex}>
                <Text style={styles.colorCodeLabel}>HEX</Text>
                <View style={styles.colorCodeValueContainer}>
                  <Text style={styles.colorCodeValue}>{selectedColor.hex}</Text>
                  <Text style={styles.copyIcon}>📋</Text>
                </View>
              </Pressable>

              <Pressable style={styles.colorCode} onPress={handleCopyRgb}>
                <Text style={styles.colorCodeLabel}>RGB</Text>
                <View style={styles.colorCodeValueContainer}>
                  <Text style={styles.colorCodeValue}>
                    {selectedColor.rgb.r}, {selectedColor.rgb.g}, {selectedColor.rgb.b}
                  </Text>
                  <Text style={styles.copyIcon}>📋</Text>
                </View>
              </Pressable>

              <Pressable style={styles.colorCode} onPress={handleCopyHsl}>
                <Text style={styles.colorCodeLabel}>HSL</Text>
                <View style={styles.colorCodeValueContainer}>
                  <Text style={styles.colorCodeValue}>
                    {selectedColor.hsl.h}°, {selectedColor.hsl.s}%, {selectedColor.hsl.l}%
                  </Text>
                  <Text style={styles.copyIcon}>📋</Text>
                </View>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={handleCustomize}>
            <Text style={styles.actionIcon}>🎨</Text>
            <Text style={styles.actionText}>Customize</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleShare}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionText}>Share</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleExport}>
            <Text style={styles.actionIcon}>📁</Text>
            <Text style={styles.actionText}>Export</Text>
          </Pressable>
        </View>

        {/* Processing Info */}
        {processingTime > 0 && (
          <Text style={styles.processingTime}>
            Extracted in {processingTime}ms
          </Text>
        )}
      </ScrollView>

      {/* Save Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Palette</Text>
            <Text style={styles.modalSubtitle}>Give your palette a name and add tags</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Sunset Vibes"
              placeholderTextColor="#666"
              value={paletteName}
              onChangeText={setPaletteName}
              autoFocus
              maxLength={100}
            />

            {/* Preview of colors */}
            <View style={styles.modalPreview}>
              {colors.slice(0, 6).map((color, index) => (
                <View
                  key={index}
                  style={[styles.modalPreviewColor, { backgroundColor: color.hex }]}
                />
              ))}
            </View>

            {/* Tag Selector */}
            <View style={styles.tagSelectorContainer}>
              <Text style={styles.tagSelectorLabel}>Tags (optional)</Text>
              <TagSelector
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                maxTags={5}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowSaveModal(false);
                  setPaletteName('');
                  setSelectedTags([]);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveButton, isSaving && styles.modalSaveButtonDisabled]}
                onPress={handleSaveConfirm}
                disabled={isSaving}
              >
                <Text style={styles.modalSaveButtonText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export Bottom Sheet */}
      <ExportBottomSheet
        visible={showExportSheet}
        onClose={() => setShowExportSheet(false)}
        colors={colors}
        paletteName={paletteName || undefined}
        sourceImageUri={params.imageUri}
      />

      {/* Share Bottom Sheet */}
      <ShareBottomSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        colors={colors}
        paletteName={paletteName || undefined}
      />
    </SafeAreaView>
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonIcon: {
    fontSize: 24,
    color: '#fff',
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  sourceImageContainer: {
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sourceImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  sourceImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  sourceImageText: {
    fontSize: 12,
    color: '#fff',
  },
  sourceImageCollapsed: {
    height: 44,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceImageCollapsedText: {
    fontSize: 14,
    color: '#666',
  },
  swatchesSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  swatchesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  swatchPressable: {
    padding: 4,
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: '#fff',
  },
  swatchCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  colorDetails: {
    marginHorizontal: 24,
    marginTop: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
  },
  colorDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorPreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 16,
  },
  colorDetailsInfo: {
    flex: 1,
  },
  colorName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  colorPercentage: {
    fontSize: 14,
    color: '#888',
  },
  colorCodes: {
    gap: 12,
  },
  colorCode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d0d0d',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  colorCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 40,
  },
  colorCodeValueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  colorCodeValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#fff',
  },
  copyIcon: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  actionIcon: {
    fontSize: 24,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  processingTime: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInput: {
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  modalPreview: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  modalPreviewColor: {
    flex: 1,
    height: 48,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  tagSelectorContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  tagSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
});
