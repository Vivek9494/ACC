import type { CaptainFeaturedMatchSummary, FeaturedMatchSummary } from '@acc/types';

import type { MatchSummaryCardProps } from '../components/ui/MatchSummaryCard';
import { formatMatchScheduleLine } from './venue-time';

export interface DashboardFeaturedMatchEntry {
  matchId: string;
  card: Omit<MatchSummaryCardProps, 'onPress'>;
}

function featuredMatchDateTimeLine(
  match: Pick<CaptainFeaturedMatchSummary, 'matchDate' | 'startTime' | 'tournamentTimezone'>,
): string {
  return formatMatchScheduleLine(match, match.tournamentTimezone);
}

export function captainFeaturedToEntry(
  match: CaptainFeaturedMatchSummary,
): DashboardFeaturedMatchEntry {
  return {
    matchId: match.matchId,
    card: {
      tournamentName: match.tournamentName,
      dateTimeLine: featuredMatchDateTimeLine(match),
      teamA: match.teamA,
      teamB: match.teamB,
      status: match.status,
      infoLine: match.infoLine,
      resultLine: match.resultLine,
      homeAway: match.homeAway,
    },
  };
}

export function featuredSummaryToEntry(match: FeaturedMatchSummary): DashboardFeaturedMatchEntry {
  return {
    matchId: match.matchId,
    card: {
      tournamentName: match.tournamentName,
      dateTimeLine: featuredMatchDateTimeLine(match),
      teamA: match.teamA,
      teamB: match.teamB,
      status: match.isLive ? 'LIVE' : match.isUpcoming ? 'UPCOMING' : 'COMPLETED',
      resultLine: match.resultNote,
      homeAway: match.homeAway,
    },
  };
}

export function captainFeaturedHref(
  match: CaptainFeaturedMatchSummary,
): `/matches/${string}` | `/matches/${string}/live` {
  return match.status === 'LIVE'
    ? `/matches/${match.matchId}/live`
    : `/matches/${match.matchId}`;
}

export function featuredSummaryHref(
  match: FeaturedMatchSummary,
): `/matches/${string}` | `/matches/${string}/live` {
  return match.isLive ? `/matches/${match.matchId}/live` : `/matches/${match.matchId}`;
}
