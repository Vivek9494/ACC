import {
  BallType,
  type TeamDetailPlayerRow,
  type TeamDetailView,
  type TeamRoleCandidate,
} from '@acc/types';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, View } from 'react-native';

import { ApiRequestError, assignTeamRoles, listTeamRoleCandidates } from '../../lib/api';
import { Button } from '../ui/Button';
import { Select, type SelectOption } from '../ui/Select';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

type LeadershipRole = 'captain' | 'viceCaptain' | 'manager';

/** Keep the sheet under ~70% of the screen so the roster FlatList scrolls internally. */
const PICKER_LIST_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.55);
const ALL_CENTERS_VALUE = '';

export interface TeamLeadershipSectionProps {
  tournamentId: string;
  teamId: string;
  detail: TeamDetailView;
  onUpdated: () => void;
}

function playerName(player: TeamDetailPlayerRow | undefined): string {
  if (!player) {
    return 'Not assigned';
  }
  return `${player.firstName} ${player.lastName}`;
}

function playerToCandidate(player: TeamDetailPlayerRow): TeamRoleCandidate {
  return {
    userId: player.userId,
    firstName: player.firstName,
    lastName: player.lastName,
    centerId: null,
    centerName: '',
  };
}

function mergeCandidates(
  audience: TeamRoleCandidate[],
  roster: TeamDetailPlayerRow[],
): TeamRoleCandidate[] {
  const byId = new Map<string, TeamRoleCandidate>();
  for (const player of roster) {
    byId.set(player.userId, playerToCandidate(player));
  }
  for (const candidate of audience) {
    byId.set(candidate.userId, candidate);
  }
  return [...byId.values()].sort((a, b) => {
    const last = a.lastName.localeCompare(b.lastName);
    if (last !== 0) {
      return last;
    }
    return a.firstName.localeCompare(b.firstName);
  });
}

function excludedUserIds(
  detail: TeamDetailView,
  pickerRole: LeadershipRole,
): string[] {
  const captain = detail.players.find((player) => player.isCaptain)?.userId ?? null;
  const viceCaptain = detail.players.find((player) => player.isViceCaptain)?.userId ?? null;
  const manager = detail.players.find((player) => player.isManager)?.userId ?? null;

  if (pickerRole === 'captain') {
    return [viceCaptain, manager].filter((id): id is string => id != null);
  }
  if (pickerRole === 'viceCaptain') {
    return [captain, manager].filter((id): id is string => id != null);
  }
  return [captain, viceCaptain].filter((id): id is string => id != null);
}

function candidateRowLabel(candidate: TeamRoleCandidate): string {
  return candidate.centerName
    ? `${candidate.firstName} ${candidate.lastName} · ${candidate.centerName}`
    : `${candidate.firstName} ${candidate.lastName}`;
}

