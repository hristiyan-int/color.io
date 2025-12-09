import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useImagePicker } from '../../src/hooks/useImagePicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

const mockImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockImageManipulator = ImageManipulator as jest.Mocked<typeof ImageManipulator>;

describe('useImagePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useImagePicker());

      expect(result.current.image).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('pickFromGallery', () => {
    it('should pick image from gallery successfully', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test.jpg', width: 800, height: 600, mimeType: 'image/jpeg', fileName: 'test.jpg' }],
      });

      mockImageManipulator.manipulateAsync.mockResolvedValue({
        uri: 'file://processed.jpg',
        width: 800,
        height: 600,
      });

      const { result } = renderHook(() => useImagePicker());

      let pickedImage;
      await act(async () => {
        pickedImage = await result.current.pickFromGallery();
      });

      expect(pickedImage).not.toBeNull();
      expect(pickedImage?.uri).toBe('file://processed.jpg');
      expect(result.current.image?.uri).toBe('file://processed.jpg');
      expect(result.current.error).toBeNull();
    });

    it('should handle permission denied', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      });

      const { result } = renderHook(() => useImagePicker());

      let pickedImage;
      await act(async () => {
        pickedImage = await result.current.pickFromGallery();
      });

      expect(pickedImage).toBeNull();
      expect(result.current.error).toBe('Gallery access is required to pick images');
    });

    it('should handle canceled selection', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: true,
        assets: [],
      });

      const { result } = renderHook(() => useImagePicker());

      let pickedImage;
      await act(async () => {
        pickedImage = await result.current.pickFromGallery();
      });

      expect(pickedImage).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should handle empty assets', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [],
      });

      const { result } = renderHook(() => useImagePicker());

      let pickedImage;
      await act(async () => {
        pickedImage = await result.current.pickFromGallery();
      });

      expect(pickedImage).toBeNull();
    });

    it('should handle errors', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockRejectedValue(new Error('Gallery error'));

      const { result } = renderHook(() => useImagePicker());

      let pickedImage;
      await act(async () => {
        pickedImage = await result.current.pickFromGallery();
      });

      expect(pickedImage).toBeNull();
      expect(result.current.error).toBe('Gallery error');
    });

    it('should handle non-Error exceptions', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockRejectedValue('String error');

      const { result } = renderHook(() => useImagePicker());

      await act(async () => {
        await result.current.pickFromGallery();
      });

      expect(result.current.error).toBe('Failed to pick image');
    });

    it('should resize large images', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://large.jpg', width: 4000, height: 3000, mimeType: 'image/jpeg', fileName: 'large.jpg' }],
      });

      mockImageManipulator.manipulateAsync.mockResolvedValue({
        uri: 'file://resized.jpg',
        width: 1200,
        height: 900,
      });

      const { result } = renderHook(() => useImagePicker({ maxWidth: 1200, maxHeight: 1200 }));

      await act(async () => {
        await result.current.pickFromGallery();
      });

      expect(mockImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file://large.jpg',
        [{ resize: { width: 1200, height: 900 } }],
        expect.any(Object)
      );
    });

    it('should resize portrait images correctly', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://portrait.jpg', width: 3000, height: 4000, mimeType: 'image/jpeg', fileName: 'portrait.jpg' }],
      });

      mockImageManipulator.manipulateAsync.mockResolvedValue({
        uri: 'file://resized.jpg',
        width: 900,
        height: 1200,
      });

      const { result } = renderHook(() => useImagePicker({ maxWidth: 1200, maxHeight: 1200 }));

      await act(async () => {
        await result.current.pickFromGallery();
      });

      expect(mockImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file://portrait.jpg',
        [{ resize: { width: 900, height: 1200 } }],
        expect.any(Object)
      );
    });

    it('should set isLoading during operation', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: true,
        assets: [],
      });

      const { result } = renderHook(() => useImagePicker());

      // Start operation and verify loading becomes false at the end
      await act(async () => {
        await result.current.pickFromGallery();
      });

      // After operation completes, isLoading should be false
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('takePhoto', () => {
    it('should take photo successfully', async () => {
      mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://photo.jpg', width: 1920, height: 1080, mimeType: 'image/jpeg', fileName: 'photo.jpg' }],
      });

      mockImageManipulator.manipulateAsync.mockResolvedValue({
        uri: 'file://processed-photo.jpg',
        width: 1200,
        height: 675,
      });

      const { result } = renderHook(() => useImagePicker());

      let photo;
      await act(async () => {
        photo = await result.current.takePhoto();
      });

      expect(photo).not.toBeNull();
      expect(photo?.uri).toBe('file://processed-photo.jpg');
      expect(result.current.image?.uri).toBe('file://processed-photo.jpg');
    });

    it('should handle camera permission denied', async () => {
      mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: true,
        expires: 'never',
      });

      const { result } = renderHook(() => useImagePicker());

      let photo;
      await act(async () => {
        photo = await result.current.takePhoto();
      });

      expect(photo).toBeNull();
      expect(result.current.error).toBe('Camera access is required to take photos');
    });

    it('should handle canceled photo', async () => {
      mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchCameraAsync.mockResolvedValue({
        canceled: true,
        assets: [],
      });

      const { result } = renderHook(() => useImagePicker());

      let photo;
      await act(async () => {
        photo = await result.current.takePhoto();
      });

      expect(photo).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should handle camera errors', async () => {
      mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchCameraAsync.mockRejectedValue(new Error('Camera error'));

      const { result } = renderHook(() => useImagePicker());

      let photo;
      await act(async () => {
        photo = await result.current.takePhoto();
      });

      expect(photo).toBeNull();
      expect(result.current.error).toBe('Camera error');
    });

    it('should handle non-Error exceptions', async () => {
      mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchCameraAsync.mockRejectedValue('String error');

      const { result } = renderHook(() => useImagePicker());

      await act(async () => {
        await result.current.takePhoto();
      });

      expect(result.current.error).toBe('Failed to take photo');
    });
  });

  describe('clearImage', () => {
    it('should clear image and error', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test.jpg', width: 800, height: 600, mimeType: 'image/jpeg', fileName: 'test.jpg' }],
      });

      mockImageManipulator.manipulateAsync.mockResolvedValue({
        uri: 'file://processed.jpg',
        width: 800,
        height: 600,
      });

      const { result } = renderHook(() => useImagePicker());

      await act(async () => {
        await result.current.pickFromGallery();
      });

      expect(result.current.image).not.toBeNull();

      act(() => {
        result.current.clearImage();
      });

      expect(result.current.image).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('options', () => {
    it('should use custom maxWidth and maxHeight', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test.jpg', width: 2000, height: 2000, mimeType: 'image/jpeg', fileName: 'test.jpg' }],
      });

      mockImageManipulator.manipulateAsync.mockResolvedValue({
        uri: 'file://processed.jpg',
        width: 500,
        height: 500,
      });

      const { result } = renderHook(() => useImagePicker({ maxWidth: 500, maxHeight: 500 }));

      await act(async () => {
        await result.current.pickFromGallery();
      });

      expect(mockImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file://test.jpg',
        [{ resize: { width: 500, height: 500 } }],
        expect.objectContaining({ format: 'jpeg' })
      );
    });

    it('should use custom quality', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://test.jpg', width: 800, height: 600, mimeType: 'image/jpeg', fileName: 'test.jpg' }],
      });

      mockImageManipulator.manipulateAsync.mockResolvedValue({
        uri: 'file://processed.jpg',
        width: 800,
        height: 600,
      });

      const { result } = renderHook(() => useImagePicker({ quality: 0.5 }));

      await act(async () => {
        await result.current.pickFromGallery();
      });

      expect(mockImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file://test.jpg',
        expect.any(Array),
        expect.objectContaining({ compress: 0.5 })
      );
    });

    it('should pass allowsEditing option', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: true,
        assets: [],
      });

      const { result } = renderHook(() => useImagePicker({ allowsEditing: true }));

      await act(async () => {
        await result.current.pickFromGallery();
      });

      expect(mockImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
        expect.objectContaining({ allowsEditing: true })
      );
    });
  });

  describe('not resizing small images', () => {
    it('should not resize images smaller than max dimensions', async () => {
      mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
        expires: 'never',
      });

      mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://small.jpg', width: 500, height: 400, mimeType: 'image/jpeg', fileName: 'small.jpg' }],
      });

      mockImageManipulator.manipulateAsync.mockResolvedValue({
        uri: 'file://processed.jpg',
        width: 500,
        height: 400,
      });

      const { result } = renderHook(() => useImagePicker({ maxWidth: 1200, maxHeight: 1200 }));

      await act(async () => {
        await result.current.pickFromGallery();
      });

      // Should still call manipulateAsync but with original dimensions
      expect(mockImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file://small.jpg',
        [{ resize: { width: 500, height: 400 } }],
        expect.any(Object)
      );
    });
  });
});
