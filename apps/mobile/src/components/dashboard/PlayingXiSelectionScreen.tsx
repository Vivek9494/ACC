import { colors } from '@/theme/colors';
import {
  PLAYING_XI_SIZE,
  POLL_RESULTS_SECTION_LABELS,
  PlayingXiNoShowRecoveryAction,
  formatRegistrationPlayerTypeLine,
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
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

type XiTab = 'in' | 'out' | 'summary';
type SquadPick = 'PLAYING_XI' | 'SUBSTITUTE' | null;

function PlayerSummaryRow({
  player,
  badge,
  badgeClassName,
}: {
  player: PollPlayingXiPlayerRow | PollTallyPlayerRow;
  badge?: string;
  badgeClassName?: string;
}): React.ReactElement {
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
        {'skillLabel' in player && player.skillLabel ? (
          <Text className="font-sans text-sm text-on-surface-variant">{player.skillLabel}</Text>
        ) : null}
      </View>
      {badge ? (
        <Text
          className={`font-sans-semibold text-xs ${badgeClassName ?? 'text-on-surface-variant'}`}
        >
          {badge}
        </Text>
      ) : null}
    </View>
  );
}

function OutReferenceRow({ player }: { player: PollTallyPlayerRow }): React.ReactElement {
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
        {player.skillLabel ? (
          <Text className="font-sans text-sm text-on-surface-variant">{player.skillLabel}</Text>
        ) : null}
      </View>
      <MaterialIcons name="cancel" size={24} color={colors.textMuted} />
    </View>
  );
}

function SquadRadio({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="flex-row items-center gap-1.5 active:opacity-80"
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? 'border-primary' : 'border-outline-variant'
        }`}
      >
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
      </View>
      <Text className={`font-sans-semibold text-xs ${selected ? 'text-primary' : 'text-on-surface-variant'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function InSelectionRow({
  player,
  pick,
  onPick,
}: {
  player: PollPlayingXiPlayerRow;
  pick: SquadPick;
  onPick: (next: SquadPick) => void;
}): React.ReactElement {
  const playerTypeLine = formatRegistrationPlayerTypeLine(
    player.playerType,
    player.matchesPlayedCount,
  );

  return (
    <View className="gap-3 border-b border-outline-variant/60 py-3">
      <View className="flex-row items-start gap-3">
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
          {playerTypeLine ? (
            <Text className="font-sans text-sm text-on-surface-variant">{playerTypeLine}</Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row gap-6 pl-[60px]">
        <SquadRadio
          label="PLAYING 11"
          selected={pick === 'PLAYING_XI'}
          onPress={() => onPick(pick === 'PLAYING_XI' ? null : 'PLAYING_XI')}
        />
        <SquadRadio
          label="SUBSTITUTE"
          selected={pick === 'SUBSTITUTE'}
          onPress={() => onPick(pick === 'SUBSTITUTE' ? null : 'SUBSTITUTE')}
        />
      </View>
    </View>
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
        players.map((player) => (
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
        ))
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
        {player.skillLabel ? (
          <Text className="font-sans text-sm text-on-surface-variant">{player.skillLabel}</Text>
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

  function setPick(userId: string, next: SquadPick): void {
    setError(null);
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
      <ScreenHeader title="Confirmed List of Players" accentTitle showProfileMenu={false} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {selection ? (
        <View className="flex-1">
          {tabs ? (
            <View className="flex-row border-b border-outline-variant">
              {tabs.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    className="flex-1 items-center py-3 active:opacity-80"
                  >
                    <Text
                      className={`font-sans-semibold text-sm ${
                        active ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {tab.label}
                    </Text>
                    {active ? <View className="mt-2 h-0.5 w-full rounded-full bg-primary" /> : null}
                  </Pressable>
                );
              })}
            </View>
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
                {selection.in.map((player) => (
                  <InSelectionRow
                    key={player.userId}
                    player={player}
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
                Playing 11: {playingXiIds.length}/{PLAYING_XI_SIZE}
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
