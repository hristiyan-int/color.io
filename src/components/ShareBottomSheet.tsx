import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Paths, File } from 'expo-file-system';
import { isLightColor } from '@/utils/colors';
import type { Color, PaletteColor, Palette } from '@/types';

interface ShareBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  colors: (Color | PaletteColor)[];
  palette?: Palette;
  paletteName?: string;
  isPublic?: boolean;
  onPublicToggle?: (isPublic: boolean) => Promise<void>;
}

// Shareable palette image component
function ShareableImage({
  colors,
  paletteName,
  viewShotRef,
}: {
  colors: (Color | PaletteColor)[];
  paletteName?: string;
  viewShotRef: React.RefObject<ViewShot | null>;
}) {
  return (
    <ViewShot
      ref={viewShotRef}
      options={{ format: 'png', quality: 1 }}
      style={styles.shareImageContainer}
    >
      <View style={styles.shareImage}>
        {/* Color swatches as main visual */}
        <View style={styles.shareImageSwatches}>
          {colors.slice(0, 6).map((color, index) => {
            const textColor = isLightColor(color.rgb) ? '#000' : '#fff';
            return (
              <View
                key={index}
                style={[styles.shareImageSwatch, { backgroundColor: color.hex }]}
              >
                <Text style={[styles.shareImageHex, { color: textColor }]}>
                  {color.hex}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Footer with branding */}
        <View style={styles.shareImageFooter}>
          {paletteName && (
            <Text style={styles.shareImageTitle} numberOfLines={1}>
              {paletteName}
            </Text>
          )}
          <Text style={styles.shareImageBrand}>Color.io</Text>
        </View>
      </View>
    </ViewShot>
  );
}

export function ShareBottomSheet({
  visible,
  onClose,
  colors,
  palette,
  paletteName,
  isPublic = false,
  onPublicToggle,
}: ShareBottomSheetProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [publicState, setPublicState] = useState(isPublic);
  const [isSharing, setIsSharing] = useState(false);
  const [sharingAction, setSharingAction] = useState<string | null>(null);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);

  const handleShare = useCallback(
    async (actionId: string, shareFn: () => Promise<void>) => {
      setIsSharing(true);
      setSharingAction(actionId);
      try {
        await shareFn();
      } catch (error) {
        if (error instanceof Error && !error.message.includes('cancel')) {
          Alert.alert('Share Failed', error.message);
        }
      } finally {
        setIsSharing(false);
        setSharingAction(null);
      }
    },
    []
  );

  // Native share with image
  const shareImage = useCallback(async () => {
    if (!viewShotRef.current?.capture) return;

    const uri = await viewShotRef.current.capture();
    if (!uri) throw new Error('Failed to capture image');

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Palette',
        UTI: 'public.png',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }, []);

  // Share as text
  const shareAsText = useCallback(async () => {
    const colorList = colors.map((c) => c.hex).join(' ');
    const message = paletteName
      ? `${paletteName}\n\nColors: ${colorList}\n\nCreated with Color.io`
      : `Color Palette\n\nColors: ${colorList}\n\nCreated with Color.io`;

    if (await Sharing.isAvailableAsync()) {
      // Create a temp text file to share
      const file = new File(Paths.cache, 'palette.txt');
      await file.write(message);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: 'Share Palette',
      });
    }
  }, [colors, paletteName]);

  // Copy link (for public palettes)
  const copyLink = useCallback(async () => {
    if (palette?.id && publicState) {
      // In a real app, this would be the actual share URL
      const shareUrl = `https://color.io/palette/${palette.id}`;
      await Clipboard.setStringAsync(shareUrl);
      Alert.alert('Link Copied', 'Palette link copied to clipboard');
      onClose();
    } else {
      Alert.alert(
        'Make Public First',
        'Enable "Make Public" to generate a shareable link',
        [{ text: 'OK' }]
      );
    }
  }, [palette?.id, publicState, onClose]);

  // Copy color codes
  const copyColors = useCallback(async () => {
    const colorText = colors.map((c) => c.hex).join('\n');
    await Clipboard.setStringAsync(colorText);
    Alert.alert('Copied', 'Color codes copied to clipboard');
    onClose();
  }, [colors, onClose]);

  // Toggle public state
  const handlePublicToggle = useCallback(
    async (value: boolean) => {
      if (!onPublicToggle) {
        setPublicState(value);
        return;
      }

      setIsTogglingPublic(true);
      try {
        await onPublicToggle(value);
        setPublicState(value);
      } catch (error) {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to update visibility'
        );
      } finally {
        setIsTogglingPublic(false);
      }
    },
    [onPublicToggle]
  );

  // Share to Instagram Stories (opens Instagram with image)
  const shareToInstagram = useCallback(async () => {
    if (!viewShotRef.current?.capture) return;

    const uri = await viewShotRef.current.capture();
    if (!uri) throw new Error('Failed to capture image');

    // Check if Instagram is installed
    const instagramUrl = 'instagram://';
    const canOpenInstagram = await Linking.canOpenURL(instagramUrl);

    if (canOpenInstagram) {
      // On iOS, we can use the Instagram URL scheme
      // On Android, we use the share intent
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share to Instagram',
        });
      }
    } else {
      Alert.alert(
        'Instagram Not Found',
        'Please install Instagram to share directly to Stories',
        [
          {
            text: 'Share Anyway',
            onPress: () => shareImage(),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }, [shareImage]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.overlay}
      >
        <Pressable style={styles.overlayPressable} onPress={onClose} />

        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          exiting={SlideOutDown.springify().damping(20).stiffness(200)}
          style={styles.sheet}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Share Palette</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          {/* Hidden image for capture */}
          <View style={styles.hiddenPreview}>
            <ShareableImage
              colors={colors}
              paletteName={paletteName}
              viewShotRef={viewShotRef}
            />
          </View>

          {/* Preview */}
          <View style={styles.previewSection}>
            <View style={styles.previewColors}>
              {colors.slice(0, 8).map((color, index) => (
                <View
                  key={index}
                  style={[styles.previewSwatch, { backgroundColor: color.hex }]}
                />
              ))}
            </View>
          </View>

          {/* Public Toggle */}
          {onPublicToggle && (
            <View style={styles.publicToggleSection}>
              <View style={styles.publicToggleInfo}>
                <Text style={styles.publicToggleIcon}>🌐</Text>
                <View style={styles.publicToggleText}>
                  <Text style={styles.publicToggleLabel}>Make Public</Text>
                  <Text style={styles.publicToggleDescription}>
                    Allow others to discover and save your palette
                  </Text>
                </View>
              </View>
              <View style={styles.switchContainer}>
                {isTogglingPublic ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Switch
                    value={publicState}
                    onValueChange={handlePublicToggle}
                    trackColor={{ false: '#333', true: '#4CAF50' }}
                    thumbColor={publicState ? '#fff' : '#666'}
                    ios_backgroundColor="#333"
                  />
                )}
              </View>
            </View>
          )}

          {/* Share Options */}
          <View style={styles.shareOptions}>
            <ShareOption
              icon="📤"
              label="Share Image"
              description="Share as PNG image"
              isLoading={isSharing && sharingAction === 'image'}
              disabled={isSharing}
              onPress={() => handleShare('image', shareImage)}
            />

            <ShareOption
              icon="📋"
              label="Copy Colors"
              description="Copy HEX codes to clipboard"
              isLoading={isSharing && sharingAction === 'copy'}
              disabled={isSharing}
              onPress={() => handleShare('copy', copyColors)}
            />

            {palette?.id && (
              <ShareOption
                icon="🔗"
                label="Copy Link"
                description={publicState ? 'Share palette URL' : 'Make public first'}
                isLoading={isSharing && sharingAction === 'link'}
                disabled={isSharing || !publicState}
                onPress={() => handleShare('link', copyLink)}
              />
            )}

            <ShareOption
              icon="📸"
              label="Instagram"
              description="Share to your Story"
              isLoading={isSharing && sharingAction === 'instagram'}
              disabled={isSharing}
              onPress={() => handleShare('instagram', shareToInstagram)}
            />

            <ShareOption
              icon="📝"
              label="Share as Text"
              description="Share color codes as text"
              isLoading={isSharing && sharingAction === 'text'}
              disabled={isSharing}
              onPress={() => handleShare('text', shareAsText)}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

interface ShareOptionProps {
  icon: string;
  label: string;
  description: string;
  isLoading: boolean;
  disabled: boolean;
  onPress: () => void;
}

function ShareOption({
  icon,
  label,
  description,
  isLoading,
  disabled,
  onPress,
}: ShareOptionProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.shareOption,
        pressed && styles.shareOptionPressed,
        disabled && !isLoading && styles.shareOptionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {isLoading ? (
        <View style={styles.shareOptionLoading}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      ) : (
        <>
          <Text style={styles.shareOptionIcon}>{icon}</Text>
          <View style={styles.shareOptionText}>
            <Text style={styles.shareOptionLabel}>{label}</Text>
            <Text style={styles.shareOptionDescription}>{description}</Text>
          </View>
          <Text style={styles.shareOptionArrow}>›</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  overlayPressable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#333',
    borderBottomWidth: 0,
    paddingBottom: 40,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    borderRadius: 16,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#888',
    lineHeight: 26,
  },
  hiddenPreview: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  shareImageContainer: {
    width: 400,
    backgroundColor: '#1a1a1a',
  },
  shareImage: {
    padding: 20,
  },
  shareImageSwatches: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
  },
  shareImageSwatch: {
    flex: 1,
    height: 160,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  shareImageHex: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  shareImageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
  },
  shareImageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  shareImageBrand: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  previewSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  previewColors: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewSwatch: {
    flex: 1,
  },
  publicToggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  publicToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  publicToggleIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  publicToggleText: {
    flex: 1,
  },
  publicToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  publicToggleDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  switchContainer: {
    width: 50,
    alignItems: 'flex-end',
  },
  shareOptions: {
    paddingHorizontal: 20,
    gap: 8,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  shareOptionPressed: {
    backgroundColor: '#333',
    transform: [{ scale: 0.98 }],
  },
  shareOptionDisabled: {
    opacity: 0.4,
  },
  shareOptionLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  shareOptionIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  shareOptionText: {
    flex: 1,
  },
  shareOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  shareOptionDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  shareOptionArrow: {
    fontSize: 24,
    color: '#666',
    marginLeft: 8,
  },
});

export default ShareBottomSheet;
