import type { GroupSummary, TeamSummary } from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button } from '../ui/Button';
import { useAuth } from '../../lib/auth-context';
import { canScheduleTournamentMatches } from '../../lib/can-schedule-matches';
import { TabEmptyState } from '../ui/TabEmptyState';
import { EditableTournamentGroupSection } from './EditableTournamentGroupSection';

const BatsmanIllustration = require('../../../assets/illustrations/batsman.png') as number;

export interface TournamentGroupsTabProps {
  tournamentId: string;
  groups: GroupSummary[];
  allTeams: TeamSummary[];
  onGroupsChanged: () => void | Promise<void>;
}

/** Tournament Groups tab — editable group cards and add-more CTA. */
export function TournamentGroupsTab({
  tournamentId,
  groups,
  allTeams,
  onGroupsChanged,
}: TournamentGroupsTabProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const canManageGroups = canScheduleTournamentMatches(user);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const handleEditStart = useCallback(
    (groupId: string) => {
      void (async () => {
        await onGroupsChanged();
        setEditingGroupId(groupId);
      })();
    },
    [onGroupsChanged],
  );

  const handleEditEnd = useCallback(() => {
    setEditingGroupId(null);
  }, []);

  function openCreateGroup(): void {
    router.push(`/tournaments/${tournamentId}/create-group`);
  }

  if (groups.length === 0) {
    if (canManageGroups) {
      return (
        <TabEmptyState
          image={BatsmanIllustration}
          message="Create groups and assign teams to get started."
          buttonLabel="Create Group"
          buttonVariant="primary"
          onPress={openCreateGroup}
        />
      );
    }

    return (
      <TabEmptyState
        image={BatsmanIllustration}
        message="No groups have been set up for this tournament yet."
      />
    );
  }

  return (
    <View className="gap-4">
      {groups.map((group) => (
        <EditableTournamentGroupSection
          key={group.id}
          group={group}
          tournamentId={tournamentId}
          allTeams={allTeams}
          canEdit={canManageGroups}
          isEditing={editingGroupId === group.id}
          onEditStart={() => handleEditStart(group.id)}
          onEditEnd={handleEditEnd}
          onGroupsChanged={onGroupsChanged}
        />
      ))}
      {canManageGroups ? (
        <Button
          label="Add More Groups"
          onPress={openCreateGroup}
          className="mt-1 h-12 w-full"
        />
      ) : null}
    </View>
  );
}
