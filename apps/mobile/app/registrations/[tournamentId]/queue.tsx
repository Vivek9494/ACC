import { useLocalSearchParams } from 'expo-router';

import { VerifyPlayersScreen } from '../../../src/components/tournament/verify-players/VerifyPlayersScreen';

export default function VerifyPlayersRoute(): React.ReactElement {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  return <VerifyPlayersScreen tournamentId={tournamentId ?? ''} />;
}
