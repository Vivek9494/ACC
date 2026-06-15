import { View } from 'react-native';

import { Card } from './Card';
import { StatusPill } from './StatusPill';
import { TeamAvatar } from './TeamAvatar';
import { Text } from './Text';

export type MatchSummaryCardStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED';

export interface MatchSummaryTeamProps {
  name: string;
  logoUrl?: string | null;
  score?: string | null;
  overs?: string | null;
  isWinner?: boolean;
}

export interface MatchSummaryCardProps {
  tournamentName: string;
  teamA: MatchSummaryTeamProps;
  teamB: MatchSummaryTeamProps;
  status: MatchSummaryCardStatus;
  /** Toss / pre-match status line (blue). Shown for LIVE (and UPCOMING when set). */
  infoLine?: string | null;
  /** Completed-match result line (blue). Shown for COMPLETED only. */
  resultLine?: string | null;
  onPress?: () => void;
}

function TeamRow({
  team,
  showScore,
}: {
  team: MatchSummaryTeamProps;
  showScore: boolean;
}): React.ReactElement {
  const scoreVisible = showScore && team.score;
  const scoreClass = team.isWinner ? 'text-primary' : 'text-on-surface';

  return (
    <View className="flex-row items-center gap-3">
      <TeamAvatar name={team.name} logoUrl={team.logoUrl} size="xs" />
      <Text className="flex-1 font-sans-bold text-base text-on-surface" numberOfLines={1}>
        {team.name}
      </Text>
      {scoreVisible ? (
        <View className="items-end">
          <Text className={`font-sans-bold text-xl ${scoreClass}`}>{team.score}</Text>
          {team.overs ? (
            <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
              {team.overs}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Featured match card with orange left accent (dashboard home screens). */
export function MatchSummaryCard({
  tournamentName,
  teamA,
  teamB,
  status,
  infoLine,
  resultLine,
  onPress,
}: MatchSummaryCardProps): React.ReactElement {
  const showScore = status !== 'UPCOMING';
  const footerLine =
    status === 'LIVE' || status === 'UPCOMING'
      ? infoLine
      : status === 'COMPLETED'
        ? resultLine
        : null;

  return (
    <Card accent onPress={onPress} className="gap-4 rounded-control">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-sans-medium text-sm text-on-surface-variant" numberOfLines={1}>
          {tournamentName}
        </Text>
        {status === 'LIVE' ? <StatusPill variant="live" label="Live" /> : null}
        {status === 'UPCOMING' ? <StatusPill variant="upcoming" label="Upcoming" /> : null}
      </View>

      <TeamRow team={teamA} showScore={showScore} />

      <View className="h-0.75 bg-separator" />

      <TeamRow team={teamB} showScore={showScore} />

      {footerLine ? (
        <Text className="font-sans-semibold text-sm text-tertiary">{footerLine}</Text>
      ) : null}
    </Card>
  );
}
