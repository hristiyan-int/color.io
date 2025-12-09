import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ImageAsset } from '@/types';

interface UseImagePickerOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  allowsEditing?: boolean;
}

interface UseImagePickerResult {
  image: ImageAsset | null;
  isLoading: boolean;
  error: string | null;
  pickFromGallery: () => Promise<ImageAsset | null>;
  takePhoto: () => Promise<ImageAsset | null>;
  clearImage: () => void;
}

const DEFAULT_MAX_SIZE = 1200;
const DEFAULT_QUALITY = 0.8;

export function useImagePicker(options: UseImagePickerOptions = {}): UseImagePickerResult {
  const {
    maxWidth = DEFAULT_MAX_SIZE,
    maxHeight = DEFAULT_MAX_SIZE,
    quality = DEFAULT_QUALITY,
    allowsEditing = false,
  } = options;

  const [image, setImage] = useState<ImageAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(
    async (uri: string, width: number, height: number): Promise<ImageAsset> => {
      // Calculate resize dimensions maintaining aspect ratio
      let resizeWidth = width;
      let resizeHeight = height;

      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;
        if (width > height) {
          resizeWidth = maxWidth;
          resizeHeight = maxWidth / aspectRatio;
        } else {
          resizeHeight = maxHeight;
          resizeWidth = maxHeight * aspectRatio;
        }
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: Math.round(resizeWidth), height: Math.round(resizeHeight) } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return {
        uri: manipulated.uri,
        width: manipulated.width,
        height: manipulated.height,
      };
    },
    [maxWidth, maxHeight, quality]
  );

  const requestGalleryPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Gallery access is required to pick images');
      return false;
    }
    return true;
  }, []);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Camera access is required to take photos');
      return false;
    }
    return true;
  }, []);

  const pickFromGallery = useCallback(async (): Promise<ImageAsset | null> => {
    setError(null);
    setIsLoading(true);

    try {
      const hasPermission = await requestGalleryPermission();
      if (!hasPermission) {
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing,
        quality: 1, // We'll compress after
        exif: false,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const asset = result.assets[0];
      const processedImage = await processImage(asset.uri, asset.width, asset.height);
      setImage(processedImage);
      return processedImage;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pick image';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [allowsEditing, processImage, requestGalleryPermission]);

  const takePhoto = useCallback(async (): Promise<ImageAsset | null> => {
    setError(null);
    setIsLoading(true);

    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing,
        quality: 1, // We'll compress after
        exif: false,
      });

      if (result.canceled || !result.assets[0]) {
        return null;
      }

      const asset = result.assets[0];
      const processedImage = await processImage(asset.uri, asset.width, asset.height);
      setImage(processedImage);
      return processedImage;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to take photo';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [allowsEditing, processImage, requestCameraPermission]);

  const clearImage = useCallback(() => {
    setImage(null);
    setError(null);
  }, []);

  return {
    image,
    isLoading,
    error,
    pickFromGallery,
    takePhoto,
    clearImage,
  };
}
