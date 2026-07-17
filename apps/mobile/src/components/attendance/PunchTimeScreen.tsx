import {
  composePunchTimeOnMatchDayUtc,
  seedPunchPickerDate,
  serverVenueTimezone,
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
  unverifyLateAttendancePunch,
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

function matchScheduleAnchor(view: PunchTimeAttendanceView): {
  matchDate: string | null;
  startTime: string | null;
} {
  return {
    matchDate: view.matchDate,
    startTime: view.startTime ?? view.reportingTime,
  };
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
  /** Post-match historical view — hide enter/edit/verify actions. */
  readOnly?: boolean;
}

/** Captain Punch Time attendance view (Phase 1 + designated penalty servers). */
export function PunchTimeScreen({
  matchId,
  teamId,
  teamTabs,
  readOnly = false,
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

  function openEdit(player: PunchTimePlayerRow, title: string, canRevoke: boolean): void {
    if (!view) {
      return;
    }
    const timeZone = serverVenueTimezone(view.timezone);
    const initial = seedPunchPickerDate({
      match: matchScheduleAnchor(view),
      timeZone,
      reportingTime: view.reportingTime,
      existingPunchUtc: player.punchTimeUtc,
    });
    setEditTarget({ player, title, initialValue: initial, canRevoke });
  }

  async function handleSave(punchTimeUtc: string): Promise<void> {
    if (!editTarget || !view) {
      return;
    }
    setWorking(true);
    try {
      const timeZone = serverVenueTimezone(view.timezone);
      const normalizedUtc = composePunchTimeOnMatchDayUtc(
        matchScheduleAnchor(view),
        timeZone,
        new Date(punchTimeUtc),
      );
      setView(
        await setAttendancePunch(matchId, editTarget.player.userId, selectedTeamId, {
          punchTimeUtc: normalizedUtc,
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

  async function handleToggleLateVerify(player: PunchTimePlayerRow): Promise<void> {
    setWorking(true);
    try {
      setView(
        player.verifiedLate
          ? await unverifyLateAttendancePunch(matchId, player.userId, selectedTeamId)
          : await verifyLateAttendancePunch(matchId, player.userId, selectedTeamId),
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : player.verifiedLate
            ? 'Could not unverify late arrival.'
            : 'Could not verify late arrival.',
      );
    } finally {
      setWorking(false);
    }
  }

  const pencilButton = (
    player: PunchTimePlayerRow,
    title: string,
    canRevoke: boolean,
  ): React.ReactElement | null => {
    if (readOnly) {
      return null;
    }
    return (
      <Pressable
        onPress={() => openEdit(player, title, canRevoke)}
        accessibilityRole="button"
        accessibilityLabel="Edit arrival time"
        className="h-10 w-10 items-center justify-center active:opacity-70"
      >
        <MaterialIcons name="edit" size={22} color={FIELD_ORANGE} />
      </Pressable>
    );
  };

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
                  readOnly ? (
                    player.verifiedLate ? (
                      <MaterialIcons name="check-circle" size={24} color={colors.primary} />
                    ) : null
                  ) : (
                    <View className="flex-row items-center">
                      {pencilButton(player, 'Edit arrival time', true)}
                      <Pressable
                        onPress={() => void handleToggleLateVerify(player)}
                        disabled={working}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: player.verifiedLate }}
                        accessibilityLabel={
                          player.verifiedLate
                            ? 'Unverify late arrival'
                            : 'Verify late arrival'
                        }
                        className="h-10 w-10 items-center justify-center active:opacity-70"
                      >
                        <MaterialIcons
                          name={player.verifiedLate ? 'check-circle' : 'radio-button-unchecked'}
                          size={24}
                          color={player.verifiedLate ? colors.primary : FIELD_ORANGE}
                        />
                      </Pressable>
                    </View>
                  )
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
