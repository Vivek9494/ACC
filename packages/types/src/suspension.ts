/** Reason stored on {@link Suspension} rows (spec §10). */
export const SuspensionReason = {
  LateLastMatch: 'late_last_match',
} as const;
export type SuspensionReason = (typeof SuspensionReason)[keyof typeof SuspensionReason];

/** Suspension lifecycle aligned with Prisma `SuspensionStatus`. */
export const SuspensionStatus = {
  Pending: 'PENDING',
  Served: 'SERVED',
  CarriedForward: 'CARRIED_FORWARD',
  Cancelled: 'CANCELLED',
} as const;
export type SuspensionStatus = (typeof SuspensionStatus)[keyof typeof SuspensionStatus];

/** Statuses that block substitute selection and leader RBAC inheritance. */
export const ACTIVE_SUSPENSION_STATUSES = [
  SuspensionStatus.Pending,
  SuspensionStatus.CarriedForward,
] as const;

/** Badge shown beside a player moved from Penalty → IN after captain action. */
export const SuspensionXiBadge = {
  CarryForward: 'carry_forward',
  Cancelled: 'cancelled',
} as const;
export type SuspensionXiBadge = (typeof SuspensionXiBadge)[keyof typeof SuspensionXiBadge];

/** How a penalty player voted for the serving (next) match — drives tab routing (DP1). */
export const SuspensionPollVoteSide = {
  In: 'in',
  Out: 'out',
  /** No poll vote yet — treated like OUT (cannot serve now; auto-carries on confirm). */
  Pending: 'pending',
} as const;
export type SuspensionPollVoteSide =
  (typeof SuspensionPollVoteSide)[keyof typeof SuspensionPollVoteSide];

export interface PollSuspensionPlayerRow {
  suspensionId: string;
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  triggeredByMatchId: string;
  /** Current persisted lifecycle state for this match. */
  suspensionStatus: typeof SuspensionStatus.Pending | typeof SuspensionStatus.CarriedForward;
  /** True when this offense was moved here from an earlier serving match. */
  isCarriedForward: boolean;
  pollVoteSide: SuspensionPollVoteSide;
  /** Manual serve/carry/cancel actions are available only to IN voters. */
  actionsEnabled: boolean;
}

export type PendingSuspensionRow = Omit<
  PollSuspensionPlayerRow,
  'pollVoteSide' | 'actionsEnabled'
>;

/** Resolve poll vote side for a penalty player (DP1). */
export function resolveSuspensionPollVoteSide(
  userId: string,
  voteByUserId: ReadonlyMap<string, boolean>,
): SuspensionPollVoteSide {
  const vote = voteByUserId.get(userId);
  if (vote === undefined) {
    return SuspensionPollVoteSide.Pending;
  }
  return vote ? SuspensionPollVoteSide.In : SuspensionPollVoteSide.Out;
}

export function enrichPollSuspensionRows(
  rows: PendingSuspensionRow[],
  voteByUserId: ReadonlyMap<string, boolean>,
): PollSuspensionPlayerRow[] {
  return rows.map((row) => {
    const pollVoteSide = resolveSuspensionPollVoteSide(row.userId, voteByUserId);
    return {
      ...row,
      pollVoteSide,
      actionsEnabled: pollVoteSide === SuspensionPollVoteSide.In,
    };
  });
}

export function isLateArrivalInPenalty(row: PollSuspensionPlayerRow): boolean {
  return row.pollVoteSide === SuspensionPollVoteSide.In;
}

/** True when the captain may manually choose this player to serve at this match. */
export function isEligibleSuspensionForManualDecision(
  row: PollSuspensionPlayerRow,
): boolean {
  return isLateArrivalInPenalty(row);
}

/** @deprecated Use isEligibleSuspensionForManualDecision. */
export const isServingSuspensionForMatch = isEligibleSuspensionForManualDecision;

export interface PollConfirmedInPartitionRow {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  skillLabel?: string | null;
}

/**
 * Manual suspension selection never excludes an eligible player from Confirmed
 * IN by itself. Exclusion happens only after the captain checks the player.
 */
export function confirmedInExclusionUserIds(args: {
  pendingSuspensions: readonly PollSuspensionPlayerRow[];
  penaltyOwingInVoterUserIds?: ReadonlySet<string>;
  /**
   * Players whose suspension was carry-forwarded or cancelled for this match.
   * They must join Confirmed IN even if a LateArrivalPenalty is still OWED.
   */
  actionedSuspensionUserIds?: ReadonlySet<string>;
}): Set<string> {
  void args;
  return new Set();
}

/**
 * Return IN voters plus actioned rows while separately surfacing manually
 * selectable suspension candidates. The two collections may overlap until the
 * captain checks a candidate.
 */
export function partitionPollConfirmedInVoters<T extends PollConfirmedInPartitionRow>(args: {
  inVoters: readonly T[];
  pendingSuspensions: readonly PollSuspensionPlayerRow[];
  actionedSuspensions: readonly PollSuspensionActionedRow[];
  penaltyOwingInVoterUserIds?: ReadonlySet<string>;
}): {
  confirmedIn: T[];
  servingSuspensionPenalty: PollSuspensionPlayerRow[];
} {
  const servingSuspensionPenalty = args.pendingSuspensions.filter(isServingSuspensionForMatch);
  const actionedSuspensionUserIds = new Set(args.actionedSuspensions.map((row) => row.userId));
  const excludeIds = confirmedInExclusionUserIds({
    pendingSuspensions: args.pendingSuspensions,
    penaltyOwingInVoterUserIds: args.penaltyOwingInVoterUserIds,
    actionedSuspensionUserIds,
  });

  const byId = new Map(args.inVoters.map((player) => [player.userId, player] as const));
  for (const row of args.actionedSuspensions) {
    if (!byId.has(row.userId)) {
      byId.set(row.userId, {
        userId: row.userId,
        firstName: row.firstName,
        lastName: row.lastName,
        profilePhotoUrl: row.profilePhotoUrl,
        skillLabel: null,
      } as T);
    }
  }

  const confirmedIn = [...byId.values()].filter((player) => !excludeIds.has(player.userId));
  return { confirmedIn, servingSuspensionPenalty };
}

export function isLateArrivalOutPenalty(row: PollSuspensionPlayerRow): boolean {
  return isPenaltyUnavailableToServe(row.pollVoteSide);
}

/**
 * Penalty player cannot serve at this match — voted OUT or has not voted.
 * Both cases use OUT-tab Late Arrival, display-only, auto-carry on XI confirm.
 */
export function isPenaltyUnavailableToServe(
  pollVoteSide: SuspensionPollVoteSide,
): boolean {
  return pollVoteSide !== SuspensionPollVoteSide.In;
}

export interface PollSuspensionActionedRow {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  badge: SuspensionXiBadge;
}

export interface PenaltyServingPlayerView {
  userId: string;
  firstName: string;
  lastName: string;
}
