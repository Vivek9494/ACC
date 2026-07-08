import { type AuthUser, UserRole } from './auth';
import { BallType } from './rbac';
import { MatchState, type MatchState as MatchStateType } from './match';
import { isAccRegisteredOpponent } from './playing-xi-finalize';
import { isCaptainOrViceCaptain, isMatchTeamCaptainOrViceCaptain } from './team-access';

/** Match states where Players Punch Time may be viewed from Match Detail (DP1). */
export const PLAYERS_PUNCH_TIME_MATCH_STATES: MatchStateType[] = [
  MatchState.Live,
  MatchState.RainInterrupted,
  MatchState.Completed,
  MatchState.NoResult,
  MatchState.ScorecardLocked,
];

export interface PunchTimeScopeMatch {
  ballType: string;
  state: MatchStateType;
  tournamentId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  externalOpponentName?: string | null;
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

/** DP1 — Match Detail "Players Punch Time" button visibility. */
export function canViewMatchPlayersPunchTimeButton(
  user: AuthUser | null | undefined,
  match: PunchTimeScopeMatch,
): boolean {
  if (!user) {
    return false;
  }
  if (match.ballType !== BallType.Leather) {
    return false;
  }
  if (!PLAYERS_PUNCH_TIME_MATCH_STATES.includes(match.state)) {
    return false;
  }
  if (user.role === UserRole.Admin || user.role === UserRole.ClubManager) {
    return true;
  }
  return isMatchTeamCaptainOrViceCaptain(user, match);
}

/**
 * DP2 — Which team(s) the Punch Time page shows for the viewer.
 * Captain/VC always get a single-team view (their ACC team). Admin/CM get one or two tabs.
 */
export function resolvePunchTimeViewScope(
  user: AuthUser | null | undefined,
  match: PunchTimeScopeMatch,
): PunchTimeViewScope | null {
  if (!canViewMatchPlayersPunchTimeButton(user, match)) {
    return null;
  }

  const teams = systemTeamsInMatch(match);
  if (teams.length === 0) {
    return null;
  }

  if (user!.role === UserRole.Admin || user!.role === UserRole.ClubManager) {
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
