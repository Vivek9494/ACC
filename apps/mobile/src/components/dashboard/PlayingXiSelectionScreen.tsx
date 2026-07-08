import { colors } from '@/theme/colors';
import {
  MAX_SUBSTITUTES,
  PLAYING_XI_SIZE,
  POLL_RESULTS_SECTION_LABELS,
  PlayingXiNoShowRecoveryAction,
  REGISTRATION_PLAYER_TYPE_LABELS,
  type PollPenaltyOwingPlayerRow,
  type PollPlayingXiPlayerRow,
  type PollPlayingXiSelectionView,
  type PollTallyPlayerRow,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  applyPlayingXiNoShowRecovery,
  confirmPollPlayingXi,
  designatePenaltyServe,
  getPollPlayingXiSelection,
  undesignatePenaltyServe,
  ApiRequestError,
} from '../../lib/api';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { UnderlineTabBar } from '../ui/UnderlineTabBar';
import { FIELD_ORANGE } from '../ui/fieldStyles';

/** Player row chrome — must not change when selected; only the badge reflects selection. */
const SQUAD_PLAYER_ROW_CLASS =
  'flex-row items-center gap-3 rounded-control border border-outline-variant';

type XiTab = 'in' | 'out' | 'summary';
type SquadPick = 'PLAYING_XI' | 'SUBSTITUTE' | null;
type SquadBucket = 'PLAYING_XI' | 'SUBSTITUTE';

function leatherPlayerTypeLabel(
  player: Pick<PollTallyPlayerRow, 'playerType'>,
): string | null {
  return player.playerType ? REGISTRATION_PLAYER_TYPE_LABELS[player.playerType] : null;
}

function PlayerSummaryRow({
  player,
  badge,
  badgeClassName,
}: {
  player: PollPlayingXiPlayerRow | PollTallyPlayerRow;
  badge?: string;
  badgeClassName?: string;
}): React.ReactElement {
  const playerTypeLabel = leatherPlayerTypeLabel(player);

  return (
    <Card className={SQUAD_PLAYER_ROW_CLASS}>
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
        {playerTypeLabel ? (
          <Text className="font-sans text-sm text-on-surface-variant">{playerTypeLabel}</Text>
        ) : null}
      </View>
      {badge ? (
        <Text
          className={`font-sans-semibold text-xs ${badgeClassName ?? 'text-on-surface-variant'}`}
        >
          {badge}
        </Text>
      ) : null}
    </Card>
  );
}

function OutReferenceRow({ player }: { player: PollTallyPlayerRow }): React.ReactElement {
  const playerTypeLabel = leatherPlayerTypeLabel(player);

  return (
    <View className="flex-row items-center gap-3 border-b border-outline-variant/60 py-2.5">
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
        {playerTypeLabel ? (
          <Text className="font-sans text-sm text-on-surface-variant">{playerTypeLabel}</Text>
        ) : null}
      </View>
      <MaterialIcons name="cancel" size={24} color={colors.textMuted} />
    </View>
  );
}

function SquadSelectionIndicator({
  bucket,
  selected,
}: {
  bucket: SquadBucket;
  selected: boolean;
}): React.ReactElement {
  return (
    <View
      className={`h-6 w-6 items-center justify-center rounded-full border ${
        selected
          ? 'border-primary bg-primary'
          : 'border-outline-variant bg-surface-container-lowest'
      }`}
    >
      {selected ? (
        <Text className="font-sans-medium text-[9px] text-on-primary">
          {bucket === 'PLAYING_XI' ? '11' : 'S'}
        </Text>
      ) : null}
    </View>
  );
}

