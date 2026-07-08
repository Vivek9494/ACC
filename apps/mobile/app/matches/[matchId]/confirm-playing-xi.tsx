import { useLocalSearchParams } from 'expo-router';

import { PollPlayingXiConfirmScreen } from '../../../src/components/dashboard/PollPlayingXiConfirmScreen';

export default function ConfirmPlayingXiFromPollRoute(): React.ReactElement | null {
  const { matchId, teamId, teamName } = useLocalSearchParams<{
    matchId: string;
    teamId: string;
    teamName?: string;
  }>();

  if (!matchId || !teamId) {
    return null;
  }

  return (
    <PollPlayingXiConfirmScreen matchId={matchId} teamId={teamId} teamName={teamName} />
  );
}
