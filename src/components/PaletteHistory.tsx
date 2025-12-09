import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
  SlideInRight,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useHistoryStore,
  historySelectors,
  type HistoryEntry,
  type DeletedPalette,
} from '@/store/historyStore';
import type { Palette, PaletteColor } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// Recent History Section
// ============================================

interface RecentHistorySectionProps {
  onSelectEntry?: (entry: HistoryEntry) => void;
  onSaveEntry?: (entry: HistoryEntry) => void;
  limit?: number;
}

export function RecentHistorySection({
  onSelectEntry,
  onSaveEntry,
  limit = 10,
}: RecentHistorySectionProps) {
  const history = useHistoryStore((state) =>
    historySelectors.getRecentHistory(state, limit)
  );
  const removeFromHistory = useHistoryStore((state) => state.removeFromHistory);
  const loadFromStorage = useHistoryStore((state) => state.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleRemove = useCallback(
    (id: string) => {
      Alert.alert(
        'Remove from History',
        'Are you sure you want to remove this from history?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              removeFromHistory(id);
            },
          },
        ]
      );
    },
    [removeFromHistory]
  );

  if (history.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent</Text>
        <Text style={styles.sectionCount}>{history.length} items</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {history.map((entry, index) => (
          <Animated.View
            key={entry.id}
            entering={SlideInRight.delay(index * 50).springify()}
            exiting={FadeOut}
            layout={Layout.springify()}
          >
            <HistoryCard
              entry={entry}
              onPress={() => onSelectEntry?.(entry)}
              onSave={!entry.savedPaletteId ? () => onSaveEntry?.(entry) : undefined}
              onRemove={() => handleRemove(entry.id)}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================
// History Card
// ============================================

interface HistoryCardProps {
  entry: HistoryEntry;
  onPress?: () => void;
  onSave?: () => void;
  onRemove?: () => void;
}

function HistoryCard({ entry, onPress, onSave, onRemove }: HistoryCardProps) {
  const timeAgo = getTimeAgo(entry.createdAt);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.historyCard,
        pressed && styles.historyCardPressed,
      ]}
      onPress={onPress}
      onLongPress={onRemove}
    >
      <View style={styles.historySwatches}>
        {entry.colors.slice(0, 5).map((color, i) => (
          <View
            key={i}
            style={[styles.historySwatch, { backgroundColor: color.hex }]}
          />
        ))}
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyName} numberOfLines={1}>
          {entry.name || `${entry.colors.length} colors`}
        </Text>
        <Text style={styles.historyTime}>{timeAgo}</Text>
      </View>
      {entry.savedPaletteId ? (
        <View style={styles.savedBadge}>
          <Text style={styles.savedBadgeText}>Saved</Text>
        </View>
      ) : onSave ? (
        <Pressable
          style={styles.saveButton}
          onPress={(e) => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSave();
          }}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// ============================================
// Deleted Palettes Section (Trash)
// ============================================

interface DeletedPalettesSectionProps {
  onRestore?: (palette: Palette) => void;
}

export function DeletedPalettesSection({ onRestore }: DeletedPalettesSectionProps) {
  const deletedPalettes = useHistoryStore((state) =>
    historySelectors.getRestorablePalettes(state)
  );
  const restorePalette = useHistoryStore((state) => state.restorePalette);
  const permanentlyDelete = useHistoryStore((state) => state.permanentlyDelete);
  const loadFromStorage = useHistoryStore((state) => state.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleRestore = useCallback(
    (id: string) => {
      const restored = restorePalette(id);
      if (restored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Return palette without deleted metadata
        const { deletedAt, expiresAt, ...palette } = restored;
        onRestore?.(palette);
      }
    },
    [restorePalette, onRestore]
  );

  const handlePermanentDelete = useCallback(
    (id: string, name: string) => {
      Alert.alert(
        'Permanently Delete',
        `Are you sure you want to permanently delete "${name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Forever',
            style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              permanentlyDelete(id);
            },
          },
        ]
      );
    },
    [permanentlyDelete]
  );

  if (deletedPalettes.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recently Deleted</Text>
        <Text style={styles.sectionSubtitle}>Tap to restore</Text>
      </View>
      <View style={styles.deletedList}>
        {deletedPalettes.map((palette, index) => (
          <Animated.View
            key={palette.id}
            entering={FadeInDown.delay(index * 50)}
            exiting={FadeOut}
            layout={Layout.springify()}
          >
            <DeletedPaletteCard
              palette={palette}
              onRestore={() => handleRestore(palette.id)}
              onDelete={() => handlePermanentDelete(palette.id, palette.name)}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ============================================
// Deleted Palette Card
// ============================================

interface DeletedPaletteCardProps {
  palette: DeletedPalette;
  onRestore: () => void;
  onDelete: () => void;
}

function DeletedPaletteCard({
  palette,
  onRestore,
  onDelete,
}: DeletedPaletteCardProps) {
  const daysRemaining = historySelectors.getDaysUntilExpiry(palette);
  const isExpiringSoon = daysRemaining <= 7;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.deletedCard,
        pressed && styles.deletedCardPressed,
      ]}
      onPress={onRestore}
    >
      <View style={styles.deletedSwatches}>
        {palette.colors.slice(0, 5).map((color, i) => (
          <View
            key={i}
            style={[styles.deletedSwatch, { backgroundColor: color.hex }]}
          />
        ))}
      </View>
      <View style={styles.deletedInfo}>
        <Text style={styles.deletedName} numberOfLines={1}>
          {palette.name}
        </Text>
        <Text
          style={[
            styles.deletedExpiry,
            isExpiringSoon && styles.deletedExpiryUrgent,
          ]}
        >
          {daysRemaining === 0
            ? 'Expires today'
            : daysRemaining === 1
            ? 'Expires tomorrow'
            : `${daysRemaining} days remaining`}
        </Text>
      </View>
      <View style={styles.deletedActions}>
        <Pressable
          style={styles.restoreButton}
          onPress={(e) => {
            e.stopPropagation();
            onRestore();
          }}
        >
          <Text style={styles.restoreButtonText}>Restore</Text>
        </Pressable>
        <Pressable
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ============================================
// Clear History Modal
// ============================================

interface ClearHistoryButtonProps {
  onClear: () => void;
}

export function ClearHistoryButton({ onClear }: ClearHistoryButtonProps) {
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const historyCount = useHistoryStore((state) => state.history.length);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear History',
      `Are you sure you want to clear all ${historyCount} items from your history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            clearHistory();
            onClear();
          },
        },
      ]
    );
  }, [clearHistory, historyCount, onClear]);

  if (historyCount === 0) return null;

  return (
    <Pressable style={styles.clearButton} onPress={handleClear}>
      <Text style={styles.clearButtonText}>Clear History</Text>
    </Pressable>
  );
}

// ============================================
// Empty State
// ============================================

export function HistoryEmptyState() {
  return (
    <Animated.View entering={FadeIn} style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🎨</Text>
      <Text style={styles.emptyTitle}>No Recent Palettes</Text>
      <Text style={styles.emptyDescription}>
        Your generated palettes will appear here.
        {'\n'}Start by taking a photo!
      </Text>
    </Animated.View>
  );
}

// ============================================
// Helper Functions
// ============================================

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  sectionCount: {
    fontSize: 13,
    color: '#888',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  horizontalScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // History Card
  historyCard: {
    width: 160,
    backgroundColor: '#252525',
    borderRadius: 16,
    overflow: 'hidden',
  },
  historyCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  historySwatches: {
    flexDirection: 'row',
    height: 60,
  },
  historySwatch: {
    flex: 1,
  },
  historyInfo: {
    padding: 12,
  },
  historyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 12,
    color: '#888',
  },
  savedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(74, 144, 217, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  saveButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  // Deleted Palettes
  deletedList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  deletedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  deletedCardPressed: {
    backgroundColor: '#333',
  },
  deletedSwatches: {
    flexDirection: 'row',
    width: 80,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  deletedSwatch: {
    flex: 1,
  },
  deletedInfo: {
    flex: 1,
  },
  deletedName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  deletedExpiry: {
    fontSize: 12,
    color: '#888',
  },
  deletedExpiryUrgent: {
    color: '#FF6B6B',
  },
  deletedActions: {
    flexDirection: 'row',
    gap: 8,
  },
  restoreButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  restoreButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },

  // Clear Button
  clearButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
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

export default RecentHistorySection;
