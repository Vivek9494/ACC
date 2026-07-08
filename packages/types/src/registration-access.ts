import { type AuthUser, UserRole } from './auth';
import { hasTeamFavouritesLeadInTournament, hasTeamLeadershipInTournament } from './team-access';
import { BallType, type BallType as BallTypeValue } from './rbac';
import { RegistrationStatus } from './registration';
import {
  isTournamentRegistrationWindowClosed,
  tournamentHasRegistrationWindow,
} from './tournament-registration';

/** Tournament fields needed for registration-management visibility. */
export interface RegistrationManagementTournamentContext {
  id?: string;
  ballType: BallTypeValue;
  /** When false, verification queue / late-register flows are hidden. */
  hasRegistrationWindow?: boolean;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  /** Server-derived: registration closed and no registrants left in waitlist. */
  registrationVerificationComplete?: boolean;
}

/** True when the actor holds a scoped Center Sevak assignment. */
export function hasCenterSevakAssignment(user: AuthUser | null | undefined): boolean {
  return (user?.centerSevakCenterIds?.length ?? 0) > 0;
}

/** Platform roles that may self-register during an open registration window. */
export function canSelfRegisterForTournament(
  userRole: UserRole | null | undefined,
): boolean {
  if (!userRole) {
    return false;
  }
  return (
    userRole === UserRole.Player ||
    userRole === UserRole.Captain ||
    userRole === UserRole.ViceCaptain ||
    userRole === UserRole.Manager ||
    userRole === UserRole.CenterSevak ||
    userRole === UserRole.ClubManager
  );
}

/** Leather ACC has no post-submit verification gate; tennis (Center / APL) does. */
export function tournamentUsesRegistrationVerification(
  ballType: BallTypeValue | null | undefined,
): boolean {
  return ballType === BallType.Tennis;
}

/**
 * Center Sevak may manage registrations (verify, late-register, own-center list)
 * for tennis (APL / Center-level) tournaments only — not leather ACC.
 */
export function canCenterSevakManageTournamentRegistrations(
  user: AuthUser | null | undefined,
  tournament: RegistrationManagementTournamentContext | null | undefined,
): boolean {
  if (!user || !tournament || !tournamentUsesRegistrationVerification(tournament.ballType)) {
    return false;
  }
  return hasCenterSevakAssignment(user);
}

/**
 * Verify Players UI — tennis Center Sevak only. Leather has no verification step for anyone.
 */
export function canShowRegistrationVerificationQueue(
  user: AuthUser | null | undefined,
  tournament: RegistrationManagementTournamentContext | null | undefined,
): boolean {
  if (!user || !tournament?.hasRegistrationWindow) {
    return false;
  }
  return canCenterSevakManageTournamentRegistrations(user, tournament);
}

/** Captain or Vice Captain in a tournament. */
export function isTournamentTeamLead(
  user: AuthUser | null | undefined,
  tournamentId: string,
): boolean {
  return hasTeamLeadershipInTournament(user, tournamentId);
}

/**
 * True when Center Sevak verification is finished: registration window closed and
 * no registrants remain IN_WAITLIST (everyone approved or declined).
 */
export function isRegistrationVerificationComplete(
  tournament: Pick<
    RegistrationManagementTournamentContext,
    'ballType' | 'hasRegistrationWindow' | 'registrationOpenAt' | 'registrationCloseAt'
  >,
  pendingWaitlistCount: number,
  now: Date = new Date(),
): boolean {
  if (!tournamentUsesRegistrationVerification(tournament.ballType)) {
    return false;
  }
  if (!tournament.hasRegistrationWindow) {
    return false;
  }
  if (!isTournamentRegistrationWindowClosed(
    {
      registrationOpenAt: tournament.registrationOpenAt ?? null,
      registrationCloseAt: tournament.registrationCloseAt ?? null,
    },
    now,
  )) {
    return false;
  }
  return pendingWaitlistCount === 0;
}

/**
 * Tennis Details-tab buttons (Registered Players List / Favourite Players).
 * Hidden until verification completes; Captain / VC / Manager (plus Admin / Club Manager).
 */
export function canShowTournamentRegistrationPlayerButtons(
  user: AuthUser | null | undefined,
  tournament: RegistrationManagementTournamentContext | null | undefined,
): boolean {
  if (!user || !tournament?.id) {
    return false;
  }
  if (!tournamentUsesRegistrationVerification(tournament.ballType)) {
    return false;
  }
  if (!tournament.registrationVerificationComplete) {
    return false;
  }
  if (user.role === UserRole.ClubManager || user.role === UserRole.Admin) {
    return true;
  }
  return hasTeamFavouritesLeadInTournament(user, tournament.id);
}

/**
 * Tennis Details-tab Upload Video button — per-player self-upload after verification.
 * Requires a confirmed registration; declined / waitlist / unregistered users excluded.
 */
export function canUploadPlayerSkillVideo(
  user: AuthUser | null | undefined,
  tournament:
    | (RegistrationManagementTournamentContext & {
        registrationVerificationComplete?: boolean;
        videoRequired?: boolean;
        videoUploadEndDate?: string | null;
      })
    | null
    | undefined,
  myRegistrationStatus: RegistrationStatus | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!user || !tournament?.id) {
    return false;
  }
  if (!tournamentUsesRegistrationVerification(tournament.ballType)) {
    return false;
  }
  if (!tournament.videoRequired) {
    return false;
  }
  if (!tournament.registrationVerificationComplete) {
    return false;
  }
  if (myRegistrationStatus !== RegistrationStatus.Confirmed) {
    return false;
  }
  if (tournament.videoUploadEndDate) {
    const deadline = new Date(tournament.videoUploadEndDate);
    deadline.setUTCHours(23, 59, 59, 999);
    if (now > deadline) {
      return false;
    }
  }
  return true;
}

/** @deprecated Use {@link canUploadPlayerSkillVideo}. */
export const canUploadPlayerVideo = canUploadPlayerSkillVideo;
