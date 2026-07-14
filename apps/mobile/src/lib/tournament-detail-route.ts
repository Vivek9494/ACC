import { UserRole, type AuthUser } from '@acc/types';

import { hasCenterSevakAccess } from './center-sevak-access';
import { hasTeamLeadAccess } from './team-lead-access';
import type { TournamentDetailTab } from './tournament-detail-tabs';

/** Roles whose dashboard has a persistent bottom tab bar. */
export type RoleTabBarRoot = 'admin' | 'club-manager' | 'captain' | 'center-sevak' | 'player';

const ROLE_TOURNAMENTS_TAB_PATHNAME: Record<RoleTabBarRoot, string> = {
  admin: '/admin/tournaments/[id]',
  'club-manager': '/club-manager/tournaments/[id]',
  captain: '/captain/tournaments/[id]',
  'center-sevak': '/center-sevak/tournaments/[id]',
  player: '/home/tournaments/[id]',
};

const ROLE_TOURNAMENTS_LIST_PATH: Record<RoleTabBarRoot, string> = {
  admin: '/admin/tournaments',
  'club-manager': '/club-manager/tournaments',
  captain: '/captain/tournaments',
  'center-sevak': '/center-sevak/tournaments',
  player: '/home/tournaments',
};

const ROLE_TOURNAMENTS_NEW_PATH: Record<RoleTabBarRoot, string> = {
  admin: '/admin/tournaments/new',
  'club-manager': '/club-manager/tournaments/new',
  captain: '/captain/tournaments/new',
  'center-sevak': '/center-sevak/tournaments/new',
  player: '/home/tournaments/new',
};

/** Role-scoped tournament detail inside the Tournaments tab stack (legacy singular path redirects here). */
const ROLE_SCOPED_TOURNAMENT_PATH =
  /\/(admin|club-manager|captain|center-sevak|home)\/(tournament\/|tournaments\/[^/]+)/;

/**
 * Sub-routes nested under `/{role}/tournaments/[id]/…` so the Tournaments tab stays active.
 * Keep in sync with files under each role hub's `tournaments/[id]/` tree.
 */
export type TournamentSubpath =
  | 'fees'
  | 'assign-scorers'
  | 'registered-players'
  | 'favourite-players'
  | 'upload-video'
  | 'leather-invites'
  | 'edit'
  | 'add-team'
  | 'create-group'
  | 'match-setup'
  | 'knockout-bracket'
  | 'knockout-chart'
  | 'schedule-matches'
  | 'schedule/round-robin'
  | 'schedule/groups-knockout'
  | 'schedule/manual'
  | 'teams/[teamId]'
  | 'teams/[teamId]/edit'
  | 'teams/[teamId]/add-players'
  | 'players/[userId]'
  | 'registrations'
  | 'registrations/queue'
  | 'registrations/register'
  | 'registrations/late-register'
  | 'registrations/ratings-review'
  | 'registrations/players';

export type TournamentRouteHref = {
  pathname: string;
  params: Record<string, string>;
};

/**
 * Bridge dynamic tournament paths into Expo Router's generated Href union without
 * naming that union (it is large enough to trip TS2590).
 */
export function tournamentHref(value: string | TournamentRouteHref) {
  return value as never;
}

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

/**
 * True when the pathname is a nested tournament flow screen (not list / detail).
 * Tab bar stays active as Tournaments but should stay hidden (pre-nesting UX).
 */
export function shouldHideRoleTabBarForPath(pathname: string): boolean {
  const normalized = normalizeTournamentRoutePath(pathname);
  // /{role}/tournaments/new
  if (/^\/(admin|club-manager|captain|center-sevak|home)\/tournaments\/new$/.test(normalized)) {
    return true;
  }
  // /{role}/tournaments/:id/<anything>
  return /^\/(admin|club-manager|captain|center-sevak|home)\/tournaments\/[^/]+\/.+/.test(
    normalized,
  );
}

/** @deprecated Use {@link isRoleScopedTournamentPath}. */
export function isClubManagerTournamentPath(pathname: string): boolean {
  return isRoleScopedTournamentPath(pathname);
}

/** Tournaments tab list route for a role hub. */
export function roleTournamentsListHref(user: AuthUser | null | undefined) {
  const roleRoot = resolveRoleTabBarRoot(user);
  return roleRoot ? tournamentHref(ROLE_TOURNAMENTS_LIST_PATH[roleRoot]) : null;
}

/** Create-tournament form inside the Tournaments tab stack. */
export function tournamentNewHref(user: AuthUser | null | undefined) {
  const roleRoot = resolveRoleTabBarRoot(user);
  if (roleRoot) {
    return tournamentHref(ROLE_TOURNAMENTS_NEW_PATH[roleRoot]);
  }
  return tournamentHref('/tournaments/new');
}

/** Role-aware tournament detail — always in the Tournaments tab stack. */
export function tournamentDetailHref(
  user: AuthUser | null | undefined,
  tournamentId: string,
  tab?: TournamentDetailTab,
) {
  const params: Record<string, string> = tab
    ? { id: tournamentId, tab }
    : { id: tournamentId };
  const roleRoot = resolveRoleTabBarRoot(user);

  if (roleRoot) {
    return tournamentHref({
      pathname: ROLE_TOURNAMENTS_TAB_PATHNAME[roleRoot],
      params,
    });
  }

  return tournamentHref({
    pathname: '/tournaments/[id]',
    params,
  });
}

/** Role-aware href for a tournament sub-page (Fees, scorers, schedule, registrations, …). */
export function tournamentSubpathHref(
  user: AuthUser | null | undefined,
  tournamentId: string,
  subpath: TournamentSubpath,
  extraParams?: Record<string, string>,
) {
  const params = { id: tournamentId, ...extraParams };
  const roleRoot = resolveRoleTabBarRoot(user);

  if (roleRoot) {
    const detailPath = ROLE_TOURNAMENTS_TAB_PATHNAME[roleRoot];
    return tournamentHref({
      pathname: `${detailPath}/${subpath}`,
      params,
    });
  }

  return tournamentHref({
    pathname: `/tournaments/[id]/${subpath}`,
    params,
  });
}

/** @deprecated Use {@link tournamentDetailHref}. */
export function tournamentDetailFromBrowseHref(
  user: AuthUser | null | undefined,
  tournamentId: string,
  tab?: TournamentDetailTab,
) {
  return tournamentDetailHref(user, tournamentId, tab);
}

/** Root-stack tournament detail URL (guest / deep links without a role hub). */
export function isRootTournamentDetailPath(pathname: string): boolean {
  return /^\/tournaments\/[^/]+$/.test(normalizeTournamentRoutePath(pathname));
}

function normalizeTournamentRoutePath(path: string): string {
  return path.split('?')[0]?.replace(/\/$/, '') ?? path;
}
