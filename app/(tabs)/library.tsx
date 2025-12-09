import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { usePaletteStore } from '@/store/paletteStore';
import { paletteService } from '@/services/palettes';
import { isLightColor } from '@/utils/colors';
import type { Palette } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 16) / 2;
const DELETE_THRESHOLD = -80;

type SortOption = 'recent' | 'name' | 'likes';

export default function LibraryScreen() {
  const router = useRouter();
  const { palettes, setPalettes, removePalette, isLoadingPalettes, setIsLoadingPalettes } = usePaletteStore();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Fetch palettes on mount
  useEffect(() => {
    fetchPalettes();
  }, []);

  const fetchPalettes = async () => {
    try {
      setIsLoadingPalettes(true);
      const data = await paletteService.getUserPalettes();
      setPalettes(data);
    } catch (error) {
      console.error('Failed to fetch palettes:', error);
    } finally {
      setIsLoadingPalettes(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPalettes();
    setRefreshing(false);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert(
      'Delete Palette',
      'Are you sure you want to delete this palette?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await paletteService.deletePalette(id);
              removePalette(id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete palette');
            }
          },
        },
      ]
    );
  }, [removePalette]);

  // Filter and sort palettes
  const filteredPalettes = useMemo(() => {
    let result = [...palettes];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    switch (sortOption) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'likes':
        result.sort((a, b) => b.likesCount - a.likesCount);
        break;
      case 'recent':
      default:
        result.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return result;
  }, [palettes, searchQuery, sortOption]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const renderPalette = ({ item, index }: { item: Palette; index: number }) => (
    <PaletteCard
      palette={item}
      index={index}
      onPress={() => router.push(`/palette/${item.id}`)}
      onDelete={() => handleDelete(item.id)}
      formatDate={formatDate}
    />
  );

  if (isLoadingPalettes && palettes.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading palettes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Library</Text>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.headerButton}
              onPress={() => setShowSearch(!showSearch)}
            >
              <Text style={styles.headerButtonIcon}>{showSearch ? '×' : '🔍'}</Text>
            </Pressable>
            <Pressable
              style={styles.sortButton}
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              <Text style={styles.sortButtonText}>
                {sortOption === 'recent' ? 'Recent' : sortOption === 'name' ? 'Name' : 'Likes'}
              </Text>
              <Text style={styles.sortButtonIcon}>▼</Text>
            </Pressable>
          </View>
        </View>

        {/* Sort Menu */}
        {showSortMenu && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            style={styles.sortMenu}
          >
            {(['recent', 'name', 'likes'] as SortOption[]).map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.sortMenuItem,
                  sortOption === option && styles.sortMenuItemActive,
                ]}
                onPress={() => {
                  setSortOption(option);
                  setShowSortMenu(false);
                }}
              >
                <Text
                  style={[
                    styles.sortMenuItemText,
                    sortOption === option && styles.sortMenuItemTextActive,
                  ]}
                >
                  {option === 'recent' ? 'Most Recent' : option === 'name' ? 'Name (A-Z)' : 'Most Liked'}
                </Text>
                {sortOption === option && <Text style={styles.sortMenuCheck}>✓</Text>}
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* Search Bar */}
        {showSearch && (
          <Animated.View
            entering={SlideInRight.springify()}
            exiting={SlideOutRight.springify()}
            style={styles.searchContainer}
          >
            <TextInput
              style={styles.searchInput}
              placeholder="Search palettes..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable style={styles.clearSearch} onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchText}>×</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Palettes Count */}
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {filteredPalettes.length} {filteredPalettes.length === 1 ? 'palette' : 'palettes'}
          </Text>
        </View>

        {/* Palettes List */}
        {filteredPalettes.length === 0 ? (
          <View style={styles.emptyState}>
            {searchQuery ? (
              <>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptySubtitle}>
                  Try a different search term
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyTitle}>No palettes saved</Text>
                <Text style={styles.emptySubtitle}>
                  Your saved color palettes will appear here
                </Text>
                <Pressable
                  style={styles.createButton}
                  onPress={() => router.push('/(tabs)')}
                >
                  <Text style={styles.createButtonText}>Create Your First Palette</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <FlashList
            data={filteredPalettes}
            renderItem={renderPalette}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#fff"
              />
            }
            estimatedItemSize={160}
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// Swipeable Palette Card Component
interface PaletteCardProps {
  palette: Palette;
  index: number;
  onPress: () => void;
  onDelete: () => void;
  formatDate: (date: string) => string;
}

function PaletteCard({ palette, index, onPress, onDelete, formatDate }: PaletteCardProps) {
  const translateX = useSharedValue(0);
  const isDeleting = useSharedValue(false);

  const handleDelete = useCallback(() => {
    onDelete();
  }, [onDelete]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, DELETE_THRESHOLD - 20);
      }
    })
    .onEnd((e) => {
      if (e.translationX < DELETE_THRESHOLD) {
        runOnJS(handleDelete)();
      }
      translateX.value = withSpring(0);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -20 ? 1 : 0,
    transform: [
      { translateX: Math.min(0, translateX.value + CARD_WIDTH) },
    ],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={styles.cardContainer}
    >
      <Animated.View style={[styles.deleteButton, deleteButtonStyle]}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          <Pressable
            style={({ pressed }) => [
              styles.paletteCard,
              pressed && styles.paletteCardPressed,
            ]}
            onPress={onPress}
          >
            {/* Colors Preview */}
            <View style={styles.colorsPreview}>
              {palette.colors.slice(0, 6).map((color, idx) => (
                <View
                  key={color.id || idx}
                  style={[styles.colorSwatch, { backgroundColor: color.hex }]}
                />
              ))}
            </View>

            {/* Palette Info */}
            <View style={styles.paletteInfo}>
              <Text style={styles.paletteName} numberOfLines={1}>
                {palette.name}
              </Text>
              <View style={styles.paletteMetadata}>
                <Text style={styles.paletteDate}>{formatDate(palette.createdAt)}</Text>
                {palette.isPublic && (
                  <View style={styles.publicBadge}>
                    <Text style={styles.publicBadgeText}>Public</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Stats */}
            <View style={styles.paletteStats}>
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>🎨</Text>
                <Text style={styles.statValue}>{palette.colors.length}</Text>
              </View>
              {palette.likesCount > 0 && (
                <View style={styles.statItem}>
                  <Text style={styles.statIcon}>❤️</Text>
                  <Text style={styles.statValue}>{palette.likesCount}</Text>
                </View>
              )}
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonIcon: {
    fontSize: 20,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  sortButtonIcon: {
    color: '#888',
    fontSize: 10,
  },
  sortMenu: {
    position: 'absolute',
    top: 100,
    right: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sortMenuItemActive: {
    backgroundColor: '#333',
  },
  sortMenuItemText: {
    fontSize: 14,
    color: '#888',
  },
  sortMenuItemTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  sortMenuCheck: {
    color: '#4CAF50',
    fontSize: 14,
    marginLeft: 12,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  clearSearch: {
    position: 'absolute',
    right: 36,
    top: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    fontSize: 20,
    color: '#888',
  },
  countContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 13,
    color: '#666',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  listRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardContainer: {
    width: CARD_WIDTH,
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  paletteCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  paletteCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  colorsPreview: {
    flexDirection: 'row',
    height: 72,
  },
  colorSwatch: {
    flex: 1,
  },
  paletteInfo: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  paletteName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  paletteMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  paletteDate: {
    fontSize: 12,
    color: '#666',
  },
  publicBadge: {
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  publicBadgeText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '500',
  },
  paletteStats: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 12,
    color: '#888',
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
});
