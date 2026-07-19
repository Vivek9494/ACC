import { colors } from '@/theme/colors';
import {
  MatchCardDisplayState,
  type MatchListItem,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import {
  formatMatchListContextLabel,
  formatMatchListDeletedAttribution,
} from '../../lib/match-display';
import { Button } from '../ui/Button';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { OverflowMenu, type OverflowMenuAction } from '../ui/OverflowMenu';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';
import { MatchHomeAwayBadge } from '../match/MatchHomeAwayBadge';
import { MatchCardDisplayBadge } from './MatchCardDisplayBadge';
import { MatchDeletedBadge } from './MatchDeletedBadge';

function TeamColumn({
  name,
  logoUrl,
  scoreLine,
}: {
  name: string;
  logoUrl: string | null;
  scoreLine: string | null;
}): React.ReactElement {
  return (
    <View className="min-w-0 flex-1 items-center gap-2">
      <TeamAvatar name={name} logoUrl={logoUrl} size="md" />
      <Text className="text-center font-sans-bold text-sm text-on-surface" numberOfLines={2}>
        {name}
      </Text>
      {scoreLine ? (
        <Text
          className="text-center font-sans-semibold text-xs text-on-surface-variant"
          numberOfLines={1}
        >
          {scoreLine}
        </Text>
      ) : null}
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
  menuActions,
  onPress,
  onWatchLivePress,
  onScorecardPress,
  showLiveMatchDetails = false,
  showCancelledMatchDetails = false,
}: {
  match: MatchListItem;
  menuActions: OverflowMenuAction[];
  onPress: () => void;
  onWatchLivePress: () => void;
  onScorecardPress: () => void;
  showLiveMatchDetails?: boolean;
  showCancelledMatchDetails?: boolean;
}): React.ReactElement {
  const isDeleted = match.isDeleted === true;
  const contextLabel = formatMatchListContextLabel(match);
  const isLive = !isDeleted && match.displayState === MatchCardDisplayState.Live;
  const isCancelled = !isDeleted && match.displayState === MatchCardDisplayState.Cancelled;
  const isCompletedTerminal =
    !isDeleted && match.displayState === MatchCardDisplayState.Completed;
  const venue = match.groundLocation?.trim();
  const hasTeamScores = Boolean(match.teamA.scoreLine || match.teamB.scoreLine);
  const bodyGap =
    hasTeamScores || (match.displayState === MatchCardDisplayState.Scheduled && venue)
      ? 'gap-6'
      : 'gap-4';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={
        isDeleted
          ? onPress
          : isLive
            ? onWatchLivePress
            : isCancelled || isCompletedTerminal
              ? onScorecardPress
              : onPress
      }
      className={`gap-4 rounded-control border border-outline-variant bg-surface p-4 active:opacity-90 ${
        isDeleted
          ? 'border-primary bg-surface-container-low opacity-75'
          : isLive
            ? 'border-primary/30'
            : isCancelled
              ? 'border-error/20'
              : ''
      }`}
      style={INPUT_SHADOW_STYLE}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text
          className="min-w-0 flex-1 font-sans-semibold text-sm text-on-surface-variant"
          numberOfLines={1}
        >
          {contextLabel}
        </Text>
        <View className="shrink-0 flex-row items-center gap-1.5">
          {match.homeAway ? <MatchHomeAwayBadge homeAway={match.homeAway} /> : null}
          {isDeleted ? (
            <MatchDeletedBadge />
          ) : (
            <MatchCardDisplayBadge state={match.state} variant="tournamentPrimary" />
          )}
          {!isDeleted && menuActions.length > 0 ? (
            <OverflowMenu actions={menuActions} iconColor={FIELD_ORANGE} />
          ) : null}
        </View>
      </View>

      <View className={bodyGap}>
        <View className="flex-row items-center justify-between gap-2">
          <TeamColumn
            name={match.teamA.name}
            logoUrl={match.teamA.logoUrl}
            scoreLine={match.teamA.scoreLine}
          />
          <Text className="px-2 font-sans-bold text-xl italic text-primary">VS</Text>
          <TeamColumn
            name={match.teamB.name}
            logoUrl={match.teamB.logoUrl}
            scoreLine={match.teamB.scoreLine}
          />
        </View>

        {isDeleted ? (
          <Text className="text-center font-sans text-sm text-on-surface-variant">
            {formatMatchListDeletedAttribution(match)}
          </Text>
        ) : null}

        {!isDeleted && match.displayState === MatchCardDisplayState.Completed && match.resultSummary ? (
          <Text className="text-center font-sans-bold text-base text-primary">
            {match.resultSummary}
          </Text>
        ) : null}

        {!isDeleted && match.displayState === MatchCardDisplayState.Scheduled && venue ? (
          <VenueRow venue={venue} />
        ) : null}
      </View>

      {isDeleted ? (
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

      {isLive ? (
        showLiveMatchDetails ? (
          <View className="flex-row gap-2">
            <Button
              label="Watch Live"
              variant="amber"
              className="h-12 min-w-0 flex-1"
              onPress={onWatchLivePress}
            />
            <Button
              label="Details"
              variant="outline"
              className="h-12 min-w-0 flex-1"
              onPress={onPress}
            />
          </View>
        ) : (
          <Button
            label="Watch Live"
            variant="amber"
            className="h-12 w-full"
            onPress={onWatchLivePress}
          />
        )
      ) : null}

      {isCancelled ? (
        showCancelledMatchDetails ? (
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
        ) : (
          <Button
            label="Scorecard"
            variant="outline"
            className="h-12 w-full"
            onPress={onScorecardPress}
          />
        )
      ) : null}

      {isCompletedTerminal ? (
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

export interface MatchListProps {
  matches: MatchListItem[];
  onMatchPress: (matchId: string) => void;
  onWatchLivePress: (matchId: string) => void;
  onScorecardPress: (matchId: string) => void;
  buildMenuActions?: (match: MatchListItem) => OverflowMenuAction[];
  /** Admin / Club Manager — secondary Details CTA beside Watch Live on live cards. */
  showLiveMatchDetails?: boolean;
  /** Admin / Club Manager / confirmed registrant — Details beside Scorecard on cancelled cards. */
  showCancelledMatchDetails?: boolean;
}

/** Tournament Matches tab — date-ordered match cards. */
export function MatchList({
  matches,
  onMatchPress,
  onWatchLivePress,
  onScorecardPress,
  buildMenuActions,
  showLiveMatchDetails = false,
  showCancelledMatchDetails = false,
}: MatchListProps): React.ReactElement {
  return (
    <View className="gap-4">
      {matches.map((match) => (
        <MatchListCard
          key={match.id}
          match={match}
          menuActions={buildMenuActions?.(match) ?? []}
          onPress={() => onMatchPress(match.id)}
          onWatchLivePress={() => onWatchLivePress(match.id)}
          onScorecardPress={() => onScorecardPress(match.id)}
          showLiveMatchDetails={showLiveMatchDetails}
          showCancelledMatchDetails={showCancelledMatchDetails}
        />
      ))}
    </View>
  );
}
