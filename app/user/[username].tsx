import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useCommunityStore } from '@/store/communityStore';
import { useAuthStore } from '@/store/authStore';
import type { FeedPalette } from '@/types';

export default function UserProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: currentUser } = useAuthStore();
  const {
    viewedProfile,
    viewedProfilePalettes,
    isLoadingProfile,
    fetchUserProfile,
    followUser,
    unfollowUser,
    clearViewedProfile,
    toggleLike,
  } = useCommunityStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    if (username) {
      fetchUserProfile(username);
    }

    return () => {
      clearViewedProfile();
    };
  }, [username]);

  const handleRefresh = useCallback(async () => {
    if (!username) return;
    setIsRefreshing(true);
    try {
      await fetchUserProfile(username);
    } finally {
      setIsRefreshing(false);
    }
  }, [username]);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      Alert.alert('Sign In Required', 'Please sign in to follow users.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    if (!viewedProfile) return;

    setIsFollowLoading(true);
    try {
      if (viewedProfile.isFollowing) {
        await unfollowUser(viewedProfile.id);
      } else {
        await followUser(viewedProfile.id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleLikePress = async (palette: FeedPalette) => {
    if (!currentUser) {
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderPaletteItem = ({ item }: { item: FeedPalette }) => (
    <Pressable
      style={styles.paletteCard}
      onPress={() => router.push(`/palette/${item.id}`)}
    >
      <View style={styles.paletteColors}>
        {item.colors.slice(0, 5).map((color, index) => (
          <View
            key={color.id || index}
            style={[styles.paletteColorSwatch, { backgroundColor: color.hex }]}
          />
        ))}
      </View>
      <View style={styles.paletteInfo}>
        <Text style={styles.paletteName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.paletteActions}>
          <Pressable
            style={styles.likeButton}
            onPress={() => handleLikePress(item)}
            hitSlop={8}
          >
            <Text style={styles.likeIcon}>{item.isLiked ? '❤️' : '🤍'}</Text>
            <Text style={[styles.likeCount, item.isLiked && styles.likeCountActive]}>
              {item.likesCount}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  // Loading state
  if (isLoadingProfile && !viewedProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  // User not found
  if (!viewedProfile && !isLoadingProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>😕</Text>
          <Text style={styles.errorTitle}>User not found</Text>
          <Text style={styles.errorSubtitle}>
            The user @{username} doesn't exist or has been deleted.
          </Text>
          <Pressable style={styles.goBackButton} onPress={() => router.back()}>
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser?.id === viewedProfile?.id;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>@{viewedProfile?.username}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.profileSection}>
          {viewedProfile?.avatarUrl ? (
            <Image source={{ uri: viewedProfile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(viewedProfile?.displayName || viewedProfile?.username || 'U')}
              </Text>
            </View>
          )}
          <Text style={styles.displayName}>
            {viewedProfile?.displayName || viewedProfile?.username}
          </Text>
          <Text style={styles.username}>@{viewedProfile?.username}</Text>
          {viewedProfile?.bio && <Text style={styles.bio}>{viewedProfile.bio}</Text>}
        </View>

        <View style={styles.statsSection}>
          <Pressable style={styles.statItem}>
            <Text style={styles.statValue}>{viewedProfile?.stats.palettesCount || 0}</Text>
            <Text style={styles.statLabel}>Palettes</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable
            style={styles.statItem}
            onPress={() => router.push(`/followers/${viewedProfile?.id}`)}
          >
            <Text style={styles.statValue}>{viewedProfile?.stats.followersCount || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable
            style={styles.statItem}
            onPress={() => router.push(`/following/${viewedProfile?.id}`)}
          >
            <Text style={styles.statValue}>{viewedProfile?.stats.followingCount || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
        </View>

        {!isOwnProfile && (
          <View style={styles.actionButtons}>
            <Pressable
              style={[
                styles.followButton,
                viewedProfile?.isFollowing && styles.followingButton,
              ]}
              onPress={handleFollowToggle}
              disabled={isFollowLoading}
            >
              {isFollowLoading ? (
                <ActivityIndicator size="small" color={viewedProfile?.isFollowing ? '#fff' : '#000'} />
              ) : (
                <Text
                  style={[
                    styles.followButtonText,
                    viewedProfile?.isFollowing && styles.followingButtonText,
                  ]}
                >
                  {viewedProfile?.isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.palettesSection}>
          <Text style={styles.sectionTitle}>Palettes</Text>

          {viewedProfilePalettes.length === 0 ? (
            <View style={styles.emptyPalettes}>
              <Text style={styles.emptyText}>No public palettes yet</Text>
            </View>
          ) : (
            <FlashList
              data={viewedProfilePalettes}
              renderItem={renderPaletteItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              estimatedItemSize={120}
            />
          )}
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '600',
    color: '#fff',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
  },
  bio: {
    fontSize: 15,
    color: '#aaa',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginTop: 8,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#888',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
  },
  actionButtons: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  followButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333',
  },
  followButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#fff',
  },
  palettesSection: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  emptyPalettes: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
  },
  paletteRow: {
    gap: 12,
    marginBottom: 12,
  },
  paletteCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  paletteColors: {
    flexDirection: 'row',
    height: 60,
  },
  paletteColorSwatch: {
    flex: 1,
  },
  paletteInfo: {
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paletteName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  paletteActions: {
    flexDirection: 'row',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeIcon: {
    fontSize: 14,
  },
  likeCount: {
    fontSize: 12,
    color: '#666',
  },
  likeCountActive: {
    color: '#ff6b6b',
  },
});
