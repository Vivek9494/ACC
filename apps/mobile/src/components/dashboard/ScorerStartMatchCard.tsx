import { Ionicons } from '@expo/vector-icons';
import {
  isScorerMatchResumable,
  scorerStartMatchDisabledHint,
  type ScorerStartableMatch,
} from '@acc/types';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

import { Button } from '../ui/Button';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

/** Shared match card chrome for scorer Start Match and captain Assign/Switch Scorer. */
export type MatchDayDashboardCardMatch = Pick<
  ScorerStartableMatch,
  'matchId' | 'dateTimeLine' | 'tournamentName' | 'teamA' | 'teamB'
>;

export interface ScorerStartMatchCardProps {
  match: MatchDayDashboardCardMatch;
  onStartPress: () => void;
  /** Defaults to "Start Match". */
  buttonLabel?: string;
}

/** Dashboard card for an assigned per-match Scorer on match day (§11.1). */
export function ScorerStartMatchCard({
  match,
  onStartPress,
  buttonLabel = 'Start Match',
}: ScorerStartMatchCardProps): React.ReactElement {
  const resumable = isScorerMatchResumable(match.state, match.hasScoringSession);
  const startFlow = match.bothTeamsFinalized && !resumable;
  const startDisabled = startFlow && !match.canStartMatch;
  const timeHint =
    startDisabled && match.startMatchBlockedReason === 'TOO_EARLY'
      ? scorerStartMatchDisabledHint(match.startMatchBlockedReason, match.startAllowedAtLine)
      : null;

  return (
    <View
      className="rounded-control border border-outline-variant bg-surface p-5"
      style={INPUT_SHADOW_STYLE}
    >
      <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
        {match.dateTimeLine}
      </Text>
      <Text className="mt-1 font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
        {match.tournamentName}
      </Text>

      <View className="my-6 flex-row items-center">
        <View className="min-w-0 flex-1 items-center gap-2 px-2">
          <TeamAvatar name={match.teamA.name} logoUrl={match.teamA.logoUrl} size="md" />
          <Text
            className="w-full text-center font-sans-semibold text-sm text-on-surface"
            numberOfLines={2}
          >
            {match.teamA.name}
          </Text>
        </View>
        <Text className="shrink-0 px-2 font-sans-bold text-lg text-primary">VS</Text>
        <View className="min-w-0 flex-1 items-center gap-2 px-2">
          <TeamAvatar name={match.teamB.name} logoUrl={match.teamB.logoUrl} size="md" />
          <Text
            className="w-full text-center font-sans-semibold text-sm text-on-surface"
            numberOfLines={2}
          >
            {match.teamB.name}
          </Text>
        </View>
      </View>

      <Button
        onPress={onStartPress}
        disabled={startDisabled}
        className="h-14 w-full flex-row gap-2"
      >
        <Text className="font-sans-semibold text-base text-on-primary">{buttonLabel}</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
      </Button>

      {timeHint ? (
        <Text className="text-center font-sans text-sm text-on-surface-variant">{timeHint}</Text>
      ) : null}
    </View>
  );
}
