import type { TournamentBoundaryLeaderboardEntry } from '@acc/types';
import { View } from 'react-native';

import { Text } from '../ui/Text';
import { PlayerAvatar } from './PlayerAvatar';

export interface TournamentBoundaryLeaderboardSectionProps {
  title: string;
  unitLabel: string;
  entries: readonly TournamentBoundaryLeaderboardEntry[];
  emptyMessage?: string;
}

/** Top-five Most Sixes / Most Fours list for the tournament Stats tab. */
export function TournamentBoundaryLeaderboardSection({
  title,
  unitLabel,
  entries,
  emptyMessage = 'No data yet',
}: TournamentBoundaryLeaderboardSectionProps): React.ReactElement {
  return (
    <View className="gap-3">
      <Text className="font-sans-bold text-lg text-on-surface">{title}</Text>
      {entries.length === 0 ? (
        <Text className="font-sans text-sm text-on-surface-variant">{emptyMessage}</Text>
      ) : (
        <View className="gap-2">
          {entries.map((entry) => (
            <View
              key={entry.userId}
              className="flex-row items-center gap-3 rounded-control border border-outline-variant/30 bg-surface px-3 py-3"
            >
              <Text className="w-6 font-sans-semibold text-sm text-on-surface-variant">
                #{entry.rank}
              </Text>
              <PlayerAvatar
                firstName={entry.firstName}
                profilePhotoUrl={entry.profilePhotoUrl}
                size="sm"
                highlighted={entry.rank === 1}
              />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-semibold text-base text-on-surface" numberOfLines={1}>
                  {entry.firstName} {entry.lastName}
                </Text>
                <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={1}>
                  {entry.teamName}
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-sans-bold text-xl text-primary">{entry.count}</Text>
                <Text className="font-sans text-[10px] uppercase tracking-wide text-on-surface-variant">
                  {unitLabel}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
