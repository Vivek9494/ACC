import type { InningsScorecard, MatchDetail, ScorecardResponse } from '@acc/types';

import type { BattingTeamLabel } from '../hooks/useMatchResolvers';

/** Every completed match has two innings tabs on the scorecard. */
export const INNINGS_TAB_COUNT = 2;

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
  if (tabIndex === 1 && firstInnings?.bowlingTeamId) {
    return teamNameOf(firstInnings.bowlingTeamId);
  }

  if (tabIndex === 0 && match?.battingFirstTeamId) {
    return teamNameOf(match.battingFirstTeamId);
  }

  if (tabIndex === 1 && match?.battingFirstTeamId) {
    const homeId = match.homeTeamId;
    const awayId = match.awayTeamId;
    if (homeId && awayId) {
      const secondBattingId =
        match.battingFirstTeamId === homeId ? awayId : homeId;
      return teamNameOf(secondBattingId);
    }
  }

  return 'Team';
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
