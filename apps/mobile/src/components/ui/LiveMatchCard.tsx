import type { GuestFeaturedLiveMatch, GuestThisOverBall } from '@acc/types';
import { View } from 'react-native';

import { Card } from './Card';
import { StatusPill } from './StatusPill';
import { TeamAvatar } from './TeamAvatar';
import { Text } from './Text';

export interface LiveMatchCardProps {
  match: GuestFeaturedLiveMatch;
  onPress?: () => void;
}

function BatterLine({
  name,
  runs,
  balls,
  isOut,
  onStrike,
}: {
  name: string;
  runs: number;
  balls: number;
  isOut: boolean;
  onStrike: boolean;
}): React.ReactElement {
  const scoreText = isOut ? `${runs} (${balls})` : `${runs}${onStrike ? '*' : ''} (${balls})`;

  return (
    <View className="gap-0.5">
      <View className="flex-row items-center gap-1">
        <Text className="font-sans-semibold text-sm text-on-surface" numberOfLines={1}>
          {name}
        </Text>
        {onStrike ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
      </View>
      <Text className="font-sans text-sm text-on-surface-variant">{scoreText}</Text>
    </View>
  );
}

function BallPill({ ball }: { ball: GuestThisOverBall }): React.ReactElement {
  const filled = ball.emphasis === 'primary' || ball.emphasis === 'wicket';
  return (
    <View
      className={`min-h-7 min-w-7 items-center justify-center rounded-full px-2.5 py-1 ${
        filled ? 'bg-primary' : 'border border-outline-variant bg-surface-container-lowest'
      }`}
    >
      <Text
        className={`font-sans-medium text-xs ${filled ? 'text-on-primary' : 'text-on-surface-variant'}`}
      >
        {ball.code}
      </Text>
    </View>
  );
}

/**
 * Rich live match card for the guest dashboard — separate from {@link MatchSummaryCard}
 * because it shows batters, projected score, and the current-over strip (spec §2).
 */
export function LiveMatchCard({ match, onPress }: LiveMatchCardProps): React.ReactElement {
  return (
    <Card accent onPress={onPress} className="gap-4 rounded-control">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-sans-medium text-sm text-on-surface-variant" numberOfLines={1}>
          {match.tournamentName}
        </Text>
        <StatusPill variant="live" label="Live" />
      </View>

      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-3">
          <TeamAvatar name={match.battingTeamName} size="xs" />
          <Text className="flex-1 font-sans-bold text-base text-on-surface" numberOfLines={1}>
            {match.battingTeamName}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-sans-bold text-xl text-primary">{match.score}</Text>
          <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
            {match.overs}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between gap-3 border-y border-separator py-3">
        <View className="flex-1 flex-row gap-4">
          {match.batters.map((batter) => (
            <BatterLine key={`${batter.name}-${batter.onStrike ? 's' : 'ns'}`} {...batter} />
          ))}
        </View>
        <View className="items-end">
          <Text className="font-sans-semibold text-xs uppercase tracking-wider text-secondary">
            Projected
          </Text>
          <Text className="font-sans-bold text-xl text-secondary">{match.projectedRuns}</Text>
          <Text className="font-sans text-sm text-on-surface-variant">@ {match.runRate} rpo</Text>
        </View>
      </View>

      {match.thisOver.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {match.thisOver.map((ball, index) => (
            <BallPill key={`${ball.code}-${index}`} ball={ball} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
