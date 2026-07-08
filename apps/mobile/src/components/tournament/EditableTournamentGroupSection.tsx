import { type GroupSummary, type TeamSummary } from '@acc/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  AddGroupTeamsModal,
  computeGroupMemberDiff,
  eligibleTeamsForGroupEdit,
  groupMemberDiffHasChanges,
} from './AddGroupTeamsModal';
import { TournamentGroupCard, type GroupCardTeam } from './TournamentGroupCard';
import { ApiRequestError, deleteGroup, updateGroupMembers } from '../../lib/api';
import { confirmDestructiveDeleteAlert } from '../../lib/confirm-destructive-delete';
import { groupDeleteBlockedMessage } from '../../lib/group-delete-messages';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { ListRowIconButton } from '../ui/ListRowIconButton';

export interface EditableTournamentGroupSectionProps {
  group: GroupSummary;
  tournamentId: string;
  allTeams: TeamSummary[];
  canEdit: boolean;
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
  onGroupsChanged: () => void | Promise<void>;
}

function resolveStagedTeams(
  stagedTeamIds: readonly string[],
  group: GroupSummary,
  allTeams: readonly TeamSummary[],
): GroupCardTeam[] {
  const byId = new Map<string, GroupCardTeam>();
  for (const team of group.teams) {
    byId.set(team.id, { id: team.id, name: team.name, logoUrl: team.logoUrl });
  }
  for (const team of allTeams) {
    byId.set(team.id, {
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
    });
  }
  return stagedTeamIds
    .map((id) => byId.get(id))
    .filter((team): team is GroupCardTeam => team != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function EditableTournamentGroupSection({
  group,
  tournamentId,
  allTeams,
  canEdit,
  isEditing,
  onEditStart,
  onEditEnd,
  onGroupsChanged,
}: EditableTournamentGroupSectionProps): React.ReactElement {
  const snapshotTeamIds = useMemo(() => group.teams.map((team) => team.id), [group.teams]);
  const [stagedTeamIds, setStagedTeamIds] = useState<string[]>(snapshotTeamIds);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const resetStaged = useCallback(() => {
    setStagedTeamIds(snapshotTeamIds);
    setSaveError(null);
  }, [snapshotTeamIds]);

  useEffect(() => {
    if (!isEditing) {
      setStagedTeamIds(snapshotTeamIds);
    }
  }, [isEditing, snapshotTeamIds]);

  const enterEditMode = useCallback(() => {
    resetStaged();
    onEditStart();
  }, [onEditStart, resetStaged]);

  const exitEditMode = useCallback(() => {
    resetStaged();
    setAddModalVisible(false);
    onEditEnd();
  }, [onEditEnd, resetStaged]);

  const stagedTeams = useMemo(
    () => resolveStagedTeams(stagedTeamIds, group, allTeams),
    [allTeams, group, stagedTeamIds],
  );

  const hasChanges = groupMemberDiffHasChanges(snapshotTeamIds, stagedTeamIds);

  const eligibleTeams = useMemo(
    () => eligibleTeamsForGroupEdit(allTeams, group.id, stagedTeamIds),
    [allTeams, group.id, stagedTeamIds],
  );

  function handleRemoveTeam(teamId: string): void {
    setStagedTeamIds((current) => current.filter((id) => id !== teamId));
    setSaveError(null);
  }

  function handleAddTeams(teamIds: string[]): void {
    setStagedTeamIds((current) => [...new Set([...current, ...teamIds])]);
    setAddModalVisible(false);
    setSaveError(null);
  }

  function handleCancel(): void {
    exitEditMode();
  }

  async function handleSave(): Promise<void> {
    if (!hasChanges) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    const diff = computeGroupMemberDiff(snapshotTeamIds, stagedTeamIds);
    try {
      await updateGroupMembers(tournamentId, group.id, diff);
      await onGroupsChanged();
      onEditEnd();
    } catch (err) {
      setSaveError(
        err instanceof ApiRequestError ? err.message : 'Could not save group changes.',
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteGroup(): void {
    if (group.hasLiveMatches) {
      Alert.alert('Could not delete group', groupDeleteBlockedMessage(group));
      return;
    }
    confirmDestructiveDeleteAlert({
      title: 'Delete group?',
      message: `Remove "${group.name}" from this tournament? Teams in this group will become unassigned.`,
      onConfirm: async () => {
        try {
          await deleteGroup(tournamentId, group.id);
          await onGroupsChanged();
          onEditEnd();
        } catch (err) {
          const message =
            err instanceof ApiRequestError
              ? err.message
              : groupDeleteBlockedMessage(group);
          Alert.alert('Could not delete group', message);
        }
      },
    });
  }

  const headerTrailing =
    canEdit && !isEditing ? (
      <ListRowIconButton
        icon="pencil"
        accessibilityLabel={`Edit ${group.name}`}
        onPress={enterEditMode}
      />
    ) : canEdit && isEditing ? (
      <ListRowIconButton
        icon="trash-outline"
        accessibilityLabel={`Delete ${group.name}`}
        onPress={handleDeleteGroup}
      />
    ) : null;

  const editFooter = isEditing ? (
    <View className="gap-3 border-t border-separator px-4 py-4">
      {saveError ? (
        <Text className="text-center font-sans text-sm text-primary">{saveError}</Text>
      ) : null}
      <Button
        label="Add Teams"
        onPress={() => setAddModalVisible(true)}
        className="h-12 w-full"
      />
      <View className="flex-row gap-3">
        <Button
          label="Cancel"
          variant="outline"
          onPress={handleCancel}
          disabled={saving}
          className="h-12 flex-1"
        />
        <Button
          label={saving ? 'Saving…' : 'Save'}
          onPress={() => void handleSave()}
          disabled={!hasChanges || saving}
          className="h-12 flex-1"
        />
      </View>
    </View>
  ) : null;

  return (
    <>
      <TournamentGroupCard
        groupName={group.name}
        teams={isEditing ? stagedTeams : group.teams.map((team) => ({
          id: team.id,
          name: team.name,
          logoUrl: team.logoUrl,
        }))}
        headerTrailing={headerTrailing}
        editMode={isEditing}
        onRemoveTeam={isEditing ? handleRemoveTeam : undefined}
        editFooter={editFooter}
      />
      <AddGroupTeamsModal
        visible={addModalVisible}
        eligibleTeams={eligibleTeams}
        onCancel={() => setAddModalVisible(false)}
        onConfirm={handleAddTeams}
      />
    </>
  );
}
