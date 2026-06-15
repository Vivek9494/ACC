import { MatchSchedulingFormat, type TournamentDetail } from '@acc/types';

export const TOURNAMENT_DETAIL_TABS = [
  'Details',
  'Matches',
  'Teams',
  'Groups',
  'Points Table',
  'Leaderboard',
] as const;

export type TournamentDetailTab = (typeof TOURNAMENT_DETAIL_TABS)[number];

export function shouldShowGroupsTab(
  tournament: Pick<TournamentDetail, 'matchSchedulingFormat' | 'groupCount'>,
): boolean {
  return (
    tournament.matchSchedulingFormat === MatchSchedulingFormat.GroupStageKnockout ||
    tournament.groupCount > 0
  );
}

export function buildTournamentDetailTabs(
  tournament: Pick<TournamentDetail, 'matchSchedulingFormat' | 'groupCount'>,
): TournamentDetailTab[] {
  const tabs: TournamentDetailTab[] = ['Details', 'Matches', 'Teams'];
  if (shouldShowGroupsTab(tournament)) {
    tabs.push('Groups');
  }
  tabs.push('Points Table', 'Leaderboard');
  return tabs;
}

export function parseTournamentDetailTab(
  value: string | string[] | undefined,
  allowedTabs: readonly TournamentDetailTab[],
): TournamentDetailTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && allowedTabs.includes(raw as TournamentDetailTab)) {
    return raw as TournamentDetailTab;
  }
  return 'Details';
}
