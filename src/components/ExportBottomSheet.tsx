import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import {
  exportService,
  TextExportFormat,
} from '@/services/exportService';
import { isLightColor } from '@/utils/colors';
import type { Color, PaletteColor } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ExportBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  colors: (Color | PaletteColor)[];
  paletteName?: string;
  sourceImageUri?: string;
}

interface ExportOption {
  id: string;
  label: string;
  icon: string;
  description: string;
  action: () => Promise<void>;
}

// Palette preview component for image generation
function PaletteImagePreview({
  colors,
  paletteName,
  showHex = true,
  viewShotRef,
}: {
  colors: (Color | PaletteColor)[];
  paletteName?: string;
  showHex?: boolean;
  viewShotRef: React.RefObject<ViewShot | null>;
}) {
  return (
    <ViewShot
      ref={viewShotRef}
      options={{ format: 'png', quality: 1 }}
      style={styles.paletteImageContainer}
    >
      <View style={styles.paletteImage}>
        {paletteName && (
          <View style={styles.paletteImageHeader}>
            <Text style={styles.paletteImageTitle}>{paletteName}</Text>
          </View>
        )}
        <View style={styles.paletteImageSwatches}>
          {colors.map((color, index) => {
            const textColor = isLightColor(color.rgb) ? '#000' : '#fff';
            return (
              <View
                key={index}
                style={[styles.paletteImageSwatch, { backgroundColor: color.hex }]}
              >
                {showHex && (
                  <Text style={[styles.paletteImageHex, { color: textColor }]}>
                    {color.hex}
                  </Text>
                )}
                {'name' in color && color.name && (
                  <Text
                    style={[styles.paletteImageColorName, { color: textColor }]}
                    numberOfLines={1}
                  >
                    {color.name}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.paletteImageFooter}>
          <Text style={styles.paletteImageWatermark}>Created with Color.io</Text>
        </View>
      </View>
    </ViewShot>
  );
}

export function ExportBottomSheet({
  visible,
  onClose,
  colors,
  paletteName,
}: ExportBottomSheetProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleExport = useCallback(
    async (id: string, exportFn: () => Promise<void>) => {
      setIsExporting(true);
      setExportingId(id);
      try {
        await exportFn();
      } catch (error) {
        Alert.alert('Export Failed', error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsExporting(false);
        setExportingId(null);
      }
    },
    []
  );

  // Export as PNG image
  const exportAsPng = useCallback(async () => {
    if (!viewShotRef.current) return;

    try {
      const uri = await viewShotRef.current.capture?.();
      if (!uri) throw new Error('Failed to capture image');

      Alert.alert('Save Image', 'Where would you like to save the image?', [
        {
          text: 'Camera Roll',
          onPress: async () => {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Please allow access to save images');
              return;
            }
            await MediaLibrary.createAssetAsync(uri);
            Alert.alert('Success', 'Image saved to camera roll');
            onClose();
          },
        },
        {
          text: 'Share',
          onPress: async () => {
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri);
            }
            onClose();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } catch (error) {
      throw error;
    }
  }, [onClose]);

  // Export as text format
  const createTextExport = useCallback(
    (format: TextExportFormat, formatLabel: string) => async () => {
      const result = await exportService.exportAsText(colors, format, paletteName);
      if (result.success) {
        Alert.alert('Copied!', `${formatLabel} copied to clipboard`);
        onClose();
      } else {
        throw new Error(result.message);
      }
    },
    [colors, paletteName, onClose]
  );

  // Export as ASE file
  const exportAsAseFile = useCallback(async () => {
    const result = await exportService.exportAsAse(colors, paletteName);
    if (result.success) {
      onClose();
    } else {
      throw new Error(result.message);
    }
  }, [colors, paletteName, onClose]);

  // Export as JSON file
  const exportAsJsonFile = useCallback(async () => {
    const result = await exportService.exportAsJsonFile(colors, paletteName);
    if (result.success) {
      onClose();
    } else {
      throw new Error(result.message);
    }
  }, [colors, paletteName, onClose]);

  const exportOptions: ExportOption[] = [
    {
      id: 'png',
      label: 'Image (PNG)',
      icon: '🖼️',
      description: 'Save or share as image',
      action: exportAsPng,
    },
    {
      id: 'hex',
      label: 'HEX Values',
      icon: '#️⃣',
      description: 'Copy HEX codes to clipboard',
      action: createTextExport('hex', 'HEX values'),
    },
    {
      id: 'rgb',
      label: 'RGB Values',
      icon: '🔴',
      description: 'Copy RGB values to clipboard',
      action: createTextExport('rgb', 'RGB values'),
    },
    {
      id: 'css',
      label: 'CSS Variables',
      icon: '🎨',
      description: 'Copy as CSS custom properties',
      action: createTextExport('css', 'CSS variables'),
    },
    {
      id: 'scss',
      label: 'SCSS Variables',
      icon: '💅',
      description: 'Copy as SCSS variables',
      action: createTextExport('scss', 'SCSS variables'),
    },
    {
      id: 'tailwind',
      label: 'Tailwind Config',
      icon: '🌬️',
      description: 'Copy as Tailwind CSS config',
      action: createTextExport('tailwind', 'Tailwind config'),
    },
    {
      id: 'swift',
      label: 'SwiftUI Colors',
      icon: '🍎',
      description: 'Copy as SwiftUI extension',
      action: createTextExport('swift', 'SwiftUI code'),
    },
    {
      id: 'android',
      label: 'Android XML',
      icon: '🤖',
      description: 'Copy as Android color resources',
      action: createTextExport('android', 'Android XML'),
    },
    {
      id: 'json',
      label: 'JSON File',
      icon: '📄',
      description: 'Export as JSON file',
      action: exportAsJsonFile,
    },
    {
      id: 'ase',
      label: 'Adobe Swatch (ASE)',
      icon: '🎯',
      description: 'Export for Adobe apps',
      action: exportAsAseFile,
    },
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayPressable} onPress={onClose} />

        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          exiting={SlideOutDown.springify().damping(20).stiffness(200)}
          style={styles.sheet}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Export Palette</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          {/* Hidden palette preview for image capture */}
          <View style={styles.hiddenPreview}>
            <PaletteImagePreview
              colors={colors}
              paletteName={paletteName}
              showHex={true}
              viewShotRef={viewShotRef}
            />
          </View>

          {/* Preview */}
          <View style={styles.previewSection}>
            <View style={styles.previewColors}>
              {colors.slice(0, 8).map((color, index) => (
                <View
                  key={index}
                  style={[styles.previewSwatch, { backgroundColor: color.hex }]}
                />
              ))}
            </View>
            {paletteName && (
              <Text style={styles.previewName}>{paletteName}</Text>
            )}
          </View>

          {/* Export Options */}
          <ScrollView
            style={styles.optionsContainer}
            contentContainerStyle={styles.optionsContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Image</Text>
            <View style={styles.optionsRow}>
              {exportOptions
                .filter((o) => o.id === 'png')
                .map((option) => (
                  <ExportOptionButton
                    key={option.id}
                    option={option}
                    isLoading={isExporting && exportingId === option.id}
                    disabled={isExporting}
                    onPress={() => handleExport(option.id, option.action)}
                  />
                ))}
            </View>

            <Text style={styles.sectionTitle}>Copy to Clipboard</Text>
            <View style={styles.optionsGrid}>
              {exportOptions
                .filter((o) => ['hex', 'rgb', 'css', 'scss', 'tailwind', 'swift', 'android'].includes(o.id))
                .map((option) => (
                  <ExportOptionButton
                    key={option.id}
                    option={option}
                    isLoading={isExporting && exportingId === option.id}
                    disabled={isExporting}
                    onPress={() => handleExport(option.id, option.action)}
                    compact
                  />
                ))}
            </View>

            <Text style={styles.sectionTitle}>Files</Text>
            <View style={styles.optionsGrid}>
              {exportOptions
                .filter((o) => ['json', 'ase'].includes(o.id))
                .map((option) => (
                  <ExportOptionButton
                    key={option.id}
                    option={option}
                    isLoading={isExporting && exportingId === option.id}
                    disabled={isExporting}
                    onPress={() => handleExport(option.id, option.action)}
                    compact
                  />
                ))}
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

interface ExportOptionButtonProps {
  option: ExportOption;
  isLoading: boolean;
  disabled: boolean;
  onPress: () => void;
  compact?: boolean;
}

function ExportOptionButton({
  option,
  isLoading,
  disabled,
  onPress,
  compact = false,
}: ExportOptionButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        compact ? styles.optionButtonCompact : styles.optionButton,
        pressed && styles.optionButtonPressed,
        disabled && !isLoading && styles.optionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Text style={styles.optionIcon}>{option.icon}</Text>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionLabel}>{option.label}</Text>
            {!compact && (
              <Text style={styles.optionDescription}>{option.description}</Text>
            )}
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  overlayPressable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderWidth: 1,
    borderColor: '#333',
    borderBottomWidth: 0,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    borderRadius: 16,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#888',
    lineHeight: 26,
  },
  hiddenPreview: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  paletteImageContainer: {
    width: 400,
    backgroundColor: '#1a1a1a',
  },
  paletteImage: {
    padding: 20,
  },
  paletteImageHeader: {
    paddingBottom: 16,
  },
  paletteImageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  paletteImageSwatches: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
  },
  paletteImageSwatch: {
    flex: 1,
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  paletteImageHex: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  paletteImageColorName: {
    fontSize: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  paletteImageFooter: {
    paddingTop: 12,
    alignItems: 'center',
  },
  paletteImageWatermark: {
    fontSize: 12,
    color: '#666',
  },
  previewSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  previewColors: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewSwatch: {
    flex: 1,
  },
  previewName: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  optionsContainer: {
    maxHeight: 400,
  },
  optionsContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
  },
  optionsRow: {
    gap: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  optionButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
    width: (SCREEN_WIDTH - 40 - 12) / 2,
  },
  optionButtonPressed: {
    backgroundColor: '#333',
    transform: [{ scale: 0.98 }],
  },
  optionButtonDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  optionDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});

export default ExportBottomSheet;
