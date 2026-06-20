import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { pickImage, profilePhotoPickOptions, tournamentPosterPickOptions, type PickedImageFile } from '../../lib/imagePicker';
import { ERROR_BORDER_CLASS, FIELD_ORANGE, labelClassName } from './fieldStyles';
import { FormErrorText } from './FormErrorText';
import { Text } from './Text';

export interface TournamentPosterFieldProps {
  uri: string | null;
  uploading?: boolean;
  onFilePicked: (file: PickedImageFile) => void | Promise<void>;
  onPickError?: (message: string) => void;
  error?: string;
}

/** Dashed upload card for tournament poster (JPEG only, max 5MB). */
export function TournamentPosterField({
  uri,
  uploading = false,
  onFilePicked,
  onPickError,
  error,
}: TournamentPosterFieldProps): React.ReactElement {
  async function pick(): Promise<void> {
    const result = await pickImage(tournamentPosterPickOptions());
    if (result === null) {
      return;
    }
    if (!result.ok) {
      onPickError?.(result.error);
      return;
    }
    await onFilePicked(result.file);
  }

  const borderClass = error ? ERROR_BORDER_CLASS : 'border-primary/40';

  return (
    <View className="gap-2">
      <Text className={labelClassName()}>Tournament Poster</Text>
      <Pressable
        onPress={() => void pick()}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel="Upload tournament poster"
        className={`items-center justify-center gap-2 rounded-control border-2 border-dashed bg-primary-50/40 px-4 py-8 ${borderClass} ${uploading ? 'opacity-70' : ''}`}
      >
        {uri ? (
          <>
            <Image source={{ uri }} className="h-32 w-full rounded-lg" resizeMode="cover" />
            {uploading ? (
              <View className="absolute inset-0 items-center justify-center rounded-lg bg-black/30">
                <ActivityIndicator color={colors.textInverse} />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={32} color={FIELD_ORANGE} />
            <Text className="font-sans-semibold text-sm text-on-surface">Tap to upload poster</Text>
            <Text className="font-sans text-xs text-on-surface-variant">JPEG up to 5MB</Text>
          </>
        )}
      </Pressable>
      {uploading ? (
        <Text className="font-sans text-sm text-on-surface-variant">Uploading poster…</Text>
      ) : null}
      <FormErrorText>{error}</FormErrorText>
    </View>
  );
}
