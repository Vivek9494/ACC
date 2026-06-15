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

export interface SelectMatchSchedulingFormatRequest {
  schedulingFormat: MatchSchedulingFormat;
}

export const MATCH_SCHEDULING_FORMAT_OPTIONS: readonly MatchSchedulingFormat[] = [
  MatchSchedulingFormat.RoundRobin,
  MatchSchedulingFormat.GroupStageKnockout,
  MatchSchedulingFormat.Manual,
];
