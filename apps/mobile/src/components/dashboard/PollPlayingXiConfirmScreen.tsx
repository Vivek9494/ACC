import { colors } from '@/theme/colors';
import {
  PLAYING_XI_SIZE,
  POLL_RESULTS_SECTION_LABELS,
  LATE_ARRIVAL_SECTION_LABEL,
  SuspensionXiBadge,
  isLateArrivalInPenalty,
  isLateArrivalOutPenalty,
  type ParticipationPollTallyView,
  type PlayingXiConfirmFromPollView,
  type PollResultsTab,
  type PollSuspensionPlayerRow,
  type PollTallyPlayerRow,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiRequestError,
  cancelSuspension,
  carryForwardSuspension,
  confirmPollPlayingXi,
  getPlayingXiConfirmFromPoll,
  lockPlayingXi,
} from '../../lib/api';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { UnderlineTabBar } from '../ui/UnderlineTabBar';
import { FIELD_ORANGE } from '../ui/fieldStyles';

type ConfirmPollTabKey = PollResultsTab | 'penalty';

const PLAYER_ROW_CARD_CLASS =
  'flex-row items-center gap-3 rounded-control border border-outline-variant';

function playersForTab(tally: ParticipationPollTallyView, tab: PollResultsTab): PollTallyPlayerRow[] {
  if (tab === 'in') return tally.in;
  if (tab === 'out') return tally.out;
  return tally.pending;
}

function countForTab(tally: ParticipationPollTallyView, tab: ConfirmPollTabKey): number {
  if (tab === 'penalty') return 0;
  if (tab === 'in') return tally.inCount;
  if (tab === 'out') return tally.outCount;
  return tally.pendingCount;
}

function suspensionBadgeLabel(badge: SuspensionXiBadge): string {
  return badge === SuspensionXiBadge.CarryForward
    ? 'Suspension carry forward'
    : 'Suspension cancelled';
}

