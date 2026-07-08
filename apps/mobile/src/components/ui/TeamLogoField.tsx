import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import {
  pickImage,
  teamLogoPickOptions,
  type PickedImageFile,
} from '../../lib/imagePicker';
import { ERROR_BORDER_CLASS, FIELD_ORANGE, labelClassName } from './fieldStyles';
import { FormErrorText } from './FormErrorText';
import { Text } from './Text';

export interface TeamLogoFieldProps {
  uri: string | null;
  uploading?: boolean;
  onFilePicked: (file: PickedImageFile) => void | Promise<void>;
  onPickError?: (message: string) => void;
  error?: string;
}

/** Dashed upload area for optional team logo (JPEG, max 5MB). */
export function TeamLogoField({
  uri,
  uploading = false,
  onFilePicked,
  onPickError,
  error,
}: TeamLogoFieldProps): React.ReactElement {
  async function pick(): Promise<void> {
    const result = await pickImage(teamLogoPickOptions());
    if (result === null) {
      return;
    }
    if (!result.ok) {
      onPickError?.(result.error);
      return;
    }
    await onFilePicked(result.file);
  }

  const borderClass = error ? ERROR_BORDER_CLASS : 'border-outline-variant';

  return (
    <View className="gap-2">
      <Text className={labelClassName()}>Team Logo</Text>
      <Pressable
        onPress={() => void pick()}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel="Upload team logo"
        className={`relative w-full overflow-hidden rounded-control border-2 border-dashed bg-surface-container-lowest ${borderClass} ${uploading ? 'opacity-70' : ''} ${uri ? '' : 'aspect-square items-center justify-center gap-3'}`}
      >
        {uri ? (
          <>
            <Image
              source={{ uri }}
              className="aspect-square w-full rounded-control"
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            {uploading ? (
              <View className="absolute inset-0 items-center justify-center rounded-control bg-black/30">
                <ActivityIndicator color={colors.textInverse} />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Ionicons name="image-outline" size={48} color={FIELD_ORANGE} />
            <Text className="font-sans-semibold text-sm text-primary">Tap to upload team logo</Text>
          </>
        )}
      </Pressable>
      {uploading ? (
        <Text className="font-sans text-sm text-on-surface-variant">Uploading logo…</Text>
      ) : null}
      <FormErrorText>{error}</FormErrorText>
    </View>
  );
}
