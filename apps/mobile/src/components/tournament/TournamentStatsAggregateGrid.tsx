import type { TournamentAggregateStats } from '@acc/types';
import { formatPlayerProfileInteger } from '@acc/types';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface AggregateStatCardConfig {
  key: keyof TournamentAggregateStats;
  label: string;
  icon: IoniconName | MaterialIconName;
  iconLibrary?: 'ionicons' | 'material-community';
}

const STAT_CARDS: AggregateStatCardConfig[] = [
  { key: 'totalRuns', label: 'Total Runs', icon: 'trending-up-outline' },
  { key: 'totalWickets', label: 'Total Wickets', icon: 'cricket', iconLibrary: 'material-community' },
  { key: 'sixes', label: 'Sixes', icon: 'flash-outline' },
  { key: 'fours', label: 'Fours', icon: 'grid-outline' },
  { key: 'fifties', label: '50s', icon: 'ribbon-outline' },
  { key: 'hundreds', label: '100s', icon: 'trophy-outline' },
  { key: 'fifers', label: 'Fifers', icon: 'medal-outline' },
];

function AggregateStatCard({
  label,
  value,
  icon,
  iconLibrary = 'ionicons',
}: {
  label: string;
  value: string;
  icon: IoniconName | MaterialIconName;
  iconLibrary?: 'ionicons' | 'material-community';
}): React.ReactElement {
  return (
    <View className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      {iconLibrary === 'material-community' ? (
        <MaterialCommunityIcons name={icon as MaterialIconName} size={22} color={FIELD_ORANGE} />
      ) : (
        <Ionicons name={icon as IoniconName} size={22} color={FIELD_ORANGE} />
      )}
      <Text className="mt-2 font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
        {label}
      </Text>
      <Text className="mt-1 font-sans-bold text-2xl text-primary">{value}</Text>
    </View>
  );
}

export interface TournamentStatsAggregateGridProps {
  aggregates: TournamentAggregateStats;
}

/** Two-column tournament aggregate stat cards. */
export function TournamentStatsAggregateGrid({
  aggregates,
}: TournamentStatsAggregateGridProps): React.ReactElement {
  return (
    <View className="flex-row flex-wrap gap-3">
      {STAT_CARDS.map((card) => (
        <View key={card.key} className="w-[48%]">
          <AggregateStatCard
            label={card.label}
            value={formatPlayerProfileInteger(aggregates[card.key])}
            icon={card.icon}
            iconLibrary={card.iconLibrary}
          />
        </View>
      ))}
    </View>
  );
}
