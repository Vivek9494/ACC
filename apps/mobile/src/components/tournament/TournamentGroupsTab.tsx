import type { GroupSummary } from '@acc/types';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '../ui/Button';
import { useAuth } from '../../lib/auth-context';
import { canScheduleTournamentMatches } from '../../lib/can-schedule-matches';
import { TabEmptyState } from '../ui/TabEmptyState';
import { TournamentGroupSection } from './TournamentGroupSection';

const BatsmanIllustration = require('../../../assets/illustrations/batsman.png') as number;

export interface TournamentGroupsTabProps {
  tournamentId: string;
  groups: GroupSummary[];
}

/** Tournament Groups tab — stacked group cards and add-more CTA. */
export function TournamentGroupsTab({
  tournamentId,
  groups,
}: TournamentGroupsTabProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const canManageGroups = canScheduleTournamentMatches(user);

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
        <TournamentGroupSection key={group.id} group={group} />
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
