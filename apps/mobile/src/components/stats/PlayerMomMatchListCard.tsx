import {
  formatPlayerMomBattingLine,
  formatPlayerMomBowlingLine,
  type PlayerMomMatchSummary,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

function formatMatchDate(matchDate: string | null): string {
  if (!matchDate) return 'Date TBD';
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(matchDate);
  if (!day) return matchDate;
  return new Date(
    Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12, 0, 0, 0),
  ).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export interface PlayerMomMatchListCardProps {
  match: PlayerMomMatchSummary;
  onPress: () => void;
}

/** One MoM award row on the player's MoM matches list. */
export function PlayerMomMatchListCard({
  match,
  onPress,
}: PlayerMomMatchListCardProps): React.ReactElement {
  const figureLines = [
    match.figures.batting ? `Batting: ${formatPlayerMomBattingLine(match.figures.batting)}` : null,
    match.figures.bowling ? `Bowling: ${formatPlayerMomBowlingLine(match.figures.bowling)}` : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="gap-3 rounded-control border border-outline-variant bg-surface p-4 active:opacity-90"
      style={INPUT_SHADOW_STYLE}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text
          className="min-w-0 flex-1 font-sans-bold text-xs uppercase tracking-wider text-primary"
          numberOfLines={2}
        >
          {match.tournamentName}
        </Text>
        <View className="rounded-md bg-secondary px-2 py-1">
          <Text className="font-sans-semibold text-[10px] uppercase tracking-wider text-text-inverse">
            MoM
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <MaterialIcons name="event" size={16} color={colors.textMuted} />
        <Text className="font-sans text-sm text-on-surface-variant">{formatMatchDate(match.matchDate)}</Text>
      </View>

      <View className="gap-1">
        <Text className="text-center font-sans-semibold text-base text-on-surface">
          {match.homeTeamName} vs {match.awayTeamName}
        </Text>
        {match.resultNote ? (
          <Text className="text-center font-sans text-sm text-primary">{match.resultNote}</Text>
        ) : null}
      </View>

      {figureLines.length > 0 ? (
        <View className="gap-1 border-t border-outline-variant/40 pt-3">
          {figureLines.map((line) => (
            <Text key={line} className="font-sans text-sm text-on-surface-variant">
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
