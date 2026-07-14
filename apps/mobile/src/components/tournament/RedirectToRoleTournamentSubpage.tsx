import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../lib/auth-context';
import {
  resolveRoleTabBarRoot,
  tournamentSubpathHref,
  type TournamentSubpath,
} from '../../lib/tournament-detail-route';

/**
 * Root `/tournaments/[id]/…` and `/registrations/…` entry — bounce authenticated
 * users into the role Tournaments tab stack so deep links keep Tournaments active.
 */
export function RedirectToRoleTournamentSubpage({
  subpath,
  extraParamKeys = [],
}: {
  subpath: TournamentSubpath;
  /** Extra search-param names to forward (e.g. teamId, userId, name). */
  extraParamKeys?: readonly string[];
}): React.ReactElement {
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const idRaw = params.id ?? params.tournamentId;
  const tournamentId = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  if (!user || !resolveRoleTabBarRoot(user)) {
    return <Redirect href="/login" />;
  }
  if (!tournamentId) {
    return <Redirect href="/login" />;
  }

  const extra: Record<string, string> = {};
  for (const key of extraParamKeys) {
    const value = params[key];
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw === 'string' && raw.length > 0) {
      extra[key] = raw;
    }
  }

  return <Redirect href={tournamentSubpathHref(user, tournamentId, subpath, extra)} />;
}
