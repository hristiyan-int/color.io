import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { tagsService } from '@/services/tags';
import { useCommunityStore } from '@/store/communityStore';
import { useAuthStore } from '@/store/authStore';
import type { Tag, TagCategory, FeedPalette } from '@/types';

const CATEGORY_LABELS: Record<TagCategory, string> = {
  mood: 'Mood',
  style: 'Style',
  season: 'Season',
  purpose: 'Purpose',
};

const CATEGORY_COLORS: Record<TagCategory, string> = {
  mood: '#FF6B6B',
  style: '#4ECDC4',
  season: '#FFE66D',
  purpose: '#95E1D3',
};

type ViewMode = 'browse' | 'palettes';

export default function TagsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tag?: string }>();
  const { user } = useAuthStore();
  const { toggleLike } = useCommunityStore();

  const [viewMode, setViewMode] = useState<ViewMode>(params.tag ? 'palettes' : 'browse');
  const [selectedTag, setSelectedTag] = useState<string | null>(params.tag || null);
  const [popularTags, setPopularTags] = useState<Tag[]>([]);
  const [tagsByCategory, setTagsByCategory] = useState<Record<TagCategory, Tag[]>>({
    mood: [],
    style: [],
    season: [],
    purpose: [],
  });
  const [palettes, setPalettes] = useState<FeedPalette[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    if (params.tag) {
      setSelectedTag(params.tag);
      setViewMode('palettes');
      loadPalettesByTag(params.tag, true);
    }
  }, [params.tag]);

  const loadTags = async () => {
    try {
      setIsLoading(true);
      const [popular, grouped] = await Promise.all([
        tagsService.getPopularTags(20),
        tagsService.getTagsByCategory(),
      ]);
      setPopularTags(popular);
      setTagsByCategory(grouped);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPalettesByTag = async (tagName: string, refresh = false) => {
    try {
      if (refresh) {
        setIsLoading(true);
        setPalettes([]);
        setCursor(undefined);
      } else {
        setIsLoadingMore(true);
      }

      const result = await tagsService.getPalettesByTag(
        tagName,
        refresh ? undefined : cursor,
        20
      );

      if (refresh) {
        setPalettes(result.palettes);
      } else {
        setPalettes((prev) => [...prev, ...result.palettes]);
      }
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load palettes:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleTagPress = (tag: Tag) => {
    setSelectedTag(tag.name);
    setViewMode('palettes');
    loadPalettesByTag(tag.name, true);
  };

  const handleBackToBrowse = () => {
    setViewMode('browse');
    setSelectedTag(null);
    setPalettes([]);
    setCursor(undefined);
    setHasMore(true);
  };

  const handleLikePress = async (palette: FeedPalette) => {
    if (!user) return;
    try {
      await toggleLike(palette.id);
      // Update local state
      setPalettes((prev) =>
        prev.map((p) =>
          p.id === palette.id
            ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
            : p
        )
      );
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && selectedTag) {
      loadPalettesByTag(selectedTag, false);
    }
  }, [isLoadingMore, hasMore, selectedTag, cursor]);

  const renderTagChip = (tag: Tag, size: 'small' | 'large' = 'small') => {
    const categoryColor = tag.category ? CATEGORY_COLORS[tag.category] : '#666';

    return (
      <Pressable
        key={tag.id}
        style={[styles.tagChip, size === 'large' && styles.tagChipLarge]}
        onPress={() => handleTagPress(tag)}
      >
        {tag.category && (
          <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
        )}
        <Text style={[styles.tagChipText, size === 'large' && styles.tagChipTextLarge]}>
          #{tag.name}
        </Text>
        <Text style={styles.tagCount}>{tag.usageCount}</Text>
      </Pressable>
    );
  };

  const renderPalette = ({ item }: { item: FeedPalette }) => (
    <Pressable
      style={styles.paletteCard}
      onPress={() => router.push(`/palette/${item.id}`)}
    >
      <View style={styles.paletteColors}>
        {item.colors.slice(0, 5).map((color, index) => (
          <View
            key={color.id || index}
            style={[styles.colorSwatch, { backgroundColor: color.hex }]}
          />
        ))}
      </View>
      <View style={styles.paletteInfo}>
        <View style={styles.paletteHeader}>
          <Text style={styles.paletteName} numberOfLines={1}>
            {item.name}
          </Text>
          <Pressable
            style={styles.likeButton}
            onPress={() => handleLikePress(item)}
            hitSlop={8}
          >
            <Text style={styles.likeIcon}>{item.isLiked ? '❤️' : '🤍'}</Text>
            <Text style={styles.likeCount}>{item.likesCount}</Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.userRow}
          onPress={() => router.push(`/user/${item.user.username}`)}
        >
          {item.user.avatarUrl ? (
            <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(item.user.displayName || item.user.username).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.username}>@{item.user.username}</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  const renderBrowseView = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Popular Tags */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popular Tags</Text>
        <View style={styles.tagsGrid}>
          {popularTags.slice(0, 12).map((tag) => renderTagChip(tag, 'large'))}
        </View>
      </View>

      {/* Tags by Category */}
      {(Object.keys(CATEGORY_LABELS) as TagCategory[]).map((category) => (
        <View key={category} style={styles.section}>
          <View style={styles.categoryHeader}>
            <View
              style={[styles.categoryIndicator, { backgroundColor: CATEGORY_COLORS[category] }]}
            />
            <Text style={styles.sectionTitle}>{CATEGORY_LABELS[category]}</Text>
          </View>
          <View style={styles.tagsGrid}>
            {tagsByCategory[category].map((tag) => renderTagChip(tag))}
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderPalettesView = () => (
    <FlashList
      data={palettes}
      renderItem={renderPalette}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏷️</Text>
            <Text style={styles.emptyTitle}>No palettes yet</Text>
            <Text style={styles.emptySubtitle}>
              Be the first to create a palette with #{selectedTag}
            </Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        isLoadingMore ? (
          <View style={styles.loadingMore}>
            <ActivityIndicator color="#888" />
          </View>
        ) : null
      }
      estimatedItemSize={150}
    />
  );

  if (isLoading && viewMode === 'browse') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.loadingText}>Loading tags...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={viewMode === 'palettes' ? handleBackToBrowse : () => router.back()}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {viewMode === 'palettes' ? `#${selectedTag}` : 'Browse Tags'}
        </Text>
        <Pressable
          style={styles.searchButton}
          onPress={() => router.push('/search')}
        >
          <Text style={styles.searchIcon}>🔍</Text>
        </Pressable>
      </View>

      {/* Tag Info Banner (when viewing palettes) */}
      {viewMode === 'palettes' && selectedTag && (
        <View style={styles.tagBanner}>
          <View style={styles.tagBannerContent}>
            <Text style={styles.tagBannerName}>#{selectedTag}</Text>
            <Text style={styles.tagBannerCount}>
              {palettes.length}{hasMore ? '+' : ''} palettes
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      {viewMode === 'browse' ? renderBrowseView() : renderPalettesView()}

      {/* Loading Overlay for Palettes View */}
      {isLoading && viewMode === 'palettes' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  backIcon: {
    fontSize: 20,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  tagChipLarge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tagChipText: {
    fontSize: 13,
    color: '#fff',
  },
  tagChipTextLarge: {
    fontSize: 15,
    fontWeight: '500',
  },
  tagCount: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  tagBanner: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tagBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagBannerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  tagBannerCount: {
    fontSize: 14,
    color: '#888',
  },
  listContent: {
    padding: 16,
  },
  paletteCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  paletteColors: {
    flexDirection: 'row',
    height: 80,
  },
  colorSwatch: {
    flex: 1,
  },
  paletteInfo: {
    padding: 12,
  },
  paletteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paletteName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeIcon: {
    fontSize: 16,
  },
  likeCount: {
    fontSize: 12,
    color: '#888',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  username: {
    fontSize: 13,
    color: '#888',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
