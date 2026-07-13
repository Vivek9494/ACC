import { colors } from '@/theme/colors';
import {
  type PollPenaltyServingPlayerRow,
  type PollPlayingXiPlayerRow,
  type PollPlayingXiSelectionView,
  type PollTallyPlayerRow,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { applyPlayingXiSwitch, ApiRequestError, getPollPlayingXiSelection } from '../../lib/api';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { ERROR_ALERT_SURFACE_CLASS, FIELD_ORANGE } from '../ui/fieldStyles';

const XI_COLLAPSED_COUNT = 6;

/** Player row chrome — matches Confirmed List of Players (`PlayingXiSelectionScreen`). */
const SQUAD_PLAYER_ROW_CLASS =
  'flex-row items-center gap-3 rounded-control border border-outline-variant';

type SwitchCandidate =
  | { kind: 'substitute'; player: PollPlayingXiPlayerRow }
  | { kind: 'penalty'; player: PollPenaltyServingPlayerRow }
  | { kind: 'unselected'; player: PollPlayingXiPlayerRow };

function SectionHeader({
  icon,
  iconColor,
  title,
  countLabel,
  pillClassName,
  pillTextClassName,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  title: string;
  countLabel: string;
  pillClassName: string;
  pillTextClassName: string;
}): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name={icon} size={20} color={iconColor} />
        <Text className="font-sans-bold text-base text-on-surface">{title}</Text>
      </View>
      <View className={`rounded-full px-3 py-1 ${pillClassName}`}>
        <Text className={`font-sans-semibold text-xs ${pillTextClassName}`}>{countLabel}</Text>
      </View>
    </View>
  );
}

function PlayingXiRow({
  player,
  switchEnabled,
  onSwitch,
}: {
  player: PollPlayingXiPlayerRow;
  switchEnabled: boolean;
  onSwitch: () => void;
}): React.ReactElement {
  return (
    <Card className={SQUAD_PLAYER_ROW_CLASS}>
      <PlayerAvatar
        firstName={player.firstName}
        profilePhotoUrl={player.profilePhotoUrl}
        size="sm"
        shape="square"
      />
      <Text className="min-w-0 flex-1 font-sans-bold text-base text-on-surface">
        {player.firstName} {player.lastName}
      </Text>
      {switchEnabled ? (
        <Button
          variant="outline"
          label="Switch"
          onPress={onSwitch}
          className="h-9 min-w-[72px] px-3"
          textClassName="text-xs"
        />
      ) : null}
    </Card>
  );
}

function SquadPlayerRow({
  player,
}: {
  player: Pick<PollTallyPlayerRow, 'firstName' | 'lastName' | 'profilePhotoUrl'>;
}): React.ReactElement {
  return (
    <Card className={SQUAD_PLAYER_ROW_CLASS}>
      <PlayerAvatar
        firstName={player.firstName}
        profilePhotoUrl={player.profilePhotoUrl}
        size="sm"
        shape="square"
      />
      <Text className="min-w-0 flex-1 font-sans-bold text-base text-on-surface">
        {player.firstName} {player.lastName}
      </Text>
    </Card>
  );
}

