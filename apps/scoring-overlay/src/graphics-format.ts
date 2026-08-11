/**
 * Broadcast-legible formatters for OBS graphics (mirrors @acc/types helpers).
 */

import type {
  BatterCard,
  BowlerCard,
  BroadcastPlayerStatsView,
  FallOfWicket,
  InningsScorecard,
  Partnership,
  ScorecardResponse,
} from './types';

const DISMISSAL_LABELS: Record<string, string> = {
  BOWLED: 'bowled',
  CAUGHT: 'caught',
  LBW: 'lbw',
  RUN_OUT: 'run out',
  STUMPED: 'stumped',
  HIT_WICKET: 'hit wicket',
  RETIRED_OUT: 'retired out',
  OBSTRUCTING_THE_FIELD: 'obstructing the field',
  HIT_THE_BALL_TWICE: 'hit the ball twice',
  TIMED_OUT: 'timed out',
};

export function playerName(
  display: ScorecardResponse['display'],
  playerId: string | null | undefined,
): string {
  if (!playerId) {
    return '—';
  }
  const name = display.players[playerId]?.trim();
  return name && name.length > 0 ? name : '—';
}

export function shortName(full: string): string {
  if (full === '—' || !full.trim()) {
    return full || '—';
  }
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return full;
  }
  const last = parts[parts.length - 1] ?? full;
  const initial = parts[0]?.[0]?.toUpperCase() ?? '';
  return initial ? `${initial}. ${last}` : last;
}

export function initialsFromName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  }
  const a = parts[0]?.[0] ?? '';
  const b = parts[parts.length - 1]?.[0] ?? '';
  return `${a}${b}`.toUpperCase() || '?';
}

export function formatDismissalShort(
  card: Pick<BatterCard, 'dismissalType' | 'bowlerId' | 'fielderId' | 'fielder2Id' | 'isMankad'>,
  nameOf: (id: string | null) => string,
): string {
  if (!card.dismissalType) {
    return '';
  }
  const bowler = card.bowlerId ? nameOf(card.bowlerId) : null;
  const fielder = card.fielderId ? nameOf(card.fielderId) : null;
  const fielder2 = card.fielder2Id ? nameOf(card.fielder2Id) : null;
  switch (card.dismissalType) {
    case 'BOWLED':
      return bowler ? `b ${bowler}` : DISMISSAL_LABELS.BOWLED;
    case 'CAUGHT':
      if (card.fielderId && card.bowlerId && card.fielderId === card.bowlerId && bowler) {
        return `c & b ${bowler}`;
      }
      return fielder && bowler
        ? `c ${fielder} b ${bowler}`
        : fielder
          ? `c ${fielder}`
          : DISMISSAL_LABELS.CAUGHT;
    case 'LBW':
      return bowler ? `lbw b ${bowler}` : DISMISSAL_LABELS.LBW;
    case 'RUN_OUT':
      if (fielder && fielder2) {
        return `run out (${fielder}/${fielder2})`;
      }
      if (fielder && card.isMankad) {
        return `run out (${fielder}) (mankad)`;
      }
      return fielder ? `run out (${fielder})` : DISMISSAL_LABELS.RUN_OUT;
    case 'STUMPED':
      return fielder && bowler
        ? `st ${fielder} b ${bowler}`
        : DISMISSAL_LABELS.STUMPED;
    case 'HIT_WICKET':
      return bowler ? `hit wicket b ${bowler}` : DISMISSAL_LABELS.HIT_WICKET;
    case 'RETIRED_OUT':
      return DISMISSAL_LABELS.RETIRED_OUT;
    default:
      return DISMISSAL_LABELS[card.dismissalType] ?? '';
  }
}

