import { Ionicons } from '@expo/vector-icons';
import {
  SIGNUP_VALIDATION_MESSAGES,
  isAllowedSignupProfilePhotoMime,
  isAllowedSignupProfilePhotoSize,
} from '@acc/types';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, View } from 'react-native';

import { FIELD_ORANGE, INPUT_SHADOW_STYLE, labelClassName, type LabelVariant } from './fieldStyles';
import { Text } from './Text';

export interface ProfilePhotoFieldProps {
  label?: string;
  labelVariant?: LabelVariant;
  uri: string | null;
  onChange: (uri: string | null) => void;
  onValidationError?: (message: string | null) => void;
  error?: string;
  containerClassName?: string;
}

/** Optional profile photo picker (spec §3.1). Local URI until upload is wired. */
export function ProfilePhotoField({
  label = 'Profile Photo',
  labelVariant = 'brand',
  uri,
  onChange,
  onValidationError,
  error,
  containerClassName,
}: ProfilePhotoFieldProps): React.ReactElement {
  async function pick(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

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

  let borderClass = 'border border-[#F1F1F1]';
  if (error) {
    borderClass = 'border border-error';
  }

  return (
    <View className={containerClassName}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      <Pressable
        onPress={() => void pick()}
        className={`flex-row items-center gap-4 rounded-control bg-white px-5 py-4 ${borderClass}`}
        style={INPUT_SHADOW_STYLE}
      >
        {uri ? (
          <Image source={{ uri }} className="h-14 w-14 rounded-xl" />
        ) : (
          <View className="h-14 w-14 items-center justify-center rounded-xl bg-[#FDF1EA]">
            <Ionicons name="camera-outline" size={24} color={FIELD_ORANGE} />
          </View>
        )}
        <View className="flex-1">
          <Text className="font-sans-semibold text-sm text-[#1A1A1A]">
            {uri ? 'Change photo' : 'Add profile photo'}
          </Text>
          <Text className="font-sans text-xs text-[#9AA0A6]">Optional · JPG only · max 5MB</Text>
        </View>
        {uri ? (
          <Pressable
            onPress={() => {
              onChange(null);
              onValidationError?.(null);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove profile photo"
          >
            <Ionicons name="close-circle" size={22} color="#9AA0A6" />
          </Pressable>
        ) : null}
      </Pressable>
      {error ? <Text className="mt-1 font-sans text-sm text-error">{error}</Text> : null}
    </View>
  );
}
