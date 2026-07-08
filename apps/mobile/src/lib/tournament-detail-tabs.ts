import { tournamentSupportsGroups, type TournamentDetail } from '@acc/types';

/** Unique tournament detail tab keys — never share names with role bottom-tab routes. */
export const TOURNAMENT_DETAIL_TAB = {
  Details: 'Details',
  TournamentMatches: 'TournamentMatches',
  Teams: 'Teams',
  Groups: 'Groups',
  PointsTable: 'Points Table',
  Stats: 'Stats',
  Leaderboard: 'Leaderboard',
} as const;

export const TOURNAMENT_DETAIL_TABS = [
  TOURNAMENT_DETAIL_TAB.Details,
  TOURNAMENT_DETAIL_TAB.TournamentMatches,
  TOURNAMENT_DETAIL_TAB.Teams,
  TOURNAMENT_DETAIL_TAB.Groups,
  TOURNAMENT_DETAIL_TAB.PointsTable,
  TOURNAMENT_DETAIL_TAB.Stats,
  TOURNAMENT_DETAIL_TAB.Leaderboard,
] as const;

export type TournamentDetailTab = (typeof TOURNAMENT_DETAIL_TABS)[number];

const TOURNAMENT_DETAIL_TAB_LABELS: Record<TournamentDetailTab, string> = {
  [TOURNAMENT_DETAIL_TAB.Details]: 'Details',
  [TOURNAMENT_DETAIL_TAB.TournamentMatches]: 'Matches',
  [TOURNAMENT_DETAIL_TAB.Teams]: 'Teams',
  [TOURNAMENT_DETAIL_TAB.Groups]: 'Groups',
  [TOURNAMENT_DETAIL_TAB.PointsTable]: 'Points Table',
  [TOURNAMENT_DETAIL_TAB.Stats]: 'Stats',
  [TOURNAMENT_DETAIL_TAB.Leaderboard]: 'Leaderboard',
};

/** User-facing label for a tournament detail tab key. */
export function getTournamentDetailTabLabel(tab: TournamentDetailTab): string {
  return TOURNAMENT_DETAIL_TAB_LABELS[tab];
}

/** @deprecated Pre-split deep links used `?tab=Matches`. */
const LEGACY_TOURNAMENT_DETAIL_TAB_KEYS: Partial<Record<string, TournamentDetailTab>> = {
  Matches: TOURNAMENT_DETAIL_TAB.TournamentMatches,
};

export function shouldShowGroupsTab(
  tournament: Pick<TournamentDetail, 'type' | 'matchSchedulingFormat' | 'groupCount'>,
): boolean {
  return tournamentSupportsGroups(tournament);
}

export function buildTournamentDetailTabs(
  tournament: Pick<TournamentDetail, 'type' | 'matchSchedulingFormat' | 'groupCount'>,
): TournamentDetailTab[] {
  const tabs: TournamentDetailTab[] = [
    TOURNAMENT_DETAIL_TAB.Details,
    TOURNAMENT_DETAIL_TAB.TournamentMatches,
    TOURNAMENT_DETAIL_TAB.Teams,
  ];
  if (shouldShowGroupsTab(tournament)) {
    tabs.push(TOURNAMENT_DETAIL_TAB.Groups);
  }
  tabs.push(TOURNAMENT_DETAIL_TAB.PointsTable, TOURNAMENT_DETAIL_TAB.Stats, TOURNAMENT_DETAIL_TAB.Leaderboard);
  return tabs;
}

export function parseTournamentDetailTab(
  value: string | string[] | undefined,
  allowedTabs: readonly TournamentDetailTab[],
): TournamentDetailTab {
  const raw = Array.isArray(value) ? value[0] : value;
  const resolved =
    raw != null
      ? (LEGACY_TOURNAMENT_DETAIL_TAB_KEYS[raw] ?? (raw as TournamentDetailTab))
      : undefined;
  if (resolved && allowedTabs.includes(resolved)) {
    return resolved;
  }
  return TOURNAMENT_DETAIL_TAB.Details;
}
