import { Ionicons } from '@expo/vector-icons';
import { formatLeaderboardEconomy, type BowlingLeaderboardEntry } from '@acc/types';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { PlayerAvatar } from './PlayerAvatar';

export interface BowlingLeaderboardCardProps {
  entry: BowlingLeaderboardEntry;
}

/** One ranked bowling row on the tournament leaderboard tab. */
export function BowlingLeaderboardCard({ entry }: BowlingLeaderboardCardProps): React.ReactElement {
  const isTopRank = entry.rank === 1;
  const displayName = `${entry.firstName} ${entry.lastName}`.trim();

  return (
    <View
      className="relative overflow-hidden rounded-control border border-outline-variant bg-surface p-4"
      style={isTopRank ? INPUT_SHADOW_STYLE : undefined}
    >
      <View className="absolute right-2 top-2">
        <View
          className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${
            isTopRank ? 'bg-secondary-container' : 'bg-surface-container-high'
          }`}
        >
          {!isTopRank ? (
            <Ionicons
              name="medal-outline"
              size={14}
              color={colors.textMuted}
              accessibilityElementsHidden
            />
          ) : null}
          <Text
            className={`font-sans-semibold text-xs ${
              isTopRank ? 'text-on-secondary-container' : 'text-on-surface-variant'
            }`}
          >
            #{entry.rank}
          </Text>
        </View>
      </View>

      <View className="mb-4 flex-row items-center gap-3 pr-16">
        <PlayerAvatar
          firstName={entry.firstName}
          profilePhotoUrl={entry.profilePhotoUrl}
          size="md"
          highlighted={isTopRank}
        />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-bold text-base text-on-surface" numberOfLines={1}>
            {displayName}
          </Text>
          <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={1}>
            {entry.teamName}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-sans-bold text-2xl text-primary">{entry.wickets}</Text>
          <Text className="font-sans text-xs uppercase tracking-wide text-on-surface-variant">
            Wickets
          </Text>
        </View>
      </View>

      <View className="flex-row border-t border-surface-container pt-3">
        <StatCell label="Matches" value={String(entry.matches)} />
        <StatCell label="Wickets" value={String(entry.wickets)} highlight />
        <StatCell label="Econ" value={formatLeaderboardEconomy(entry.economy)} />
      </View>
    </View>
  );
}

function StatCell({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): React.ReactElement {
  return (
    <View className="flex-1">
      <Text className="font-sans text-xs text-on-surface-variant">{label}</Text>
      <Text
        className={`font-sans-bold text-base ${highlight ? 'text-primary' : 'text-on-surface'}`}
      >
        {value}
      </Text>
    </View>
  );
}
