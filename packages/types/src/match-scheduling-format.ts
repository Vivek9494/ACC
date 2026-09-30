import { BallType } from './rbac';

/**
 * Coarse fixture-scheduling mode chosen when the organizer taps Schedule Matches.
 * Distinct from {@link TournamentFormat} (§24), which is set at tournament creation.
 */

export const MatchSchedulingFormat = {
  RoundRobin: 'ROUND_ROBIN',
  GroupStageKnockout: 'GROUP_STAGE_KNOCKOUT',
  Manual: 'MANUAL',
} as const;
export type MatchSchedulingFormat =
  (typeof MatchSchedulingFormat)[keyof typeof MatchSchedulingFormat];

export const MATCH_SCHEDULING_FORMAT_LABELS: Record<MatchSchedulingFormat, string> = {
  ROUND_ROBIN: 'Round Robin',
  GROUP_STAGE_KNOCKOUT: 'Group Stage + Knockout',
  MANUAL: 'Manual',
};

/** Expo-router segment under `/tournaments/[id]/schedule/`. */
export const MATCH_SCHEDULING_FORMAT_ROUTE_SEGMENT: Record<MatchSchedulingFormat, string> = {
  ROUND_ROBIN: 'round-robin',
  GROUP_STAGE_KNOCKOUT: 'groups-knockout',
  MANUAL: 'manual',
};

export const MATCH_SCHEDULING_FORMAT_MESSAGES = {
  locked:
    'This tournament uses Group Stage + Knockout. Delete all groups to choose a different format.',
  manualOnly: 'Leather-ball tournaments are scheduled manually',
} as const;

/** Leather-ball (ACC) tournaments have no format picker, groups, or knockouts — always Manual. */
export function isManualSchedulingOnly(ballType: BallType): boolean {
  return ballType === BallType.Leather;
}

/** Format that governs fixture rules — Leather reads as Manual regardless of what is stored. */
export function schedulingFormatForBallType(
  ballType: BallType,
  format: MatchSchedulingFormat | null,
): MatchSchedulingFormat | null {
  return isManualSchedulingOnly(ballType) ? MatchSchedulingFormat.Manual : format;
}

/**
 * Group Stage + Knockout is finalized by creating the first group; until then (or once every
 * group is deleted) the tournament has no finalized format.
 */
export function isMatchSchedulingFormatLocked(
  format: MatchSchedulingFormat | null,
  groupCount: number,
): boolean {
  return format === MatchSchedulingFormat.GroupStageKnockout && groupCount > 0;
}

/**
 * Stored format as exposed to clients — Leather reads as Manual; Group Stage + Knockout without
 * groups reads as unset.
 */
export function effectiveMatchSchedulingFormat(
  format: MatchSchedulingFormat | null,
  groupCount: number,
  ballType: BallType,
): MatchSchedulingFormat | null {
  if (isManualSchedulingOnly(ballType)) return MatchSchedulingFormat.Manual;
  return format === MatchSchedulingFormat.GroupStageKnockout && groupCount === 0 ? null : format;
}

export interface SelectMatchSchedulingFormatRequest {
  schedulingFormat: MatchSchedulingFormat;
}

export const MATCH_SCHEDULING_FORMAT_OPTIONS: readonly MatchSchedulingFormat[] = [
  MatchSchedulingFormat.RoundRobin,
  MatchSchedulingFormat.GroupStageKnockout,
  MatchSchedulingFormat.Manual,
];
