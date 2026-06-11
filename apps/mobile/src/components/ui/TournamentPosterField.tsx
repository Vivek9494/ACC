import { Ionicons } from '@expo/vector-icons';
import {
  TOURNAMENT_FORM_MESSAGES,
  isAllowedTournamentPosterMime,
  isAllowedTournamentPosterSize,
} from '@acc/types';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, View } from 'react-native';

import { FIELD_ORANGE } from './fieldStyles';
import { Text } from './Text';

export interface TournamentPosterFieldProps {
  uri: string | null;
  onChange: (uri: string | null) => void;
  onValidationError?: (message: string | null) => void;
  error?: string;
}

/** Dashed upload card for tournament poster (JPEG/PNG, max 5MB). */
export function TournamentPosterField({
  uri,
  onChange,
  onValidationError,
  error,
}: TournamentPosterFieldProps): React.ReactElement {
  async function pick(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (!isAllowedTournamentPosterMime(asset.mimeType)) {
        onValidationError?.(TOURNAMENT_FORM_MESSAGES.poster.type);
        return;
      }
      if (!isAllowedTournamentPosterSize(asset.fileSize)) {
        onValidationError?.(TOURNAMENT_FORM_MESSAGES.poster.size);
        return;
      }
      onValidationError?.(null);
      onChange(asset.uri);
    }
  }

  const borderClass = error ? 'border-error' : 'border-primary/40';

  return (
    <View className="gap-2">
      <Text className="font-sans-bold text-sm uppercase tracking-wider text-primary">
        Tournament Poster
      </Text>
      <Pressable
        onPress={() => void pick()}
        accessibilityRole="button"
        accessibilityLabel="Upload tournament poster"
        className={`items-center justify-center gap-2 rounded-control border-2 border-dashed bg-[#FDF1EA]/40 px-4 py-8 ${borderClass}`}
      >
        {uri ? (
          <Image source={{ uri }} className="h-32 w-full rounded-lg" resizeMode="cover" />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={32} color={FIELD_ORANGE} />
            <Text className="font-sans-semibold text-sm text-on-surface">Tap to upload poster</Text>
            <Text className="font-sans text-xs text-on-surface-variant">JPEG, PNG up to 5MB</Text>
          </>
        )}
      </Pressable>
      {error ? <Text className="font-sans text-sm text-error">{error}</Text> : null}
    </View>
  );
}
