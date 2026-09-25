import { type AuthUser, UserRole } from './auth';
import { hasTeamFavouritesLeadInTournament, hasTeamLeadershipInTournament } from './team-access';
import { BallType, type BallType as BallTypeValue } from './rbac';
import { RegistrationStatus } from './registration';
import {
  hasRegistrationOpened,
  isRegistrationVerificationDeadlinePassed,
} from './tournament-registration';
import { TournamentDisplayStatus, type TournamentDisplayStatus as TournamentDisplayStatusValue } from './tournament-display-status';

/** Tournament fields needed for registration-management visibility. */
export interface RegistrationManagementTournamentContext {
  id?: string;
  ballType: BallTypeValue;
  /** When false, verification queue / late-register flows are hidden. */
  hasRegistrationWindow?: boolean;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  /** Tennis: auction datetime locks verification when set. */
  auctionAt?: string | null;
  /** Server-derived: verification deadline passed and no registrants left in waitlist. */
  registrationVerificationComplete?: boolean;
  /** Date-derived status — hide Verify Players once the tournament is finished. */
  displayStatus?: TournamentDisplayStatusValue;
}

/** True when the actor holds a scoped Center Sevak assignment. */
export function hasCenterSevakAssignment(user: AuthUser | null | undefined): boolean {
  return (user?.centerSevakCenterIds?.length ?? 0) > 0;
}

/**
 * Platform roles that may self-register during an open registration window.
 * Cap/VC/Manager are tournament-scoped (RoleAssignment) — holders keep User.role = Player.
 */
export function canSelfRegisterForTournament(
  userRole: UserRole | null | undefined,
): boolean {
  if (!userRole) {
    return false;
  }
  return (
    userRole === UserRole.Player ||
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
 * Hidden once the tournament is Completed (or Cancelled).
 */
export function canShowRegistrationVerificationQueue(
  user: AuthUser | null | undefined,
  tournament: RegistrationManagementTournamentContext | null | undefined,
): boolean {
  if (!user || !tournament?.hasRegistrationWindow) {
    return false;
  }
  if (
    tournament.displayStatus === TournamentDisplayStatus.Completed ||
    tournament.displayStatus === TournamentDisplayStatus.Cancelled
  ) {
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
 * True when Center Sevak verification is finished: verification deadline passed and
 * no registrants remain IN_WAITLIST (everyone approved, declined, or auto-confirmed).
 */
export function isRegistrationVerificationComplete(
  tournament: Pick<
    RegistrationManagementTournamentContext,
    | 'ballType'
    | 'hasRegistrationWindow'
    | 'registrationOpenAt'
    | 'registrationCloseAt'
    | 'auctionAt'
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
  if (
    !isRegistrationVerificationDeadlinePassed(
      {
        auctionAt: tournament.auctionAt ?? null,
        registrationCloseAt: tournament.registrationCloseAt ?? null,
      },
      now,
    )
  ) {
    return false;
  }
  return pendingWaitlistCount === 0;
}

/**
 * Tennis Details-tab Registered Players List button.
 * Shown once registration has opened (verification may still be pending).
 * Admin / Club Manager / Captain / VC / Manager / Center Sevak.
 * Non-Admin: hidden when tournament displayStatus is Completed or Cancelled.
 */
export function canShowTournamentRegistrationPlayerButtons(
  user: AuthUser | null | undefined,
  tournament: RegistrationManagementTournamentContext | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!user || !tournament?.id) {
    return false;
  }
  if (!tournamentUsesRegistrationVerification(tournament.ballType)) {
    return false;
  }
  if (!tournament.hasRegistrationWindow) {
    return false;
  }
  if (
    !hasRegistrationOpened(
      {
        registrationOpenAt: tournament.registrationOpenAt ?? null,
      },
      now,
    )
  ) {
    return false;
  }
  if (
    user.role !== UserRole.Admin &&
    (tournament.displayStatus === TournamentDisplayStatus.Completed ||
      tournament.displayStatus === TournamentDisplayStatus.Cancelled)
  ) {
    return false;
  }
  if (
    user.role === UserRole.ClubManager ||
    user.role === UserRole.Admin ||
    user.role === UserRole.CenterSevak
  ) {
    return user.role !== UserRole.CenterSevak || hasCenterSevakAssignment(user);
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
        videoUploadStartAt?: string | null;
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
  if (tournament.videoUploadStartAt && now < new Date(tournament.videoUploadStartAt)) {
    return false;
  }
  if (tournament.videoUploadEndDate && now > new Date(tournament.videoUploadEndDate)) {
    return false;
  }
  return true;
}

/** @deprecated Use {@link canUploadPlayerSkillVideo}. */
export const canUploadPlayerVideo = canUploadPlayerSkillVideo;

export { canManageRegistrationVerification } from './tournament-registration';
