import {
  BALLS_PER_OVER,
  BEST_ECONOMY_MIN_LEGAL_BALLS,
  BEST_STRIKE_RATE_MIN_BALLS,
  bestEconomies,
  bestStrikeRates,
  formatLeaderboardEconomy,
  formatLeaderboardStrikeRate,
  topRunScorers,
  topWicketTakers,
  type DismissalNameResolver,
  type InningsScorecard,
  type MatchListItem,
  type ScorecardResponse,
  type TournamentLeaderboard,
  type TournamentStatsView,
} from '@acc/types';

export const DETAIL_TABS = [
  { path: 'teams', label: 'Teams' },
  { path: 'matches', label: 'Matches' },
  { path: 'points', label: 'Points table' },
  { path: 'stats', label: 'Tournament stats' },
  { path: 'registrations', label: 'Registrations' },
] as const;

export type DetailTabPath = (typeof DETAIL_TABS)[number]['path'];

/** Four-up card grid shared by the Teams, Matches and Tournament stats tabs (sized to the tab container). */
export const DETAIL_GRID = 'grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-4';

// matchDate is a calendar day (YYYY-MM-DD) — format in UTC so it never shifts a day.
const MATCH_DAY = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const MATCH_TIME = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' });

/** "Sat, Jul 11, 2026 · 9:30 a.m." — date only when no start time; "Date TBD" when neither. */
export function formatMatchWhen(match: Pick<MatchListItem, 'matchDate' | 'startTime'>): string {
  const day = match.matchDate ? new Date(`${match.matchDate}T00:00:00.000Z`) : null;
  const start = match.startTime ? new Date(match.startTime) : null;
  const dayText = day && !Number.isNaN(day.getTime()) ? MATCH_DAY.format(day) : null;
  const timeText = start && !Number.isNaN(start.getTime()) ? MATCH_TIME.format(start) : null;
  if (dayText && timeText) return `${dayText} · ${timeText}`;
  return dayText ?? (start && timeText ? `${MATCH_DAY.format(start)} · ${timeText}` : 'Date TBD');
}

/** "47/1 (3.0)" → { score: "47/1", overs: "3.0" }; non-score lines (e.g. "Yet to Bat") keep overs null. */
export function splitScoreLine(scoreLine: string): { score: string; overs: string | null } {
  const match = /^(.*?)\s*\(([^)]+)\)$/.exec(scoreLine.trim());
  return match?.[1] && match[2] ? { score: match[1], overs: match[2] } : { score: scoreLine, overs: null };
}

/** Active (non-deleted) fixtures in schedule order. */
export function visibleMatches(matches: readonly MatchListItem[]): MatchListItem[] {
  return matches.filter((match) => !match.isDeleted);
}

/** Player id → display name from the scorecard's bundled display context. */
export function scorecardNameResolver(card: Pick<ScorecardResponse, 'display'>): DismissalNameResolver {
  return (id) => (id ? card.display.players[id] : undefined) ?? 'Unknown player';
}

/** Batting / bowling side names for an innings (display labels, else the match list teams). */
export function inningsTeams(
  card: Pick<ScorecardResponse, 'display'>,
  innings: Pick<InningsScorecard, 'inningsId' | 'battingTeamId' | 'bowlingTeamId'>,
  match?: Pick<MatchListItem, 'teamA' | 'teamB'> | null,
): { batting: string; bowling: string; battingLogoUrl: string | null } {
  const label = card.display.innings.find((row) => row.inningsId === innings.inningsId);
  const teamName = (teamId: string | null): string | null => {
    if (!match || !teamId) return null;
    if (match.teamA.id === teamId) return match.teamA.name;
    if (match.teamB.id === teamId) return match.teamB.name;
    return null;
  };
  return {
    batting: label?.battingTeamName ?? teamName(innings.battingTeamId) ?? 'Batting side',
    bowling: label?.bowlingTeamName ?? teamName(innings.bowlingTeamId) ?? 'Bowling side',
    battingLogoUrl: label?.battingTeamLogoUrl ?? null,
  };
}

/** Innings in play order; super overs are labelled after the main innings. */
export function orderedInnings(card: Pick<ScorecardResponse, 'innings'>): InningsScorecard[] {
  return [...card.innings].sort((left, right) => left.sequence - right.sequence);
}

/** "1-12 (A. Patel, 2.3 ov), 2-40 (…)" — compact fall-of-wickets line under the batting table. */
export function formatFallOfWicketsLine(
  innings: Pick<InningsScorecard, 'fallOfWickets'>,
  nameOf: DismissalNameResolver,
): string {
  return innings.fallOfWickets
    .map((fow) => `${fow.wicketNumber}-${fow.teamRuns} (${nameOf(fow.playerId)}, ${fow.oversText} ov)`)
    .join(', ');
}

export interface LeaderCardRow {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamName: string;
  value: string;
}

export interface LeaderCard {
  id: 'batting' | 'bowling' | 'sixes' | 'fours' | 'economy' | 'strikeRate';
  title: string;
  metric: string;
  emptyText: string;
  /** Qualification rule shown under the title (Best economy / strike rate). */
  note?: string;
  rows: LeaderCardRow[];
}

/** The six Tournament Stats cards (top 10 each), built from the cached leaderboard + stats payloads. */
export function buildLeaderCards(
  leaderboard: Pick<TournamentLeaderboard, 'batting' | 'bowling'> | undefined,
  stats: Pick<TournamentStatsView, 'mostSixes' | 'mostFours'> | undefined,
): LeaderCard[] {
  const batting = leaderboard?.batting.entries ?? [];
  const bowling = leaderboard?.bowling.entries ?? [];
  return [
    {
      id: 'batting',
      title: 'Batting',
      metric: 'Runs',
      emptyText: 'No runs scored yet.',
      rows: topRunScorers(batting).map((e) => ({ ...e, value: String(e.runs) })),
    },
    {
      id: 'bowling',
      title: 'Bowling',
      metric: 'Wkts',
      emptyText: 'No wickets taken yet.',
      rows: topWicketTakers(bowling).map((e) => ({ ...e, value: String(e.wickets) })),
    },
    {
      id: 'sixes',
      title: 'Most sixes',
      metric: '6s',
      emptyText: 'No sixes hit yet.',
      rows: (stats?.mostSixes ?? []).map((e) => ({ ...e, value: String(e.count) })),
    },
    {
      id: 'fours',
      title: 'Most 4s',
      metric: '4s',
      emptyText: 'No fours hit yet.',
      rows: (stats?.mostFours ?? []).map((e) => ({ ...e, value: String(e.count) })),
    },
    {
      id: 'economy',
      title: 'Best economy',
      metric: 'Econ',
      note: `Min ${BEST_ECONOMY_MIN_LEGAL_BALLS / BALLS_PER_OVER} overs`,
      emptyText: `No bowler has bowled ${BEST_ECONOMY_MIN_LEGAL_BALLS / BALLS_PER_OVER} overs yet.`,
      rows: bestEconomies(bowling).map((e) => ({ ...e, value: formatLeaderboardEconomy(e.economy) })),
    },
    {
      id: 'strikeRate',
      title: 'Best strike rate',
      metric: 'SR',
      note: `Min ${BEST_STRIKE_RATE_MIN_BALLS} balls faced`,
      emptyText: `No batter has faced ${BEST_STRIKE_RATE_MIN_BALLS} balls yet.`,
      rows: bestStrikeRates(batting).map((e) => ({ ...e, value: formatLeaderboardStrikeRate(e.strikeRate) })),
    },
  ];
}
