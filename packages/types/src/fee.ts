/** Manual per-player fee status (spec §20). No payment gateway integration. */
export const FeeStatus = {
  Pending: 'PENDING',
  Paid: 'PAID',
} as const;
export type FeeStatus = (typeof FeeStatus)[keyof typeof FeeStatus];

/** How the tracker list is rendered for the current viewer (§20). */
export const TournamentFeesTrackerLayout = {
  /** Center Sevak (tennis) or Captain (leather) — no team section headers. */
  Flat: 'flat',
  /** Club Manager on leather ACC — team header + nested players. */
  GroupedByTeam: 'grouped_by_team',
} as const;
export type TournamentFeesTrackerLayout =
  (typeof TournamentFeesTrackerLayout)[keyof typeof TournamentFeesTrackerLayout];

/** One player fee row in the ACC Fees Tracker (§20). */
export interface TournamentFeeEntry {
  id: string;
  registrationId: string;
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamId: string | null;
  teamName: string;
  /** Stored fee obligation in cents (BIGINT on server). */
  amountCents: number;
  status: FeeStatus;
  paidAt: string | null;
}

/** Fees grouped under a team heading in the tracker UI. */
export interface TournamentFeeTeamGroup {
  teamId: string | null;
  teamName: string;
  entries: TournamentFeeEntry[];
}

/** Role- and tournament-type-aware fees tracker payload (§20). */
export interface TournamentFeesTracker {
  layout: TournamentFeesTrackerLayout;
  paid: TournamentFeeTeamGroup[];
  unpaid: TournamentFeeTeamGroup[];
  paidCount: number;
  unpaidCount: number;
}

/** Formats cents as a display currency string (e.g. 5000 → "$50"). */
export function formatFeeAmountCents(amountCents: number): string {
  const dollars = amountCents / 100;
  return amountCents % 100 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}
