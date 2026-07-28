import {
  BallType,
  TEAM_ROSTER_MESSAGES,
  type TeamAddPlayersPickerView,
  type UnassignedTeamPlayerCandidate,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiRequestError,
  addPlayersToTeam,
  listTeamAddPlayerCandidates,
} from '../../lib/api';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { VerifyPlayerRatingsRow } from '../tournament/verify-players/VerifyPlayerRatingsRow';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  PILL_TAB_CHIP_ACTIVE_CLASS,
  PILL_TAB_CHIP_BASE_CLASS,
  PILL_TAB_CHIP_INACTIVE_CLASS,
  PILL_TAB_LABEL_ACTIVE_CLASS,
  PILL_TAB_LABEL_INACTIVE_CLASS,
} from '../ui/PillTabBar';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { FIELD_ORANGE } from '../ui/fieldStyles';

type LeatherTab = 'fulltime' | 'parttime';

function countSelectedInList(
  selectedIds: ReadonlySet<string>,
  candidates: readonly UnassignedTeamPlayerCandidate[],
): number {
  return candidates.filter((candidate) => selectedIds.has(candidate.userId)).length;
}

function SelectablePlayerCard({
  player,
  selected,
  disabled,
  onToggle,
}: {
  player: UnassignedTeamPlayerCandidate;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <Card
      onPress={disabled && !selected ? undefined : onToggle}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 rounded-control border ${
        selected ? 'border-primary' : 'border-outline-variant'
      } ${disabled && !selected ? 'opacity-50' : ''}`}
    >
      <PlayerAvatar
        firstName={player.firstName}
        profilePhotoUrl={player.profilePhotoUrl}
        size="sm"
        shape="circle"
      />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-sans-bold text-base text-on-surface">
          {player.firstName} {player.lastName}
        </Text>
        <Text className="font-sans text-sm text-on-surface-variant">{player.centerName}</Text>
        <VerifyPlayerRatingsRow
          batting={player.battingRating}
          bowling={player.bowlingRating}
          fielding={player.fieldingRating}
        />
      </View>
      <View
        className={`h-7 w-7 items-center justify-center rounded-full border ${
          selected ? 'border-primary bg-primary' : 'border-outline-variant bg-surface-container-lowest'
        }`}
      >
        {selected ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
      </View>
    </Card>
  );
}

export interface TeamAddPlayersScreenProps {
  tournamentId: string;
  teamId: string;
  teamName: string;
}

/** Admin / Club Manager — pick unassigned registrants and add them to the team roster. */
export function TeamAddPlayersScreen({
  tournamentId,
  teamId,
  teamName,
}: TeamAddPlayersScreenProps): React.ReactElement {
  const router = useRouter();
  const [picker, setPicker] = useState<TeamAddPlayersPickerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [leatherTab, setLeatherTab] = useState<LeatherTab>('fulltime');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPicker(await listTeamAddPlayerCandidates(tournamentId, teamId));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load players.');
    } finally {
      setLoading(false);
    }
  }, [teamId, tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isLeather = picker?.ballType === BallType.Leather;
  const rosterSlotsRemaining = picker?.rosterSlotsRemaining ?? null;
  const selectedCount = selectedIds.size;

  const fulltimeSelectedCount = useMemo(
    () => (picker ? countSelectedInList(selectedIds, picker.fulltimeCandidates) : 0),
    [picker, selectedIds],
  );
  const parttimeSelectedCount = useMemo(
    () => (picker ? countSelectedInList(selectedIds, picker.parttimeCandidates) : 0),
    [picker, selectedIds],
  );

  const visibleCandidates = useMemo((): UnassignedTeamPlayerCandidate[] => {
    if (!picker) {
      return [];
    }
    if (isLeather) {
      return leatherTab === 'fulltime' ? picker.fulltimeCandidates : picker.parttimeCandidates;
    }
    return picker.candidates;
  }, [isLeather, leatherTab, picker]);

  function togglePlayer(userId: string): void {
    setError(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
        return next;
      }
      if (rosterSlotsRemaining != null && next.size >= rosterSlotsRemaining) {
        setError(TEAM_ROSTER_MESSAGES.noRemainingSlots);
        return current;
      }
      next.add(userId);
      return next;
    });
  }

  async function submitAdd(): Promise<void> {
    const userIds = [...selectedIds];
    if (userIds.length === 0) {
      setError(TEAM_ROSTER_MESSAGES.selectAtLeastOne);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addPlayersToTeam(tournamentId, teamId, { userIds });
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not add players.');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmAdd(): void {
    const count = selectedIds.size;
    if (count === 0) {
      setError(TEAM_ROSTER_MESSAGES.selectAtLeastOne);
      return;
    }
    Alert.alert(
      TEAM_ROSTER_MESSAGES.addConfirmTitle,
      TEAM_ROSTER_MESSAGES.addConfirmMessage(count, teamName),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => void submitAdd() },
      ],
    );
  }

  const capHint =
    picker?.playersPerTeamCap != null
      ? `${picker.currentRosterSize}/${picker.playersPerTeamCap} on roster${
          rosterSlotsRemaining != null ? ` · ${rosterSlotsRemaining} slot${rosterSlotsRemaining === 1 ? '' : 's'} left` : ''
        }`
      : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Add Players" subtitle={teamName} onBack={() => router.back()} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : (
        <>
          <View className="gap-3 px-4 pt-2">
            {capHint ? (
              <Text className="font-sans text-sm text-on-surface-variant">{capHint}</Text>
            ) : null}

            {isLeather ? (
              <View className="flex-row gap-2">
                {(
                  [
                    {
                      key: 'fulltime' as const,
                      label: `Full-time (${fulltimeSelectedCount})`,
                    },
                    {
                      key: 'parttime' as const,
                      label: `Part-time (${parttimeSelectedCount})`,
                    },
                  ] as const
                ).map((tab) => {
                  const active = leatherTab === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setLeatherTab(tab.key)}
                      className={`min-w-0 flex-1 ${PILL_TAB_CHIP_BASE_CLASS} ${
                        active ? PILL_TAB_CHIP_ACTIVE_CLASS : PILL_TAB_CHIP_INACTIVE_CLASS
                      }`}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                        className={
                          active ? PILL_TAB_LABEL_ACTIVE_CLASS : PILL_TAB_LABEL_INACTIVE_CLASS
                        }
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text className="font-sans-semibold text-sm text-on-surface">
                Selected: {selectedCount}
              </Text>
            )}
          </View>

          <ScrollView contentContainerClassName="gap-3 px-4 py-4">
            {error ? (
              <View className="rounded-lg bg-primary-50 px-4 py-3">
                <Text className="font-sans text-sm text-primary">{error}</Text>
              </View>
            ) : null}

            {visibleCandidates.length === 0 ? (
              <Text className="py-12 text-center font-sans text-base text-on-surface-variant">
                {isLeather && leatherTab === 'fulltime'
                  ? 'No unassigned full-time players.'
                  : isLeather
                    ? 'No unassigned part-time players.'
                    : 'No unassigned registered players.'}
              </Text>
            ) : (
              visibleCandidates.map((player) => {
                const selected = selectedIds.has(player.userId);
                const atCap = rosterSlotsRemaining != null && rosterSlotsRemaining <= 0;
                return (
                  <SelectablePlayerCard
                    key={player.userId}
                    player={player}
                    selected={selected}
                    disabled={atCap}
                    onToggle={() => togglePlayer(player.userId)}
                  />
                );
              })
            )}
          </ScrollView>

          <View className="border-t border-outline-variant px-4 py-4">
            {isLeather ? (
              <Text className="mb-3 text-center font-sans-semibold text-sm text-on-surface">
                {selectedCount} selected
              </Text>
            ) : null}
            <Button
              variant="amber"
              className="h-14 w-full"
              label={submitting ? 'Adding…' : 'Add to the Team'}
              disabled={submitting || selectedCount === 0}
              onPress={confirmAdd}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
