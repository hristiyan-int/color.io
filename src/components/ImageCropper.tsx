import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
  Text,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

type AspectRatio = 'free' | '1:1' | '4:3' | '3:4' | '16:9';

interface ImageCropperProps {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onCropComplete: (croppedUri: string) => void;
  onCancel: () => void;
  onUseFullImage: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CROP_AREA_PADDING = 24;
const MIN_CROP_SIZE = 100;

export function ImageCropper({
  imageUri,
  imageWidth,
  imageHeight,
  onCropComplete,
  onCancel,
  onUseFullImage,
}: ImageCropperProps) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  const [isCropping, setIsCropping] = useState(false);

  // Calculate display dimensions
  const displayDimensions = useMemo(() => {
    const maxWidth = SCREEN_WIDTH - CROP_AREA_PADDING * 2;
    const maxHeight = SCREEN_HEIGHT * 0.5;

    const imageAspect = imageWidth / imageHeight;
    let displayWidth = maxWidth;
    let displayHeight = maxWidth / imageAspect;

    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = maxHeight * imageAspect;
    }

    return { width: displayWidth, height: displayHeight };
  }, [imageWidth, imageHeight]);

  // Crop box animated values
  const cropX = useSharedValue(displayDimensions.width * 0.1);
  const cropY = useSharedValue(displayDimensions.height * 0.1);
  const cropWidth = useSharedValue(displayDimensions.width * 0.8);
  const cropHeight = useSharedValue(displayDimensions.height * 0.8);

  // For dragging the crop box
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  const getAspectRatioValue = (ratio: AspectRatio): number | null => {
    switch (ratio) {
      case '1:1': return 1;
      case '4:3': return 4 / 3;
      case '3:4': return 3 / 4;
      case '16:9': return 16 / 9;
      default: return null;
    }
  };

  const applyAspectRatio = useCallback((ratio: AspectRatio) => {
    'worklet';
    const ratioValue = getAspectRatioValue(ratio);
    if (!ratioValue) return;

    const currentWidth = cropWidth.value;
    const currentHeight = cropHeight.value;
    const currentCenterX = cropX.value + currentWidth / 2;
    const currentCenterY = cropY.value + currentHeight / 2;

    let newWidth = currentWidth;
    let newHeight = currentWidth / ratioValue;

    if (newHeight > displayDimensions.height * 0.8) {
      newHeight = displayDimensions.height * 0.8;
      newWidth = newHeight * ratioValue;
    }

    const newX = Math.max(0, Math.min(currentCenterX - newWidth / 2, displayDimensions.width - newWidth));
    const newY = Math.max(0, Math.min(currentCenterY - newHeight / 2, displayDimensions.height - newHeight));

    cropX.value = withSpring(newX);
    cropY.value = withSpring(newY);
    cropWidth.value = withSpring(newWidth);
    cropHeight.value = withSpring(newHeight);
  }, [displayDimensions]);

  const handleAspectRatioChange = useCallback((ratio: AspectRatio) => {
    setAspectRatio(ratio);
    if (ratio !== 'free') {
      applyAspectRatio(ratio);
    }
  }, [applyAspectRatio]);

  // Gesture for dragging the crop box
  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextX.value = cropX.value;
      contextY.value = cropY.value;
    })
    .onUpdate((event) => {
      const newX = contextX.value + event.translationX;
      const newY = contextY.value + event.translationY;

      cropX.value = Math.max(0, Math.min(newX, displayDimensions.width - cropWidth.value));
      cropY.value = Math.max(0, Math.min(newY, displayDimensions.height - cropHeight.value));
    });

  // Gesture for resizing from corners
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const scale = event.scale;
      const centerX = cropX.value + cropWidth.value / 2;
      const centerY = cropY.value + cropHeight.value / 2;

      let newWidth = cropWidth.value * scale;
      let newHeight = cropHeight.value * scale;

      // Apply constraints
      newWidth = Math.max(MIN_CROP_SIZE, Math.min(newWidth, displayDimensions.width));
      newHeight = Math.max(MIN_CROP_SIZE, Math.min(newHeight, displayDimensions.height));

      // Maintain aspect ratio if set
      const ratioValue = getAspectRatioValue(aspectRatio);
      if (ratioValue) {
        newHeight = newWidth / ratioValue;
      }

      // Calculate new position to keep centered
      let newX = centerX - newWidth / 2;
      let newY = centerY - newHeight / 2;

      // Bound to image
      newX = Math.max(0, Math.min(newX, displayDimensions.width - newWidth));
      newY = Math.max(0, Math.min(newY, displayDimensions.height - newHeight));

      cropWidth.value = newWidth;
      cropHeight.value = newHeight;
      cropX.value = newX;
      cropY.value = newY;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const cropBoxStyle = useAnimatedStyle(() => ({
    left: cropX.value,
    top: cropY.value,
    width: cropWidth.value,
    height: cropHeight.value,
  }));

  const handleCrop = async () => {
    setIsCropping(true);
    try {
      // Convert display coordinates to image coordinates
      const scaleX = imageWidth / displayDimensions.width;
      const scaleY = imageHeight / displayDimensions.height;

      const cropRegion: CropRegion = {
        x: Math.round(cropX.value * scaleX),
        y: Math.round(cropY.value * scaleY),
        width: Math.round(cropWidth.value * scaleX),
        height: Math.round(cropHeight.value * scaleY),
      };

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: { originX: cropRegion.x, originY: cropRegion.y, width: cropRegion.width, height: cropRegion.height } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      onCropComplete(result.uri);
    } catch (error) {
      console.error('Crop failed:', error);
    } finally {
      setIsCropping(false);
    }
  };

  const aspectRatioOptions: AspectRatio[] = ['free', '1:1', '4:3', '16:9'];

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={onCancel}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Crop Image</Text>
        <Pressable
          style={[styles.headerButton, isCropping && styles.headerButtonDisabled]}
          onPress={handleCrop}
          disabled={isCropping}
        >
          <Text style={[styles.headerButtonText, styles.headerButtonPrimary]}>
            {isCropping ? 'Cropping...' : 'Done'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.imageContainer, { width: displayDimensions.width, height: displayDimensions.height }]}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: displayDimensions.width, height: displayDimensions.height }}
          resizeMode="contain"
        />

        {/* Overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[styles.overlay, { left: 0, top: 0, right: 0, bottom: 0 }]} />
        </View>

        {/* Crop Box */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.cropBox, cropBoxStyle]}>
            {/* Corner handles */}
            <View style={[styles.cornerHandle, styles.topLeft]} />
            <View style={[styles.cornerHandle, styles.topRight]} />
            <View style={[styles.cornerHandle, styles.bottomLeft]} />
            <View style={[styles.cornerHandle, styles.bottomRight]} />

            {/* Grid lines */}
            <View style={[styles.gridLine, styles.gridHorizontal, { top: '33%' }]} />
            <View style={[styles.gridLine, styles.gridHorizontal, { top: '66%' }]} />
            <View style={[styles.gridLine, styles.gridVertical, { left: '33%' }]} />
            <View style={[styles.gridLine, styles.gridVertical, { left: '66%' }]} />
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.controls}>
        <Text style={styles.controlLabel}>Aspect Ratio</Text>
        <View style={styles.aspectRatioButtons}>
          {aspectRatioOptions.map((ratio) => (
            <Pressable
              key={ratio}
              style={[
                styles.aspectRatioButton,
                aspectRatio === ratio && styles.aspectRatioButtonActive,
              ]}
              onPress={() => handleAspectRatioChange(ratio)}
            >
              <Text
                style={[
                  styles.aspectRatioText,
                  aspectRatio === ratio && styles.aspectRatioTextActive,
                ]}
              >
                {ratio === 'free' ? 'Free' : ratio}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.fullImageButton} onPress={onUseFullImage}>
          <Text style={styles.fullImageButtonText}>Use Full Image</Text>
        </Pressable>
      </View>
    </GestureHandlerRootView>
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
    borderBottomColor: '#222',
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#888',
  },
  headerButtonPrimary: {
    color: '#fff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  imageContainer: {
    alignSelf: 'center',
    marginVertical: 24,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  cornerHandle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
    borderWidth: 3,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  gridHorizontal: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridVertical: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  controls: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  controlLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  aspectRatioButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  aspectRatioButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  aspectRatioButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  aspectRatioText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  aspectRatioTextActive: {
    color: '#000',
  },
  fullImageButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  fullImageButtonText: {
    fontSize: 16,
    color: '#888',
    textDecorationLine: 'underline',
  },
});
