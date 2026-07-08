import type { TournamentDetail } from '@acc/types';
import { Pressable, View } from 'react-native';

import { tournamentScopeLine } from '../../lib/tournament-display';
import {
  promptOpenVenueInMaps,
  tournamentVenueIsOpenable,
} from '../../lib/open-tournament-venue';
import { Text } from './Text';

export function TournamentVenueCardContent({
  tournament,
}: {
  tournament: Pick<
    TournamentDetail,
    'locationAddress' | 'latitude' | 'longitude' | 'scopeDisplay'
  >;
}): React.ReactElement {
  const scopeLine = tournamentScopeLine(tournament);
  const address = tournament.locationAddress?.trim() || 'Location to be announced';
  const openable = tournamentVenueIsOpenable(tournament);

  const addressNode = openable ? (
    <Pressable
      onPress={() =>
        promptOpenVenueInMaps({
          address: tournament.locationAddress,
          latitude: tournament.latitude,
          longitude: tournament.longitude,
        })
      }
      accessibilityRole="link"
      accessibilityLabel={`Open venue in maps: ${address}`}
      className="active:opacity-80"
    >
      <Text className="font-sans text-base text-primary underline">{address}</Text>
    </Pressable>
  ) : (
    <Text className="font-sans text-base text-on-surface-variant">{address}</Text>
  );

  return (
    <View className="gap-2">
      {scopeLine ? (
        <Text className="font-sans text-base text-on-surface">{scopeLine}</Text>
      ) : null}
      {addressNode}
    </View>
  );
}
