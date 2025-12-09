import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useImagePicker } from '@/hooks/useImagePicker';

export default function HomeScreen() {
  const router = useRouter();
  const { pickFromGallery, isLoading } = useImagePicker({
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.9,
  });

  const handlePickFromGallery = async () => {
    const image = await pickFromGallery();
    if (image) {
      router.push({
        pathname: '/palette-result',
        params: { imageUri: image.uri },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>Color.io</Text>
        <Text style={styles.subtitle}>Extract beautiful palettes from photos</Text>
      </View>

      <View style={styles.content}>
        <Pressable
          style={({ pressed }) => [styles.captureButton, pressed && styles.captureButtonPressed]}
          onPress={() => router.push('/camera')}
        >
          <View style={styles.captureButtonInner}>
            <Text style={styles.captureIcon}>📷</Text>
            <Text style={styles.captureText}>Take Photo</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.galleryButton,
            pressed && styles.galleryButtonPressed,
            isLoading && styles.galleryButtonDisabled,
          ]}
          onPress={handlePickFromGallery}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 12 }} />
          ) : (
            <Text style={styles.galleryIcon}>🖼️</Text>
          )}
          <Text style={styles.galleryText}>
            {isLoading ? 'Loading...' : 'Choose from Gallery'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Palettes</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No palettes yet</Text>
          <Text style={styles.emptySubtext}>Capture or select a photo to get started</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  content: {
    paddingHorizontal: 24,
    gap: 16,
  },
  captureButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  captureButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  captureButtonInner: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  captureText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  galleryButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  galleryButtonPressed: {
    backgroundColor: '#222',
  },
  galleryButtonDisabled: {
    opacity: 0.7,
  },
  galleryIcon: {
    fontSize: 24,
  },
  galleryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  recentSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
  },
});
