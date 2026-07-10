import {
  type PunchTimeAttendanceView,
  type PunchTimePlayerRow,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiRequestError,
  getPunchTimeAttendance,
  revokeAttendancePunch,
  setAttendancePunch,
  verifyLateAttendancePunch,
} from '../../lib/api';
import { EditPunchTimeDialog } from '../attendance/EditPunchTimeDialog';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { UnderlineTabBar } from '../ui/UnderlineTabBar';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { colors } from '@/theme/colors';

/** Player row chrome — matches Confirmed List of Players (`PlayingXiSelectionScreen`). */
const PUNCH_TIME_PLAYER_CARD_CLASS =
  'flex-row items-center gap-3 rounded-control border border-outline-variant';

interface EditTarget {
  player: PunchTimePlayerRow;
  title: string;
  initialValue: Date;
  canRevoke: boolean;
}

function SectionHeader({ label }: { label: string }): React.ReactElement {
  return (
    <Text className="font-sans-bold text-xs uppercase tracking-wider text-on-surface-variant">
      {label}
    </Text>
  );
}

function playerRoleSuffix(player: PunchTimePlayerRow): string {
  return player.isDesignatedServer ? ' · Penalty server' : '';
}

function PlayerCard({
  player,
  trailing,
  subtitle,
  subtitleClassName,
}: {
  player: PunchTimePlayerRow;
  trailing: React.ReactNode;
  subtitle: string;
  subtitleClassName?: string;
}): React.ReactElement {
  return (
    <Card className={PUNCH_TIME_PLAYER_CARD_CLASS}>
      <PlayerAvatar
        firstName={player.firstName}
        profilePhotoUrl={player.profilePhotoUrl}
        size="sm"
        shape="square"
      />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-base text-on-surface">
          {player.firstName} {player.lastName}
        </Text>
        <Text
          className={`font-sans text-sm ${subtitleClassName ?? 'text-on-surface-variant'}`}
        >
          {subtitle}
        </Text>
      </View>
      {trailing}
    </Card>
  );
}

function PlayerCardSection({
  label,
  players,
  renderPlayer,
}: {
  label: string;
  players: PunchTimePlayerRow[];
  renderPlayer: (player: PunchTimePlayerRow) => React.ReactElement;
}): React.ReactElement | null {
  if (players.length === 0) {
    return null;
  }

  return (
    <View className="mb-4 gap-2">
      <SectionHeader label={label} />
      <View className="gap-2">
        {players.map((player) => renderPlayer(player))}
      </View>
    </View>
  );
}

export interface PunchTimeTeamTab {
  id: string;
  name: string;
}

export interface PunchTimeScreenProps {
  matchId: string;
  teamId: string;
  /** Admin/CM on ACC-vs-ACC — one tab per ACC team. */
  teamTabs?: readonly PunchTimeTeamTab[];
}