export function wicketOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}TH`;
  }
  const mod10 = n % 10;
  const suffix =
    mod10 === 1 ? 'ST' : mod10 === 2 ? 'ND' : mod10 === 3 ? 'RD' : 'TH';
  return `${n}${suffix}`;
}

/** True when the player has usable bowling career figures for the card. */
export function hasBowlerCareerStats(
  stats: BroadcastPlayerStatsView | null | undefined,
): boolean {
  if (!stats || stats.matches <= 0) {
    return false;
  }
  return (
    stats.wickets > 0 ||
    stats.economy != null ||
    stats.bowlingAverage != null ||
    (stats.bowlingLegalBalls ?? 0) > 0 ||
    Boolean(stats.bestBowling?.trim())
  );
}

/** True when the player has usable batting career figures for the card. */
export function hasBatsmanCareerStats(
  stats: BroadcastPlayerStatsView | null | undefined,
): boolean {
  if (!stats || stats.matches <= 0) {
    return false;
  }
  return (
    stats.battingInnings > 0 ||
    stats.runs > 0 ||
    stats.average != null ||
    stats.strikeRate != null ||
    Boolean(stats.highestScore?.trim())
  );
}

/** Highest-score footer: `v Opponent, venue, year` when parts exist. */
export function formatHighestScoreMeta(
  stats: BroadcastPlayerStatsView | null | undefined,
): string | null {
  if (!stats) {
    return null;
  }
  const opponent = stats.highestScoreOpponent?.trim() || null;
  const context = stats.highestScoreContext?.trim() || null;
  if (opponent && context) {
    return `v ${opponent}, ${context}`;
  }
  if (opponent) {
    return `v ${opponent}`;
  }
  return context;
}

export interface LiveCareerBowlingDisplay {
  matches: number;
  wickets: number;
  average: number | null;
  economy: number | null;
  best: string;
}

function parseBestBowling(
  text: string | null | undefined,
): { wickets: number; runsConceded: number } | null {
  if (!text?.trim()) {
    return null;
  }
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(text.trim());
  if (!m) {
    return null;
  }
  return { wickets: Number(m[1]), runsConceded: Number(m[2]) };
}

function isBetterBowlingFigures(
  current: { wickets: number; runsConceded: number } | null,
  candidate: { wickets: number; runsConceded: number },
): boolean {
  if (!current) {
    return true;
  }
  if (candidate.wickets !== current.wickets) {
    return candidate.wickets > current.wickets;
  }
  return candidate.runsConceded < current.runsConceded;
}

function formatBestBowling(wickets: number, runsConceded: number): string {
  return `${wickets}/${runsConceded}`;
}

function thisMatchBowler(
  card: ScorecardResponse | null,
  playerId: string,
): BowlerCard | null {
  if (!card) {
    return null;
  }
  let merged: BowlerCard | null = null;
  for (const innings of card.innings) {
    const row = innings.bowlers.find((b) => b.playerId === playerId);
    if (!row) {
      continue;
    }
    if (!merged) {
      merged = { ...row };
      continue;
    }
    merged = {
      ...merged,
      runsConceded: merged.runsConceded + row.runsConceded,
      wickets: merged.wickets + row.wickets,
      legalBalls: (merged.legalBalls ?? 0) + (row.legalBalls ?? 0),
    };
  }
  return merged;
}

/**
 * Career (completed) + this-match live bowling, combined from underlying totals.
 * Matches +1 once the bowler has bowled ≥1 legal ball this match.
 */
export function combineCareerBowlingWithLive(
  career: BroadcastPlayerStatsView,
  card: ScorecardResponse | null,
  playerId: string,
): LiveCareerBowlingDisplay {
  const live = thisMatchBowler(card, playerId);
  const liveBalls = live?.legalBalls ?? 0;
  const liveRuns = live?.runsConceded ?? 0;
  const liveWkts = live?.wickets ?? 0;
  const hasBowledThisMatch = liveBalls > 0;

  const careerRuns = career.bowlingRunsConceded ?? 0;
  const careerBalls = career.bowlingLegalBalls ?? 0;
  const careerWkts = career.wickets;

  const totalRuns = careerRuns + (hasBowledThisMatch ? liveRuns : 0);
  const totalBalls = careerBalls + (hasBowledThisMatch ? liveBalls : 0);
  const totalWkts = careerWkts + (hasBowledThisMatch ? liveWkts : 0);
  const matches = career.matches + (hasBowledThisMatch ? 1 : 0);

  const average =
    totalWkts > 0 ? Math.round((totalRuns / totalWkts) * 100) / 100 : null;
  const economy =
    totalBalls > 0
      ? Math.round((totalRuns / (totalBalls / 6)) * 100) / 100
      : null;

  let bestCareer =
    career.bestBowlingWickets != null && career.bestBowlingRunsConceded != null
      ? {
          wickets: career.bestBowlingWickets,
          runsConceded: career.bestBowlingRunsConceded,
        }
      : parseBestBowling(career.bestBowling);

  let best = bestCareer;
  if (hasBowledThisMatch && (liveWkts > 0 || liveBalls > 0)) {
    const liveBest = { wickets: liveWkts, runsConceded: liveRuns };
    if (isBetterBowlingFigures(best, liveBest)) {
      best = liveBest;
    }
  }

  return {
    matches,
    wickets: totalWkts,
    average,
    economy,
    best: best
      ? formatBestBowling(best.wickets, best.runsConceded)
      : career.bestBowling?.trim() || '—',
  };
}

export function resolveActiveInnings(card: ScorecardResponse): InningsScorecard | null {
  if (card.innings.length === 0) {
    return null;
  }
  const open = [...card.innings].reverse().find((inn) => !inn.closed);
  if (open) {
    return open;
  }
  return card.innings[card.innings.length - 1] ?? null;
}

export function battingTeamLabel(
  card: ScorecardResponse,
  innings: InningsScorecard,
): string {
  const labels = card.display.innings.find(
    (row) =>
      (innings.inningsId != null && row.inningsId === innings.inningsId) ||
      (row.battingTeamId != null &&
        innings.battingTeamId != null &&
        row.battingTeamId === innings.battingTeamId),
  );
  const name = labels?.battingTeamName?.trim();
  return name && name.length > 0 ? name : 'Batting';
}

export function partnershipBatterRuns(
  partnership: Partnership,
  playerId: string,
): number {
  return partnership.batterRuns.find((r) => r.playerId === playerId)?.runs ?? 0;
}

export function latestFallOfWicket(
  innings: InningsScorecard | null,
): FallOfWicket | null {
  const list = innings?.fallOfWickets ?? [];
  if (list.length === 0) {
    return null;
  }
  return list[list.length - 1] ?? null;
}

export function formatStat(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
