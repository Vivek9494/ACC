import { useLocalSearchParams } from 'expo-router';

import { TournamentRegistrationFormScreen } from '../../../../src/components/tournament/TournamentRegistrationFormScreen';
import { tournamentIdFromParams } from '../../../../src/lib/tournament-route-params';

export default function TournamentRegistrationScreen(): React.ReactElement {
  const params = useLocalSearchParams<{
    id?: string;
    tournamentId?: string;
    onBehalfOfUserId?: string;
    firstName?: string;
    lastName?: string;
    centerId?: string;
    lateRegister?: string;
  }>();

  return (
    <TournamentRegistrationFormScreen
      tournamentId={tournamentIdFromParams(params)}
      onBehalfOfUserId={params.onBehalfOfUserId}
      prefilledFirstName={params.firstName}
      prefilledLastName={params.lastName}
      prefilledCenterId={params.centerId}
      lateRegister={params.lateRegister === '1'}
    />
  );
}
