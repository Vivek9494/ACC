import type { TournamentDetail } from './tournament';

/** Both registration open and close datetimes are configured. */
export function tournamentHasRegistrationWindow(
  tournament: Pick<TournamentDetail, 'registrationOpenAt' | 'registrationCloseAt'>,
): boolean {
  return tournament.registrationOpenAt != null && tournament.registrationCloseAt != null;
}

/** Whether `now` falls within the tournament registration window (inclusive). */
export function isTournamentRegistrationOpen(
  tournament: Pick<TournamentDetail, 'registrationOpenAt' | 'registrationCloseAt'>,
  now: Date = new Date(),
): boolean {
  if (!tournament.registrationOpenAt || !tournament.registrationCloseAt) {
    return false;
  }
  const t = now.getTime();
  return (
    t >= new Date(tournament.registrationOpenAt).getTime() &&
    t <= new Date(tournament.registrationCloseAt).getTime()
  );
}

/** True after `registrationCloseAt` — when Center Sevak may adjust ratings (§7.5). */
export function isTournamentRegistrationWindowClosed(
  tournament: Pick<TournamentDetail, 'registrationOpenAt' | 'registrationCloseAt'>,
  now: Date = new Date(),
): boolean {
  if (!tournament.registrationCloseAt) {
    return false;
  }
  return now.getTime() > new Date(tournament.registrationCloseAt).getTime();
}
