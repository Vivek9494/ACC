import { PlayerCategory, type TeamDetailPlayerRow, type TeamDetailView } from '@acc/types';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiRequestError, getTeamDetail, removePlayerFromTeam } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { confirmDestructiveDeleteAlert } from '../../lib/confirm-destructive-delete';
import { tournamentSubpathHref } from '../../lib/tournament-detail-route';
import { CircularAddButton } from '../ui/CircularAddButton';
import { PillTabBar } from '../ui/PillTabBar';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { TeamLeadershipSection } from './TeamLeadershipSection';
import { TeamPlayerCard } from './TeamPlayerCard';

type PlayerCategoryTab = 'fulltime' | 'parttime';

function SquadStatusCard({ detail }: { detail: TeamDetailView }): React.ReactElement {
  const playerLabel = `${detail.activePlayerCount} Active Player${detail.activePlayerCount === 1 ? '' : 's'}`;

  return (
    <View className="rounded-xl bg-primary p-5">
      <Text className="font-sans-semibold text-sm text-on-primary opacity-90">Squad Status</Text>
      <Text variant="section" className="mt-1 font-sans-bold text-on-primary">
        {playerLabel}
      </Text>
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

function renderPlayerCards({
  players,
  showViewProfile,
  canRemovePlayers,
  removingUserId,
  onViewProfile,
  onRemove,
}: {
  players: TeamDetailPlayerRow[];
  showViewProfile: boolean;
  canRemovePlayers: boolean;
  removingUserId: string | null;
  onViewProfile: (player: TeamDetailPlayerRow) => void;
  onRemove: (player: TeamDetailPlayerRow) => void;
}): React.ReactElement[] {
  return players.map((player) => (
    <TeamPlayerCard
      key={player.userId}
      player={player}
      showViewProfile={showViewProfile}
      onViewProfile={() => onViewProfile(player)}
      onRemove={canRemovePlayers ? () => onRemove(player) : undefined}
      removing={removingUserId === player.userId}
    />
  ));
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
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [categoryTab, setCategoryTab] = useState<PlayerCategoryTab>('fulltime');

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

  const fulltimePlayers = useMemo(
    () =>
      detail?.showPlayerCategorySplit
        ? detail.players.filter((player) => player.playerCategory === PlayerCategory.Fulltime)
        : [],
    [detail],
  );
  const parttimePlayers = useMemo(
    () =>
      detail?.showPlayerCategorySplit
        ? detail.players.filter((player) => player.playerCategory === PlayerCategory.Parttime)
        : [],
    [detail],
  );
  const uncategorizedPlayers = useMemo(
    () =>
      detail?.showPlayerCategorySplit
        ? detail.players.filter(
            (player) =>
              player.playerCategory !== PlayerCategory.Fulltime &&
              player.playerCategory !== PlayerCategory.Parttime,
          )
        : [],
    [detail],
  );

  const categoryTabOptions = useMemo(
    () =>
      detail
        ? ([
            {
              value: 'fulltime' as const,
              label: `Full-time (${detail.fulltimePlayerCount})`,
            },
            {
              value: 'parttime' as const,
              label: `Part-time (${detail.parttimePlayerCount})`,
            },
          ] as const)
        : [],
    [detail],
  );

  const selectedCategoryPlayers =
    categoryTab === 'fulltime' ? fulltimePlayers : parttimePlayers;

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

  function confirmRemovePlayer(
    userId: string,
    firstName: string,
    lastName: string,
  ): void {
    confirmDestructiveDeleteAlert({
      title: 'Remove player from team?',
      message: `${firstName} ${lastName} will be removed from this team. Their tournament registration and completed-match history will remain.`,
      onConfirm: async () => {
        setRemovingUserId(userId);
        try {
          await removePlayerFromTeam(tournamentId, teamId, userId);
          setDetail((current) => {
            if (!current) {
              return current;
            }
            const removed = current.players.find((player) => player.userId === userId);
            if (!removed) {
              return current;
            }
            return {
              ...current,
              activePlayerCount: Math.max(0, current.activePlayerCount - 1),
              fulltimePlayerCount:
                removed.playerCategory === 'FULLTIME'
                  ? Math.max(0, current.fulltimePlayerCount - 1)
                  : current.fulltimePlayerCount,
              parttimePlayerCount:
                removed.playerCategory === 'PARTTIME'
                  ? Math.max(0, current.parttimePlayerCount - 1)
                  : current.parttimePlayerCount,
              rosterSlotsRemaining:
                current.rosterSlotsRemaining == null ? null : current.rosterSlotsRemaining + 1,
              players: current.players.filter((player) => player.userId !== userId),
            };
          });
        } catch (err) {
          Alert.alert(
            'Could not remove player',
            err instanceof ApiRequestError ? err.message : 'Please try again.',
          );
        } finally {
          setRemovingUserId(null);
        }
      },
    });
  }

  const playerCardHandlers = detail
    ? {
        showViewProfile: detail.canViewPlayerProfiles,
        canRemovePlayers: detail.canRemovePlayers,
        removingUserId,
        onViewProfile: (player: TeamDetailPlayerRow) =>
          openPlayerProfile(player.userId, player.firstName, player.lastName),
        onRemove: (player: TeamDetailPlayerRow) =>
          confirmRemovePlayer(player.userId, player.firstName, player.lastName),
      }
    : null;

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

      {detail && playerCardHandlers ? (
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
              <Text variant="section" className="font-sans-bold text-on-surface">
                Team Players
              </Text>
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
            ) : detail.showPlayerCategorySplit ? (
              <View className="gap-3">
                <PillTabBar
                  options={categoryTabOptions}
                  value={categoryTab}
                  onChange={setCategoryTab}
                  accessibilityLabel="Player category"
                />
                {selectedCategoryPlayers.length === 0 ? (
                  <Text className="font-sans text-sm text-on-surface-variant">
                    {categoryTab === 'fulltime'
                      ? 'No full-time players on this team.'
                      : 'No part-time players on this team.'}
                  </Text>
                ) : (
                  renderPlayerCards({
                    players: selectedCategoryPlayers,
                    ...playerCardHandlers,
                  })
                )}
                {uncategorizedPlayers.length > 0
                  ? renderPlayerCards({
                      players: uncategorizedPlayers,
                      ...playerCardHandlers,
                    })
                  : null}
              </View>
            ) : (
              renderPlayerCards({
                players: detail.players,
                ...playerCardHandlers,
              })
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
