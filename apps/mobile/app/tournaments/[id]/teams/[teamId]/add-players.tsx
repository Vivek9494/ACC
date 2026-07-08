import { useLocalSearchParams } from 'expo-router';

import { TeamAddPlayersScreen } from '../../../../../src/components/tournament/TeamAddPlayersScreen';

export default function TeamAddPlayersRoute(): React.ReactElement | null {
  const { id, teamId, teamName } = useLocalSearchParams<{
    id: string;
    teamId: string;
    teamName?: string;
  }>();
  if (!id || !teamId) {
    return null;
  }
  return (
    <TeamAddPlayersScreen
      tournamentId={id}
      teamId={teamId}
      teamName={teamName?.trim() || 'Team'}
    />
  );
}
