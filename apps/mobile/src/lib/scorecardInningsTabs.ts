import type {
  InningsScorecard,
  MatchDetail,
  ScorecardInningsLabels,
  ScorecardResponse,
} from '@acc/types';

import type { BattingTeamLabel } from '../hooks/useMatchResolvers';

/** Every completed match has two innings tabs on the scorecard. */
export const INNINGS_TAB_COUNT = 2;

/** Same opponent label as live scorecard header (`home vs away/external`). */
export function matchOpponentTeamName(match: MatchDetail | null): string | null {
  if (!match) {
    return null;
  }
  const away = match.awayTeamName?.trim();
  if (away) {
    return away;
  }
  const external = match.externalOpponentName?.trim();
  return external || null;
}

function displayInningsLabels(
  card: ScorecardResponse,
  inningsId: string | null | undefined,
): ScorecardInningsLabels | undefined {
  if (!inningsId) {
    return undefined;
  }
  return card.display.innings.find((row) => row.inningsId === inningsId);
}

/** Second-innings batting side before innings 2 exists — the bowling side from innings 1. */
function yetToBatTeamName(
  firstInnings: InningsScorecard,
  card: ScorecardResponse,
  match: MatchDetail | null,
  teamNameOf: (teamId: string | null) => string,
): string {
  const labels = displayInningsLabels(card, firstInnings.inningsId);
  if (labels?.bowlingTeamName) {
    return labels.bowlingTeamName;
  }

  if (firstInnings.bowlingTeamId) {
    return teamNameOf(firstInnings.bowlingTeamId);
  }

  if (firstInnings.bowlingIsExternal) {
    return matchOpponentTeamName(match) ?? 'Opponent';
  }

  if (firstInnings.battingIsExternal) {
    return match?.homeTeamName?.trim() ?? teamNameOf(match?.homeTeamId ?? null);
  }

  if (match?.battingFirstTeamId) {
    const homeId = match.homeTeamId;
    const awayId = match.awayTeamId;
    if (homeId && awayId) {
      const secondBattingId =
        match.battingFirstTeamId === homeId ? awayId : homeId;
      return teamNameOf(secondBattingId);
    }
  }

  return matchOpponentTeamName(match) ?? 'Opponent';
}

/** Active tab on open — the latest innings that has started. */
export function defaultInningsTabIndex(card: ScorecardResponse): number {
  if (card.innings.length === 0) {
    return 0;
  }
  return Math.min(card.innings.length - 1, INNINGS_TAB_COUNT - 1);
}

export function inningsForTab(
  card: ScorecardResponse,
  tabIndex: number,
): InningsScorecard | null {
  return card.innings[tabIndex] ?? null;
}

/** Batting team name for each tab (tab 2 uses the yet-to-bat side before innings 2 exists). */
export function inningsTabTeamLabel(
  tabIndex: number,
  card: ScorecardResponse,
  match: MatchDetail | null,
  teamNameOf: (teamId: string | null) => string,
  battingTeamLabel: (innings: InningsScorecard) => BattingTeamLabel,
): string {
  const started = card.innings[tabIndex];
  if (started) {
    return battingTeamLabel(started).name;
  }

  const firstInnings = card.innings[0];
  if (tabIndex === 1 && firstInnings) {
    return yetToBatTeamName(firstInnings, card, match, teamNameOf);
  }

  if (tabIndex === 0 && match?.battingFirstTeamId) {
    return teamNameOf(match.battingFirstTeamId);
  }

  return matchOpponentTeamName(match) ?? 'Opponent';
}

export function inningsTabLabels(
  card: ScorecardResponse,
  match: MatchDetail | null,
  teamNameOf: (teamId: string | null) => string,
  battingTeamLabel: (innings: InningsScorecard) => BattingTeamLabel,
): [string, string] {
  return [
    inningsTabTeamLabel(0, card, match, teamNameOf, battingTeamLabel),
    inningsTabTeamLabel(1, card, match, teamNameOf, battingTeamLabel),
  ];
}

/** Latest started innings on the scorecard (the in-progress innings while live). */
export function liveInnings(card: ScorecardResponse): InningsScorecard | null {
  if (card.innings.length === 0) {
    return null;
  }
  return card.innings[card.innings.length - 1] ?? null;
}

/** Live scoring scorecard — inner innings tabs appear only once the 2nd innings exists. */
export const LIVE_SCORECARD_INNINGS_TAB_LABELS = ['1st Innings', '2nd Innings'] as const;

export function showLiveScorecardInningsTabs(card: ScorecardResponse): boolean {
  return card.innings.length >= 2;
}

/** Default inner tab: 2nd innings when both exist; otherwise the sole innings. */
export function defaultLiveScorecardInningsIndex(card: ScorecardResponse): number {
  return card.innings.length >= 2 ? 1 : 0;
}

/** Pinned live header cards — only while the match is live and the current innings is open. */
export function shouldShowLiveTopCards(
  isMatchLive: boolean,
  card: ScorecardResponse,
): boolean {
  if (!isMatchLive) {
    return false;
  }
  const current = liveInnings(card);
  return current != null && !current.closed;
}
