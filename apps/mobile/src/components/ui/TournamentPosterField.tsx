import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { pickImage, tournamentPosterPickOptions, type PickedImageFile } from '../../lib/imagePicker';
import { resolveMediaDisplayUrl } from '../../lib/media-url';
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
  const displayUri = uri ? (resolveMediaDisplayUrl(uri) ?? uri) : null;

  return (
    <View className="gap-2">
      <Text className={labelClassName()}>Tournament Poster</Text>
      <Pressable
        onPress={() => void pick()}
        disabled={uploading}
        accessibilityRole="button"
        accessibilityLabel="Upload tournament poster"
        className={`relative w-full overflow-hidden rounded-control border-2 border-dashed bg-primary-50/40 ${borderClass} ${uploading ? 'opacity-70' : ''} ${displayUri ? '' : 'items-center justify-center gap-2 px-4 py-8'}`}
      >
        {displayUri ? (
          <>
            <Image
              source={{ uri: displayUri }}
              className="aspect-video w-full rounded-lg"
              style={{ width: '100%', aspectRatio: 16 / 9 }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              onError={(event) => {
                if (__DEV__) {
                  console.warn('[TournamentPosterField] poster failed to load', {
                    uri: displayUri.slice(0, 160),
                    error: event.nativeEvent.error,
                  });
                }
              }}
            />
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
