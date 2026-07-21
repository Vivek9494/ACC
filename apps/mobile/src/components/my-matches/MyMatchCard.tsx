import { MatchCardDisplayState, resolveEffectiveStartTime, type MyMatchListItem } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { MatchCardDisplayBadge } from '../tournament/MatchCardDisplayBadge';
import { Button } from '../ui/Button';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';

function formatMyMatchDateTimeLine(
  match: Pick<MyMatchListItem, 'matchDate' | 'startTime' | 'delayMinutes'>,
): string {
  const effectiveStart = resolveEffectiveStartTime({
    matchDate: match.matchDate,
    startTime: match.startTime,
    delayMinutes: match.delayMinutes ?? 0,
  });

  if (!match.matchDate && !effectiveStart) {
    return 'Date TBD';
  }

  const instant = effectiveStart ?? (match.matchDate ? `${match.matchDate}T12:00:00.000Z` : null);
  if (!instant) {
    return 'Date TBD';
  }

  const date = instant instanceof Date ? instant : new Date(instant);
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(match.matchDate ?? '');
  const dateLabel = effectiveStart
    ? date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : day
      ? new Date(
          Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12, 0, 0, 0),
        ).toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : match.matchDate ?? 'Date TBD';

  if (!effectiveStart) {
    return dateLabel;
  }

  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel} • ${timeLabel}`;
}

/** Full-width team row — name left (wraps), score right (dashboard MatchSummaryCard style). */
function TeamRow({ team }: { team: MyMatchListItem['teamA'] }): React.ReactElement {
  const toneClass = team.isWinner ? 'text-primary' : 'text-on-surface';

  return (
    <View className="flex-row items-start gap-3">
      <Text className={`min-w-0 flex-1 font-sans-bold text-base ${toneClass}`}>
        {team.name}
      </Text>
      {team.scoreLine ? (
        <Text className={`shrink-0 font-sans-bold text-base ${toneClass}`}>{team.scoreLine}</Text>
      ) : null}
    </View>
  );
}

export interface MyMatchCardProps {
  match: MyMatchListItem;
  onPress: () => void;
  onWatchLivePress: () => void;
  onScorecardPress: () => void;
}

/** One row on the My Matches screen. */
export function MyMatchCard({
  match,
  onPress,
  onWatchLivePress,
  onScorecardPress,
}: MyMatchCardProps): React.ReactElement {
  const isLive = match.displayState === MatchCardDisplayState.Live;
  const isCancelled = match.displayState === MatchCardDisplayState.Cancelled;
  const isCompleted = match.displayState === MatchCardDisplayState.Completed;
  const isScheduled = match.displayState === MatchCardDisplayState.Scheduled;
  const showFooterLine = Boolean(match.footerLine && !isCancelled && !isScheduled);

  const cardPress = isLive ? onWatchLivePress : isCancelled ? onScorecardPress : onPress;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={cardPress}
      className={`gap-3 rounded-control border border-outline-variant bg-surface p-4 active:opacity-90 ${
        isLive ? 'border-primary/30' : isCancelled ? 'border-error/20' : ''
      }`}
      style={INPUT_SHADOW_STYLE}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text
          className="min-w-0 flex-1 font-sans-bold text-xs uppercase tracking-wider text-primary"
          numberOfLines={2}
        >
          {match.tournamentName}
        </Text>
        <MatchCardDisplayBadge state={match.state} />
      </View>

      <View className="flex-row items-center gap-2">
        <MaterialIcons name="event" size={16} color={colors.textMuted} />
        <Text className="font-sans text-sm text-on-surface-variant">
          {formatMyMatchDateTimeLine(match)}
        </Text>
      </View>

      <View className="gap-3">
        <TeamRow team={match.teamA} />
        <View className="h-0.75 bg-separator" />
        <TeamRow team={match.teamB} />

        {showFooterLine ? (
          <Text
            className={`font-sans-semibold text-sm ${
              isCompleted ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            {match.footerLine}
          </Text>
        ) : null}
      </View>

      {isLive ? (
        <Button
          label="Watch Live"
          variant="amber"
          className="h-12 w-full"
          onPress={onWatchLivePress}
        />
      ) : null}

      {isCancelled ? (
        <View className="flex-row gap-2">
          <Button
            label="Scorecard"
            variant="outline"
            className="h-12 min-w-0 flex-1"
            onPress={onScorecardPress}
          />
          <Button
            label="Details"
            variant="outline"
            className="h-12 min-w-0 flex-1"
            onPress={onPress}
          />
        </View>
      ) : null}
    </Pressable>
  );
}
