import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../lib/auth-context';
import {
  parseTournamentDetailTab,
  TOURNAMENT_DETAIL_TABS,
} from '../../lib/tournament-detail-tabs';
import { tournamentDetailHref } from '../../lib/tournament-detail-route';

/** Legacy `/…/tournament/[id]` routes → Tournaments tab stack detail. */
export default function RoleScopedTournamentDetailRedirect(): React.ReactElement | null {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string | string[] }>();
  const { user } = useAuth();

  if (!id) {
    return null;
  }

  const rawTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const tab = rawTab ? parseTournamentDetailTab(rawTab, TOURNAMENT_DETAIL_TABS) : undefined;

  return <Redirect href={tournamentDetailHref(user, id, tab)} />;
}
