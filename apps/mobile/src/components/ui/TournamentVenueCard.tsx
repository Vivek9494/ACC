import { Ionicons } from '@expo/vector-icons';
import type { TournamentDetail } from '@acc/types';
import { Pressable, View } from 'react-native';

import {
  openTournamentVenueInMaps,
  tournamentVenueIsOpenable,
} from '../../lib/open-tournament-venue';
import { FIELD_ORANGE } from './fieldStyles';
import { Text } from './Text';

export function TournamentVenueCardContent({
  tournament,
}: {
  tournament: Pick<TournamentDetail, 'locationAddress' | 'latitude' | 'longitude'>;
}): React.ReactElement {
  const address = tournament.locationAddress?.trim() || 'Location to be announced';
  const openable = tournamentVenueIsOpenable(tournament);

  if (!openable) {
    return (
      <View className="flex-row items-start gap-2">
        <Ionicons name="location-outline" size={18} color={FIELD_ORANGE} />
        <Text className="flex-1 font-sans text-base text-on-surface-variant">{address}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void openTournamentVenueInMaps(tournament)}
      accessibilityRole="link"
      accessibilityLabel={`Open venue in maps: ${address}`}
      className="flex-row items-start gap-2 active:opacity-80"
    >
      <Ionicons name="location-outline" size={18} color={FIELD_ORANGE} />
      <Text className="flex-1 font-sans text-base text-primary underline">{address}</Text>
    </Pressable>
  );
}
