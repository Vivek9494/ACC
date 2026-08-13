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
  CompletedPartnership,
  OverSummary,
  Partnership,
  ScorecardInningsLabels,
  ScorecardResponse,
  TimelineEntry,
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

export function inningsKey(innings: InningsScorecard): string {
  const id = innings.inningsId?.trim();
  if (id) {
    return id;
  }
  return `seq:${innings.sequence}`;
}

export function findInningsByKey(
  card: ScorecardResponse,
  key: string | null | undefined,
): InningsScorecard | null {
  const want = key?.trim();
  if (!want) {
    return null;
  }
  return card.innings.find((inn) => inningsKey(inn) === want) ?? null;
}

export function resolveScorecardInnings(
  card: ScorecardResponse,
  options?: { inningsId?: string | null; source?: string | null },
): InningsScorecard | null {
  if (options?.source === 'scorecard') {
    return findInningsByKey(card, options.inningsId ?? null);
  }
  return resolveInningsBreakInnings(card);
}

export interface BattingSideOption {
  inningsId: string | null;
  label: string;
  enabled: boolean;
}

/** Dropdown rows: existing batting innings (enabled) + sides that have not batted (disabled). */
export function battingSideOptions(
  card: ScorecardResponse | null,
  ctx: MatchContext | null,
): BattingSideOption[] {
  const options: BattingSideOption[] = [];
  const innings = card?.innings ?? [];
  const labels = innings.map((inn) =>
    card ? battingTeamLabel(card, inn) : `Innings ${inn.sequence}`,
  );
  const dup = new Set(
    labels.filter((name, i) => labels.indexOf(name) !== i),
  );
  const battedTeamIds = new Set<string>();
  let battedExternal = false;

  for (const [i, inn] of innings.entries()) {
    const base = labels[i] ?? `Innings ${inn.sequence}`;
    const label = dup.has(base) ? `${base} (${inn.sequence})` : base;
    options.push({ inningsId: inningsKey(inn), label, enabled: true });
    const tid = normTeamId(inn.battingTeamId);
    if (tid) {
      battedTeamIds.add(tid);
    }
    if (inn.battingIsExternal === true || (!tid && Boolean(ctx?.externalOpponentName))) {
      battedExternal = true;
    }
  }

  const pending: string[] = [];
  const homeId = normTeamId(ctx?.homeTeamId ?? null);
  const awayId = normTeamId(ctx?.awayTeamId ?? null);
  if (homeId && !battedTeamIds.has(homeId)) {
    pending.push(ctx?.homeTeamName?.trim() || 'Home');
  }
  if (awayId && !battedTeamIds.has(awayId)) {
    pending.push(ctx?.awayTeamName?.trim() || 'Away');
  }
  if (
    ctx?.externalOpponentName?.trim() &&
    !awayId &&
    !battedExternal
  ) {
    pending.push(ctx.externalOpponentName.trim());
  }
  for (const name of pending) {
    options.push({
      inningsId: null,
      label: `${name} (not yet batted)`,
      enabled: false,
    });
  }
  return options;
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

export function resolveBattingTeamId(
  card: ScorecardResponse,
  innings: InningsScorecard,
): string | null {
  const direct = normTeamId(innings.battingTeamId);
  if (direct) {
    return direct;
  }
  const labels = inningsLabels(card, innings);
  return normTeamId(labels?.battingTeamId ?? null);
}

function inningsLabels(
  card: ScorecardResponse,
  innings: InningsScorecard,
): ScorecardInningsLabels | undefined {
  return (
    card.display.innings.find(
      (row) =>
        innings.inningsId != null && row.inningsId === innings.inningsId,
    ) ?? card.display.innings[0]
  );
}

/** One player of a candidate side, registered or external — same id space. */
export interface SidePlayer {
  /** Matches BatterCard.playerId: a userId, or an ExternalPlayer id. */
  playerId: string;
  name: string;
  order: number | null;
}

export type BattingSideSource = 'member_match' | 'team_id' | 'external_flag';

export interface ResolvedBattingSide {
  teamId: string | null;
  isExternal: boolean;
  players: SidePlayer[];
  source: BattingSideSource;
}

interface CandidateSide {
  teamId: string | null;
  isExternal: boolean;
  players: SidePlayer[];
  ids: Set<string>;
}

function squadSide(squad: MatchSquadContext): CandidateSide {
  const players = playingXiPlayers(squad).map((p) => ({
    playerId: String(p.userId),
    name: `${p.firstName} ${p.lastName}`.trim(),
    order: p.battingOrder,
  }));
  return {
    teamId: normTeamId(squad.teamId),
    isExternal: false,
    players,
    ids: new Set(players.map((p) => p.playerId)),
  };
}

function externalSide(ctx: MatchContext): CandidateSide | null {
  if (ctx.externalPlayers.length === 0) {
    return null;
  }
  const players = [...ctx.externalPlayers]
    .sort((a, b) => a.slot - b.slot)
    .map((p) => ({
      playerId: String(p.id),
      name: p.name,
      order: p.slot,
    }));
  return {
    teamId: null,
    isExternal: true,
    players,
    ids: new Set(players.map((p) => p.playerId)),
  };
}

/** Every player set the match has: one per locked squad, plus the external roster. */
function candidateSides(ctx: MatchContext): CandidateSide[] {
  const sides = ctx.squads
    .map(squadSide)
    .filter((side) => side.players.length > 0);
  const external = externalSide(ctx);
  return external ? [...sides, external] : sides;
}

function containsAll(side: CandidateSide, ids: ReadonlySet<string>): boolean {
  for (const id of ids) {
    if (!side.ids.has(id)) {
      return false;
    }
  }
  return true;
}

function countHits(side: CandidateSide, ids: ReadonlySet<string>): number {
  let hits = 0;
  for (const id of ids) {
    if (side.ids.has(id)) {
      hits += 1;
    }
  }
  return hits;
}

/** The side the innings frame points at — used only to break ties. */
function sideFromFrame(
  card: ScorecardResponse,
  innings: InningsScorecard,
  sides: CandidateSide[],
): CandidateSide | null {
  const labels = inningsLabels(card, innings);
  if (innings.battingIsExternal === true) {
    return sides.find((s) => s.isExternal) ?? null;
  }
  const teamId =
    normTeamId(innings.battingTeamId) ??
    normTeamId(labels?.battingTeamId ?? null);
  if (teamId) {
    return sides.find((s) => !s.isExternal && s.teamId === teamId) ?? null;
  }
  if (innings.battingTeamId == null && labels?.battingTeamId == null) {
    return sides.find((s) => s.isExternal) ?? null;
  }
  return null;
}

function toResolved(
  side: CandidateSide,
  source: BattingSideSource,
): ResolvedBattingSide {
  return {
    teamId: side.teamId,
    isExternal: side.isExternal,
    players: side.players,
    source,
  };
}

/**
 * The batting side is the player set that CONTAINS the batters — registered
 * squad or external roster, resolved the same way. teamId and the external
 * flag only break ties; neither can select a side on its own.
 */
export function resolveBattingSide(
  card: ScorecardResponse,
  innings: InningsScorecard,
  ctx: MatchContext | null,
): ResolvedBattingSide | null {
  if (!ctx) {
    return null;
  }
  const sides = candidateSides(ctx);
  if (sides.length === 0) {
    return null;
  }
  const batterIds = new Set(innings.batters.map((b) => String(b.playerId)));

  if (batterIds.size > 0) {
    const owning = sides.filter((side) => containsAll(side, batterIds));
    if (owning.length === 1 && owning[0]) {
      return toResolved(owning[0], 'member_match');
    }
    if (owning.length > 1) {
      const framed = sideFromFrame(card, innings, owning);
      const pick = framed ?? owning[0];
      return pick ? toResolved(pick, framed ? 'team_id' : 'member_match') : null;
    }
    let best: CandidateSide | null = null;
    let bestHits = 0;
    for (const side of sides) {
      const hits = countHits(side, batterIds);
      if (hits > bestHits) {
        bestHits = hits;
        best = side;
      }
    }
    if (best && bestHits > 0) {
      console.warn('[isc-xi] sanity', {
        reason: 'no side contains every batter',
        matchedBatters: bestHits,
        totalBatters: batterIds.size,
        teamId: best.teamId,
        isExternal: best.isExternal,
      });
      return toResolved(best, 'member_match');
    }
    return null;
  }

  const framed = sideFromFrame(card, innings, sides);
  if (framed) {
    return toResolved(framed, framed.isExternal ? 'external_flag' : 'team_id');
  }
  return null;
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
  partnership: Pick<Partnership, 'batterRuns'>,
  playerId: string,
): number {
  return partnership.batterRuns.find((r) => r.playerId === playerId)?.runs ?? 0;
}

/**
 * All stands for the innings-break partnerships tab: closed wickets plus the
 * unbroken last pair. Do not drop the trailing stand on a closed innings
 * (171–1 still has a live partnership).
 */
export function partnershipStandRows(
  innings: InningsScorecard,
): CompletedPartnership[] {
  const rows: CompletedPartnership[] = [...(innings.partnerships ?? [])];
  if (innings.partnership) {
    rows.push({
      batterIds: innings.partnership.batterIds,
      batterRuns: innings.partnership.batterRuns,
      runs: innings.partnership.runs,
      balls: innings.partnership.balls,
    });
  }
  return rows;
}

/** Full-innings over aggregates from the ball-by-ball timeline (not last-6 recentOvers). */
export function groupTimelineByOver(
  timeline: TimelineEntry[] | undefined,
): OverSummary[] {
  const overMap = new Map<number, OverSummary>();
  for (const entry of timeline ?? []) {
    if (entry.overNumber === null) {
      continue;
    }
    let over = overMap.get(entry.overNumber);
    if (!over) {
      over = { overNumber: entry.overNumber, balls: [], runs: 0, wickets: 0 };
      overMap.set(entry.overNumber, over);
    }
    over.balls.push(entry.code);
    over.runs += entry.runs;
    if (entry.isWicket) {
      over.wickets += 1;
    }
  }
  return [...overMap.values()].sort((a, b) => a.overNumber - b.overNumber);
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
