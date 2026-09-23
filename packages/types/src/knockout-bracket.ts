import type { AuthUser } from './auth';
import { UserRole } from './auth';
import { MatchState } from './match';

export const KNOCKOUT_BRACKET_MESSAGES = {
  notFound: 'No knockout bracket exists for this tournament',
  alreadyExists: 'A knockout bracket already exists for this tournament',
  notApl: 'Knockout brackets apply to APL tournaments only',
  notConfigured: 'Set the knockout team count before generating a bracket',
  qualificationNotReady:
    'Group-stage matches must be complete before generating the knockout bracket',
  deleteTitle: 'Delete Knockout Bracket?',
  deleteStandard:
    'This removes all knockout matches and unlocks the knockout team count. Group-stage matches are not affected.',
  deleteWithResults: (count: number) =>
    `${count} knockout ${count === 1 ? 'match has' : 'matches have'} results that will be lost. Group-stage matches are not affected.`,
  correctionBlocked:
    'Cannot change the result — the next knockout match is already scheduled or played. Delete the bracket to start over.',
  requiresResolution: 'Requires resolution',
  generateConfirmTitle: 'Generate Knockout Bracket?',
  generateConfirmMessage: (teamCount: number, matchCount: number) =>
    `This creates ${matchCount} knockout matches for ${teamCount} qualified teams. Group-stage standings will be locked in.`,
  manualSeedInvalid:
    'The seed order must include exactly the qualified teams with no duplicates',
  /** Knockout match completed but scorecard not yet locked — winner has not advanced. */
  awaitingScorecardConfirmation:
    'Awaiting confirmation — winner advances after scorecard lock',
  awaitingScorecardConfirmationShort: 'Awaiting confirmation',
  /** Shown on downstream WINNER_OF slots when the feeder has a result pending lock. */
  feederAwaitingScorecardConfirmation: 'Result pending scorecard lock',
} as const;

/** Admin / Club Manager — same gate as bracket generation. */
export function canManageKnockoutBracket(user: AuthUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return user.role === UserRole.Admin || user.role === UserRole.ClubManager;
}

/** Bracket-existence flag on tournament read models (server-sourced). */
export function tournamentHasKnockoutBracketFromFlag(hasKnockoutBracket: boolean): boolean {
  return hasKnockoutBracket;
}

export interface KnockoutBracketDeletePreview {
  totalKnockoutMatches: number;
  /** Matches with confirmedAt != null OR at least one innings row. */
  playedKnockoutMatchCount: number;
}

export const KnockoutBracketSlotKind = {
  Team: 'TEAM',
  Bye: 'BYE',
  WinnerOf: 'WINNER_OF',
  Tbd: 'TBD',
} as const;

export type KnockoutBracketSlotKind =
  (typeof KnockoutBracketSlotKind)[keyof typeof KnockoutBracketSlotKind];

export interface KnockoutBracketMatchSlot {
  kind: KnockoutBracketSlotKind;
  teamId: string | null;
  teamName: string | null;
  logoUrl: string | null;
  /** When kind is WINNER_OF — e.g. "Winner of Pre Quarter Final · Match 1". */
  feederLabel: string | null;
  /** True when the feeding match is complete but its scorecard is not yet locked. */
  feederAwaitingConfirmation?: boolean;
}

export interface KnockoutBracketMatchSummary {
  id: string;
  bracketRoundIndex: number | null;
  bracketPosition: number | null;
  bracketRoundLabel: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeSlot: KnockoutBracketMatchSlot;
  awaySlot: KnockoutBracketMatchSlot;
  state: MatchState;
  confirmedAt: string | null;
  winningTeamId: string | null;
  isNoResult: boolean;
  awaitingTeams: boolean;
  /** Confirmed without a winner — tie / no-result needing manual resolution. */
  requiresResolution: boolean;
  /** Completed (or no-result) but scorecard not yet locked — winner has not advanced. */
  awaitingScorecardConfirmation: boolean;
}

export interface KnockoutBracketView {
  tournamentId: string;
  bracketSize: number;
  byeCount: number;
  knockoutTeamCount: number;
  championTeamId: string | null;
  matches: KnockoutBracketMatchSummary[];
}

/** Match states beyond pure scheduling — used as secondary "touched" signal. */
export const KNOCKOUT_TOUCHED_MATCH_STATES: readonly MatchState[] = [
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
  MatchState.Live,
  MatchState.RainInterrupted,
  MatchState.Completed,
  MatchState.NoResult,
  MatchState.ScorecardLocked,
] as const;

export function isKnockoutMatchPlayedForDeleteWarning(match: {
  confirmedAt: Date | string | null;
  inningsCount?: number;
}): boolean {
  if (match.confirmedAt != null) {
    return true;
  }
  return (match.inningsCount ?? 0) > 0;
}

export function knockoutMatchRequiresResolution(match: {
  confirmedAt: Date | string | null;
  winningTeamId: string | null;
  isNoResult: boolean;
}): boolean {
  return match.confirmedAt != null && (match.winningTeamId == null || match.isNoResult);
}

/** True when the match is finished but the scorecard is not yet locked (§13.1). */
export function knockoutMatchAwaitingScorecardConfirmation(match: {
  state: MatchState;
  confirmedAt: string | Date | null;
}): boolean {
  if (match.confirmedAt != null) {
    return false;
  }
  return match.state === MatchState.Completed || match.state === MatchState.NoResult;
}

export function buildKnockoutBracketDeleteMessage(preview: KnockoutBracketDeletePreview): string {
  if (preview.playedKnockoutMatchCount > 0) {
    return KNOCKOUT_BRACKET_MESSAGES.deleteWithResults(preview.playedKnockoutMatchCount);
  }
  return KNOCKOUT_BRACKET_MESSAGES.deleteStandard;
}
