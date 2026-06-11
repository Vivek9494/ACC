import { Ionicons } from '@expo/vector-icons';
import {
  SIGNUP_VALIDATION_MESSAGES,
  isAllowedSignupProfilePhotoMime,
  isAllowedSignupProfilePhotoSize,
} from '@acc/types';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, View } from 'react-native';

import { FIELD_ORANGE } from './fieldStyles';
import { Text } from './Text';

export interface EditProfilePhotoProps {
  uri: string | null;
  onChange: (uri: string | null) => void;
  onValidationError?: (message: string | null) => void;
  error?: string;
}

/** Large circular profile photo with camera badge — Edit Profile header block. */
export function EditProfilePhoto({
  uri,
  onChange,
  onValidationError,
  error,
}: EditProfilePhotoProps): React.ReactElement {
  async function pick(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!isAllowedSignupProfilePhotoMime(asset.mimeType)) {
        onValidationError?.(SIGNUP_VALIDATION_MESSAGES.profilePhoto.type);
        return;
      }
      if (!isAllowedSignupProfilePhotoSize(asset.fileSize)) {
        onValidationError?.(SIGNUP_VALIDATION_MESSAGES.profilePhoto.size);
        return;
      }
      onValidationError?.(null);
      onChange(asset.uri);
    }
  }

  return (
    <View className="items-center gap-2">
      <Pressable
        onPress={() => void pick()}
        accessibilityRole="button"
        accessibilityLabel="Update profile photo"
        className="relative active:opacity-90"
      >
        {uri ? (
          <Image source={{ uri }} className="h-28 w-28 rounded-full" />
        ) : (
          <View className="h-28 w-28 items-center justify-center rounded-full bg-[#FDF1EA]">
            <Ionicons name="person-outline" size={48} color={FIELD_ORANGE} />
          </View>
        )}
        <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary">
          <Ionicons name="camera" size={18} color="#ffffff" />
        </View>
      </Pressable>
      <Text className="font-sans text-sm text-on-surface-variant">Tap to update photo</Text>
      {error ? <Text className="font-sans text-sm text-error">{error}</Text> : null}
    </View>
  );
}
