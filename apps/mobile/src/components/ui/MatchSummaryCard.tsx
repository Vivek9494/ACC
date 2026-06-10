import { Image, View } from 'react-native';

import { Card } from './Card';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

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
  /** e.g. "Barrie Cobras won by 40 runs". Omit for live/upcoming. */
  resultNote?: string | null;
  /** When true, shows a Live StatusPill and hides the result line. */
  live?: boolean;
  /** When true, shows an Upcoming StatusPill and hides scores/result. */
  upcoming?: boolean;
  onPress?: () => void;
}

function TeamLogo({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}): React.ReactElement {
  if (logoUrl) {
    return <Image source={{ uri: logoUrl }} className="h-9 w-9 rounded-full" />;
  }

  return (
    <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-container-high">
      <Text className="font-sans-bold text-sm text-primary">{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
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
      <TeamLogo name={team.name} logoUrl={team.logoUrl} />
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

/** Featured match card with orange left accent (Club Manager / player home). */
export function MatchSummaryCard({
  tournamentName,
  teamA,
  teamB,
  resultNote,
  live = false,
  upcoming = false,
  onPress,
}: MatchSummaryCardProps): React.ReactElement {
  const showScore = !upcoming;

  return (
    <Card accent onPress={onPress} className="gap-4">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-sans-medium text-sm text-on-surface-variant" numberOfLines={1}>
          {tournamentName}
        </Text>
        {live ? <StatusPill variant="ongoing" label="Live" /> : null}
        {upcoming ? <StatusPill variant="upcoming" label="Upcoming" /> : null}
      </View>

      <TeamRow team={teamA} showScore={showScore} />

      <View className="h-px bg-outline-variant" />

      <TeamRow team={teamB} showScore={showScore} />

      {resultNote && !live && !upcoming ? (
        <Text className="font-sans-semibold text-sm text-[#1565C0]">{resultNote}</Text>
      ) : null}
    </Card>
  );
}
