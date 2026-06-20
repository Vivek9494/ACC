import type { PlayerProfileCareerStats } from '@acc/types';
import {
  formatPlayerProfileAverage,
  formatPlayerProfileCareerSpanYears,
  formatPlayerProfileInteger,
  formatPlayerProfileStrikeRate,
} from '@acc/types';
import { View } from 'react-native';

import { Text } from '../../ui/Text';

interface StatCardProps {
  label: string;
  value: string;
  subline?: string | null;
  valueClassName?: string;
  children?: React.ReactNode;
}

function StatCard({
  label,
  value,
  subline,
  valueClassName = 'text-on-surface',
  children,
}: StatCardProps): React.ReactElement {
  return (
    <View className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
        {label}
      </Text>
      <Text className={`mt-2 font-sans-bold text-2xl ${valueClassName}`}>{value}</Text>
      {subline ? (
        <Text className="mt-1 font-sans text-xs text-on-surface-variant">{subline}</Text>
      ) : null}
      {children}
    </View>
  );
}

export interface PlayerProfileCareerStatsGridProps {
  career: PlayerProfileCareerStats;
  showStumpingsCard: boolean;
}

/** Two-column career stat cards matching the player profile design. */
export function PlayerProfileCareerStatsGrid({
  career,
  showStumpingsCard,
}: PlayerProfileCareerStatsGridProps): React.ReactElement {
  const careerSpan = formatPlayerProfileCareerSpanYears(career.careerSpanYears);

  return (
    <View className="flex-row flex-wrap gap-3">
      <View className="w-[48%]">
        <StatCard
          label="Total Runs"
          value={formatPlayerProfileInteger(career.runs)}
          valueClassName="text-primary"
        />
      </View>
      <View className="w-[48%]">
        <StatCard label="Average" value={formatPlayerProfileAverage(career.average)} />
      </View>
      <View className="w-[48%]">
        <View className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
          <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
            Highest Score
          </Text>
          <View className="mt-2 flex-row flex-wrap items-baseline gap-2">
            <Text className="font-sans-bold text-2xl text-on-surface">
              {career.highestScore ?? '–'}
            </Text>
            {career.highestScoreOpponent ? (
              <Text className="font-sans text-xs text-on-surface-variant">
                vs {career.highestScoreOpponent}
              </Text>
            ) : null}
          </View>
          {career.highestScoreContext ? (
            <Text className="mt-1 font-sans text-xs text-on-surface-variant">
              {career.highestScoreContext}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="w-[48%]">
        <StatCard label="Strike Rate" value={formatPlayerProfileStrikeRate(career.strikeRate)}>
          {career.strikeRateBarPercent != null ? (
            <View className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container">
              <View
                className="h-1 rounded-full bg-primary"
                style={{ width: `${career.strikeRateBarPercent}%` }}
              />
            </View>
          ) : null}
        </StatCard>
      </View>
      <View className="w-[48%]">
        <StatCard
          label="Total Wickets"
          value={formatPlayerProfileInteger(career.wickets)}
          subline={careerSpan ? `Career Span: ${careerSpan}` : null}
        />
      </View>
      <View className="w-[48%]">
        <StatCard
          label="Best Figures"
          value={career.bestBowling ?? '–'}
          subline={career.bestBowlingContext}
        />
      </View>
      <View className="w-[48%]">
        <StatCard label="Total Catches" value={formatPlayerProfileInteger(career.catches)} />
      </View>
      {showStumpingsCard ? (
        <View className="w-[48%]">
          <StatCard
            label="Total Stumpings"
            value={formatPlayerProfileInteger(career.stumpings)}
          />
        </View>
      ) : null}
      <View className="w-[48%]">
        <StatCard label="Total Sixes" value={formatPlayerProfileInteger(career.sixes)} />
      </View>
      <View className="w-[48%]">
        <StatCard label="Total Fours" value={formatPlayerProfileInteger(career.fours)} />
      </View>
    </View>
  );
}
