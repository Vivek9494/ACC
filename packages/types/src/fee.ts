import { BallType, type BallType as BallTypeValue } from './rbac';
import {
  RegistrationPlayerType,
  REGISTRATION_PLAYER_TYPE_OPTIONS,
  type RegistrationPlayerType as RegistrationPlayerTypeValue,
} from './registration';

/** Manual per-player fee status (spec §20). No payment gateway integration. */
export const FeeStatus = {
  Pending: 'PENDING',
  Paid: 'PAID',
} as const;
export type FeeStatus = (typeof FeeStatus)[keyof typeof FeeStatus];

/** How the tracker list is rendered for the current viewer (§20). */
export const TournamentFeesTrackerLayout = {
  /** Center Sevak (tennis) or Captain (leather) — no section headers. */
  Flat: 'flat',
  /** Club Manager / Admin on leather ACC — team header + nested players. */
  GroupedByTeam: 'grouped_by_team',
  /** Admin on tennis — center header + nested players. */
  GroupedByCenter: 'grouped_by_center',
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
  centerId: string | null;
  centerName: string;
  playerType: RegistrationPlayerTypeValue | null;
  /** Grey subtitle under the player name (team · type, or center). */
  cardSubtitle: string;
  /** Display-only obligation derived from tournament fee fields; cents for formatting. */
  amountCents: number;
  status: FeeStatus;
  paidAt: string | null;
}

/** Fees grouped under a section heading (team or center) in the tracker UI. */
export interface TournamentFeeTeamGroup {
  teamId: string | null;
  teamName: string;
  entries: TournamentFeeEntry[];
}

/** Role- and tournament-type-aware fees tracker payload (§20). */
export interface TournamentFeesTracker {
  ballType: BallTypeValue;
  layout: TournamentFeesTrackerLayout;
  paid: TournamentFeeTeamGroup[];
  unpaid: TournamentFeeTeamGroup[];
  paidCount: number;
  unpaidCount: number;
}

/** Select value for the all-centers option in the fees tracker center filter. */
export const FEES_TRACKER_ALL_CENTERS = '__all__';

/** Total player rows across grouped fee sections. */
export function countFeeTrackerEntries(groups: readonly TournamentFeeTeamGroup[]): number {
  return groups.reduce((sum, group) => sum + group.entries.length, 0);
}

/** Keeps only the section for one center (GroupedByCenter layout). Pass null for all centers. */
export function filterFeeTrackerGroupsByCenter(
  groups: readonly TournamentFeeTeamGroup[],
  centerId: string | null,
): TournamentFeeTeamGroup[] {
  if (!centerId) {
    return [...groups];
  }
  return groups.filter((group) => group.teamId === centerId);
}

/** Center dropdown options derived from paid + unpaid group headers. */
export function buildFeeTrackerCenterOptions(
  tracker: Pick<TournamentFeesTracker, 'paid' | 'unpaid'>,
): { value: string; label: string }[] {
  const centers = new Map<string, string>();
  for (const groups of [tracker.paid, tracker.unpaid]) {
    for (const group of groups) {
      if (group.teamId) {
        centers.set(group.teamId, group.teamName);
      }
    }
  }

  return [
    { value: FEES_TRACKER_ALL_CENTERS, label: 'All Centers' },
    ...[...centers.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label })),
  ];
}

/** Formats cents as a display currency string (e.g. 5000 → "$50"). */
export function formatFeeAmountCents(amountCents: number): string {
  const dollars = amountCents / 100;
  return amountCents % 100 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

function registrationPlayerTypeLabel(
  playerType: RegistrationPlayerTypeValue,
): string {
  return (
    REGISTRATION_PLAYER_TYPE_OPTIONS.find((option) => option.value === playerType)?.label ??
    playerType
  );
}

/** Display-only fee amount in cents from tournament fee fields + player type. */
export function resolveTournamentFeeDisplayCents(
  ballType: BallTypeValue,
  feeFullTime: number | null,
  feePartTime: number | null,
  playerType: RegistrationPlayerTypeValue | null,
): number {
  const toCents = (dollars: number): number => Math.round(dollars * 100);

  if (ballType === BallType.Tennis) {
    return feeFullTime != null ? toCents(feeFullTime) : 0;
  }

  if (playerType === RegistrationPlayerType.FullTime) {
    return feeFullTime != null ? toCents(feeFullTime) : 0;
  }
  if (playerType === RegistrationPlayerType.PartTime) {
    return feePartTime != null ? toCents(feePartTime) : 0;
  }
  return 0;
}

/** Grey card subtitle for the fees tracker. */
export function buildTournamentFeeCardSubtitle(
  ballType: BallTypeValue,
  teamName: string,
  centerName: string,
  playerType: RegistrationPlayerTypeValue | null,
): string {
  if (ballType === BallType.Tennis) {
    return centerName;
  }
  if (!playerType) {
    return teamName;
  }
  return `${teamName} · ${registrationPlayerTypeLabel(playerType)}`;
}

export const TOURNAMENT_FEE_UNASSIGNED_CENTER_LABEL = 'Unassigned';
