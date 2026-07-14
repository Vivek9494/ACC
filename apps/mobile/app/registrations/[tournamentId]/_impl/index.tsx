import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/lib/auth-context';
import { tournamentSubpathHref } from '../../../../src/lib/tournament-detail-route';
import { tournamentIdFromParams } from '../../../../src/lib/tournament-route-params';

/** Legacy route — canonical registration screen lives at `/register`. */
export default function RegistrationIndexRedirect(): React.ReactElement {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; tournamentId?: string }>();
  const tournamentId = tournamentIdFromParams(params);
  if (!tournamentId) {
    return <Redirect href="/" />;
  }
  return <Redirect href={tournamentSubpathHref(user, tournamentId, 'registrations/register')} />;
}
