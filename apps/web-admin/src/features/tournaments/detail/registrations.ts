import {
  BallType,
  RegistrationStatus,
  formatCanadianMobileForDisplay,
  getRegistrationVerificationDeadline,
  hasRegistrationOpened,
  type RegistrationSummary,
  type TournamentDetail,
} from '@acc/types';

export const REGISTRATION_STATUS_TABS = [
  { value: RegistrationStatus.InWaitlist, label: 'In Waitlist' },
  { value: RegistrationStatus.Confirmed, label: 'Confirmed' },
  { value: RegistrationStatus.Declined, label: 'Declined' },
] as const;

export const ALL_CENTERS = 'all';

export interface RegistrationFilters {
  status: RegistrationStatus;
  search: string;
  /** Center id, or {@link ALL_CENTERS}. */
  centerId: string;
}

export type VerificationWindowTournament = Pick<
  TournamentDetail,
  'ballType' | 'registrationOpenAt' | 'registrationCloseAt' | 'auctionAt'
>;

/** Where the tournament sits in the registration → verification lifecycle (display only; the API enforces it). */
export type VerificationState =
  | { kind: 'leather' }
  | { kind: 'no-window' }
  | { kind: 'not-open'; opensAt: Date }
  | { kind: 'open'; deadline: Date }
  | { kind: 'closed'; deadline: Date }
  | { kind: 'complete' };

export function resolveVerificationState(
  tournament: VerificationWindowTournament,
  pendingCount: number,
  now: Date = new Date(),
): VerificationState {
  if (tournament.ballType === BallType.Leather) return { kind: 'leather' };
  const deadline = getRegistrationVerificationDeadline(tournament);
  if (!tournament.registrationOpenAt || !tournament.registrationCloseAt || !deadline) {
    return { kind: 'no-window' };
  }
  if (!hasRegistrationOpened(tournament, now)) {
    return { kind: 'not-open', opensAt: new Date(tournament.registrationOpenAt) };
  }
  if (now.getTime() <= deadline.getTime()) return { kind: 'open', deadline };
  return pendingCount === 0 ? { kind: 'complete' } : { kind: 'closed', deadline };
}

/** Once verification is complete the confirmed roster is the useful default. */
export function defaultRegistrationStatus(state: VerificationState): RegistrationStatus {
  return state.kind === 'complete' ? RegistrationStatus.Confirmed : RegistrationStatus.InWaitlist;
}

export function countByStatus(rows: readonly RegistrationSummary[]): Record<RegistrationStatus, number> {
  const counts: Record<RegistrationStatus, number> = {
    [RegistrationStatus.InWaitlist]: 0,
    [RegistrationStatus.Confirmed]: 0,
    [RegistrationStatus.Declined]: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** Distinct registration centers, by name. */
export function registrationCenters(rows: readonly RegistrationSummary[]): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const row of rows) byId.set(row.centerId, row.centerName);
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function filterRegistrations(
  rows: readonly RegistrationSummary[],
  filters: RegistrationFilters,
): RegistrationSummary[] {
  const needle = filters.search.trim().toLowerCase();
  const digits = needle.replace(/\D/g, '');
  return rows.filter((row) => {
    if (row.status !== filters.status) return false;
    if (filters.centerId !== ALL_CENTERS && row.centerId !== filters.centerId) return false;
    if (!needle) return true;
    const name = `${row.firstName} ${row.lastName}`.toLowerCase();
    return name.includes(needle) || (digits.length >= 3 && row.mobileNumber.replace(/\D/g, '').includes(digits));
  });
}

export function registrationMobileLabel(row: Pick<RegistrationSummary, 'mobileNumber'>): string {
  return formatCanadianMobileForDisplay(row.mobileNumber);
}

export function formatRating(value: number | null): string {
  return value === null ? '—' : String(value);
}
