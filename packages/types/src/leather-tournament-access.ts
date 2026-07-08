import { type AuthUser, UserRole } from './auth';
import { BallType, type BallType as BallTypeValue } from './rbac';

/** Tournament fields for leather invite management UI. */
export interface LeatherInviteTournamentContext {
  ballType: BallTypeValue;
  /** ISO 8601 UTC — invites hidden once the tournament has started. */
  startAt: string;
}

/** A registered app user eligible to receive a leather tournament invite. */
export interface LeatherInviteCandidate {
  userId: string;
  firstName: string;
  lastName: string;
  centerId: string;
  centerName: string;
}

/** An outstanding leather invite for a tournament. */
export interface LeatherTournamentInvite {
  userId: string;
  firstName: string;
  lastName: string;
  centerName: string;
  invitedAt: string;
  /** False once the player submits registration. */
  canRevoke: boolean;
}

export interface LeatherInviteCandidatesResponse {
  candidates: LeatherInviteCandidate[];
}

export interface LeatherTournamentInvitesResponse {
  invites: LeatherTournamentInvite[];
}

export interface CreateLeatherInvitesRequest {
  userIds: string[];
}

export interface CreateLeatherInvitesResponse {
  invitedCount: number;
}

/**
 * Club Managers may self-register for leather tournaments during the registration
 * window without an invite (organizers who also play ACC).
 */
export function clubManagerCanSelfRegisterForLeather(
  user: AuthUser | null | undefined,
  ballType: BallTypeValue | null | undefined,
): boolean {
  return user?.role === UserRole.ClubManager && ballType === BallType.Leather;
}

/** Club Manager may invite until the tournament start date. */
export function canManageLeatherInvites(
  user: AuthUser | null | undefined,
  tournament: LeatherInviteTournamentContext | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!user || !tournament || tournament.ballType !== BallType.Leather) {
    return false;
  }
  if (user.role !== UserRole.ClubManager) {
    return false;
  }
  return now.getTime() < new Date(tournament.startAt).getTime();
}

/**
 * Documented Path A + B rules (enforced server-side in LeatherTournamentVisibilityService):
 * - any locked-XI in a leather tournament match, OR
 * - rostered to an active leather team.
 */
export const EXISTING_LEATHER_PLAYER_RULE = {
  anyLockedXiInLeatherTournament: true,
  activeLeatherTeamRoster: true,
} as const;
