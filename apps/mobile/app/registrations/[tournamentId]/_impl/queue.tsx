import { useLocalSearchParams } from 'expo-router';

import { VerifyPlayersScreen } from '../../../../src/components/tournament/verify-players/VerifyPlayersScreen';
import { tournamentIdFromParams } from '../../../../src/lib/tournament-route-params';

export default function VerifyPlayersRoute(): React.ReactElement {
  const params = useLocalSearchParams<{ id?: string; tournamentId?: string }>();
  const tournamentId = tournamentIdFromParams(params);
  return <VerifyPlayersScreen tournamentId={tournamentId} />;
}
