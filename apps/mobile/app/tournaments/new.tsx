import { Redirect } from 'expo-router';

import { useAuth } from '../../src/lib/auth-context';
import { tournamentNewHref } from '../../src/lib/tournament-detail-route';

/** Root create-tournament entry — bounce into the role Tournaments tab stack. */
export default function AddTournamentRedirect(): React.ReactElement {
  const { user } = useAuth();
  return <Redirect href={tournamentNewHref(user)} />;
}
