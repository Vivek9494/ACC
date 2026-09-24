import type { TournamentDetail } from './tournament';

/** When there is no auction, Sevak verification locks this long after registration close. */
export const REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS = 48 * 60 * 60 * 1000;

type InstantLike = string | Date | null | undefined;

function toMillis(value: InstantLike): number | null {
  if (value == null || value === '') {
    return null;
  }
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Both registration open and close datetimes are configured. */
export function tournamentHasRegistrationWindow(
  tournament: Pick<TournamentDetail, 'registrationOpenAt' | 'registrationCloseAt'>,
): boolean {
  return tournament.registrationOpenAt != null && tournament.registrationCloseAt != null;
}

/** True once the registration window start time has passed. */
export function hasRegistrationOpened(
  tournament: { registrationOpenAt?: InstantLike },
  now: Date = new Date(),
): boolean {
  const openMs = toMillis(tournament.registrationOpenAt);
  if (openMs == null) {
    return false;
  }
  return now.getTime() >= openMs;
}

/** Whether `now` falls within the tournament registration window (inclusive). */
export function isTournamentRegistrationOpen(
  tournament: Pick<TournamentDetail, 'registrationOpenAt' | 'registrationCloseAt'>,
  now: Date = new Date(),
): boolean {
  const openMs = toMillis(tournament.registrationOpenAt);
  const closeMs = toMillis(tournament.registrationCloseAt);
  if (openMs == null || closeMs == null) {
    return false;
  }
  const t = now.getTime();
  return t >= openMs && t <= closeMs;
}

/** True after `registrationCloseAt` (players can no longer self-register). */
export function isTournamentRegistrationWindowClosed(
  tournament: Pick<TournamentDetail, 'registrationOpenAt' | 'registrationCloseAt'>,
  now: Date = new Date(),
): boolean {
  const closeMs = toMillis(tournament.registrationCloseAt);
  if (closeMs == null) {
    return false;
  }
  return now.getTime() > closeMs;
}

type VerificationDeadlineFields = {
  auctionAt?: InstantLike;
  registrationCloseAt?: InstantLike;
};

/**
 * Single verification deadline: Auction Date when set, otherwise registration
 * close + 48 hours. Null when neither is available.
 */
export function getRegistrationVerificationDeadline(
  tournament: VerificationDeadlineFields,
): Date | null {
  const auctionMs = toMillis(tournament.auctionAt);
  if (auctionMs != null) {
    return new Date(auctionMs);
  }
  const closeMs = toMillis(tournament.registrationCloseAt);
  if (closeMs != null) {
    return new Date(closeMs + REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS);
  }
  return null;
}

type VerificationManageFields = VerificationDeadlineFields & {
  registrationOpenAt?: InstantLike;
};

/**
 * Center Sevak may fully verify (approve/decline/ratings) from registration-open
 * through the verification deadline (inclusive). Locked after the deadline.
 */
export function canManageRegistrationVerification(
  tournament: VerificationManageFields,
  now: Date = new Date(),
): boolean {
  if (!hasRegistrationOpened(tournament, now)) {
    return false;
  }
  const deadline = getRegistrationVerificationDeadline(tournament);
  if (!deadline) {
    return false;
  }
  return now.getTime() <= deadline.getTime();
}

/** True once the verification deadline has passed (ratings lock / auto-confirm due). */
export function isRegistrationVerificationDeadlinePassed(
  tournament: VerificationDeadlineFields,
  now: Date = new Date(),
): boolean {
  const deadline = getRegistrationVerificationDeadline(tournament);
  if (!deadline) {
    return false;
  }
  return now.getTime() > deadline.getTime();
}