/** Captain Punch Time attendance view (Phase 1 + designated penalty servers). */
export function PunchTimeScreen({
  matchId,
  teamId,
  teamTabs,
}: PunchTimeScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [selectedTeamId, setSelectedTeamId] = useState(teamId);
  const [view, setView] = useState<PunchTimeAttendanceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  useEffect(() => {
    setSelectedTeamId(teamId);
  }, [teamId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setView(await getPunchTimeAttendance(matchId, selectedTeamId));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load punch time.');
    } finally {
      setLoading(false);
    }
  }, [matchId, selectedTeamId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(
    player: PunchTimePlayerRow,
    title: string,
    fallbackIso: string,
    canRevoke: boolean,
  ): void {
    const initial = player.punchTimeUtc ? new Date(player.punchTimeUtc) : new Date(fallbackIso);
    setEditTarget({ player, title, initialValue: initial, canRevoke });
  }

  async function handleSave(punchTimeUtc: string): Promise<void> {
    if (!editTarget) {
      return;
    }
    setWorking(true);
    try {
      setView(
        await setAttendancePunch(matchId, editTarget.player.userId, selectedTeamId, {
          punchTimeUtc,
        }),
      );
      setEditTarget(null);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save arrival time.');
    } finally {
      setWorking(false);
    }
  }

  async function handleRevoke(): Promise<void> {
    if (!editTarget) {
      return;
    }
    setWorking(true);
    try {
      setView(await revokeAttendancePunch(matchId, editTarget.player.userId, selectedTeamId));
      setEditTarget(null);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not clear arrival.');
    } finally {
      setWorking(false);
    }
  }

  async function handleVerify(player: PunchTimePlayerRow): Promise<void> {
    setWorking(true);
    try {
      setView(await verifyLateAttendancePunch(matchId, player.userId, selectedTeamId));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not verify late arrival.');
    } finally {
      setWorking(false);
    }
  }

  const pencilButton = (player: PunchTimePlayerRow, title: string, canRevoke: boolean): React.ReactElement => (
    <Pressable
      onPress={() =>
        openEdit(player, title, view?.reportingTime ?? new Date().toISOString(), canRevoke)
      }
      accessibilityRole="button"
      accessibilityLabel="Edit arrival time"
      className="h-10 w-10 items-center justify-center active:opacity-70"
    >
      <MaterialIcons name="edit" size={22} color={FIELD_ORANGE} />
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background">
      {teamTabs && teamTabs.length > 1 ? (
        <View className="px-4 pb-2">
          <UnderlineTabBar
            layout="spread"
            options={teamTabs.map((team) => ({ value: team.id, label: team.name }))}
            value={selectedTeamId}
            onChange={setSelectedTeamId}
            accessibilityLabel="ASC team punch time"
          />
        </View>
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {!loading && view ? (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <View className="mb-6 gap-3 rounded-control border border-primary/30 bg-primary-container/30 p-4">
            <Text className="font-sans-bold text-lg text-on-surface">{view.matchTitle}</Text>
            <View className="flex-row items-end justify-between">
              <View>
                <Text className="font-sans-bold text-4xl text-on-surface">
                  {view.playersPresentCount}
                </Text>
                <Text className="font-sans text-sm text-on-surface-variant">Players Present</Text>
              </View>
              <View className="rounded-full bg-primary px-4 py-2">
                <Text className="font-sans-semibold text-sm text-on-primary">
                  {view.aggregateStatusLabel}
                </Text>
              </View>
            </View>
            <Text className="font-sans text-sm text-on-surface-variant">
              Reporting: {view.reportingTimeLabel}
            </Text>
          </View>

          {error ? <Text className="mb-3 font-sans text-sm text-primary">{error}</Text> : null}

          <PlayerCardSection
            label="On Time / Arrived"
            players={view.onTime}
            renderPlayer={(player) => (
              <PlayerCard
                key={player.userId}
                player={player}
                subtitle={`Arrived at ${player.arrivedAtLabel ?? '—'}${playerRoleSuffix(player)}`}
                trailing={pencilButton(player, 'Edit arrival time', true)}
              />
            )}
          />

          <PlayerCardSection
            label="Late Arrival"
            players={view.late}
            renderPlayer={(player) => (
              <PlayerCard
                key={player.userId}
                player={player}
                subtitle={`Arrived at ${player.arrivedAtLabel ?? '—'} · Late${playerRoleSuffix(player)}`}
                subtitleClassName="text-primary"
                trailing={
                  <View className="flex-row items-center">
                    {pencilButton(player, 'Edit arrival time', true)}
                    <Pressable
                      onPress={() => void handleVerify(player)}
                      disabled={working || player.verifiedLate}
                      accessibilityRole="button"
                      accessibilityLabel="Verify late arrival"
                      className="h-10 w-10 items-center justify-center active:opacity-70"
                    >
                      <MaterialIcons
                        name={player.verifiedLate ? 'check-circle' : 'radio-button-unchecked'}
                        size={24}
                        color={player.verifiedLate ? colors.primary : FIELD_ORANGE}
                      />
                    </Pressable>
                  </View>
                }
              />
            )}
          />

          <PlayerCardSection
            label="Not Arrived"
            players={view.notArrived}
            renderPlayer={(player) => (
              <PlayerCard
                key={player.userId}
                player={player}
                subtitle={`Not arrived${playerRoleSuffix(player)}`}
                subtitleClassName="text-on-surface-variant"
                trailing={pencilButton(player, 'Enter arrival time', false)}
              />
            )}
          />
        </ScrollView>
      ) : null}

      {!loading && error && !view ? (
        <View className="px-4">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      <EditPunchTimeDialog
        visible={editTarget != null}
        title={editTarget?.title ?? ''}
        initialValue={editTarget?.initialValue ?? new Date()}
        onClose={() => setEditTarget(null)}
        onSave={handleSave}
        onRevoke={editTarget?.canRevoke ? handleRevoke : undefined}
        working={working}
      />
    </View>
  );
}