function InSelectionRow({
  player,
  bucket,
  pick,
  onPick,
}: {
  player: PollPlayingXiPlayerRow;
  bucket: SquadBucket;
  pick: SquadPick;
  onPick: (next: SquadPick) => void;
}): React.ReactElement {
  const playerTypeLabel = leatherPlayerTypeLabel(player);
  const selected = pick === bucket;

  return (
    <Card
      onPress={() => onPick(selected ? null : bucket)}
      accessibilityRole="button"
      className={SQUAD_PLAYER_ROW_CLASS}
    >
      <PlayerAvatar
        firstName={player.firstName}
        profilePhotoUrl={player.profilePhotoUrl}
        size="sm"
        shape="square"
      />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans-bold text-base text-on-surface">
          {player.firstName} {player.lastName}
        </Text>
        {playerTypeLabel ? (
          <Text className="font-sans text-sm text-on-surface-variant">{playerTypeLabel}</Text>
        ) : null}
      </View>
      <SquadSelectionIndicator bucket={bucket} selected={selected} />
    </Card>
  );
}

function SummarySection({
  title,
  players,
  emptyLabel,
  showArrivalStatus = false,
}: {
  title: string;
  players: PollPlayingXiPlayerRow[] | PollTallyPlayerRow[];
  emptyLabel: string;
  showArrivalStatus?: boolean;
}): React.ReactElement {
  return (
    <View className="gap-2">
      <Text className="font-sans-bold text-xs uppercase tracking-wider text-on-surface-variant">
        {title}
      </Text>
      {players.length === 0 ? (
        <Text className="font-sans text-sm text-on-surface-variant">{emptyLabel}</Text>
      ) : (
        <View className="gap-3">
          {players.map((player) => (
            <PlayerSummaryRow
              key={player.userId}
              player={player}
              badge={
                showArrivalStatus && 'hasPunched' in player
                  ? player.hasPunched
                    ? 'On ground'
                    : 'Not arrived'
                  : 'hasPunched' in player && player.hasPunched
                    ? 'On ground'
                    : undefined
              }
              badgeClassName={
                showArrivalStatus && 'hasPunched' in player && !player.hasPunched
                  ? 'text-secondary-900'
                  : undefined
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}

function PenaltyServerCheckboxRow({
  player,
  checked,
  disabled,
  working,
  onToggle,
}: {
  player: PollPenaltyOwingPlayerRow;
  checked: boolean;
  disabled: boolean;
  working: boolean;
  onToggle: (next: boolean) => void;
}): React.ReactElement {
  const playerTypeLabel = leatherPlayerTypeLabel(player);

  return (
    <Pressable
      onPress={() => !disabled && !working && onToggle(!checked)}
      disabled={disabled || working}
      className="flex-row items-center gap-3 border-b border-outline-variant/60 py-3 active:opacity-80"
    >
      <MaterialIcons
        name={checked ? 'check-box' : 'check-box-outline-blank'}
        size={24}
        color={disabled ? colors.textMuted : checked ? colors.primary : colors.textMuted}
      />
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
        {playerTypeLabel ? (
          <Text className="font-sans text-sm text-on-surface-variant">{playerTypeLabel}</Text>
        ) : null}
        {!player.canDesignateForThisMatch ? (
          <Text className="font-sans text-xs text-on-surface-variant">
            Serving at another match
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function RecoverySection({
  selection,
  working,
  onRecover,
}: {
  selection: PollPlayingXiSelectionView;
  working: boolean;
  onRecover: (
    absentUserId: string,
    action: (typeof PlayingXiNoShowRecoveryAction)[keyof typeof PlayingXiNoShowRecoveryAction],
    replacementUserId: string,
  ) => void;
}): React.ReactElement {
  return (
    <View className="gap-4 rounded-control border border-outline-variant bg-surface-container-lowest p-4">
      <Text className="font-sans-bold text-sm text-on-surface">Match-day no-show recovery</Text>
      <Text className="font-sans text-sm text-on-surface-variant">
        When a Playing 11 player and all substitutes are absent, swap in an on-ground player to keep
        the XI at 11.
      </Text>
      {selection.recoveryEligiblePlayingXi.length === 0 ? (
        <Text className="font-sans text-sm text-on-surface-variant">
          No absent Playing 11 players eligible for recovery right now.
        </Text>
      ) : (
        selection.recoveryEligiblePlayingXi.map((absent) => (
          <View key={absent.userId} className="gap-2 border-t border-outline-variant/60 pt-3">
            <Text className="font-sans-semibold text-sm text-on-surface">
              Replace {absent.firstName} {absent.lastName}
            </Text>
            {selection.penaltyServersOnGround.length > 0 ? (
              <View className="gap-1">
                <Text className="font-sans text-xs uppercase tracking-wider text-on-surface-variant">
                  Promote penalty server (cancels penalty)
                </Text>
                {selection.penaltyServersOnGround.map((server) => (
                  <Button
                    key={server.userId}
                    label={`${server.firstName} ${server.lastName}`}
                    variant="outline"
                    disabled={working}
                    className="h-10 w-full"
                    onPress={() =>
                      onRecover(
                        absent.userId,
                        PlayingXiNoShowRecoveryAction.PromotePenaltyServer,
                        server.userId,
                      )
                    }
                  />
                ))}
              </View>
            ) : null}
            {selection.onGroundSwapCandidates.length > 0 ? (
              <View className="gap-1">
                <Text className="font-sans text-xs uppercase tracking-wider text-on-surface-variant">
                  Swap in on-ground squad player
                </Text>
                {selection.onGroundSwapCandidates.map((candidate) => (
                  <Button
                    key={candidate.userId}
                    label={`${candidate.firstName} ${candidate.lastName}`}
                    variant="outline"
                    disabled={working}
                    className="h-10 w-full"
                    onPress={() =>
                      onRecover(
                        absent.userId,
                        PlayingXiNoShowRecoveryAction.SwapInOnGround,
                        candidate.userId,
                      )
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

export interface PlayingXiSelectionScreenProps {
  pollId: string;
  onConfirmed?: () => void;
}

/** Captain manages Playing 11, substitutes, and views penalty-serving players. */
export function PlayingXiSelectionScreen({
  pollId,
  onConfirmed,
}: PlayingXiSelectionScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<PollPlayingXiSelectionView | null>(null);
  const [activeTab, setActiveTab] = useState<XiTab>('summary');
  const [squadBucket, setSquadBucket] = useState<SquadBucket>('PLAYING_XI');
  const [editing, setEditing] = useState(false);
  const [picks, setPicks] = useState<Record<string, SquadPick>>({});
  const [designatedServerUserIds, setDesignatedServerUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPollPlayingXiSelection(pollId);
      setSelection(data);
      const initial: Record<string, SquadPick> = {};
      for (const player of data.in) {
        initial[player.userId] = player.squadRole;
      }
      setPicks(initial);
      setDesignatedServerUserIds(
        new Set(
          data.penaltyOwing
            .filter((row) => row.designatedForThisMatch)
            .map((row) => row.userId),
        ),
      );
      setEditing(!data.hasSavedSquad);
      setActiveTab(data.hasSavedSquad ? 'summary' : 'in');
    } catch {
      setError('Could not load players.');
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    void load();
  }, [load]);

  const playingXiIds = useMemo(
    () =>
      Object.entries(picks)
        .filter(([, role]) => role === 'PLAYING_XI')
        .map(([userId]) => userId),
    [picks],
  );
  const substituteIds = useMemo(
    () =>
      Object.entries(picks)
        .filter(([, role]) => role === 'SUBSTITUTE')
        .map(([userId]) => userId),
    [picks],
  );

  const visibleInPlayers = useMemo(() => {
    if (!selection) {
      return [];
    }
    return selection.in.filter((player) => {
      const pick = picks[player.userId] ?? null;
      if (squadBucket === 'PLAYING_XI') {
        return pick !== 'SUBSTITUTE';
      }
      return pick !== 'PLAYING_XI';
    });
  }, [picks, selection, squadBucket]);

  function setPick(userId: string, next: SquadPick): void {
    setError(null);
    if (next === 'SUBSTITUTE') {
      setPicks((current) => {
        const currentSubs = Object.entries(current).filter(([, role]) => role === 'SUBSTITUTE').length;
        const alreadySub = current[userId] === 'SUBSTITUTE';
        if (!alreadySub && currentSubs >= MAX_SUBSTITUTES) {
          setError(`Only ${MAX_SUBSTITUTES} substitutes allowed.`);
          return current;
        }
        return { ...current, [userId]: next };
      });
      return;
    }
    setPicks((current) => ({ ...current, [userId]: next }));
  }

  async function togglePenaltyServer(
    player: PollPenaltyOwingPlayerRow,
    checked: boolean,
  ): Promise<void> {
    if (!selection) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      if (checked) {
        await designatePenaltyServe(selection.teamId, player.penaltyId, {
          serveMatchId: selection.matchId,
        });
        setDesignatedServerUserIds((current) => new Set([...current, player.userId]));
      } else {
        await undesignatePenaltyServe(selection.teamId, player.penaltyId);
        setDesignatedServerUserIds((current) => {
          const next = new Set(current);
          next.delete(player.userId);
          return next;
        });
      }
      const data = await getPollPlayingXiSelection(pollId);
      setSelection(data);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not update penalty server designation.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleRecovery(
    absentUserId: string,
    action: (typeof PlayingXiNoShowRecoveryAction)[keyof typeof PlayingXiNoShowRecoveryAction],
    replacementUserId: string,
  ): Promise<void> {
    setWorking(true);
    setError(null);
    try {
      const updated = await applyPlayingXiNoShowRecovery(pollId, {
        absentUserId,
        action,
        replacementUserId,
      });
      setSelection(updated);
      const nextPicks: Record<string, SquadPick> = {};
      for (const player of updated.in) {
        nextPicks[player.userId] = player.squadRole;
      }
      setPicks(nextPicks);
      setDesignatedServerUserIds(
        new Set(
          updated.penaltyOwing
            .filter((row) => row.designatedForThisMatch)
            .map((row) => row.userId),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not apply no-show recovery.');
    } finally {
      setWorking(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (playingXiIds.length !== PLAYING_XI_SIZE) {
      setError(`Select exactly ${PLAYING_XI_SIZE} players as Playing 11.`);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const updated = await confirmPollPlayingXi(pollId, {
        playingXi: playingXiIds,
        substitutes: substituteIds,
        penaltyServerUserIds: [...designatedServerUserIds],
      });
      setSelection(updated);
      const nextPicks: Record<string, SquadPick> = {};
      for (const player of updated.in) {
        nextPicks[player.userId] = player.squadRole;
      }
      setPicks(nextPicks);
      setDesignatedServerUserIds(
        new Set(
          updated.penaltyOwing
            .filter((row) => row.designatedForThisMatch)
            .map((row) => row.userId),
        ),
      );
      setEditing(false);
      setActiveTab('summary');
      onConfirmed?.();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : `Could not save the Playing 11. Select exactly ${PLAYING_XI_SIZE} Playing 11 players.`,
      );
    } finally {
      setWorking(false);
    }
  }

  const viewingSavedSquad = selection?.hasSavedSquad === true && !editing;
  const showEditTabs = !viewingSavedSquad;
  const tabs = viewingSavedSquad
    ? null
    : ([
        { key: 'in' as const, label: `IN (${selection?.inCount ?? 0})` },
        { key: 'out' as const, label: `OUT (${selection?.outCount ?? 0})` },
      ] as const);

  const sectionLabel =
    viewingSavedSquad || activeTab === 'summary'
      ? 'CONFIRMED SQUAD'
      : POLL_RESULTS_SECTION_LABELS[activeTab === 'out' ? 'out' : 'in'];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Confirmed List of Players" accentTitle />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {selection ? (
        <View className="flex-1">
          {tabs ? (
            <UnderlineTabBar
              layout="spread"
              options={tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
              value={activeTab === 'out' ? 'out' : 'in'}
              onChange={setActiveTab}
            />
          ) : null}

          <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
            <Text className="font-sans-bold text-xs tracking-wider text-on-surface-variant">
              {sectionLabel}
            </Text>
            {selection.hasSavedSquad && !editing ? (
              <Pressable
                onPress={() => {
                  setEditing(true);
                  setActiveTab('in');
                }}
              >
                <Text className="font-sans-semibold text-sm text-primary">Edit squad</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView className="flex-1 px-4" contentContainerClassName="gap-4 pb-4">
            {viewingSavedSquad || activeTab === 'summary' ? (
              <>
                <SummarySection
                  title="Playing 11"
                  players={selection.playingXi}
                  emptyLabel="No Playing 11 saved yet."
                  showArrivalStatus={selection.isMatchDay}
                />
                <SummarySection
                  title="Substitutes"
                  players={selection.substitutes}
                  emptyLabel="No substitutes selected."
                  showArrivalStatus={selection.isMatchDay}
                />
                <SummarySection
                  title="Late arrival penalty servers"
                  players={selection.penaltyServing}
                  emptyLabel="No players serving a penalty."
                  showArrivalStatus={selection.isMatchDay}
                />
                {selection.recoveryActionsEnabled ? (
                  <RecoverySection
                    selection={selection}
                    working={working}
                    onRecover={(absentUserId, action, replacementUserId) =>
                      void handleRecovery(absentUserId, action, replacementUserId)
                    }
                  />
                ) : null}
              </>
            ) : null}

            {activeTab === 'in' ? (
              <>
                <View className="flex-row gap-2">
                  {(
                    [
                      {
                        key: 'PLAYING_XI' as const,
                        label: `Playing 11 ${playingXiIds.length}/${PLAYING_XI_SIZE}`,
                      },
                      {
                        key: 'SUBSTITUTE' as const,
                        label: `Substitutes ${substituteIds.length}/${MAX_SUBSTITUTES}`,
                      },
                    ] as const
                  ).map((bucket) => {
                    const active = squadBucket === bucket.key;
                    return (
                      <Pressable
                        key={bucket.key}
                        onPress={() => setSquadBucket(bucket.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        className={`flex-1 rounded-control border px-3 py-2 active:opacity-80 ${
                          active
                            ? 'border-primary bg-primary-container'
                            : 'border-outline-variant bg-surface'
                        }`}
                      >
                        <Text
                          className={`text-center font-sans-semibold text-sm ${
                            active ? 'text-primary' : 'text-on-surface'
                          }`}
                        >
                          {bucket.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {visibleInPlayers.map((player) => (
                  <InSelectionRow
                    key={player.userId}
                    player={player}
                    bucket={squadBucket}
                    pick={picks[player.userId] ?? null}
                    onPick={(next) => setPick(player.userId, next)}
                  />
                ))}
                {selection.penaltyOwing.length > 0 ? (
                  <View className="mt-2 gap-2 border-t border-outline-variant pt-4">
                    <Text className="font-sans-bold text-xs uppercase tracking-wider text-on-surface-variant">
                      Late arrival penalty players
                    </Text>
                    <Text className="font-sans text-sm text-on-surface-variant">
                      Designate players to serve their penalty at this match. They are separate from
                      the Playing 11 and substitutes.
                    </Text>
                    {selection.penaltyOwing.map((player) => (
                      <PenaltyServerCheckboxRow
                        key={player.penaltyId}
                        player={player}
                        checked={designatedServerUserIds.has(player.userId)}
                        disabled={!player.canDesignateForThisMatch}
                        working={working}
                        onToggle={(next) => void togglePenaltyServer(player, next)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {activeTab === 'out'
              ? selection.out.map((player) => <OutReferenceRow key={player.userId} player={player} />)
              : null}
          </ScrollView>

          {showEditTabs ? (
            <View
              className="border-t border-outline-variant bg-background px-4 pt-3"
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              {error ? <Text className="mb-2 font-sans text-sm text-primary">{error}</Text> : null}
              <Text className="mb-3 font-sans text-sm text-on-surface-variant">
                Playing 11: {playingXiIds.length}/{PLAYING_XI_SIZE} · Substitutes:{' '}
                {substituteIds.length}/{MAX_SUBSTITUTES}
                {designatedServerUserIds.size > 0
                  ? ` · Penalty servers: ${designatedServerUserIds.size}`
                  : ''}
              </Text>
              <Button
                label={working ? 'Saving…' : selection.hasSavedSquad ? 'Save changes' : 'Confirm'}
                disabled={working}
                onPress={() => void handleConfirm()}
                className="h-12 w-full"
              />
            </View>
          ) : (
            <View style={{ paddingBottom: Math.max(insets.bottom, 16) }} />
          )}
        </View>
      ) : null}

      {!loading && error && !selection ? (
        <View className="px-4">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
