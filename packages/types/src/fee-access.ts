import { type AuthUser, UserRole, type TeamLeadAssignment } from './auth';
import { BallType, type BallType as BallTypeValue } from './rbac';
import type { TournamentScopeDisplay } from './tournament';
import { isAllCentersTennisScope } from './tournament-scorers';

/** Tournament fields needed to decide Fees Tracker button visibility. */
export interface FeesTrackerTournamentContext {
  id: string;
  ballType: BallTypeValue;
  scopeDisplay: TournamentScopeDisplay;
}

function leadsTeamInTournament(
  assignments: TeamLeadAssignment[] | undefined,
  tournamentId: string,
): boolean {
  return (assignments ?? []).some(
    (assignment) =>
      assignment.tournamentId === tournamentId &&
      (assignment.role === UserRole.Captain || assignment.role === UserRole.ViceCaptain),
  );
}

/**
 * §20 UI gate for the tournament Details "ACC Fees Tracker" button.
 * Server enforces the same matrix on fee endpoints.
 */
export function canShowTournamentFeesTracker(
  user: AuthUser | null | undefined,
  tournament: FeesTrackerTournamentContext | null | undefined,
): boolean {
  if (!user || !tournament) {
    return false;
  }

  if (user.role === UserRole.Admin) {
    return true;
  }

  if (tournament.ballType === BallType.Tennis) {
    if (user.role === UserRole.ClubManager && isAllCentersTennisScope(tournament.scopeDisplay)) {
      return true;
    }
    return (user.centerSevakCenterIds?.length ?? 0) > 0;
  }

  if (tournament.ballType === BallType.Leather) {
    if (user.role === UserRole.ClubManager) {
      return true;
    }
    return leadsTeamInTournament(user.teamLeadAssignments, tournament.id);
  }

  return false;
}
