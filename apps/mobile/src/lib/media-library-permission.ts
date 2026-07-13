import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export const MEDIA_LIBRARY_PERMISSION_MESSAGE =
  'Photo library access is required to choose photos and videos.';

function hasMediaLibraryAccess(
  permission: ImagePicker.MediaLibraryPermissionResponse,
): boolean {
  return permission.granted || permission.accessPrivileges === 'limited';
}

/** Request photo-library access; prompts to open Settings when denied. */
export async function ensureMediaLibraryAccess(): Promise<boolean> {
  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (hasMediaLibraryAccess(existing)) {
    return true;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (hasMediaLibraryAccess(permission)) {
    return true;
  }

  Alert.alert(
    'Photos access needed',
    'Allow ASC to access your photos in Settings so you can upload profile pictures, tournament posters, and videos.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ],
  );
  return false;
}
