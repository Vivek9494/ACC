import { MatchCardDisplayState, type MyMatchListItem } from '@acc/types';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';
import { StatusPill } from '../ui/StatusPill';

const STATUS_LABEL: Record<MatchCardDisplayState, string> = {
  [MatchCardDisplayState.Completed]: 'Completed',
  [MatchCardDisplayState.Live]: 'Live',
  [MatchCardDisplayState.Scheduled]: 'Scheduled',
};

function formatMyMatchDateTimeLine(
  match: Pick<MyMatchListItem, 'matchDate' | 'startTime'>,
): string {
  if (!match.matchDate) {
    return 'Date TBD';
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(match.matchDate);
  const dateLabel = day
    ? new Date(
        Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12, 0, 0, 0),
      ).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : match.matchDate;

  if (!match.startTime) {
    return dateLabel;
  }
  const timeLabel = new Date(match.startTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel} • ${timeLabel}`;
}

function TeamScoreRow({
  team,
}: {
  team: MyMatchListItem['teamA'];
}): React.ReactElement {
  return (
    <View className="flex-row items-center gap-3">
      <TeamAvatar name={team.name} logoUrl={team.logoUrl} size="sm" />
      <Text
        className={`min-w-0 flex-1 font-sans-semibold text-sm ${
          team.isWinner ? 'text-primary' : 'text-on-surface'
        }`}
        numberOfLines={2}
      >
        {team.name}
      </Text>
      {team.scoreLine ? (
        <Text
          className={`font-sans-bold text-sm ${
            team.isWinner ? 'text-primary' : 'text-on-surface'
          }`}
        >
          {team.scoreLine}
        </Text>
      ) : null}
    </View>
  );
}

export interface MyMatchCardProps {
  match: MyMatchListItem;
  onPress: () => void;
}

/** One row on the My Matches screen. */
function footerTextClass(displayState: MatchCardDisplayState): string {
  if (displayState === MatchCardDisplayState.Live) {
    return 'text-secondary-900';
  }
  if (displayState === MatchCardDisplayState.Completed) {
    return 'text-primary';
  }
  return 'text-on-surface-variant';
}

export function MyMatchCard({ match, onPress }: MyMatchCardProps): React.ReactElement {
  const isLive = match.displayState === MatchCardDisplayState.Live;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`gap-3 rounded-control border border-outline-variant bg-surface p-4 active:opacity-90 ${
        isLive ? 'border-primary/30' : ''
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
        {isLive ? (
          <StatusPill variant="live" label={STATUS_LABEL[match.displayState]} />
        ) : (
          <View className="rounded-full bg-surface-container-high px-3 py-1">
            <Text className="font-sans-semibold text-[10px] uppercase tracking-wider text-on-surface-variant">
              {STATUS_LABEL[match.displayState]}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center gap-2">
        <MaterialIcons name="event" size={16} color={colors.textMuted} />
        <Text className="font-sans text-sm text-on-surface-variant">
          {formatMyMatchDateTimeLine(match)}
        </Text>
      </View>

      <View className="gap-2">
        <TeamScoreRow team={match.teamA} />
        <Text className="text-center font-sans-medium text-xs uppercase tracking-widest text-on-surface-variant">
          vs
        </Text>
        <TeamScoreRow team={match.teamB} />
      </View>

      {match.footerLine ? (
        <View className="flex-row items-center justify-between gap-2 border-t border-separator pt-3">
          <Text
            className={`min-w-0 flex-1 font-sans-semibold text-sm ${footerTextClass(match.displayState)}`}
            numberOfLines={2}
          >
            {match.footerLine}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}
