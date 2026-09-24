/**
 * Type-aware tournament organizer rules (edit/delete/groups) and Sevak
 * verification center scope. Shared by API enforcement and mobile UI gating.
 */

import { UserRole } from './auth';
import { TournamentType } from './rbac';

/** Tournament facts needed to resolve organizer / verification scope. */
export interface TournamentOrganizerContext {
  type: TournamentType;
  createdByUserId: string;
  /** TournamentCenter ids linked to this tournament. */
  participatingCenterIds: string[];
}

/** Actor facts for organizer checks. */
export interface TournamentOrganizerActor {
  userId: string;
  role: UserRole;
  /** Center Sevak scoped center ids (ignored for other roles). */
  sevakCenterIds?: readonly string[];
}

/** CENTER-type with two or more participating centers. */
export function isMultiCenterTournament(
  type: TournamentType,
  participatingCenterIds: readonly string[],
): boolean {
  return type === TournamentType.Center && participatingCenterIds.length >= 2;
}

/**
 * Whether the actor may organize the tournament (edit, delete, manage groups).
 *
 * - Admin: always.
 * - APL: Admin or Club Manager only (Sevak never organizes).
 * - Multi-center CENTER: Admin or any participating Center Sevak; Club Manager never.
 * - Single-center CENTER / ACC (leather): Admin, Club Manager, or Sevak (creator or own participating center).
 *
 * Distinct from {@link isTournamentOrganizer} in punch-time-scope (creator-only check).
 */
export function canOrganizeTournament(
  actor: TournamentOrganizerActor,
  tournament: TournamentOrganizerContext,
): boolean {
  if (actor.role === UserRole.Admin) {
    return true;
  }

  if (tournament.type === TournamentType.APL) {
    return actor.role === UserRole.ClubManager;
  }

  // Multi-center CENTER — shared Sevak organizers; CM excluded
  if (isMultiCenterTournament(tournament.type, tournament.participatingCenterIds)) {
    if (actor.role === UserRole.ClubManager) {
      return false;
    }
    return canCenterSevakOrganizeTournament(
      actor.sevakCenterIds ?? [],
      actor.userId,
      tournament,
    );
  }

  // Single-center CENTER or ACC (leather) — CM + Sevak creator/own-center
  if (actor.role === UserRole.ClubManager) {
    return true;
  }
  return canCenterSevakOrganizeTournament(
    actor.sevakCenterIds ?? [],
    actor.userId,
    tournament,
  );
}

/**
 * Whether a Center Sevak may organize this tournament.
 * False for APL; multi-center = any participating center; single/leather = creator or own center.
 */
export function canCenterSevakOrganizeTournament(
  sevakCenterIds: readonly string[],
  userId: string,
  tournament: TournamentOrganizerContext,
): boolean {
  if (tournament.type === TournamentType.APL) {
    return false;
  }

  if (isMultiCenterTournament(tournament.type, tournament.participatingCenterIds)) {
    return sevakCenterIds.some((id) => tournament.participatingCenterIds.includes(id));
  }

  // Single-center CENTER or ACC (leather)
  if (tournament.createdByUserId === userId) {
    return true;
  }
  return sevakCenterIds.some((id) => tournament.participatingCenterIds.includes(id));
}

/**
 * Centers a Center Sevak may verify / manage players for in this tournament.
 *
 * - Multi-center organizer Sevak → all participating centers.
 * - APL / single-center → own centers ∩ participating centers.
 * - When the tournament has no center links yet → own centers (legacy / open setup).
 * - Non-participating Sevak → empty.
 */
export function resolveSevakVerificationCenterIds(
  sevakCenterIds: readonly string[],
  tournament: Pick<TournamentOrganizerContext, 'type' | 'participatingCenterIds'>,
): string[] {
  if (tournament.type === TournamentType.ACC) {
    return [];
  }

  if (tournament.participatingCenterIds.length === 0) {
    return [...sevakCenterIds];
  }

  if (isMultiCenterTournament(tournament.type, tournament.participatingCenterIds)) {
    const participates = sevakCenterIds.some((id) =>
      tournament.participatingCenterIds.includes(id),
    );
    return participates ? [...tournament.participatingCenterIds] : [];
  }

  // APL or single-center: own ∩ tournament
  const participating = new Set(tournament.participatingCenterIds);
  return sevakCenterIds.filter((id) => participating.has(id));
}

/**
 * True when a Sevak may manage (verify/rate/late-register) a player at `targetCenterId`.
 */
export function canSevakManageVerificationAtCenter(
  sevakCenterIds: readonly string[],
  tournament: Pick<TournamentOrganizerContext, 'type' | 'participatingCenterIds'>,
  targetCenterId: string,
): boolean {
  return resolveSevakVerificationCenterIds(sevakCenterIds, tournament).includes(targetCenterId);
}
