import { Redirect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TeamDetailScreen } from '../../../../src/components/tournament/TeamDetailScreen';
import { useAuth } from '../../../../src/lib/auth-context';
import {
  resolveRoleTabBarRoot,
  tournamentSubpathHref,
} from '../../../../src/lib/tournament-detail-route';

/**
 * Root deep-link / guest entry for team detail.
 * Authenticated users bounce into the role Tournaments tab stack; guests see the roster.
 */
export default function Route(): React.ReactElement | null {
  const { user, status } = useAuth();
  const { id, teamId } = useLocalSearchParams<{ id: string; teamId: string }>();

  if (status === 'loading') {
    return null;
  }

  if (user && resolveRoleTabBarRoot(user) && id && teamId) {
    return (
      <Redirect href={tournamentSubpathHref(user, id, 'teams/[teamId]', { teamId })} />
    );
  }

  if (!id || !teamId) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <TeamDetailScreen tournamentId={id} teamId={teamId} />
    </SafeAreaView>
  );
}
