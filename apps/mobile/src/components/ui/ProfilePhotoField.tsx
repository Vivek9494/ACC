import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, View } from 'react-native';

import { FIELD_ORANGE, inputFieldShellStyle, labelClassName, type LabelVariant } from './fieldStyles';
import { Text } from './Text';

export interface ProfilePhotoFieldProps {
  label?: string;
  labelVariant?: LabelVariant;
  uri: string | null;
  onChange: (uri: string | null) => void;
  containerClassName?: string;
}

/** Optional profile photo picker (spec §3.1). Local URI until upload is wired. */
export function ProfilePhotoField({
  label = 'Profile Photo',
  labelVariant = 'brand',
  uri,
  onChange,
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
      onChange(result.assets[0].uri);
    }
  }

  return (
    <View className={containerClassName}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      <Pressable
        onPress={() => void pick()}
        className="flex-row items-center gap-4 px-5 py-4"
        style={inputFieldShellStyle()}
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
          <Text className="font-sans text-xs text-[#9AA0A6]">Optional</Text>
        </View>
        {uri ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove profile photo"
          >
            <Ionicons name="close-circle" size={22} color="#9AA0A6" />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}
