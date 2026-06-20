import { colors } from '@/theme/colors';
import {
  MatchCardDisplayState,
  type MatchListItem,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import {
  formatMatchListContextLabel,
  formatMatchLiveScoreLine,
} from '../../lib/match-display';
import { Button } from '../ui/Button';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';
import { MatchCardDisplayBadge } from './MatchCardDisplayBadge';

function TeamColumn({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}): React.ReactElement {
  return (
    <View className="flex-1 items-center gap-3">
      <TeamAvatar name={name} logoUrl={logoUrl} size="md" />
      <Text className="text-center font-sans-bold text-sm text-on-surface" numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

function VenueRow({ venue }: { venue: string }): React.ReactElement {
  return (
    <View className="flex-row items-center gap-2">
      <MaterialIcons name="location-on" size={18} color={colors.textMuted} />
      <Text className="flex-1 font-sans text-sm text-on-surface-variant" numberOfLines={2}>
        {venue}
      </Text>
    </View>
  );
}

function MatchListCard({
  match,
  onPress,
  onWatchLivePress,
}: {
  match: MatchListItem;
  onPress: () => void;
  onWatchLivePress: () => void;
}): React.ReactElement {
  const contextLabel = formatMatchListContextLabel(match);
  const isLive = match.displayState === MatchCardDisplayState.Live;
  const liveScoreLine = match.liveScore ? formatMatchLiveScoreLine(match.liveScore) : null;
  const venue = match.groundLocation?.trim();

  return (
    <View
      className={`gap-4 rounded-control border border-outline-variant bg-surface p-4 ${
        isLive ? 'border-primary/30' : ''
      }`}
      style={INPUT_SHADOW_STYLE}
    >
      <Pressable
        accessibilityRole="button"
        onPress={isLive ? onWatchLivePress : onPress}
        className="gap-6 active:opacity-90"
      >
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="flex-1 font-sans-semibold text-sm text-on-surface-variant"
            numberOfLines={1}
          >
            {contextLabel}
          </Text>
          <MatchCardDisplayBadge displayState={match.displayState} />
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <TeamColumn name={match.teamA.name} logoUrl={match.teamA.logoUrl} />
          <Text className="px-2 font-sans-bold text-xl italic text-primary">VS</Text>
          <TeamColumn name={match.teamB.name} logoUrl={match.teamB.logoUrl} />
        </View>

        {match.displayState === MatchCardDisplayState.Completed && match.resultSummary ? (
          <Text className="text-center font-sans-bold text-base text-primary">
            {match.resultSummary}
          </Text>
        ) : null}

        {isLive && liveScoreLine ? (
          <View className="items-center gap-1">
            <Text className="font-sans-bold text-2xl text-on-surface">{liveScoreLine.score}</Text>
            <Text className="font-sans text-sm text-on-surface-variant">{liveScoreLine.overs}</Text>
          </View>
        ) : null}

        {match.displayState === MatchCardDisplayState.Scheduled && venue ? (
          <VenueRow venue={venue} />
        ) : null}
      </Pressable>

      {isLive ? (
        <Button
          label="Watch Live"
          variant="amber"
          className="h-12 w-full"
          onPress={onWatchLivePress}
        />
      ) : null}
    </View>
  );
}

export interface MatchListProps {
  matches: MatchListItem[];
  onMatchPress: (matchId: string) => void;
  onWatchLivePress: (matchId: string) => void;
}

/** Tournament Matches tab — date-ordered match cards. */
export function MatchList({
  matches,
  onMatchPress,
  onWatchLivePress,
}: MatchListProps): React.ReactElement {
  return (
    <View className="gap-4">
      {matches.map((match) => (
        <MatchListCard
          key={match.id}
          match={match}
          onPress={() => onMatchPress(match.id)}
          onWatchLivePress={() => onWatchLivePress(match.id)}
        />
      ))}
    </View>
  );
}
