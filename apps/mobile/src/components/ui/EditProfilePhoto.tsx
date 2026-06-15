import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';

import { pickImage, profilePhotoPickOptions, type PickedImageFile } from '../../lib/imagePicker';
import { FIELD_ORANGE } from './fieldStyles';
import { Text } from './Text';

export interface EditProfilePhotoProps {
  uri: string | null;
  onChange: (file: PickedImageFile | null) => void;
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
    const result = await pickImage(profilePhotoPickOptions());
    if (result === null) {
      return;
    }
    if (!result.ok) {
      onValidationError?.(result.error);
      return;
    }
    onValidationError?.(null);
    onChange(result.file);
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
