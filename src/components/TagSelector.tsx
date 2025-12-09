import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { tagsService } from '@/services/tags';
import type { Tag, TagCategory } from '@/types';

const MAX_TAGS = 5;

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

interface TagSelectorProps {
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  maxTags?: number;
}

export function TagSelector({
  selectedTags,
  onTagsChange,
  maxTags = MAX_TAGS,
}: TagSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [tagsByCategory, setTagsByCategory] = useState<Record<TagCategory, Tag[]>>({
    mood: [],
    style: [],
    season: [],
    purpose: [],
  });
  const [searchResults, setSearchResults] = useState<Tag[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TagCategory | null>(null);

  // Load tags on mount
  useEffect(() => {
    loadTags();
  }, []);

  // Search tags when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchTags(searchQuery);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery]);

  const loadTags = async () => {
    try {
      setIsLoading(true);
      const grouped = await tagsService.getTagsByCategory();
      setTagsByCategory(grouped);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchTags = useCallback(async (query: string) => {
    try {
      setIsSearching(true);
      const results = await tagsService.searchTags(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search tags:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleTagPress = (tag: Tag) => {
    const isSelected = selectedTags.some((t) => t.id === tag.id);

    if (isSelected) {
      // Remove tag
      onTagsChange(selectedTags.filter((t) => t.id !== tag.id));
    } else if (selectedTags.length < maxTags) {
      // Add tag
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleCreateTag = async () => {
    const tagName = searchQuery.trim().toLowerCase();
    if (!tagName || selectedTags.length >= maxTags) return;

    // Check if tag already exists in selection
    if (selectedTags.some((t) => t.name === tagName)) return;

    try {
      const newTag = await tagsService.getOrCreateTag(tagName);
      onTagsChange([...selectedTags, newTag]);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const isTagSelected = (tag: Tag) => selectedTags.some((t) => t.id === tag.id);
  const canAddMore = selectedTags.length < maxTags;

  const renderTagChip = (tag: Tag, showCategory: boolean = false) => {
    const isSelected = isTagSelected(tag);
    const categoryColor = tag.category ? CATEGORY_COLORS[tag.category] : '#666';

    return (
      <Pressable
        key={tag.id}
        style={[
          styles.tagChip,
          isSelected && styles.tagChipSelected,
          !canAddMore && !isSelected && styles.tagChipDisabled,
        ]}
        onPress={() => handleTagPress(tag)}
        disabled={!canAddMore && !isSelected}
      >
        {showCategory && tag.category && (
          <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
        )}
        <Text
          style={[
            styles.tagChipText,
            isSelected && styles.tagChipTextSelected,
          ]}
        >
          #{tag.name}
        </Text>
        {isSelected && (
          <Text style={styles.removeIcon}>×</Text>
        )}
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#888" size="small" />
        <Text style={styles.loadingText}>Loading tags...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={styles.sectionLabel}>
            Selected ({selectedTags.length}/{maxTags})
          </Text>
          <View style={styles.selectedTags}>
            {selectedTags.map((tag) => (
              <Animated.View
                key={tag.id}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                layout={Layout.springify()}
              >
                {renderTagChip(tag, true)}
              </Animated.View>
            ))}
          </View>
        </View>
      )}

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search or create tag..."
          placeholderTextColor="#666"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.trim() && !searchResults.some((t) => t.name === searchQuery.trim().toLowerCase()) && canAddMore && (
          <Pressable style={styles.createButton} onPress={handleCreateTag}>
            <Text style={styles.createButtonText}>+ Create</Text>
          </Pressable>
        )}
      </View>

      {/* Search Results */}
      {searchQuery.trim() && (
        <View style={styles.searchResults}>
          {isSearching ? (
            <ActivityIndicator color="#888" size="small" />
          ) : searchResults.length > 0 ? (
            <View style={styles.tagsGrid}>
              {searchResults.map((tag) => renderTagChip(tag, true))}
            </View>
          ) : (
            <Text style={styles.noResults}>
              No tags found. Press "Create" to add "{searchQuery.trim()}"
            </Text>
          )}
        </View>
      )}

      {/* Category Tabs */}
      {!searchQuery.trim() && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {(Object.keys(CATEGORY_LABELS) as TagCategory[]).map((category) => (
              <Pressable
                key={category}
                style={[
                  styles.categoryTab,
                  activeCategory === category && styles.categoryTabActive,
                ]}
                onPress={() => setActiveCategory(
                  activeCategory === category ? null : category
                )}
              >
                <View
                  style={[
                    styles.categoryIndicator,
                    { backgroundColor: CATEGORY_COLORS[category] },
                  ]}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    activeCategory === category && styles.categoryTabTextActive,
                  ]}
                >
                  {CATEGORY_LABELS[category]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Tags List */}
          <ScrollView
            style={styles.tagsList}
            contentContainerStyle={styles.tagsListContent}
            showsVerticalScrollIndicator={false}
          >
            {activeCategory ? (
              // Show single category
              <View style={styles.categorySection}>
                <View style={styles.tagsGrid}>
                  {tagsByCategory[activeCategory].map((tag) => renderTagChip(tag))}
                </View>
              </View>
            ) : (
              // Show all categories
              (Object.keys(CATEGORY_LABELS) as TagCategory[]).map((category) => (
                <View key={category} style={styles.categorySection}>
                  <View style={styles.categoryHeader}>
                    <View
                      style={[
                        styles.categoryIndicator,
                        { backgroundColor: CATEGORY_COLORS[category] },
                      ]}
                    />
                    <Text style={styles.categoryTitle}>
                      {CATEGORY_LABELS[category]}
                    </Text>
                  </View>
                  <View style={styles.tagsGrid}>
                    {tagsByCategory[category].slice(0, 8).map((tag) => renderTagChip(tag))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  selectedSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  createButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  searchResults: {
    marginBottom: 16,
  },
  noResults: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 12,
  },
  categoryTabs: {
    flexGrow: 0,
    marginBottom: 12,
  },
  categoryTabsContent: {
    paddingRight: 16,
    gap: 8,
  },
  categoryTab: {
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
  categoryTabActive: {
    backgroundColor: '#333',
    borderColor: '#444',
  },
  categoryIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryTabText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#fff',
  },
  tagsList: {
    flex: 1,
  },
  tagsListContent: {
    paddingBottom: 16,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
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
  tagChipSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  tagChipDisabled: {
    opacity: 0.4,
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
  tagChipTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  removeIcon: {
    fontSize: 16,
    color: '#000',
    marginLeft: 2,
  },
});