/** Admin / Club Manager assigns Captain, Vice-Captain, and Manager from the type audience. */
export function TeamLeadershipSection({
  tournamentId,
  teamId,
  detail,
  onUpdated,
}: TeamLeadershipSectionProps): React.ReactElement | null {
  const [pickerRole, setPickerRole] = useState<LeadershipRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audienceCandidates, setAudienceCandidates] = useState<TeamRoleCandidate[]>([]);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [centerFilter, setCenterFilter] = useState<string>(ALL_CENTERS_VALUE);
  const [search, setSearch] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const showManager = detail.ballType !== BallType.Leather;
  const captain = detail.players.find((player) => player.isCaptain);
  const viceCaptain = detail.players.find((player) => player.isViceCaptain);
  const manager = detail.players.find((player) => player.isManager);

  useEffect(() => {
    if (!detail.canAssignTeamRoles || pickerRole == null) {
      return;
    }
    let cancelled = false;
    setLoadingCandidates(true);
    listTeamRoleCandidates(tournamentId, {
      centerId: centerFilter || undefined,
    })
      .then((response) => {
        if (!cancelled) {
          setAudienceCandidates(response.candidates);
          setCenters(response.centers);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not load eligible players.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCandidates(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [detail.canAssignTeamRoles, pickerRole, tournamentId, centerFilter]);

  const pool = useMemo(() => {
    const merged = mergeCandidates(audienceCandidates, detail.players);
    const excluded =
      pickerRole == null ? new Set<string>() : new Set(excludedUserIds(detail, pickerRole));
    const needle = search.trim().toLowerCase();
    return merged.filter((candidate) => {
      if (excluded.has(candidate.userId)) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack =
        `${candidate.firstName} ${candidate.lastName} ${candidate.centerName}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [audienceCandidates, detail, pickerRole, search]);

  const centerOptions: SelectOption[] = useMemo(
    () => [
      { value: ALL_CENTERS_VALUE, label: 'All centers' },
      ...centers.map((center) => ({ value: center.id, label: center.name })),
    ],
    [centers],
  );

  if (!detail.canAssignTeamRoles) {
    return null;
  }

  async function saveRole(role: LeadershipRole, userId: string | null): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await assignTeamRoles(tournamentId, teamId, {
        ...(role === 'captain'
          ? { captainUserId: userId }
          : role === 'viceCaptain'
            ? { viceCaptainUserId: userId }
            : { managerUserId: userId }),
      });
      setPickerRole(null);
      setSearch('');
      setCenterFilter(ALL_CENTERS_VALUE);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update team role.');
    } finally {
      setSaving(false);
    }
  }

  function pickerTitle(role: LeadershipRole): string {
    if (role === 'captain') {
      return 'Select Captain';
    }
    if (role === 'viceCaptain') {
      return 'Select Vice-Captain';
    }
    return 'Select Manager';
  }

  function openPicker(role: LeadershipRole): void {
    setError(null);
    setSearch('');
    setCenterFilter(ALL_CENTERS_VALUE);
    setPickerRole(role);
  }

  return (
    <View className="gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <Text variant="section" className="font-sans-bold text-on-surface">
        Team Leadership
      </Text>
      <Text className="font-sans text-sm text-on-surface-variant">
        Assign Captain, Vice-Captain
        {showManager ? ', and Manager' : ''} from confirmed registrants after registration closes.
        Players not already on this squad are added automatically.
      </Text>

      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text variant="secondary" className="font-sans-semibold text-on-surface-variant">
              Captain
            </Text>
            <Text variant="body" className="font-sans-bold text-on-surface" numberOfLines={1}>
              {playerName(captain)}
            </Text>
          </View>
          <Button
            variant="outline"
            label="Change"
            onPress={() => openPicker('captain')}
            disabled={saving}
            className="h-8 shrink-0 px-2.5"
            textClassName="text-caption"
          />
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text variant="secondary" className="font-sans-semibold text-on-surface-variant">
              Vice-Captain
            </Text>
            <Text variant="body" className="font-sans-bold text-on-surface" numberOfLines={1}>
              {playerName(viceCaptain)}
            </Text>
          </View>
          <Button
            variant="outline"
            label="Change"
            onPress={() => openPicker('viceCaptain')}
            disabled={saving}
            className="h-8 shrink-0 px-2.5"
            textClassName="text-caption"
          />
        </View>

        {showManager ? (
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text variant="secondary" className="font-sans-semibold text-on-surface-variant">
                Manager
              </Text>
              <Text variant="body" className="font-sans-bold text-on-surface" numberOfLines={1}>
                {playerName(manager)}
              </Text>
            </View>
            <Button
              variant="outline"
              label="Change"
              onPress={() => openPicker('manager')}
              disabled={saving}
              className="h-8 shrink-0 px-2.5"
              textClassName="text-caption"
            />
          </View>
        ) : null}
      </View>

      {error && pickerRole == null ? (
        <Text className="font-sans text-sm text-primary">{error}</Text>
      ) : null}

      <Modal
        visible={pickerRole != null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerRole(null)}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setPickerRole(null)}>
          <Pressable
            className="max-h-[70%] overflow-hidden rounded-t-2xl bg-background px-4 pb-8 pt-4"
            onPress={(event) => event.stopPropagation()}
          >
            <Text variant="section" className="font-sans-bold text-on-surface">
              {pickerRole ? pickerTitle(pickerRole) : ''}
            </Text>
            <View className="mt-3 gap-3">
              {centers.length > 0 ? (
                <Select
                  label="Filter by center"
                  placeholder="All centers"
                  value={centerFilter}
                  options={centerOptions}
                  onChange={setCenterFilter}
                  disabled={saving || loadingCandidates}
                />
              ) : null}
              <TextInput
                label="Search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name…"
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            {error ? (
              <Text className="mt-2 font-sans text-sm text-primary">{error}</Text>
            ) : null}
            <FlatList
              data={pool}
              keyExtractor={(candidate) => candidate.userId}
              style={{ maxHeight: PICKER_LIST_MAX_HEIGHT, marginTop: 8 }}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              ListHeaderComponent={
                <Pressable
                  className="border-b border-outline-variant py-3"
                  onPress={() => pickerRole && void saveRole(pickerRole, null)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Clear assignment"
                >
                  <Text className="font-sans-semibold text-base text-on-surface-variant">
                    Clear assignment
                  </Text>
                </Pressable>
              }
              renderItem={({ item: candidate }) => (
                <Pressable
                  className="border-b border-outline-variant py-3"
                  onPress={() => pickerRole && void saveRole(pickerRole, candidate.userId)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={candidateRowLabel(candidate)}
                >
                  <Text className="font-sans-semibold text-base text-on-surface">
                    {candidateRowLabel(candidate)}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text className="py-6 text-center font-sans text-sm text-on-surface-variant">
                  {loadingCandidates ? 'Loading…' : 'No eligible players.'}
                </Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
