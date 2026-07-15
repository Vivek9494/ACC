import { type AuthUser, UserRole } from './auth';
import { BallType } from './rbac';
import { MatchState, type MatchState as MatchStateType } from './match';
import { isAccRegisteredOpponent } from './playing-xi-finalize';
import { isCaptainOrViceCaptain, isMatchTeamCaptainOrViceCaptain } from './team-access';

/**
 * Post-match states: punch attendance may still be VIEWED, but manual
 * enter/edit/verify overrides are closed (historical record).
 */
export const PUNCH_TIME_READ_ONLY_MATCH_STATES: MatchStateType[] = [
  MatchState.Completed,
  MatchState.NoResult,
  MatchState.ScorecardLocked,
];

/**
 * Match states where punch time VIEW is allowed (Match Detail, Captain Home, page).
 * Prep through live/post — excludes Cancelled and other terminal non-attendance states.
 */
export const PUNCH_TIME_VIEWABLE_MATCH_STATES: MatchStateType[] = [
  MatchState.Scheduled,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
  MatchState.Delayed,
  MatchState.Live,
  MatchState.RainInterrupted,
  ...PUNCH_TIME_READ_ONLY_MATCH_STATES,
];

/** @deprecated Use {@link PUNCH_TIME_VIEWABLE_MATCH_STATES}. Kept for call-site aliases. */
export const PLAYERS_PUNCH_TIME_MATCH_STATES: MatchStateType[] = PUNCH_TIME_VIEWABLE_MATCH_STATES;

/** @deprecated Use {@link PUNCH_TIME_VIEWABLE_MATCH_STATES}. */
export const CAPTAIN_DASHBOARD_PUNCH_TIME_MATCH_STATES: MatchStateType[] =
  PUNCH_TIME_VIEWABLE_MATCH_STATES;

/** States allowed for the Punch Time page GET (and Match Detail / Home view buttons). */
export const PUNCH_TIME_PAGE_MATCH_STATES: MatchStateType[] = PUNCH_TIME_VIEWABLE_MATCH_STATES;

export interface PunchTimeScopeMatch {
  ballType: string;
  state: MatchStateType;
  tournamentId: string;
  tournamentCreatedByUserId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  externalOpponentName?: string | null;
}

/** B1 organizer check — tournament creator (`createdByUserId`). */
export function isTournamentOrganizer(
  user: AuthUser | null | undefined,
  tournamentCreatedByUserId: string | null | undefined,
): boolean {
  return Boolean(user && tournamentCreatedByUserId && user.id === tournamentCreatedByUserId);
}

export interface PunchTimeTeamTab {
  id: string;
  name: string;
}

export interface PunchTimeViewScope {
  teams: PunchTimeTeamTab[];
  showTeamTabs: boolean;
  defaultTeamId: string;
}

function systemTeamsInMatch(match: PunchTimeScopeMatch): PunchTimeTeamTab[] {
  const teams: PunchTimeTeamTab[] = [];
  if (match.homeTeamId) {
    teams.push({ id: match.homeTeamId, name: match.homeTeamName ?? 'Home' });
  }
  if (match.awayTeamId) {
    teams.push({ id: match.awayTeamId, name: match.awayTeamName ?? 'Away' });
  }
  return teams;
}

function canViewPunchTimeForStates(
  user: AuthUser | null | undefined,
  match: PunchTimeScopeMatch,
  allowedStates: readonly MatchStateType[],
): boolean {
  if (!user) {
    return false;
  }
  if (match.ballType !== BallType.Leather) {
    return false;
  }
  if (!allowedStates.includes(match.state)) {
    return false;
  }
  if (user.role === UserRole.Admin) {
    return true;
  }
  if (user.role === UserRole.ClubManager) {
    return isTournamentOrganizer(user, match.tournamentCreatedByUserId);
  }
  return isMatchTeamCaptainOrViceCaptain(user, match);
}

/** True when punch records are historical — no enter/edit/verify overrides. */
export function isPunchTimeReadOnly(state: MatchStateType): boolean {
  return PUNCH_TIME_READ_ONLY_MATCH_STATES.includes(state);
}

/** Match Detail "View Punch Time" / "Players Punch Time" button visibility. */
export function canViewMatchPlayersPunchTimeButton(
  user: AuthUser | null | undefined,
  match: PunchTimeScopeMatch,
): boolean {
  return canViewPunchTimeForStates(user, match, PUNCH_TIME_VIEWABLE_MATCH_STATES);
}

/**
 * Captain Home upcoming-card "View Punch Time" — same role/leather/state rules as Match Detail.
 */
export function canViewCaptainDashboardPunchTimeButton(
  user: AuthUser | null | undefined,
  match: PunchTimeScopeMatch,
): boolean {
  return canViewPunchTimeForStates(user, match, PUNCH_TIME_VIEWABLE_MATCH_STATES);
}

/**
 * DP2 — Which team(s) the Punch Time page shows for the viewer.
 * Captain/VC always get a single-team view (their ACC team). Admin/CM get one or two tabs.
 */
export function resolvePunchTimeViewScope(
  user: AuthUser | null | undefined,
  match: PunchTimeScopeMatch,
): PunchTimeViewScope | null {
  if (!canViewPunchTimeForStates(user, match, PUNCH_TIME_PAGE_MATCH_STATES)) {
    return null;
  }

  const teams = systemTeamsInMatch(match);
  if (teams.length === 0) {
    return null;
  }

  const isAdmin = user!.role === UserRole.Admin;
  const isOrganizerCm =
    user!.role === UserRole.ClubManager &&
    isTournamentOrganizer(user, match.tournamentCreatedByUserId);
  if (isAdmin || isOrganizerCm) {
    if (isAccRegisteredOpponent(match)) {
      return {
        teams,
        showTeamTabs: teams.length === 2,
        defaultTeamId: teams[0]!.id,
      };
    }
    return {
      teams: [teams[0]!],
      showTeamTabs: false,
      defaultTeamId: teams[0]!.id,
    };
  }

  const ownTeam = teams.find((team) =>
    isCaptainOrViceCaptain(user, match.tournamentId, team.id),
  );
  if (!ownTeam) {
    return null;
  }

  return {
    teams: [ownTeam],
    showTeamTabs: false,
    defaultTeamId: ownTeam.id,
  };
}
