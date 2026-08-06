/**
 * Broadcast-legible formatters for OBS graphics (mirrors @acc/types helpers).
 */

import type {
  BatterCard,
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
