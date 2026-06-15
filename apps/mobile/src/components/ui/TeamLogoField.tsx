import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import {
  pickImage,
  teamLogoPickOptions,
  type PickedImageFile,
} from '../../lib/imagePicker';
import { FIELD_ORANGE, labelClassName } from './fieldStyles';
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

  const borderClass = error ? 'border-error' : 'border-outline-variant';

  return (
    <View className="gap-2">
      <Text className={labelClassName()}>Team Logo</Text>
      <Pressable
        onPress={() => void pick()}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel="Upload team logo"
        className={`aspect-square w-full items-center justify-center gap-3 rounded-control border-2 border-dashed bg-surface-container-lowest ${borderClass} ${uploading ? 'opacity-70' : ''}`}
      >
        {uri ? (
          <>
            <Image source={{ uri }} className="h-full w-full rounded-control" resizeMode="contain" />
            {uploading ? (
              <View className="absolute inset-0 items-center justify-center rounded-control bg-black/30">
                <ActivityIndicator color="#ffffff" />
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
      {error ? <Text className="font-sans text-sm text-error">{error}</Text> : null}
    </View>
  );
}
