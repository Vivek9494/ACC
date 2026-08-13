/**
 * Broadcast-legible formatters for OBS graphics (mirrors @acc/types helpers).
 */

import type {
  BatterCard,
  BowlerCard,
  BroadcastPlayerStatsView,
  FallOfWicket,
  InningsScorecard,
  MatchContext,
  MatchSquadContext,
  MatchSquadPlayer,
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

/** This-innings score line: `100* (34)` when not out, else `100 (34)`. */
export function formatBatterInningsScore(
  batter: Pick<BatterCard, 'runs' | 'balls' | 'isOut'> | null | undefined,
): string {
  if (!batter) {
    return '0 (0)';
  }
  const runs = Number.isFinite(batter.runs) ? batter.runs : 0;
  const balls = Number.isFinite(batter.balls) ? batter.balls : 0;
  const star = batter.isOut ? '' : '*';
  return `${runs}${star} (${balls})`;
}

/**
 * Faced balls with no off-bat 1/2/3/4/6 credited — derived because BatterCard
 * has no `dotBalls` field (only bowlers do).
 */
export function deriveBatterDotBalls(
  batter: Pick<
    BatterCard,
    'balls' | 'ones' | 'twos' | 'threes' | 'fours' | 'sixes'
  > | null | undefined,
): number {
  if (!batter) {
    return 0;
  }
  const balls = Number.isFinite(batter.balls) ? batter.balls : 0;
  const scored =
    (batter.ones ?? 0) +
    (batter.twos ?? 0) +
    (batter.threes ?? 0) +
    (Number.isFinite(batter.fours) ? batter.fours : 0) +
    (Number.isFinite(batter.sixes) ? batter.sixes : 0);
  return Math.max(0, balls - scored);
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
  if (!stats || (stats.matches ?? 0) <= 0) {
    return false;
  }
  return (
    (stats.battingInnings ?? 0) > 0 ||
    (stats.runs ?? 0) > 0 ||
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

export function firstInnings(card: ScorecardResponse): InningsScorecard | null {
  return card.innings[0] ?? null;
}

/** Just-completed innings for the break graphic (not an empty open follow-on). */
export function resolveInningsBreakInnings(
  card: ScorecardResponse,
): InningsScorecard | null {
  const closed = card.innings.filter((inn) => inn.closed);
  if (closed.length > 0) {
    return closed[closed.length - 1] ?? null;
  }
  return card.innings[0] ?? null;
}

export function normTeamId(id: string | null | undefined): string | null {
  if (id == null) {
    return null;
  }
  const trimmed = String(id).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function playingXiPlayers(squad: MatchSquadContext): MatchSquadPlayer[] {
  return squad.players.filter((p) => p.role === 'PLAYING_XI');
}

export type BattingSquadSource =
  | 'innings'
  | 'frame'
  | 'single_squad'
  | 'member_match';

export interface ResolvedBattingSquad {
  teamId: string;
  squad: MatchSquadContext;
  source: BattingSquadSource;
}

function squadByTeamId(
  ctx: MatchContext | null,
  teamId: string | null,
): MatchSquadContext | null {
  const id = normTeamId(teamId);
  if (!ctx || !id) {
    return null;
  }
  return (
    ctx.squads.find((s) => normTeamId(s.teamId) === id) ?? null
  );
}

export function resolveBattingTeamId(
  card: ScorecardResponse,
  innings: InningsScorecard,
): string | null {
  const direct = normTeamId(innings.battingTeamId);
  if (direct) {
    return direct;
  }
  const labels =
    card.display.innings.find(
      (row) =>
        innings.inningsId != null && row.inningsId === innings.inningsId,
    ) ?? card.display.innings[0];
  return normTeamId(labels?.battingTeamId ?? null);
}

/**
 * Identify the batting Playing XI even when innings.battingTeamId is null
 * (ACC leather / incomplete live frame). Null team id alone is not "no squad".
 */
export function resolveBattingSquad(
  card: ScorecardResponse,
  innings: InningsScorecard,
  ctx: MatchContext | null,
): ResolvedBattingSquad | null {
  if (!ctx) {
    return null;
  }
  const withXi = ctx.squads.filter((s) => playingXiPlayers(s).length > 0);
  const hit = (
    teamId: string | null,
    source: BattingSquadSource,
  ): ResolvedBattingSquad | null => {
    const squad = squadByTeamId(ctx, teamId);
    if (!squad || playingXiPlayers(squad).length === 0) {
      return null;
    }
    return { teamId: normTeamId(squad.teamId) ?? squad.teamId, squad, source };
  };

  const fromInnings = hit(innings.battingTeamId, 'innings');
  if (fromInnings) {
    return fromInnings;
  }

  const labels =
    card.display.innings.find(
      (row) =>
        innings.inningsId != null && row.inningsId === innings.inningsId,
    ) ?? card.display.innings[0];
  const fromFrameId = hit(labels?.battingTeamId ?? null, 'frame');
  if (fromFrameId) {
    return fromFrameId;
  }
  const battingName = labels?.battingTeamName?.trim() ?? '';
  if (battingName) {
    if (ctx.homeTeamName?.trim() === battingName) {
      const home = hit(ctx.homeTeamId, 'frame');
      if (home) {
        return home;
      }
    }
    if (ctx.awayTeamName?.trim() === battingName) {
      const away = hit(ctx.awayTeamId, 'frame');
      if (away) {
        return away;
      }
    }
  }
  const bowlingId = normTeamId(
    innings.bowlingTeamId ?? labels?.bowlingTeamId ?? null,
  );
  if (bowlingId && withXi.length === 2) {
    const other = withXi.find((s) => normTeamId(s.teamId) !== bowlingId);
    if (other) {
      return {
        teamId: normTeamId(other.teamId) ?? other.teamId,
        squad: other,
        source: 'frame',
      };
    }
  }

  if (withXi.length === 1 && withXi[0]) {
    const only = withXi[0];
    return {
      teamId: normTeamId(only.teamId) ?? only.teamId,
      squad: only,
      source: 'single_squad',
    };
  }

  const batterIds = new Set(innings.batters.map((b) => String(b.playerId)));
  if (batterIds.size > 0) {
    let best: MatchSquadContext | null = null;
    let bestHits = 0;
    for (const squad of withXi) {
      const hits = squad.players.filter((p) =>
        batterIds.has(String(p.userId)),
      ).length;
      if (hits > bestHits) {
        bestHits = hits;
        best = squad;
      }
    }
    if (best && bestHits > 0) {
      return {
        teamId: normTeamId(best.teamId) ?? best.teamId,
        squad: best,
        source: 'member_match',
      };
    }
  }

  return null;
}

export function hasPlayingXiForTeam(
  ctx: MatchContext | null,
  battingTeamId: string | null,
): boolean {
  const squad = squadByTeamId(ctx, battingTeamId);
  return squad != null && playingXiPlayers(squad).length > 0;
}

export function extrasTotal(innings: InningsScorecard): number {
  const total = innings.extras?.total;
  return typeof total === 'number' && Number.isFinite(total) ? total : 0;
}

/** Split how-out into fielder column + bowler column for the scorecard table. */
export function dismissalColumns(
  card: Pick<
    BatterCard,
    'dismissalType' | 'bowlerId' | 'fielderId' | 'fielder2Id' | 'isMankad'
  >,
  nameOf: (id: string | null) => string,
): { fielder: string; bowler: string } {
  const bowlerName = card.bowlerId ? nameOf(card.bowlerId) : '';
  const fielderName = card.fielderId ? nameOf(card.fielderId) : '';
  const fielder2Name = card.fielder2Id ? nameOf(card.fielder2Id) : '';
  const bowlerOk = Boolean(bowlerName && bowlerName !== '—');
  const fielderOk = Boolean(fielderName && fielderName !== '—');
  const fielder2Ok = Boolean(fielder2Name && fielder2Name !== '—');

  switch (card.dismissalType) {
    case 'BOWLED':
      return { fielder: '', bowler: bowlerOk ? `b ${bowlerName}` : 'bowled' };
    case 'CAUGHT':
      if (card.fielderId && card.bowlerId && card.fielderId === card.bowlerId && bowlerOk) {
        return { fielder: `c & b ${bowlerName}`, bowler: '' };
      }
      return {
        fielder: fielderOk ? `c ${fielderName}` : 'caught',
        bowler: bowlerOk ? `b ${bowlerName}` : '',
      };
    case 'LBW':
      return { fielder: 'lbw', bowler: bowlerOk ? `b ${bowlerName}` : '' };
    case 'RUN_OUT': {
      let label = 'run out';
      if (fielderOk && fielder2Ok) {
        label = `run out (${fielderName}/${fielder2Name})`;
      } else if (fielderOk && card.isMankad) {
        label = `run out (${fielderName}) (mankad)`;
      } else if (fielderOk) {
        label = `run out (${fielderName})`;
      }
      return { fielder: label, bowler: '' };
    }
    case 'STUMPED':
      return {
        fielder: fielderOk ? `st ${fielderName}` : 'stumped',
        bowler: bowlerOk ? `b ${bowlerName}` : '',
      };
    case 'HIT_WICKET':
      return {
        fielder: 'hit wicket',
        bowler: bowlerOk ? `b ${bowlerName}` : '',
      };
    case 'RETIRED_OUT':
      return { fielder: 'retired out', bowler: '' };
    default:
      if (!card.dismissalType) {
        return { fielder: 'out', bowler: '' };
      }
      return {
        fielder: DISMISSAL_LABELS[card.dismissalType] ?? 'out',
        bowler: '',
      };
  }
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
