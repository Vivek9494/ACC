import type { TeamSummary } from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeamAvatar } from '../ui/TeamAvatar';
import { Button } from '../ui/Button';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

function TeamPickRow({
  team,
  checked,
  onToggle,
}: {
  team: TeamSummary;
  checked: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onToggle}
      className={`flex-row items-center gap-3 rounded-control border bg-surface p-4 active:opacity-90 ${
        checked ? 'border-primary bg-primary/5' : 'border-outline-variant'
      }`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={team.name}
    >
      <TeamAvatar name={team.name} logoUrl={team.logoUrl} size="md" />
      <Text className="min-w-0 flex-1 font-sans-medium text-base text-on-surface">{team.name}</Text>
      <View
        className={`h-6 w-6 items-center justify-center rounded-md border ${
          checked ? 'border-primary bg-primary' : 'border-stone-300 bg-surface'
        }`}
      >
        {checked ? <Ionicons name="checkmark" size={16} color={colors.textInverse} /> : null}
      </View>
    </Pressable>
  );
}

export interface AddGroupTeamsModalProps {
  visible: boolean;
  eligibleTeams: TeamSummary[];
  onCancel: () => void;
  onConfirm: (teamIds: string[]) => void;
}

/** Multi-select picker for unassigned tournament teams. */
export function AddGroupTeamsModal({
  visible,
  eligibleTeams,
  onCancel,
  onConfirm,
}: AddGroupTeamsModalProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [pickedIds, setPickedIds] = useState<string[]>([]);

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return eligibleTeams;
    }
    return eligibleTeams.filter((team) => team.name.toLowerCase().includes(query));
  }, [eligibleTeams, search]);

  function handleClose(): void {
    setSearch('');
    setPickedIds([]);
    onCancel();
  }

  function toggleTeam(teamId: string): void {
    setPickedIds((current) =>
      current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId],
    );
  }

  function handleConfirm(): void {
    if (pickedIds.length === 0) {
      handleClose();
      return;
    }
    onConfirm(pickedIds);
    setSearch('');
    setPickedIds([]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={handleClose}>
        <Pressable
          className="max-h-[85%] flex-col overflow-hidden rounded-t-2xl bg-background"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="gap-4 px-4 pt-5">
            <Text className="text-center font-sans-bold text-lg text-on-surface">Add Teams</Text>
            <Text className="text-center font-sans text-sm text-on-surface-variant">
              Only unassigned teams are shown.
            </Text>
            <TextInput
              label="Search teams"
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView
            className="flex-shrink"
            style={{ maxHeight: 320 }}
            contentContainerClassName="gap-3 px-4 pb-3"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {filteredTeams.length === 0 ? (
              <Text className="py-6 text-center font-sans text-sm text-on-surface-variant">
                No eligible teams available.
              </Text>
            ) : (
              filteredTeams.map((team) => (
                <TeamPickRow
                  key={team.id}
                  team={team}
                  checked={pickedIds.includes(team.id)}
                  onToggle={() => toggleTeam(team.id)}
                />
              ))
            )}
          </ScrollView>

          <View
            className="border-t border-outline-variant bg-background px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <View className="flex-row gap-3">
              <Button label="Cancel" variant="outline" onPress={handleClose} className="h-12 flex-1" />
              <Button
                label="Add Selected"
                onPress={handleConfirm}
                disabled={pickedIds.length === 0}
                className="h-12 flex-1"
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Teams eligible for the Add Teams picker while editing one group. */
export function eligibleTeamsForGroupEdit(
  allTeams: readonly TeamSummary[],
  groupId: string,
  stagedTeamIds: readonly string[],
): TeamSummary[] {
  const stagedSet = new Set(stagedTeamIds);
  return allTeams.filter((team) => {
    if (stagedSet.has(team.id)) {
      return false;
    }
    if (team.groupId != null && team.groupId !== groupId) {
      return false;
    }
    return true;
  });
}

export function computeGroupMemberDiff(
  snapshotTeamIds: readonly string[],
  stagedTeamIds: readonly string[],
): { addTeamIds: string[]; removeTeamIds: string[] } {
  const snapshot = new Set(snapshotTeamIds);
  const staged = new Set(stagedTeamIds);
  const addTeamIds = stagedTeamIds.filter((id) => !snapshot.has(id));
  const removeTeamIds = snapshotTeamIds.filter((id) => !staged.has(id));
  return { addTeamIds, removeTeamIds };
}

export function groupMemberDiffHasChanges(
  snapshotTeamIds: readonly string[],
  stagedTeamIds: readonly string[],
): boolean {
  if (snapshotTeamIds.length !== stagedTeamIds.length) {
    return true;
  }
  const snapshot = new Set(snapshotTeamIds);
  return stagedTeamIds.some((id) => !snapshot.has(id));
}
