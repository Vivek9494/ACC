import type { TeamDetailView } from '@acc/types';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiRequestError, getTeamDetail } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { tournamentSubpathHref } from '../../lib/tournament-detail-route';
import { CircularAddButton } from '../ui/CircularAddButton';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { TeamLeadershipSection } from './TeamLeadershipSection';
import { TeamPlayerCard } from './TeamPlayerCard';

function SquadStatusCard({ detail }: { detail: TeamDetailView }): React.ReactElement {
  const playerLabel = `${detail.activePlayerCount} Active Player${detail.activePlayerCount === 1 ? '' : 's'}`;

  return (
    <View className="rounded-xl bg-primary p-5">
      <Text className="font-sans-semibold text-sm text-on-primary opacity-90">Squad Status</Text>
      <Text className="mt-1 font-sans-bold text-2xl text-on-primary">{playerLabel}</Text>
      {detail.showPlayerCategorySplit ? (
        <View className="mt-4 flex-row flex-wrap gap-2">
          <View className="rounded-full bg-on-primary/15 px-3 py-1">
            <Text className="font-sans-semibold text-xs text-on-primary">
              Full-time Players: {detail.fulltimePlayerCount}
            </Text>
          </View>
          <View className="rounded-full bg-on-primary/15 px-3 py-1">
            <Text className="font-sans-semibold text-xs text-on-primary">
              Part-time Players: {detail.parttimePlayerCount}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export interface TeamDetailScreenProps {
  tournamentId: string;
  teamId: string;
}

/** Tournament team roster with squad status and player cards. */
export function TeamDetailScreen({
  tournamentId,
  teamId,
}: TeamDetailScreenProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<TeamDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTeamDetail(tournamentId, teamId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load team details.');
    } finally {
      setLoading(false);
    }
  }, [teamId, tournamentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function openPlayerProfile(userId: string, firstName: string, lastName: string): void {
    router.push(
      tournamentSubpathHref(user, tournamentId, 'players/[userId]', {
        userId,
        firstName,
        lastName,
      }),
    );
  }

  function openAddPlayers(): void {
    if (!detail) {
      return;
    }
    router.push(
      tournamentSubpathHref(user, tournamentId, 'teams/[teamId]/add-players', {
        teamId,
        teamName: detail.name,
      }),
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={detail?.name ?? 'Team'} accentTitle />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {!loading && error ? (
        <View className="px-4">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      {detail ? (
        <ScrollView
          className="flex-1 px-4"
          contentContainerClassName="gap-6 pb-6"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <SquadStatusCard detail={detail} />

          <TeamLeadershipSection
            tournamentId={tournamentId}
            teamId={teamId}
            detail={detail}
            onUpdated={() => void load()}
          />

          <View className="gap-3">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="font-sans-bold text-xl text-on-surface">Team Players</Text>
              {detail.canAddPlayers &&
              (detail.rosterSlotsRemaining == null || detail.rosterSlotsRemaining > 0) ? (
                <CircularAddButton
                  accessibilityLabel="Add players to team"
                  onPress={openAddPlayers}
                />
              ) : null}
            </View>
            {detail.players.length === 0 ? (
              <Text className="font-sans text-sm text-on-surface-variant">
                No players on this team yet.
              </Text>
            ) : (
              detail.players.map((player) => (
                <TeamPlayerCard
                  key={player.userId}
                  player={player}
                  showViewProfile={detail.canViewPlayerProfiles}
                  onViewProfile={() =>
                    openPlayerProfile(player.userId, player.firstName, player.lastName)
                  }
                />
              ))
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
