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
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePaletteStore } from '@/store/paletteStore';
import { paletteService } from '@/services/palettes';
import type { Palette } from '@/types';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading, initialize } = useAuthStore();
  const { palettes, setPalettes, setIsLoadingPalettes, isLoadingPalettes } = usePaletteStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Initialize auth on mount
    initialize();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserPalettes();
    }
  }, [user]);

  const loadUserPalettes = async () => {
    try {
      setIsLoadingPalettes(true);
      const userPalettes = await paletteService.getUserPalettes();
      setPalettes(userPalettes);
    } catch (error) {
      console.error('Failed to load palettes:', error);
    } finally {
      setIsLoadingPalettes(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await initialize(); // Refresh user data
      await loadUserPalettes();
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await useAuthStore.getState().signOut();
            setPalettes([]);
          } catch (error) {
            console.error('Sign out error:', error);
          }
        },
      },
    ]);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderPaletteItem = ({ item }: { item: Palette }) => (
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
        <View style={styles.paletteStats}>
          <Text style={styles.paletteStatText}>
            {item.isPublic ? '🌐' : '🔒'} {item.likesCount} likes
          </Text>
        </View>
      </View>
    </Pressable>
  );

  // Not logged in state
  if (!user && !authLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable
            style={styles.settingsButton}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </Pressable>
        </View>

        <View style={styles.authPrompt}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarIcon}>👤</Text>
          </View>
          <Text style={styles.authTitle}>Sign in to Color.io</Text>
          <Text style={styles.authSubtitle}>
            Save your palettes, follow creators, and share your work with the community
          </Text>
          <Pressable
            style={styles.signInButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
          <Pressable
            style={styles.signUpButton}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.signUpButtonText}>Create Account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  // Logged in state
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
          <Text style={styles.title}>Profile</Text>
          <Pressable
            style={styles.settingsButton}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </Pressable>
        </View>

        <View style={styles.profileSection}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(user?.displayName || user?.username || 'U')}
              </Text>
            </View>
          )}
          <Text style={styles.displayName}>
            {user?.displayName || user?.username}
          </Text>
          <Text style={styles.username}>@{user?.username}</Text>
          {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}
        </View>

        <View style={styles.statsSection}>
          <Pressable style={styles.statItem}>
            <Text style={styles.statValue}>{user?.stats?.palettesCount || 0}</Text>
            <Text style={styles.statLabel}>Palettes</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable
            style={styles.statItem}
            onPress={() => router.push(`/followers/${user?.id}`)}
          >
            <Text style={styles.statValue}>{user?.stats?.followersCount || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable
            style={styles.statItem}
            onPress={() => router.push(`/following/${user?.id}`)}
          >
            <Text style={styles.statValue}>{user?.stats?.followingCount || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
        </View>

        <View style={styles.actionButtons}>
          <Pressable
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>
        </View>

        <View style={styles.palettesSection}>
          <Text style={styles.sectionTitle}>My Palettes</Text>

          {isLoadingPalettes ? (
            <View style={styles.loadingPalettes}>
              <ActivityIndicator color="#888" />
            </View>
          ) : palettes.length === 0 ? (
            <View style={styles.emptyPalettes}>
              <Text style={styles.emptyIcon}>🎨</Text>
              <Text style={styles.emptyTitle}>No palettes yet</Text>
              <Text style={styles.emptyText}>
                Create your first palette by extracting colors from a photo
              </Text>
              <Pressable
                style={styles.createButton}
                onPress={() => router.push('/camera')}
              >
                <Text style={styles.createButtonText}>Create Palette</Text>
              </Pressable>
            </View>
          ) : (
            <FlashList
              data={palettes}
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
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  settingsIcon: {
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#333',
  },
  avatarIcon: {
    fontSize: 48,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  signInButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    width: '100%',
    alignItems: 'center',
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 16,
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
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 16,
    gap: 12,
  },
  editButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  signOutButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#ff6b6b',
    fontSize: 15,
    fontWeight: '600',
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
  loadingPalettes: {
    padding: 40,
    alignItems: 'center',
  },
  emptyPalettes: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
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
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
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
  },
  paletteName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  paletteStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paletteStatText: {
    fontSize: 11,
    color: '#666',
  },
});