function SwitchPlayerPickerModal({
  visible,
  replacedPlayer,
  candidates,
  working,
  onClose,
  onSelect,
}: {
  visible: boolean;
  replacedPlayer: PollPlayingXiPlayerRow | null;
  candidates: SwitchCandidate[];
  working: boolean;
  onClose: () => void;
  onSelect: (candidate: SwitchCandidate) => void;
}): React.ReactElement {
  const grouped = useMemo(() => {
    const substitutes = candidates.filter((row) => row.kind === 'substitute');
    const penalties = candidates.filter((row) => row.kind === 'penalty');
    const unselected = candidates.filter((row) => row.kind === 'unselected');
    return { substitutes, penalties, unselected };
  }, [candidates]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[85%] rounded-t-2xl bg-surface-container-lowest px-4 pb-6 pt-4"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-outline-variant" />
          <Text className="font-sans-bold text-lg text-on-surface">Switch player</Text>
          {replacedPlayer ? (
            <Text className="mt-1 font-sans text-sm text-on-surface-variant">
              Replace {replacedPlayer.firstName} {replacedPlayer.lastName}
            </Text>
          ) : null}

          <ScrollView className="mt-4" contentContainerClassName="gap-4 pb-2">
            {candidates.length === 0 ? (
              <Text className="font-sans text-sm text-on-surface-variant">
                No eligible players to switch in right now.
              </Text>
            ) : null}

            {grouped.substitutes.length > 0 ? (
              <View className="gap-1">
                <Text className="font-sans-bold text-xs uppercase tracking-wider text-on-surface-variant">
                  Substitutes
                </Text>
                {grouped.substitutes.map((row) => (
                  <Pressable
                    key={row.player.userId}
                    disabled={working}
                    onPress={() => onSelect(row)}
                    className="flex-row items-center gap-3 rounded-control border border-outline-variant/60 px-3 py-2.5 active:opacity-80"
                  >
                    <PlayerAvatar
                      firstName={row.player.firstName}
                      profilePhotoUrl={row.player.profilePhotoUrl}
                      size="sm"
                      shape="square"
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans-semibold text-base text-on-surface">
                        {row.player.firstName} {row.player.lastName}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {grouped.penalties.length > 0 ? (
              <View className="gap-1">
                <Text className="font-sans-bold text-xs uppercase tracking-wider text-on-surface-variant">
                  Penalty serving
                </Text>
                {grouped.penalties.map((row) => (
                  <Pressable
                    key={row.player.userId}
                    disabled={working}
                    onPress={() => onSelect(row)}
                    className="flex-row items-center gap-3 rounded-control border border-stone-300 bg-stone-100 px-3 py-2.5 active:opacity-80"
                  >
                    <PlayerAvatar
                      firstName={row.player.firstName}
                      profilePhotoUrl={row.player.profilePhotoUrl}
                      size="sm"
                      shape="square"
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans-semibold text-base text-on-surface">
                        {row.player.firstName} {row.player.lastName}
                      </Text>
                      <Text className="font-sans text-sm text-on-surface-variant">
                        {row.player.statusLabel || PENALTY_SERVING_STATUS}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {grouped.unselected.length > 0 ? (
              <View className="gap-1">
                <Text className="font-sans-bold text-xs uppercase tracking-wider text-on-surface-variant">
                  Unselected squad
                </Text>
                {grouped.unselected.map((row) => (
                  <Pressable
                    key={row.player.userId}
                    disabled={working}
                    onPress={() => onSelect(row)}
                    className="flex-row items-center gap-3 rounded-control border border-outline-variant/60 px-3 py-2.5 active:opacity-80"
                  >
                    <PlayerAvatar
                      firstName={row.player.firstName}
                      profilePhotoUrl={row.player.profilePhotoUrl}
                      size="sm"
                      shape="square"
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans-semibold text-base text-on-surface">
                        {row.player.firstName} {row.player.lastName}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <Button variant="outline" label="Cancel" onPress={onClose} disabled={working} className="mt-4 h-11 w-full" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PenaltyCancelConfirmModal({
  visible,
  player,
  working,
  errorMessage,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  player: PollPenaltyServingPlayerRow | null;
  working: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 justify-center bg-black/40 px-6" onPress={onCancel}>
        <Pressable
          className="rounded-xl bg-surface p-5"
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="font-sans-bold text-lg text-on-surface">Cancel penalty?</Text>
          <Text className="mt-2 font-sans text-sm leading-5 text-on-surface-variant">
            {player
              ? `Cancel ${player.firstName} ${player.lastName}'s penalty and add them to the Playing 11? Their suspension will be revoked.`
              : 'Cancel this player\'s penalty and add them to the Playing 11? Their suspension will be revoked.'}
          </Text>
          {errorMessage ? (
            <View className={`mt-3 ${ERROR_ALERT_SURFACE_CLASS}`}>
              <Text className="font-sans text-sm text-primary">{errorMessage}</Text>
            </View>
          ) : null}
          <View className="mt-5 flex-row gap-3">
            <View className="flex-1">
              <Button variant="outline" label="Dismiss" onPress={onCancel} disabled={working} />
            </View>
            <View className="flex-1">
              <Button
                label={working ? 'Switching…' : 'Confirm'}
                onPress={onConfirm}
                disabled={working}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export interface ConfirmedPlayersScreenProps {
  pollId: string;
}

/** Captain views confirmed squad and switches Playing 11 players before the match goes live. */
export function ConfirmedPlayersScreen({ pollId }: ConfirmedPlayersScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<PollPlayingXiSelectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xiExpanded, setXiExpanded] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<PollPlayingXiPlayerRow | null>(null);
  const [penaltyConfirm, setPenaltyConfirm] = useState<{
    replacedUserId: string;
    replacement: PollPenaltyServingPlayerRow;
  } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPollPlayingXiSelection(pollId);
      setSelection(data);
      if (!data.hasSavedSquad) {
        setError('Playing 11 has not been confirmed yet.');
      }
    } catch {
      setError('Could not load confirmed players.');
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleXi = useMemo(() => {
    if (!selection) {
      return [];
    }
    if (xiExpanded || selection.playingXi.length <= XI_COLLAPSED_COUNT) {
      return selection.playingXi;
    }
    return selection.playingXi.slice(0, XI_COLLAPSED_COUNT);
  }, [selection, xiExpanded]);

  const hiddenXiCount = selection
    ? Math.max(0, selection.playingXi.length - XI_COLLAPSED_COUNT)
    : 0;

  const switchCandidates = useMemo((): SwitchCandidate[] => {
    if (!selection || !switchTarget) {
      return [];
    }
    const excluded = switchTarget.userId;
    const subs: SwitchCandidate[] = selection.switchSubstituteCandidates
      .filter((row) => row.userId !== excluded)
      .map((player) => ({ kind: 'substitute', player }));
    const penalties: SwitchCandidate[] = selection.switchPenaltyServerCandidates
      .filter((row) => row.userId !== excluded)
      .map((player) => ({ kind: 'penalty', player }));
    const unselected: SwitchCandidate[] = selection.switchUnselectedCandidates
      .filter((row) => row.userId !== excluded)
      .map((player) => ({ kind: 'unselected', player }));
    return [...subs, ...penalties, ...unselected];
  }, [selection, switchTarget]);

  async function executeSwitch(
    replacedUserId: string,
    replacementUserId: string,
    confirmPenaltyCancellation?: boolean,
  ): Promise<void> {
    setWorking(true);
    setError(null);
    setConfirmError(null);
    try {
      const updated = await applyPlayingXiSwitch(pollId, {
        replacedUserId,
        replacementUserId,
        confirmPenaltyCancellation,
      });
      setSelection(updated);
      setSwitchTarget(null);
      setPenaltyConfirm(null);
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : 'Could not switch players.';
      if (penaltyConfirm) {
        setConfirmError(message);
      } else {
        setError(message);
      }
    } finally {
      setWorking(false);
    }
  }

  function handleCandidateSelect(candidate: SwitchCandidate): void {
    if (!switchTarget) {
      return;
    }
    if (candidate.kind === 'penalty') {
      setPenaltyConfirm({
        replacedUserId: switchTarget.userId,
        replacement: candidate.player,
      });
      setConfirmError(null);
      return;
    }
    void executeSwitch(switchTarget.userId, candidate.player.userId);
  }

  function handlePenaltyConfirm(): void {
    if (!penaltyConfirm) {
      return;
    }
    void executeSwitch(
      penaltyConfirm.replacedUserId,
      penaltyConfirm.replacement.userId,
      true,
    );
  }

  const switchEnabled = selection?.switchActionsEnabled === true;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Confirmed Players" accentTitle />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {selection?.hasSavedSquad ? (
        <ScrollView
          className="flex-1 px-4"
          contentContainerClassName="gap-6 pb-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {error ? (
            <View className={ERROR_ALERT_SURFACE_CLASS}>
              <Text className="font-sans text-sm text-primary">{error}</Text>
            </View>
          ) : null}

          <View className="gap-2">
            <SectionHeader
              icon="sports-cricket"
              iconColor={FIELD_ORANGE}
              title="Playing 11"
              countLabel={`${selection.playingXi.length} Players`}
              pillClassName="bg-primary"
              pillTextClassName="text-on-primary"
            />
            {selection.playingXi.length === 0 ? (
              <Text className="font-sans text-sm text-on-surface-variant">No Playing 11 saved yet.</Text>
            ) : (
              <>
                <View className="gap-3">
                  {visibleXi.map((player) => (
                    <PlayingXiRow
                      key={player.userId}
                      player={player}
                      switchEnabled={switchEnabled}
                      onSwitch={() => {
                        setError(null);
                        setSwitchTarget(player);
                      }}
                    />
                  ))}
                </View>
                {!xiExpanded && hiddenXiCount > 0 ? (
                  <Pressable
                    onPress={() => setXiExpanded(true)}
                    className="flex-row items-center justify-center gap-1 py-2 active:opacity-80"
                  >
                    <Text className="font-sans-semibold text-sm text-primary">
                      View remaining {hiddenXiCount} players
                    </Text>
                    <MaterialIcons name="expand-more" size={20} color={FIELD_ORANGE} />
                  </Pressable>
                ) : null}
                {xiExpanded && selection.playingXi.length > XI_COLLAPSED_COUNT ? (
                  <Pressable
                    onPress={() => setXiExpanded(false)}
                    className="flex-row items-center justify-center gap-1 py-2 active:opacity-80"
                  >
                    <Text className="font-sans-semibold text-sm text-primary">Show fewer</Text>
                    <MaterialIcons name="expand-less" size={20} color={FIELD_ORANGE} />
                  </Pressable>
                ) : null}
              </>
            )}
          </View>

          <View className="gap-2">
            <SectionHeader
              icon="groups"
              iconColor={colors.secondary}
              title="Substitutes"
              countLabel={`${selection.substitutes.length} Players`}
              pillClassName="bg-primary-300"
              pillTextClassName="text-on-primary"
            />
            {selection.substitutes.length === 0 ? (
              <Text className="font-sans text-sm text-on-surface-variant">No substitutes selected.</Text>
            ) : (
              <View className="gap-3">
                {selection.substitutes.map((player) => (
                  <SquadPlayerRow key={player.userId} player={player} />
                ))}
              </View>
            )}
          </View>

          {selection.penaltyServing.length > 0 ? (
            <View className="gap-2">
              <SectionHeader
                icon="warning"
                iconColor={colors.secondaryDark}
                title="Penalty Serving Players"
                countLabel={`${selection.penaltyServing.length} Players`}
                pillClassName="bg-stone-200"
                pillTextClassName="text-secondary-800"
              />
              <View className="gap-3">
                {selection.penaltyServing.map((player) => (
                  <SquadPlayerRow key={player.userId} player={player} />
                ))}
              </View>
            </View>
          ) : null}

          {!switchEnabled ? (
            <Text className="font-sans text-sm text-on-surface-variant">
              Playing 11 switches are locked once the match goes live.
            </Text>
          ) : null}
        </ScrollView>
      ) : null}

      {!loading && error && !selection?.hasSavedSquad ? (
        <View className="px-4">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      <SwitchPlayerPickerModal
        visible={switchTarget != null && penaltyConfirm == null}
        replacedPlayer={switchTarget}
        candidates={switchCandidates}
        working={working}
        onClose={() => {
          if (!working) {
            setSwitchTarget(null);
          }
        }}
        onSelect={handleCandidateSelect}
      />

      <PenaltyCancelConfirmModal
        visible={penaltyConfirm != null}
        player={penaltyConfirm?.replacement ?? null}
        working={working}
        errorMessage={confirmError}
        onCancel={() => {
          if (!working) {
            setPenaltyConfirm(null);
            setConfirmError(null);
          }
        }}
        onConfirm={handlePenaltyConfirm}
      />
    </View>
  );
}
