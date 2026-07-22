import { type AuthUser, UserRole } from './auth';
import { BallType, type BallType as BallTypeValue } from './rbac';
import {
  deriveTournamentDisplayStatus,
  TournamentDisplayStatus,
} from './tournament-display-status';

/** Tournament fields for leather invite management UI / window checks. */
export interface LeatherInviteTournamentContext {
  ballType: BallTypeValue;
  /** ISO 8601 UTC — used with endAt for Upcoming / Live / Completed. */
  startAt: string;
  /** ISO 8601 UTC — invites hidden once venue-local calendar day is past this. */
  endAt: string;
  /** IANA venue timezone; defaults to America/Toronto when omitted. */
  timezone?: string | null;
  cancelled?: boolean;
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

/**
 * Invites are allowed while the tournament is Upcoming or Live (venue-local /
 * America/Toronto by default). Hidden after Completed or when Cancelled.
 */
export function isLeatherInviteWindowOpen(
  tournament: Pick<
    LeatherInviteTournamentContext,
    'startAt' | 'endAt' | 'timezone' | 'cancelled'
  >,
  now: Date = new Date(),
): boolean {
  const status = deriveTournamentDisplayStatus(
    {
      startAt: tournament.startAt,
      endAt: tournament.endAt,
      timezone: tournament.timezone,
      cancelled: tournament.cancelled,
    },
    now,
  );
  return (
    status === TournamentDisplayStatus.Upcoming || status === TournamentDisplayStatus.Live
  );
}

/** Admin may manage leather invites until the tournament has ended. */
export function canManageLeatherInvites(
  user: AuthUser | null | undefined,
  tournament: LeatherInviteTournamentContext | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!user || !tournament || tournament.ballType !== BallType.Leather) {
    return false;
  }
  if (user.role !== UserRole.Admin) {
    return false;
  }
  return isLeatherInviteWindowOpen(tournament, now);
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
