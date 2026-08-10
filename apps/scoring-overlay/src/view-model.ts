import { buildCurrentOverTracker, type CurrentOverTracker } from './over-tracker';
import type {
  InningsScorecard,
  MatchContext,
  MatchResultView,
  ScorecardInningsLabels,
  ScorecardResponse,
} from './types';

const BALLS_PER_OVER = 6;

export interface StripBatterVm {
  name: string;
  runs: string;
  balls: string;
  onStrike: boolean;
}

export interface StripTeamVm {
  name: string;
  logoUrl: string | null;
  initials: string;
}

export interface StripViewModel {
  batting: StripTeamVm;
  bowling: StripTeamVm;
  batsmen: StripBatterVm[];
  /** runs-wickets, e.g. "120-3". */
  scoreLine: string;
  /** Current run rate, e.g. "CRR 8.50". */
  runRateLine: string;
  /** Remaining overs, e.g. "18.2 OV REM", or null if unknown. */
  oversRemainingLine: string | null;
  oversLine: string;
  showPowerplay: boolean;
  subtitle: string | null;
  bowlerName: string;
  /** wickets-runs, e.g. "1-24". */
  bowlerFigs: string;
  bowlerOvers: string;
  overTracker: CurrentOverTracker;
}

function playerName(
  display: ScorecardResponse['display'],
  playerId: string | null,
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

export function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
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

function batterRunsBalls(
  innings: InningsScorecard,
  playerId: string,
): { runs: string; balls: string } {
  const card = innings.batters.find((b) => b.playerId === playerId);
  if (!card) {
    return { runs: '0', balls: '0' };
  }
  return { runs: String(card.runs), balls: String(card.balls) };
}

/** Active or most recent innings for the strip. */
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

function inningsLabels(
  card: ScorecardResponse,
  innings: InningsScorecard,
): ScorecardInningsLabels | null {
  return (
    card.display.innings.find(
      (row) =>
        (innings.inningsId != null && row.inningsId === innings.inningsId) ||
        (row.battingTeamId != null &&
          innings.battingTeamId != null &&
          row.battingTeamId === innings.battingTeamId),
    ) ?? null
  );
}

function formatCurrentRunRate(innings: InningsScorecard): string {
  if (innings.legalBalls <= 0) {
    return 'CRR 0.00';
  }
  const rr = (innings.runs * BALLS_PER_OVER) / innings.legalBalls;
  const text = Number.isFinite(rr) ? rr.toFixed(2) : '0.00';
  return `CRR ${text}`;
}

function formatOversFromBalls(balls: number): string {
  const whole = Math.floor(balls / BALLS_PER_OVER);
  const rem = balls % BALLS_PER_OVER;
  return `${whole}.${rem}`;
}

function formatOversRemaining(innings: InningsScorecard): string | null {
  const ballsLeft = remainingLegalBalls(innings);
  if (ballsLeft == null) {
    return null;
  }
  return `Overs remaining ${formatOversFromBalls(ballsLeft)}`;
}

function remainingLegalBalls(innings: InningsScorecard): number | null {
  if (innings.oversAllotted == null || innings.oversAllotted <= 0) {
    return null;
  }
  const total = innings.oversAllotted * BALLS_PER_OVER;
  const left = total - innings.legalBalls;
  return left > 0 ? left : 0;
}

function chaseLine(card: ScorecardResponse, innings: InningsScorecard): string | null {
  if (innings.sequence < 2 && innings.target == null) {
    return null;
  }

  const target =
    innings.target ??
    card.effectiveTarget ??
    card.dlsTarget ??
    card.originalTarget;
  if (target == null || target <= 0) {
    return null;
  }

  const needs = Math.max(0, target - innings.runs);
  if (needs <= 0) {
    return `TARGET ${target}`;
  }
  const ballsLeft = remainingLegalBalls(innings);
  if (ballsLeft == null || ballsLeft === 0) {
    return `NEED ${needs} · TARGET ${target}`;
  }
  const rrr = (needs * BALLS_PER_OVER) / ballsLeft;
  const rrrText = Number.isFinite(rrr) ? rrr.toFixed(2) : '—';
  return `NEED ${needs} OFF ${ballsLeft} · RRR ${rrrText}`;
}

/** e.g. "ACC 3 won the toss and chose to bat" — null until toss is recorded. */
export function formatTossLine(ctx: MatchContext | null): string | null {
  if (!ctx?.tossWinner || !ctx.tossDecision) {
    return null;
  }
  const winnerName =
    ctx.tossWinner === 'TEAM_A'
      ? (ctx.homeTeamName ?? 'Home')
      : (ctx.awayTeamName ?? ctx.externalOpponentName ?? 'Away');
  const decisionWord = ctx.tossDecision === 'BAT' ? 'bat' : 'bowl';
  return `${winnerName} won the toss and chose to ${decisionWord}`;
}

function winnerDisplayName(
  card: ScorecardResponse,
  result: MatchResultView,
  ctx: MatchContext | null,
): string {
  if (result.winningTeamId) {
    for (const row of card.display.innings) {
      if (row.battingTeamId === result.winningTeamId && row.battingTeamName.trim()) {
        return row.battingTeamName.trim();
      }
      if (row.bowlingTeamId === result.winningTeamId && row.bowlingTeamName.trim()) {
        return row.bowlingTeamName.trim();
      }
    }
    if (ctx?.homeTeamId === result.winningTeamId && ctx.homeTeamName) {
      return ctx.homeTeamName;
    }
    if (ctx?.awayTeamId === result.winningTeamId && ctx.awayTeamName) {
      return ctx.awayTeamName;
    }
  }
  return ctx?.homeTeamName ?? 'Winner';
}

function formatResultLine(
  card: ScorecardResponse,
  ctx: MatchContext | null,
): string | null {
  const result = card.result;
  if (!result) {
    return null;
  }
  if (ctx?.resultNote?.trim()) {
    return ctx.resultNote.trim();
  }
  if (result.superOverRequired) {
    return result.note ?? 'Scores level — Super Over required';
  }
  if (result.isTie) {
    return 'Match tied';
  }
  if (!result.decided) {
    return null;
  }
  const winner = winnerDisplayName(card, result, ctx);
  if (result.marginWickets != null && result.marginWickets >= 0) {
    const w = result.marginWickets;
    const line = `${winner} won by ${w} wicket${w === 1 ? '' : 's'}`;
    return result.note === 'Decided by Super Over' ? `${line} (Super Over)` : line;
  }
  if (result.marginRuns != null && result.marginRuns >= 0) {
    const r = result.marginRuns;
    const line = `${winner} won by ${r} run${r === 1 ? '' : 's'}`;
    return result.note === 'Decided by Super Over' ? `${line} (Super Over)` : line;
  }
  if (result.note === 'Decided by Super Over') {
    return `${winner} won (Super Over)`;
  }
  return result.note?.trim() || `${winner} won`;
}

function buildSubtitle(
  card: ScorecardResponse,
  innings: InningsScorecard,
  ctx: MatchContext | null,
): string | null {
  const result = formatResultLine(card, ctx);
  if (result) {
    return result;
  }
  // Toss is operator-driven on the CRR row (Show toss) — never auto-stack under CRR.
  return chaseLine(card, innings);
}

function teamVm(
  name: string,
  teamId: string | null,
  ctx: MatchContext | null,
): StripTeamVm {
  const trimmed = name.trim() || '—';
  const logoUrl =
    teamId && ctx?.logosByTeamId[teamId] ? ctx.logosByTeamId[teamId] : null;
  return {
    name: trimmed,
    logoUrl,
    initials: teamInitials(trimmed),
  };
}

/** True while still inside the configured fielding powerplay overs. */
function inPowerplay(
  innings: InningsScorecard,
  ctx: MatchContext | null,
): boolean {
  const pp = ctx?.powerplayOvers;
  if (pp == null || pp <= 0) {
    return false;
  }
  const oversStarted = Math.floor(innings.legalBalls / BALLS_PER_OVER);
  return oversStarted < pp;
}

export function buildStripViewModel(
  card: ScorecardResponse,
  ctx: MatchContext | null = null,
): StripViewModel | null {
  const innings = resolveActiveInnings(card);
  if (!innings) {
    return null;
  }

  const labels = inningsLabels(card, innings);
  const battingName = labels?.battingTeamName?.trim() || 'Batting';
  const bowlingName = labels?.bowlingTeamName?.trim() || 'Bowling';
  const battingId = labels?.battingTeamId ?? innings.battingTeamId;
  const bowlingId = labels?.bowlingTeamId ?? innings.bowlingTeamId;

  const batsmen: StripBatterVm[] = [];
  const strikerId = innings.currentStrikerId;
  const nonStrikerId = innings.currentNonStrikerId;

  if (strikerId) {
    const figs = batterRunsBalls(innings, strikerId);
    batsmen.push({
      name: shortName(playerName(card.display, strikerId)),
      runs: figs.runs,
      balls: figs.balls,
      onStrike: true,
    });
  }
  if (nonStrikerId) {
    const figs = batterRunsBalls(innings, nonStrikerId);
    batsmen.push({
      name: shortName(playerName(card.display, nonStrikerId)),
      runs: figs.runs,
      balls: figs.balls,
      onStrike: false,
    });
  }
  while (batsmen.length < 2) {
    batsmen.push({ name: '—', runs: '', balls: '', onStrike: false });
  }

  const bowlerId = innings.currentBowlerId;
  const bowlerName = bowlerId
    ? shortName(playerName(card.display, bowlerId))
    : '—';
  const bowlRow = bowlerId
    ? innings.bowlers.find((b) => b.playerId === bowlerId)
    : undefined;

  return {
    batting: teamVm(battingName, battingId, ctx),
    bowling: teamVm(bowlingName, bowlingId, ctx),
    batsmen,
    scoreLine: `${innings.runs}-${innings.wickets}`,
    runRateLine: formatCurrentRunRate(innings),
    oversRemainingLine: formatOversRemaining(innings),
    oversLine: innings.oversText || '0.0',
    showPowerplay: inPowerplay(innings, ctx),
    subtitle: buildSubtitle(card, innings, ctx),
    bowlerName,
    bowlerFigs: bowlRow ? `${bowlRow.wickets}-${bowlRow.runsConceded}` : '',
    bowlerOvers: bowlRow?.oversText ?? '',
    overTracker: buildCurrentOverTracker(innings),
  };
}
