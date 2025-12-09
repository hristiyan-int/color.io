import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
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
import { usePaletteStore } from '@/store/paletteStore';
import { paletteService } from '@/services/palettes';
import { isLightColor } from '@/utils/colors';
import { ExportBottomSheet, ShareBottomSheet, Comments } from '@/components';
import type { Palette, PaletteColor } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PaletteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectPalette, selectedPalette, startEditing } = usePaletteStore();

  const [palette, setPalette] = useState<Palette | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const selectedColor = palette?.colors[selectedColorIndex] || null;

  useEffect(() => {
    if (id) {
      fetchPalette(id);
    }
  }, [id]);

  const fetchPalette = async (paletteId: string) => {
    try {
      setIsLoading(true);
      const data = await paletteService.getPalette(paletteId);
      if (data) {
        setPalette(data);
        setLikesCount(data.likesCount);
        selectPalette(data);
        // Check if user owns this palette
        // This would need current user ID - for now assume owner if we got here from library
        setIsOwner(true);

        // Check if liked
        const liked = await paletteService.isLiked(paletteId);
        setIsLiked(liked);
      }
    } catch (error) {
      console.error('Failed to fetch palette:', error);
      Alert.alert('Error', 'Failed to load palette');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = useCallback(async () => {
    if (!palette) return;

    try {
      if (isLiked) {
        await paletteService.unlikePalette(palette.id);
        setIsLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      } else {
        await paletteService.likePalette(palette.id);
        setIsLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update like');
    }
  }, [palette, isLiked]);

  const handleEdit = useCallback(() => {
    if (!palette) return;
    startEditing(palette);
    router.push('/palette-editor');
  }, [palette, startEditing, router]);

  const handleShare = useCallback(() => {
    if (!palette) return;
    setShowShareSheet(true);
  }, [palette]);

  const handleExport = useCallback(() => {
    if (!palette) return;
    setShowExportSheet(true);
  }, [palette]);

  const handlePublicToggle = useCallback(async (isPublic: boolean) => {
    if (!palette) return;

    try {
      await paletteService.updatePalette(palette.id, { isPublic });
      setPalette((prev) => prev ? { ...prev, isPublic } : null);
    } catch (error) {
      throw error;
    }
  }, [palette]);

  const handleCopyColor = useCallback(async (format: 'hex' | 'rgb' | 'hsl') => {
    if (!selectedColor) return;

    let text = '';
    switch (format) {
      case 'hex':
        text = selectedColor.hex;
        break;
      case 'rgb':
        text = `rgb(${selectedColor.rgb.r}, ${selectedColor.rgb.g}, ${selectedColor.rgb.b})`;
        break;
      case 'hsl':
        text = `hsl(${selectedColor.hsl.h}, ${selectedColor.hsl.s}%, ${selectedColor.hsl.l}%)`;
        break;
    }

    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', `${text} copied to clipboard`);
  }, [selectedColor]);

  const handleDelete = useCallback(() => {
    if (!palette) return;

    Alert.alert(
      'Delete Palette',
      'Are you sure you want to delete this palette? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await paletteService.deletePalette(palette.id);
              router.replace('/(tabs)/library');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete palette');
            }
          },
        },
      ]
    );
  }, [palette, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading palette...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!palette) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Palette not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {palette.name}
          </Text>
          {palette.isPublic && (
            <View style={styles.publicBadge}>
              <Text style={styles.publicBadgeText}>Public</Text>
            </View>
          )}
        </View>
        <Pressable style={styles.headerButton} onPress={handleLike}>
          <Text style={styles.likeIcon}>{isLiked ? '❤️' : '🤍'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Source Image */}
        {palette.sourceImageUrl && (
          <Animated.View entering={FadeIn} style={styles.sourceImageContainer}>
            <Image
              source={{ uri: palette.sourceImageUrl }}
              style={styles.sourceImage}
              resizeMode="cover"
            />
          </Animated.View>
        )}

        {/* Color Swatches */}
        <View style={styles.swatchesContainer}>
          <View style={styles.swatchesRow}>
            {palette.colors.map((color, index) => (
              <ColorSwatch
                key={color.id}
                color={color}
                index={index}
                isSelected={selectedColorIndex === index}
                onPress={() => setSelectedColorIndex(index)}
              />
            ))}
          </View>
        </View>

        {/* Selected Color Details */}
        {selectedColor && (
          <Animated.View entering={FadeInDown} style={styles.colorDetails}>
            <View style={styles.colorDetailsHeader}>
              <View
                style={[styles.colorPreview, { backgroundColor: selectedColor.hex }]}
              />
              <View style={styles.colorInfo}>
                <Text style={styles.colorName}>
                  {selectedColor.name || 'Custom Color'}
                </Text>
                <Text style={styles.colorPosition}>
                  Color {selectedColorIndex + 1} of {palette.colors.length}
                </Text>
              </View>
            </View>

            {/* Color Values */}
            <View style={styles.colorValues}>
              <Pressable
                style={styles.colorValue}
                onPress={() => handleCopyColor('hex')}
              >
                <Text style={styles.colorValueLabel}>HEX</Text>
                <View style={styles.colorValueContent}>
                  <Text style={styles.colorValueText}>{selectedColor.hex}</Text>
                  <Text style={styles.copyIcon}>📋</Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.colorValue}
                onPress={() => handleCopyColor('rgb')}
              >
                <Text style={styles.colorValueLabel}>RGB</Text>
                <View style={styles.colorValueContent}>
                  <Text style={styles.colorValueText}>
                    {selectedColor.rgb.r}, {selectedColor.rgb.g}, {selectedColor.rgb.b}
                  </Text>
                  <Text style={styles.copyIcon}>📋</Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.colorValue}
                onPress={() => handleCopyColor('hsl')}
              >
                <Text style={styles.colorValueLabel}>HSL</Text>
                <View style={styles.colorValueContent}>
                  <Text style={styles.colorValueText}>
                    {selectedColor.hsl.h}°, {selectedColor.hsl.s}%, {selectedColor.hsl.l}%
                  </Text>
                  <Text style={styles.copyIcon}>📋</Text>
                </View>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Palette Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{palette.colors.length}</Text>
            <Text style={styles.statLabel}>Colors</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{likesCount}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {new Date(palette.createdAt).toLocaleDateString()}
            </Text>
            <Text style={styles.statLabel}>Created</Text>
          </View>
        </View>

        {/* Description */}
        {palette.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{palette.description}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {isOwner && (
            <Pressable style={styles.actionButton} onPress={handleEdit}>
              <Text style={styles.actionIcon}>✏️</Text>
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
          )}

          <Pressable style={styles.actionButton} onPress={handleShare}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionText}>Share</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleExport}>
            <Text style={styles.actionIcon}>📁</Text>
            <Text style={styles.actionText}>Export</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => setShowComments(true)}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>Comments</Text>
          </Pressable>
        </View>

        {/* Delete Button (Owner only) */}
        {isOwner && (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Palette</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Export Bottom Sheet */}
      <ExportBottomSheet
        visible={showExportSheet}
        onClose={() => setShowExportSheet(false)}
        colors={palette.colors}
        paletteName={palette.name}
        sourceImageUri={palette.sourceImageUrl}
      />

      {/* Share Bottom Sheet */}
      <ShareBottomSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        colors={palette.colors}
        palette={palette}
        paletteName={palette.name}
        isPublic={palette.isPublic}
        onPublicToggle={isOwner ? handlePublicToggle : undefined}
      />

      {/* Comments Modal */}
      {showComments && (
        <View style={styles.commentsModal}>
          <Comments
            paletteId={palette.id}
            onClose={() => setShowComments(false)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// Color Swatch Component
interface ColorSwatchProps {
  color: PaletteColor;
  index: number;
  isSelected: boolean;
  onPress: () => void;
}

function ColorSwatch({ color, index, isSelected, onPress }: ColorSwatchProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.1 : 1, {
      damping: 12,
      stiffness: 180,
    });
  }, [isSelected]);

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify()}
        style={[
          styles.swatch,
          { backgroundColor: color.hex },
          isSelected && styles.swatchSelected,
          animatedStyle,
        ]}
      >
        {isSelected && (
          <View
            style={[
              styles.swatchCheck,
              { backgroundColor: isLightColor(color.rgb) ? '#000' : '#fff' },
            ]}
          >
            <Text
              style={{
                color: isLightColor(color.rgb) ? '#fff' : '#000',
                fontSize: 10,
              }}
            >
              ✓
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  publicBadge: {
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  publicBadgeText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
  },
  likeIcon: {
    fontSize: 22,
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
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
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
    height: 180,
  },
  swatchesContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  swatchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  swatch: {
    width: 52,
    height: 52,
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
  colorInfo: {
    flex: 1,
  },
  colorName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  colorPosition: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  colorValues: {
    gap: 10,
  },
  colorValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d0d0d',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  colorValueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 40,
  },
  colorValueContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  colorValueText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#fff',
  },
  copyIcon: {
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  descriptionContainer: {
    marginHorizontal: 24,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 24,
    gap: 12,
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
  deleteButton: {
    marginHorizontal: 24,
    marginTop: 24,
    backgroundColor: '#FF6B6B20',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B40',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FF6B6B',
  },
  commentsModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
});
