import { useLocalSearchParams } from 'expo-router';

import { TournamentRegistrationFormScreen } from '../../../src/components/tournament/TournamentRegistrationFormScreen';

export default function TournamentRegistrationScreen(): React.ReactElement {
  const params = useLocalSearchParams<{
    tournamentId: string;
    onBehalfOfUserId?: string;
    firstName?: string;
    lastName?: string;
    centerId?: string;
    lateRegister?: string;
  }>();

  return (
    <TournamentRegistrationFormScreen
      tournamentId={params.tournamentId ?? ''}
      onBehalfOfUserId={params.onBehalfOfUserId}
      prefilledFirstName={params.firstName}
      prefilledLastName={params.lastName}
      prefilledCenterId={params.centerId}
      lateRegister={params.lateRegister === '1'}
    />
  );
}
