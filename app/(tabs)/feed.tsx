import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useCommunityStore } from '@/store/communityStore';
import { useAuthStore } from '@/store/authStore';
import type { FeedPalette, FeedType } from '@/types';

const DOUBLE_TAP_DELAY = 300;

export default function FeedScreen() {
  const router = useRouter();
  const {
    feedPalettes,
    feedType,
    hasMoreFeed,
    isLoadingFeed,
    isRefreshing,
    setFeedType,
    fetchFeed,
    loadMoreFeed,
    refreshFeed,
    toggleLike,
  } = useCommunityStore();
  const { user } = useAuthStore();

  const [lastTap, setLastTap] = useState<{ id: string; time: number } | null>(null);
  const [likedAnimations, setLikedAnimations] = useState<Record<string, boolean>>({});

  const tabs: { key: FeedType; label: string }[] = [
    { key: 'trending', label: 'Trending' },
    { key: 'recent', label: 'Recent' },
    { key: 'following', label: 'Following' },
  ];

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleTabChange = (tab: FeedType) => {
    if (tab === 'following' && !user) {
      Alert.alert('Sign In Required', 'Please sign in to see palettes from people you follow.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    setFeedType(tab);
  };

  const handlePaletteTap = useCallback(
    (palette: FeedPalette) => {
      const now = Date.now();

      if (lastTap && lastTap.id === palette.id && now - lastTap.time < DOUBLE_TAP_DELAY) {
        // Double tap - like
        handleDoubleTapLike(palette);
        setLastTap(null);
      } else {
        // Single tap - navigate after delay if no second tap
        setLastTap({ id: palette.id, time: now });
        setTimeout(() => {
          setLastTap((current) => {
            if (current && current.id === palette.id && current.time === now) {
              // Navigate to palette detail
              router.push(`/palette/${palette.id}`);
            }
            return null;
          });
        }, DOUBLE_TAP_DELAY);
      }
    },
    [lastTap, user, router]
  );

  const handleDoubleTapLike = async (palette: FeedPalette) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to like palettes.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    if (!palette.isLiked) {
      // Show heart animation
      setLikedAnimations((prev) => ({ ...prev, [palette.id]: true }));
      setTimeout(() => {
        setLikedAnimations((prev) => ({ ...prev, [palette.id]: false }));
      }, 800);

      try {
        await toggleLike(palette.id);
      } catch (error) {
        console.error('Failed to like:', error);
      }
    }
  };

  const handleLikePress = async (palette: FeedPalette) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to like palettes.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    try {
      await toggleLike(palette.id);
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleLongPress = (palette: FeedPalette) => {
    Alert.alert(palette.name, 'Choose an action', [
      {
        text: 'View Palette',
        onPress: () => router.push(`/palette/${palette.id}`),
      },
      {
        text: `View @${palette.user.username}`,
        onPress: () => router.push(`/user/${palette.user.username}`),
      },
      {
        text: palette.isLiked ? 'Unlike' : 'Like',
        onPress: () => handleLikePress(palette),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleEndReached = () => {
    if (!isLoadingFeed && hasMoreFeed) {
      loadMoreFeed();
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const renderPalette = ({ item }: { item: FeedPalette }) => (
    <Pressable
      style={styles.feedCard}
      onPress={() => handlePaletteTap(item)}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={500}
    >
      <Pressable
        style={styles.cardHeader}
        onPress={() => router.push(`/user/${item.user.username}`)}
      >
        <View style={styles.userInfo}>
          {item.user.avatarUrl ? (
            <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(item.user.displayName || item.user.username).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.displayName}>
              {item.user.displayName || item.user.username}
            </Text>
            <Text style={styles.username}>@{item.user.username}</Text>
          </View>
        </View>
        <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
      </Pressable>

      <View style={styles.colorsContainer}>
        <View style={styles.colorsPreview}>
          {item.colors.map((color, index) => (
            <View
              key={color.id || index}
              style={[styles.colorSwatch, { backgroundColor: color.hex }]}
            />
          ))}
        </View>

        {likedAnimations[item.id] && (
          <View style={styles.heartAnimation}>
            <Text style={styles.heartEmoji}>❤️</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.paletteName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.stats}>
          <Pressable
            style={styles.statButton}
            onPress={() => handleLikePress(item)}
            hitSlop={8}
          >
            <Text style={styles.statIcon}>{item.isLiked ? '❤️' : '🤍'}</Text>
            <Text style={[styles.statText, item.isLiked && styles.statTextActive]}>
              {item.likesCount}
            </Text>
          </Pressable>
          <View style={styles.statButton}>
            <Text style={styles.statIcon}>💬</Text>
            <Text style={styles.statText}>{item.commentsCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  const renderFooter = () => {
    if (!isLoadingFeed) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoadingFeed) return null;

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>
          {feedType === 'following' ? '👥' : '🌐'}
        </Text>
        <Text style={styles.emptyTitle}>
          {feedType === 'following' ? 'No palettes yet' : 'Discover amazing palettes'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {feedType === 'following'
            ? 'Follow some creators to see their palettes here'
            : 'Be the first to share a palette with the community'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <Pressable
          style={styles.searchButton}
          onPress={() => router.push('/search')}
        >
          <Text style={styles.searchIcon}>🔍</Text>
        </Pressable>
      </View>

      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, feedType === tab.key && styles.tabActive]}
            onPress={() => handleTabChange(tab.key)}
          >
            <Text
              style={[styles.tabText, feedType === tab.key && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlashList
        data={feedPalettes}
        renderItem={renderPalette}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshFeed}
            tintColor="#fff"
            colors={['#fff']}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        estimatedItemSize={220}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    fontSize: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
  tabTextActive: {
    color: '#000',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
  },
  feedCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  username: {
    fontSize: 12,
    color: '#666',
  },
  timeAgo: {
    fontSize: 12,
    color: '#666',
  },
  colorsContainer: {
    position: 'relative',
  },
  colorsPreview: {
    flexDirection: 'row',
    height: 120,
  },
  colorSwatch: {
    flex: 1,
  },
  heartAnimation: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heartEmoji: {
    fontSize: 64,
  },
  cardFooter: {
    padding: 12,
  },
  paletteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  statButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 16,
  },
  statText: {
    fontSize: 14,
    color: '#888',
  },
  statTextActive: {
    color: '#ff6b6b',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
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
  },
});
