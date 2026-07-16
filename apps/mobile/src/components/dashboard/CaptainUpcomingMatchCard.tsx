import type { CaptainScorerAssignmentMatch, CaptainUpcomingMatchCardView } from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { ParticipationPollSection } from './ParticipationPollSection';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';

export interface CaptainUpcomingMatchCardProps {
  card: CaptainUpcomingMatchCardView;
  onOpenScorerAssignment?: (match: CaptainScorerAssignmentMatch) => void;
  onPollUpdated?: () => void;
}

/**
 * Captain-only upcoming leather match card: metadata, inline poll (while open),
 * and stacked prep actions gated by server-computed timing windows.
 */
export function CaptainUpcomingMatchCard({
  card,
  onOpenScorerAssignment,
  onPollUpdated,
}: CaptainUpcomingMatchCardProps): React.ReactElement {
  const router = useRouter();
  const pollOpen = card.participationPoll?.isOpen === true;
  const { actions } = card;
  const scorerLabel = card.scorerAssignment?.assignedScorer
    ? 'Switch Scorer'
    : 'Assign Scorer';

  const hasVisibleActions =
    actions.showConfirmedList || actions.showAssignScorer || actions.showViewPunchTime;

  const viewPollId =
    card.participationPoll?.pollId ?? card.playingXiEntry?.pollId ?? null;
  const showViewPoll =
    viewPollId != null &&
    ((pollOpen && card.participationPoll != null) ||
      (!pollOpen && card.playingXiEntry != null));

  return (
    <Card accent className="gap-4 rounded-control">
      <View className="gap-1">
        <Text className="font-sans-bold text-xs uppercase tracking-wider text-primary">
          {card.tournamentName}
        </Text>
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="event" size={16} color={colors.textMuted} />
          <Text className="font-sans text-sm text-on-surface-variant">{card.dateTimeLine}</Text>
        </View>
        {card.venue ? (
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="location-on" size={16} color={colors.textMuted} />
            <Text className="font-sans text-sm text-on-surface-variant" numberOfLines={2}>
              {card.venue}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="font-sans-bold text-lg text-on-surface">{card.matchTitle}</Text>

      {pollOpen && card.participationPoll ? (
        <ParticipationPollSection
          poll={card.participationPoll}
          onPollUpdated={() => onPollUpdated?.()}
          showViewPollLink={false}
        />
      ) : null}

      {hasVisibleActions ? (
        <View className="gap-2">
          {actions.showConfirmedList && card.playingXiEntry ? (
            <Button
              variant="tertiary"
              label="Confirmed List of Players"
              onPress={() => {
                const entry = card.playingXiEntry!;
                const path = entry.hasSavedSquad
                  ? `/participation-polls/${entry.pollId}/confirmed-players`
                  : `/participation-polls/${entry.pollId}/playing-xi`;
                router.push(path as Href);
              }}
              className="h-12 w-full"
            />
          ) : null}

          {actions.showAssignScorer && card.scorerAssignment ? (
            <Button
              label={scorerLabel}
              onPress={() => onOpenScorerAssignment?.(card.scorerAssignment!)}
              className="h-12 w-full"
            />
          ) : null}

          {actions.showViewPunchTime ? (
            <Button
              label="View Punch Time"
              onPress={() =>
                router.push(
                  `/matches/${card.matchId}/punch-time?teamId=${encodeURIComponent(card.teamId)}` as Href,
                )
              }
              className="h-12 w-full"
            />
          ) : null}
        </View>
      ) : null}

      {showViewPoll && viewPollId ? (
        <Pressable
          onPress={() =>
            router.push(`/participation-polls/${viewPollId}/results` as Href)
          }
          accessibilityRole="button"
          className="items-center py-1 active:opacity-80"
        >
          <Text className="font-sans-semibold text-sm text-primary">View Poll</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
