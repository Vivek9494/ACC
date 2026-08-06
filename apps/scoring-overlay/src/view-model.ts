import type { InningsScorecard, ScorecardResponse } from './types';

const BALLS_PER_OVER = 6;

export interface StripViewModel {
  teamName: string;
  scoreLine: string;
  oversLine: string;
  striker: string;
  nonStriker: string;
  bowler: string;
  chase: string | null;
  resultNote: string | null;
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

function shortName(full: string): string {
  if (full === '—') {
    return full;
  }
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return full;
  }
  const last = parts[parts.length - 1] ?? full;
  const initial = parts[0]?.[0]?.toUpperCase() ?? '';
  return initial ? `${initial}. ${last}` : last;
}

function formatRunsBalls(
  innings: InningsScorecard,
  playerId: string,
  onStrike: boolean,
): string {
  const card = innings.batters.find((b) => b.playerId === playerId);
  if (!card) {
    return '';
  }
  const runs = onStrike && !card.isOut ? `${card.runs}*` : String(card.runs);
  return `${runs} (${card.balls})`;
}

function playerLine(
  card: ScorecardResponse,
  innings: InningsScorecard,
  playerId: string | null,
  onStrike: boolean,
): string {
  if (!playerId) {
    return '—';
  }
  const name = shortName(playerName(card.display, playerId));
  const figs = formatRunsBalls(innings, playerId, onStrike);
  return figs ? `${name}  ${figs}` : name;
}

function bowlingFigures(innings: InningsScorecard, bowlerId: string | null): string {
  if (!bowlerId) {
    return '';
  }
  const row = innings.bowlers.find((b) => b.playerId === bowlerId);
  if (!row) {
    return '';
  }
  return `${row.oversText}-${row.runsConceded}-${row.wickets}`;
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

function battingTeamLabel(card: ScorecardResponse, innings: InningsScorecard): string {
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

function remainingLegalBalls(innings: InningsScorecard): number | null {
  if (innings.oversAllotted == null || innings.oversAllotted <= 0) {
    return null;
  }
  const total = innings.oversAllotted * BALLS_PER_OVER;
  const left = total - innings.legalBalls;
  return left > 0 ? left : 0;
}

function chaseLine(card: ScorecardResponse, innings: InningsScorecard): string | null {
  // Second innings (or later) only — sequence >= 2, or innings-level target.
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
  if (ballsLeft == null) {
    return `TARGET ${target}  ·  NEED ${needs}`;
  }
  if (ballsLeft === 0) {
    return `TARGET ${target}  ·  NEED ${needs}`;
  }
  const rrr = (needs * BALLS_PER_OVER) / ballsLeft;
  const rrrText = Number.isFinite(rrr) ? rrr.toFixed(2) : '—';
  return `TARGET ${target}  ·  NEED ${needs} OFF ${ballsLeft}  ·  RRR ${rrrText}`;
}

export function buildStripViewModel(card: ScorecardResponse): StripViewModel | null {
  const innings = resolveActiveInnings(card);
  if (!innings) {
    return null;
  }

  const bowlFigs = bowlingFigures(innings, innings.currentBowlerId);
  const bowlerName = shortName(playerName(card.display, innings.currentBowlerId));
  const bowlerLine = innings.currentBowlerId
    ? bowlFigs
      ? `${bowlerName}  ${bowlFigs}`
      : bowlerName
    : '—';

  let resultNote: string | null = null;
  if (card.result?.decided) {
    resultNote = card.result.note?.trim() || 'MATCH COMPLETE';
  }

  return {
    teamName: battingTeamLabel(card, innings),
    scoreLine: `${innings.runs}/${innings.wickets}`,
    oversLine: `(${innings.oversText || '0.0'})`,
    striker: playerLine(card, innings, innings.currentStrikerId, true),
    nonStriker: playerLine(card, innings, innings.currentNonStrikerId, false),
    bowler: bowlerLine,
    chase: resultNote ? null : chaseLine(card, innings),
    resultNote,
  };
}
