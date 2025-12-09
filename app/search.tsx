import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useCommunityStore } from '@/store/communityStore';
import { useAuthStore } from '@/store/authStore';
import { tagsService } from '@/services/tags';
import type { FeedPalette, Tag } from '@/types';

// Simple in-memory storage for recent searches (will be lost on app restart)
// For persistent storage, you could use expo-secure-store or MMKV from a store
let recentSearchesCache: string[] = [];
const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 10;

type SearchFilter = 'all' | 'most_liked' | 'recent' | 'by_creator';

const FILTER_OPTIONS: { value: SearchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'most_liked', label: 'Most Liked' },
  { value: 'recent', label: 'Recent' },
  { value: 'by_creator', label: 'By Creator' },
];

export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    searchQuery,
    searchResults,
    isSearching,
    setSearchQuery,
    searchPalettes,
    clearSearch,
    toggleLike,
  } = useCommunityStore();

  const [inputValue, setInputValue] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularTags, setPopularTags] = useState<Tag[]>([]);
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Load recent searches and popular tags on mount
  useEffect(() => {
    loadRecentSearches();
    loadPopularTags();
  }, []);

  const loadRecentSearches = () => {
    setRecentSearches(recentSearchesCache);
  };

  const loadPopularTags = async () => {
    try {
      const tags = await tagsService.getPopularTags(15);
      setPopularTags(tags);
    } catch (error) {
      console.error('Failed to load popular tags:', error);
    }
  };

  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const updated = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(
      0,
      MAX_RECENT_SEARCHES
    );
    setRecentSearches(updated);
    recentSearchesCache = updated;
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    recentSearchesCache = [];
  };

  const removeRecentSearch = (query: string) => {
    const updated = recentSearches.filter((s) => s !== query);
    setRecentSearches(updated);
    recentSearchesCache = updated;
  };

  const handleSearch = useCallback(() => {
    const query = inputValue.trim();
    if (query) {
      saveRecentSearch(query);
      searchPalettes(query);
    }
  }, [inputValue, searchPalettes]);

  const handleTagPress = (tag: Tag) => {
    setInputValue(tag.name);
    saveRecentSearch(`#${tag.name}`);
    searchPalettes('', tag.name);
  };

  const handleRecentPress = (query: string) => {
    setInputValue(query.replace(/^#/, ''));
    if (query.startsWith('#')) {
      searchPalettes('', query.slice(1));
    } else {
      searchPalettes(query);
    }
  };

  const handleClear = () => {
    setInputValue('');
    clearSearch();
  };

  const handleLikePress = async (palette: FeedPalette) => {
    if (!user) return;
    try {
      await toggleLike(palette.id);
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleFilterChange = (filter: SearchFilter) => {
    setActiveFilter(filter);
    setShowFilters(false);
    // Re-search with new filter if there's an active query
    if (inputValue.trim()) {
      handleSearch();
    }
  };

  // Sort results based on filter
  const getSortedResults = useCallback(() => {
    const results = [...searchResults];

    switch (activeFilter) {
      case 'most_liked':
        return results.sort((a, b) => b.likesCount - a.likesCount);
      case 'recent':
        return results.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'by_creator':
        return results.sort((a, b) =>
          a.user.username.localeCompare(b.user.username)
        );
      default:
        return results;
    }
  }, [searchResults, activeFilter]);

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

  const renderSuggestions = () => (
    <ScrollView
      style={styles.suggestionsScrollView}
      contentContainerStyle={styles.suggestionsContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.suggestionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            <Pressable onPress={clearRecentSearches} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.recentList}>
            {recentSearches.map((query, index) => (
              <Pressable
                key={`${query}-${index}`}
                style={styles.recentItem}
                onPress={() => handleRecentPress(query)}
              >
                <Text style={styles.recentIcon}>🕐</Text>
                <Text style={styles.recentText}>{query}</Text>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeRecentSearch(query)}
                  hitSlop={8}
                >
                  <Text style={styles.removeIcon}>×</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Popular Tags */}
      <View style={styles.suggestionsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Tags</Text>
          <Pressable onPress={() => router.push('/tags')} hitSlop={8}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>
        <View style={styles.tagsContainer}>
          {popularTags.map((tag) => (
            <Pressable
              key={tag.id}
              style={styles.tagChip}
              onPress={() => handleTagPress(tag)}
            >
              <Text style={styles.tagText}>#{tag.name}</Text>
              <Text style={styles.tagCount}>{tag.usageCount}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Search Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Search Tips</Text>
        <View style={styles.tipsList}>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>🎨</Text>
            <Text style={styles.tipText}>Search by palette name or description</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>🏷️</Text>
            <Text style={styles.tipText}>Use tags like "minimalist" or "vintage"</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>👤</Text>
            <Text style={styles.tipText}>Search for creators by username</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>🔵</Text>
            <Text style={styles.tipText}>Enter a HEX code to find similar colors</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderEmpty = () => {
    if (isSearching) return null;
    if (!searchQuery) return renderSuggestions();

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptySubtitle}>
          Try searching for different keywords or tags
        </Text>
        <Pressable
          style={styles.browseTags}
          onPress={() => router.push('/tags')}
        >
          <Text style={styles.browseTagsText}>Browse Tags</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Search palettes, tags, creators..."
            placeholderTextColor="#666"
            autoFocus
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {inputValue.length > 0 && (
            <Pressable onPress={handleClear} hitSlop={8}>
              <Text style={styles.clearIcon}>×</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter Bar */}
      {searchResults.length > 0 && (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {FILTER_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.filterChip,
                  activeFilter === option.value && styles.filterChipActive,
                ]}
                onPress={() => handleFilterChange(option.value)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === option.value && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <FlashList
          data={getSortedResults()}
          renderItem={renderPalette}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          ListHeaderComponent={
            searchResults.length > 0 ? (
              <Text style={styles.resultsCount}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
          estimatedItemSize={150}
        />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
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
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  clearIcon: {
    fontSize: 20,
    color: '#666',
  },
  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  filterChipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterChipText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#000',
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
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
  },
  suggestionsScrollView: {
    flex: 1,
  },
  suggestionsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  suggestionsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  clearText: {
    fontSize: 13,
    color: '#888',
  },
  viewAllText: {
    fontSize: 13,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  recentList: {
    gap: 4,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    gap: 10,
  },
  recentIcon: {
    fontSize: 14,
  },
  recentText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  removeButton: {
    padding: 4,
  },
  removeIcon: {
    fontSize: 18,
    color: '#666',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  tagText: {
    fontSize: 14,
    color: '#fff',
  },
  tagCount: {
    fontSize: 11,
    color: '#666',
  },
  tipsSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  tipsList: {
    gap: 10,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipIcon: {
    fontSize: 16,
  },
  tipText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 20,
  },
  browseTags: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  browseTagsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  resultsCount: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
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
  likeButton: {},
  likeIcon: {
    fontSize: 18,
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
});