function PollResultsTabBar({
  tally,
  penaltyCount,
  activeTab,
  onChange,
}: {
  tally: ParticipationPollTallyView;
  penaltyCount: number;
  activeTab: ConfirmPollTabKey;
  onChange: (tab: ConfirmPollTabKey) => void;
}): React.ReactElement {
  const showPending = tally.canViewPending && tally.pendingCount > 0;
  const tabs: { key: ConfirmPollTabKey; label: string }[] = [
    { key: 'in', label: `IN (${tally.inCount})` },
    { key: 'out', label: `OUT (${tally.outCount})` },
  ];
  if (showPending) {
    tabs.push({ key: 'pending', label: `PENDING (${tally.pendingCount})` });
  }
  if (penaltyCount > 0) {
    tabs.push({ key: 'penalty', label: `PENALTY (${penaltyCount})` });
  }

  return (
    <UnderlineTabBar
      layout="spread"
      options={tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
      value={activeTab}
      onChange={onChange}
    />
  );
}

function SelectablePlayerRow({
  player,
  selected,
  selectable,
  badge,
  onToggle,
}: {
  player: PollTallyPlayerRow;
  selected: boolean;
  selectable: boolean;
  badge?: string | null;
  onToggle: () => void;
}): React.ReactElement {
  const rowContent = (
    <>
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
        {badge ? (
          <Text className="font-sans-medium text-xs text-primary">{badge}</Text>
        ) : player.skillLabel ? (
          <Text className="font-sans text-sm text-on-surface-variant">{player.skillLabel}</Text>
        ) : null}
      </View>
      {selectable ? (
        <View
          className={`h-6 w-6 items-center justify-center rounded-full border ${
            selected ? 'border-primary bg-primary' : 'border-outline-variant bg-surface-container-lowest'
          }`}
        >
          {selected ? <Text className="font-sans-medium text-[9px] text-on-primary">11</Text> : null}
        </View>
      ) : (
        <MaterialIcons name="block" size={20} color={colors.textMuted} />
      )}
    </>
  );

  if (selectable) {
    return (
      <Card onPress={onToggle} accessibilityRole="button" className={PLAYER_ROW_CARD_CLASS}>
        {rowContent}
      </Card>
    );
  }

  return <Card className={`${PLAYER_ROW_CARD_CLASS} opacity-60`}>{rowContent}</Card>;
}

function SectionHeading({
  label,
  count,
}: {
  label: string;
  count?: number;
}): React.ReactElement {
  const pill =
    count != null
      ? `${count} ${count === 1 ? 'PLAYER' : 'PLAYERS'}`
      : null;
  return (
    <View className="flex-row items-center justify-between pb-2 pt-4">
      <Text className="font-sans-bold text-xs tracking-wider text-on-surface-variant">{label}</Text>
      {pill ? (
        <View className="rounded-full bg-primary-container px-3 py-1">
          <Text className="font-sans-bold text-xs text-primary">{pill}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PenaltyPlayerRow({
  player,
  working,
  onCarryForward,
  onCancel,
}: {
  player: PollSuspensionPlayerRow;
  working: boolean;
  onCarryForward: () => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <Card className={PLAYER_ROW_CARD_CLASS}>
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
        <Text className="font-sans text-sm text-on-surface-variant">Late arrival last match</Text>
        {!player.actionsEnabled ? (
          <Text className="font-sans-medium text-xs text-primary">
            Voted OUT or did not vote — suspension auto-carries to a later match
          </Text>
        ) : null}
      </View>
      {player.actionsEnabled ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Carry forward suspension for ${player.firstName} ${player.lastName}`}
            disabled={working}
            onPress={onCarryForward}
            className="h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest active:opacity-70"
          >
            <MaterialIcons name="redo" size={18} color={FIELD_ORANGE} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Cancel suspension for ${player.firstName} ${player.lastName}`}
            disabled={working}
            onPress={onCancel}
            className="h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest active:opacity-70"
          >
            <MaterialIcons name="delete-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </>
      ) : null}
    </Card>
  );
}

function LateArrivalPlayerRow({
  player,
  subtitle,
}: {
  player: PollTallyPlayerRow | PollSuspensionPlayerRow;
  subtitle: string;
}): React.ReactElement {
  return (
    <Card className={`${PLAYER_ROW_CARD_CLASS} border-primary/30 bg-primary-container/20`}>
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
        <Text className="font-sans-medium text-xs text-primary">{subtitle}</Text>
      </View>
      <MaterialIcons name="schedule" size={20} color={FIELD_ORANGE} />
    </Card>
  );
}

export interface PollPlayingXiConfirmScreenProps {
  matchId: string;
  teamId: string;
  teamName?: string;
}

/** Leather — In/Out poll page as Playing XI selection surface (§9.7). */
export function PollPlayingXiConfirmScreen({
  matchId,
  teamId,
  teamName,
}: PollPlayingXiConfirmScreenProps): React.ReactElement {
  const router = useRouter();
  const [context, setContext] = useState<PlayingXiConfirmFromPollView | null>(null);
  const [activeTab, setActiveTab] = useState<ConfirmPollTabKey>('in');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [penaltyWorking, setPenaltyWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlayingXiConfirmFromPoll(matchId, teamId);
      setContext(data);
      setSelectedIds(data.savedPlayingXiIds);
      setActiveTab((tab) =>
        tab === 'penalty' && data.pendingSuspensions.length === 0 ? 'in' : tab,
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load poll results.');
    } finally {
      setLoading(false);
    }
  }, [matchId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tally = context?.tally ?? null;
  const pendingSuspensions = context?.pendingSuspensions ?? [];
  const actionedSuspensions = context?.actionedSuspensions ?? [];

  const actionedBadgeByUserId = useMemo(
    () =>
      new Map(
        actionedSuspensions.map((row) => [row.userId, suspensionBadgeLabel(row.badge)] as const),
      ),
    [actionedSuspensions],
  );

  const inVoterIds = useMemo(() => {
    const ids = new Set(tally?.in.map((player) => player.userId) ?? []);
    for (const row of actionedSuspensions) {
      ids.add(row.userId);
    }
    return ids;
  }, [actionedSuspensions, tally?.in]);

  const outPoolOpen = Boolean(tally && tally.inCount < PLAYING_XI_SIZE);

  const lateArrivalIn = useMemo(
    () => pendingSuspensions.filter(isLateArrivalInPenalty),
    [pendingSuspensions],
  );

  const lateArrivalOut = useMemo(
    () => pendingSuspensions.filter(isLateArrivalOutPenalty),
    [pendingSuspensions],
  );

  const lateArrivalInIds = useMemo(
    () => new Set(lateArrivalIn.map((row) => row.userId)),
    [lateArrivalIn],
  );

  const lateArrivalOutIds = useMemo(
    () => new Set(lateArrivalOut.map((row) => row.userId)),
    [lateArrivalOut],
  );

  const inTabPlayers = useMemo((): PollTallyPlayerRow[] => {
    if (!tally) return [];
    const byId = new Map(tally.in.map((player) => [player.userId, player] as const));
    for (const row of actionedSuspensions) {
      if (!byId.has(row.userId)) {
        byId.set(row.userId, {
          userId: row.userId,
          firstName: row.firstName,
          lastName: row.lastName,
          profilePhotoUrl: row.profilePhotoUrl,
          skillLabel: null,
        });
      }
    }
    return [...byId.values()].filter((player) => !lateArrivalInIds.has(player.userId));
  }, [actionedSuspensions, lateArrivalInIds, tally]);

  const outTabPlayers = useMemo((): PollTallyPlayerRow[] => {
    if (!tally) return [];
    return tally.out.filter((player) => !lateArrivalOutIds.has(player.userId));
  }, [lateArrivalOutIds, tally]);

  const activePlayers = useMemo(() => {
    if (!tally) return [];
    if (activeTab === 'in') return inTabPlayers;
    if (activeTab === 'out') return outTabPlayers;
    if (activeTab === 'penalty') return [];
    return playersForTab(tally, activeTab);
  }, [activeTab, inTabPlayers, outTabPlayers, tally]);

  const activeCount =
    activeTab === 'penalty'
      ? pendingSuspensions.length
      : activeTab === 'in'
        ? inTabPlayers.length + lateArrivalIn.length
        : activeTab === 'out'
          ? outTabPlayers.length + lateArrivalOut.length
          : tally
            ? countForTab(tally, activeTab)
            : 0;

  const sectionLabel =
    activeTab === 'penalty'
      ? 'PENALTY PLAYERS'
      : activeTab === 'in' || activeTab === 'out'
        ? ''
        : tally
          ? POLL_RESULTS_SECTION_LABELS[activeTab]
          : '';
  const playerPillLabel = `${activeCount} ${activeCount === 1 ? 'PLAYER' : 'PLAYERS'}`;

  function canTogglePlayer(userId: string, tab: ConfirmPollTabKey): boolean {
    if (tab === 'in') return true;
    if (tab === 'out') {
      return outPoolOpen || selectedIds.includes(userId);
    }
    return false;
  }

  function togglePlayer(userId: string, tab: ConfirmPollTabKey): void {
    if (!canTogglePlayer(userId, tab)) return;
    setError(null);
    setSelectedIds((current) => {
      if (current.includes(userId)) {
        return current.filter((id) => id !== userId);
      }
      if (current.length >= PLAYING_XI_SIZE) {
        setError(`Playing 11 is full (${PLAYING_XI_SIZE}).`);
        return current;
      }
      return [...current, userId];
    });
  }

  function confirmCarryForward(player: PollSuspensionPlayerRow): void {
    Alert.alert(
      'Carry suspension forward?',
      `Carry ${player.firstName} ${player.lastName}'s suspension forward to the next match? They will play this match.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            void (async () => {
              setPenaltyWorking(true);
              setError(null);
              try {
                await carryForwardSuspension(player.suspensionId);
                await load();
                setActiveTab('in');
              } catch (err) {
                setError(
                  err instanceof ApiRequestError ? err.message : 'Could not carry forward suspension.',
                );
              } finally {
                setPenaltyWorking(false);
              }
            })();
          },
        },
      ],
    );
  }

  function confirmCancelPenalty(player: PollSuspensionPlayerRow): void {
    Alert.alert(
      'Cancel suspension?',
      `Cancel ${player.firstName} ${player.lastName}'s suspension? They will play this match and the penalty will be waived.`,
      [
        { text: 'Dismiss', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setPenaltyWorking(true);
              setError(null);
              try {
                await cancelSuspension(player.suspensionId);
                await load();
                setActiveTab('in');
              } catch (err) {
                setError(
                  err instanceof ApiRequestError ? err.message : 'Could not cancel suspension.',
                );
              } finally {
                setPenaltyWorking(false);
              }
            })();
          },
        },
      ],
    );
  }

  async function submit(): Promise<void> {
    if (!context) return;
    if (selectedIds.length !== PLAYING_XI_SIZE) {
      setError(`Select exactly ${PLAYING_XI_SIZE} players for the Playing 11.`);
      return;
    }

    const allFromIn = selectedIds.every((id) => inVoterIds.has(id));
    const usePollConfirm = context.canUsePollConfirm && allFromIn;

    setSaving(true);
    setError(null);
    try {
      if (usePollConfirm) {
        await confirmPollPlayingXi(context.pollId, {
          playingXi: selectedIds,
          substitutes: [],
          penaltyServerUserIds: [],
        });
      } else {
        await lockPlayingXi(matchId, {
          teamId,
          playingXi: selectedIds,
          substitutes: [],
        });
      }
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not confirm the Playing 11.');
    } finally {
      setSaving(false);
    }
  }

  const headerTitle = teamName ?? context?.teamName ?? 'Team';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={headerTitle}
        subtitle={context?.isFinalized ? 'Edit Playing 11' : 'Confirm Playing 11'}
        onBack={() => router.back()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {error ? (
        <View className="px-4 pb-2">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      {context?.isFinalized ? (
        <View className="px-4 pb-2">
          <Text className="font-sans text-sm text-primary">
            Finalized — you can still edit before the match goes live.
          </Text>
        </View>
      ) : null}

      {tally ? (
        <View className="flex-1">
          <PollResultsTabBar
            tally={tally}
            penaltyCount={pendingSuspensions.length}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {(sectionLabel || activeTab === 'penalty') && (
            <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
              <Text className="font-sans-bold text-xs tracking-wider text-on-surface-variant">
                {sectionLabel}
              </Text>
              <View className="rounded-full bg-primary-container px-3 py-1">
                <Text className="font-sans-bold text-xs text-primary">{playerPillLabel}</Text>
              </View>
            </View>
          )}

          <ScrollView className="flex-1 px-4" contentContainerClassName="gap-2 pb-4">
            {activeTab === 'penalty' ? (
              pendingSuspensions.length === 0 ? (
                <Text className="py-6 font-sans text-sm text-on-surface-variant">
                  No penalty players
                </Text>
              ) : (
                pendingSuspensions.map((player) => (
                  <PenaltyPlayerRow
                    key={player.suspensionId}
                    player={player}
                    working={penaltyWorking}
                    onCarryForward={() => confirmCarryForward(player)}
                    onCancel={() => confirmCancelPenalty(player)}
                  />
                ))
              )
            ) : null}

            {activeTab === 'in' ? (
              <>
                <SectionHeading
                  label={POLL_RESULTS_SECTION_LABELS.in}
                  count={inTabPlayers.length}
                />
                {inTabPlayers.length === 0 ? (
                  <Text className="pb-4 font-sans text-sm text-on-surface-variant">
                    No confirmed players
                  </Text>
                ) : (
                  inTabPlayers.map((player) => {
                    const selected = selectedIds.includes(player.userId);
                    const badge = actionedBadgeByUserId.get(player.userId) ?? null;
                    return (
                      <SelectablePlayerRow
                        key={player.userId}
                        player={player}
                        selected={selected}
                        selectable
                        badge={badge}
                        onToggle={() => togglePlayer(player.userId, 'in')}
                      />
                    );
                  })
                )}
                {lateArrivalIn.length > 0 ? (
                  <>
                    <SectionHeading
                      label={LATE_ARRIVAL_SECTION_LABEL}
                      count={lateArrivalIn.length}
                    />
                    <Text className="pb-2 font-sans text-sm text-on-surface-variant">
                      Serving suspension — sitting out this match. Action from the Penalty tab to play
                      instead.
                    </Text>
                    {lateArrivalIn.map((player) => (
                      <LateArrivalPlayerRow
                        key={player.suspensionId}
                        player={player}
                        subtitle="Penalty serving — not in Playing 11"
                      />
                    ))}
                  </>
                ) : null}
              </>
            ) : null}

            {activeTab === 'out' ? (
              <>
                <SectionHeading label={POLL_RESULTS_SECTION_LABELS.out} count={outTabPlayers.length} />
                {!outPoolOpen ? (
                  <Text className="py-4 font-sans text-sm text-on-surface-variant">
                    {PLAYING_XI_SIZE} or more players voted IN — OUT players are for reference only.
                    Select your Playing 11 from the IN tab.
                  </Text>
                ) : null}
                {outTabPlayers.length === 0 ? (
                  <Text className="pb-4 font-sans text-sm text-on-surface-variant">
                    No unavailable players
                  </Text>
                ) : (
                  outTabPlayers.map((player) => {
                    const canToggle = canTogglePlayer(player.userId, 'out');
                    const selected = selectedIds.includes(player.userId);
                    return (
                      <SelectablePlayerRow
                        key={player.userId}
                        player={player}
                        selected={selected}
                        selectable={canToggle}
                        onToggle={() => togglePlayer(player.userId, 'out')}
                      />
                    );
                  })
                )}
                {lateArrivalOut.length > 0 ? (
                  <>
                    <SectionHeading
                      label={LATE_ARRIVAL_SECTION_LABEL}
                      count={lateArrivalOut.length}
                    />
                    <Text className="pb-2 font-sans text-sm text-on-surface-variant">
                      Voted OUT or did not vote — not available this match. Suspension automatically
                      carries forward.
                    </Text>
                    {lateArrivalOut.map((player) => (
                      <LateArrivalPlayerRow
                        key={player.suspensionId}
                        player={player}
                        subtitle="Auto carry-forward to a later match"
                      />
                    ))}
                  </>
                ) : null}
              </>
            ) : null}

            {activeTab !== 'penalty' && activeTab !== 'in' && activeTab !== 'out' ? (
              <>
                {activePlayers.length === 0 ? (
                  <Text className="py-6 font-sans text-sm text-on-surface-variant">No players</Text>
                ) : (
                  activePlayers.map((player) => {
                    const canToggle = canTogglePlayer(player.userId, activeTab);
                    const selected = selectedIds.includes(player.userId);
                    return (
                      <SelectablePlayerRow
                        key={player.userId}
                        player={player}
                        selected={selected}
                        selectable={canToggle}
                        onToggle={() => togglePlayer(player.userId, activeTab)}
                      />
                    );
                  })
                )}
              </>
            ) : null}
          </ScrollView>

          <View className="border-t border-outline-variant px-4 py-4">
            <Button
              disabled={saving || selectedIds.length !== PLAYING_XI_SIZE}
              onPress={() => void submit()}
              variant="secondary"
              className="h-12"
              textClassName="text-base"
              label={
                saving
                  ? 'Confirming…'
                  : `Confirm Playing 11 (${selectedIds.length}/${PLAYING_XI_SIZE})`
              }
            />
          </View>
        </View>
      ) : null}

      {penaltyWorking ? (
        <Modal transparent animationType="fade" visible>
          <View className="flex-1 items-center justify-center bg-black/30">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}
