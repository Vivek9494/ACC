import { UserRole, type AuthUser } from '@acc/types';
import type { Href } from 'expo-router';

import { hasCenterSevakAccess } from './center-sevak-access';
import { hasTeamLeadAccess } from './team-lead-access';
import type { TournamentDetailTab } from './tournament-detail-tabs';

/** Roles whose dashboard has a persistent bottom tab bar. */
export type RoleTabBarRoot = 'admin' | 'club-manager' | 'captain' | 'center-sevak' | 'player';

const ROLE_TOURNAMENTS_TAB_PATHNAME: Record<
  RoleTabBarRoot,
  | '/admin/tournaments/[id]'
  | '/club-manager/tournaments/[id]'
  | '/captain/tournaments/[id]'
  | '/center-sevak/tournaments/[id]'
  | '/home/tournaments/[id]'
> = {
  admin: '/admin/tournaments/[id]',
  'club-manager': '/club-manager/tournaments/[id]',
  captain: '/captain/tournaments/[id]',
  'center-sevak': '/center-sevak/tournaments/[id]',
  player: '/home/tournaments/[id]',
};

const ROLE_TOURNAMENTS_LIST_PATH: Record<RoleTabBarRoot, Href> = {
  admin: '/admin/tournaments',
  'club-manager': '/club-manager/tournaments',
  captain: '/captain/tournaments',
  'center-sevak': '/center-sevak/tournaments',
  player: '/home/tournaments',
};

/** Role-scoped tournament detail inside the Tournaments tab stack (legacy singular path redirects here). */
const ROLE_SCOPED_TOURNAMENT_PATH =
  /\/(admin|club-manager|captain|center-sevak|home)\/(tournament\/|tournaments\/[^/]+)/;

/** Resolve which role hub should host tournament detail for an authenticated user. */
export function resolveRoleTabBarRoot(
  user: AuthUser | null | undefined,
): RoleTabBarRoot | null {
  if (!user) {
    return null;
  }
  if (user.role === UserRole.Admin) {
    return 'admin';
  }
  if (user.role === UserRole.ClubManager) {
    return 'club-manager';
  }
  if (
    user.role === UserRole.Captain ||
    user.role === UserRole.ViceCaptain ||
    hasTeamLeadAccess(user)
  ) {
    return 'captain';
  }
  if (user.role === UserRole.CenterSevak || hasCenterSevakAccess(user)) {
    return 'center-sevak';
  }
  return 'player';
}

/** True when tournament detail is rendered inside a role tab group (bottom bar visible). */
export function isRoleScopedTournamentPath(pathname: string): boolean {
  return ROLE_SCOPED_TOURNAMENT_PATH.test(pathname);
}

/** @deprecated Use {@link isRoleScopedTournamentPath}. */
export function isClubManagerTournamentPath(pathname: string): boolean {
  return isRoleScopedTournamentPath(pathname);
}

/** Tournaments tab list route for a role hub. */
export function roleTournamentsListHref(user: AuthUser | null | undefined): Href | null {
  const roleRoot = resolveRoleTabBarRoot(user);
  return roleRoot ? ROLE_TOURNAMENTS_LIST_PATH[roleRoot] : null;
}

/** Role-aware tournament detail — always in the Tournaments tab stack. */
export function tournamentDetailHref(
  user: AuthUser | null | undefined,
  tournamentId: string,
  tab?: TournamentDetailTab,
): Href {
  const params = tab ? { id: tournamentId, tab } : { id: tournamentId };
  const roleRoot = resolveRoleTabBarRoot(user);

  if (roleRoot) {
    return {
      pathname: ROLE_TOURNAMENTS_TAB_PATHNAME[roleRoot],
      params,
    };
  }

  return {
    pathname: '/tournaments/[id]',
    params,
  };
}

/** @deprecated Use {@link tournamentDetailHref}. */
export function tournamentDetailFromBrowseHref(
  user: AuthUser | null | undefined,
  tournamentId: string,
  tab?: TournamentDetailTab,
): Href {
  return tournamentDetailHref(user, tournamentId, tab);
}

/** Root-stack tournament detail URL (guest / deep links without a role hub). */
export function isRootTournamentDetailPath(pathname: string): boolean {
  return /^\/tournaments\/[^/]+$/.test(normalizeTournamentRoutePath(pathname));
}

function normalizeTournamentRoutePath(path: string): string {
  return path.split('?')[0]?.replace(/\/$/, '') ?? path;
}
