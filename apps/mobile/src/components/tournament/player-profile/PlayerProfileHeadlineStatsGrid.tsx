import type { PlayerProfileCareerStats } from '@acc/types';
import {
  formatPlayerProfileAverage,
  formatPlayerProfileInteger,
  formatPlayerProfileStrikeRate,
} from '@acc/types';
import { View } from 'react-native';

import { Text } from '../../ui/Text';

interface HeadlineStatCardProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function HeadlineStatCard({
  label,
  value,
  valueClassName = 'text-on-surface',
}: HeadlineStatCardProps): React.ReactElement {
  return (
    <View className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
        {label}
      </Text>
      <Text className={`mt-2 font-sans-bold text-2xl ${valueClassName}`}>{value}</Text>
    </View>
  );
}

export interface PlayerProfileHeadlineStatsGridProps {
  career: PlayerProfileCareerStats;
}

/** Top 2×2 headline stat cards — plain values only (no trend/percentile sublines). */
export function PlayerProfileHeadlineStatsGrid({
  career,
}: PlayerProfileHeadlineStatsGridProps): React.ReactElement {
  return (
    <View className="flex-row flex-wrap gap-3">
      <View className="w-[48%]">
        <HeadlineStatCard
          label="Total Runs"
          value={formatPlayerProfileInteger(career.runs)}
          valueClassName="text-primary"
        />
      </View>
      <View className="w-[48%]">
        <HeadlineStatCard label="Average" value={formatPlayerProfileAverage(career.average)} />
      </View>
      <View className="w-[48%]">
        <HeadlineStatCard label="Highest Score" value={career.highestScore ?? '–'} />
      </View>
      <View className="w-[48%]">
        <HeadlineStatCard
          label="Strike Rate"
          value={formatPlayerProfileStrikeRate(career.strikeRate)}
        />
      </View>
    </View>
  );
}
