import { UserRole } from './auth';
import { TournamentType } from './rbac';
import {
  canCenterSevakOrganizeTournament,
  type TournamentOrganizerActor,
  type TournamentOrganizerContext,
} from './tournament-organizer';

/**
 * Strict who-may-assign Captain / VC / Manager (distinct from EDIT_TOURNAMENT).
 *
 * - CENTER (single or multi): Admin or participating-center Sevak. Club Manager never.
 * - APL: Admin or Club Manager. Sevak never.
 * - Leather (ACC): Admin or Club Manager only. Sevak never (even if they organize).
 */
export function canAssignTeamLeadershipRoles(
  actor: TournamentOrganizerActor,
  tournament: TournamentOrganizerContext,
): boolean {
  if (actor.role === UserRole.Admin) {
    return true;
  }

  if (tournament.type === TournamentType.ACC) {
    return actor.role === UserRole.ClubManager;
  }

  if (tournament.type === TournamentType.APL) {
    return actor.role === UserRole.ClubManager;
  }

  if (tournament.type === TournamentType.Center) {
    if (actor.role === UserRole.ClubManager) {
      return false;
    }
    return canCenterSevakOrganizeTournament(
      actor.sevakCenterIds ?? [],
      actor.userId,
      tournament,
    );
  }

  return false;
}
