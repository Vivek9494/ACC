import { PLAYING_XI_SIZE } from './match';
import {
  computeLiveStartAllowedAt,
  formatLiveStartAllowedAtLine,
  isLiveStartTimeWindowOpen,
} from './match-live-start';

/** Per-team Playing XI finalization on a match squad row. */
export interface SquadFinalizationView {
  isFinalized: boolean;
  finalizedByUserId: string | null;
  finalizedAt: string | null;
}

export interface MatchTeamFinalizationSummary {
  teamId: string;
  teamName: string;
  isFinalized: boolean;
}

export interface MatchPlayingXiFinalizationStatus {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamFinalized: boolean;
  awayTeamFinalized: boolean;
  bothTeamsFinalized: boolean;
}

export function countPlayingXiStarters(
  players: readonly { role: string }[],
): number {
  return players.filter((player) => player.role === 'PLAYING_XI').length;
}

export function isSquadFinalizedWithFullXi(
  squad: { isFinalized: boolean; players: readonly { role: string }[] } | null | undefined,
): boolean {
  if (!squad?.isFinalized) {
    return false;
  }
  return countPlayingXiStarters(squad.players) === PLAYING_XI_SIZE;
}

export function buildMatchPlayingXiFinalizationStatus(input: {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  squads: readonly {
    teamId: string;
    isFinalized: boolean;
    players: readonly { role: string }[];
  }[];
  /** When Team B is an external opponent (no awayTeamId), use player count instead of a squad row. */
  externalOpponentPlayerCount?: number;
}): MatchPlayingXiFinalizationStatus {
  const hasExternalOpponent =
    input.awayTeamId == null && input.externalOpponentPlayerCount !== undefined;
  const homeSquad = input.homeTeamId
    ? input.squads.find((squad) => squad.teamId === input.homeTeamId)
    : undefined;
  const awaySquad = input.awayTeamId
    ? input.squads.find((squad) => squad.teamId === input.awayTeamId)
    : undefined;
  const homeTeamFinalized = isSquadFinalizedWithFullXi(homeSquad);
  const awayTeamFinalized = hasExternalOpponent
    ? (input.externalOpponentPlayerCount ?? 0) === PLAYING_XI_SIZE
    : isSquadFinalizedWithFullXi(awaySquad);
  return {
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    homeTeamName: input.homeTeamName,
    awayTeamName: input.awayTeamName,
    homeTeamFinalized,
    awayTeamFinalized,
    bothTeamsFinalized: homeTeamFinalized && awayTeamFinalized,
  };
}

/**
 * Match-setup checkbox "Does Opposite team is ACC team?" (checked).
 * Persisted as a registered Team B (`awayTeamId`); both sides use the normal two-team Playing 11 flow.
 */
export function isAccRegisteredOpponent(match: { awayTeamId: string | null }): boolean {
  return match.awayTeamId != null;
}

/**
 * Match-setup checkbox unchecked — Team B is external (ACC §9.5).
 * Persisted as `awayTeamId = null` + free-text `externalOpponentName` (no Team record).
 */
export function isExternalOpponentMatch(match: {
  awayTeamId: string | null;
  externalOpponentName?: string | null;
}): boolean {
  return !isAccRegisteredOpponent(match) && Boolean(match.externalOpponentName?.trim());
}

/** Scorer dashboard primary action label from per-team finalization state. */
export function scorerVerifyPlayingXiButtonLabel(
  status: Pick<
    MatchPlayingXiFinalizationStatus,
    'homeTeamName' | 'awayTeamName' | 'homeTeamFinalized' | 'awayTeamFinalized' | 'awayTeamId'
  >,
): string {
  const externalOpponent = status.awayTeamId == null;
  if (status.homeTeamFinalized && status.awayTeamFinalized) {
    return 'Start Match';
  }
  if (!status.homeTeamFinalized && !status.awayTeamFinalized) {
    return externalOpponent ? 'Set Up Playing 11' : 'Verify Playing 11';
  }
  if (!status.homeTeamFinalized) {
    return `Verify ${status.homeTeamName}'s Playing 11`;
  }
  if (externalOpponent) {
    return 'Add Opponent Team Players';
  }
  return `Verify ${status.awayTeamName}'s Playing 11`;
}

export function unfinalizedTeamForScorerVerify(
  status: MatchPlayingXiFinalizationStatus,
): MatchTeamFinalizationSummary | null {
  if (status.bothTeamsFinalized) {
    return null;
  }
  if (!status.homeTeamFinalized && status.homeTeamId) {
    return {
      teamId: status.homeTeamId,
      teamName: status.homeTeamName,
      isFinalized: false,
    };
  }
  if (!status.awayTeamFinalized && status.awayTeamId) {
    return {
      teamId: status.awayTeamId,
      teamName: status.awayTeamName,
      isFinalized: false,
    };
  }
  return null;
}

export type ScorerStartMatchBlockReason = 'PLAYING_XI' | 'TOO_EARLY';

/** Combined scorer Start Match gate: finalized squads + venue-local 30-minute window. */
export function buildScorerStartMatchAvailability(input: {
  matchDate: Date | string | null;
  startTime: Date | string | null;
  timeZone: string;
  bothTeamsFinalized: boolean;
  now?: Date;
}): {
  canStartMatch: boolean;
  startAllowedAt: string | null;
  startAllowedAtLine: string | null;
  blockedReason: ScorerStartMatchBlockReason | null;
} {
  const schedule = { matchDate: input.matchDate, startTime: input.startTime };
  const allowedAt = computeLiveStartAllowedAt(schedule);
  const startAllowedAt = allowedAt?.toISOString() ?? null;
  const startAllowedAtLine = formatLiveStartAllowedAtLine(schedule, input.timeZone);
  const now = input.now ?? new Date();

  if (!input.bothTeamsFinalized) {
    return {
      canStartMatch: false,
      startAllowedAt,
      startAllowedAtLine,
      blockedReason: 'PLAYING_XI',
    };
  }
  if (!isLiveStartTimeWindowOpen(schedule, now)) {
    return {
      canStartMatch: false,
      startAllowedAt,
      startAllowedAtLine,
      blockedReason: 'TOO_EARLY',
    };
  }
  return {
    canStartMatch: true,
    startAllowedAt,
    startAllowedAtLine,
    blockedReason: null,
  };
}

/** Dashboard hint when Start Match is disabled by the time window. */
export function scorerStartMatchDisabledHint(
  blockedReason: ScorerStartMatchBlockReason | null,
  startAllowedAtLine: string | null,
): string | null {
  if (blockedReason !== 'TOO_EARLY') {
    return null;
  }
  return startAllowedAtLine
    ? `Available ${startAllowedAtLine} (30 min before start)`
    : 'Available 30 minutes before scheduled start';
}

/** Pre-match states where Playing XI can be finalized or edited. */
export const PLAYING_XI_FINALIZE_STATES = [
  'SCHEDULED',
  'PLAYING_XI_LOCKED',
  'TOSS_COMPLETED',
  'DELAYED',
] as const;

export interface FinalizeBothPlayingXiRequest {
  teams: readonly {
    teamId: string;
    playingXi: readonly string[];
    substitutes: readonly string[];
    impactCandidates?: readonly string[];
    activeImpactUserId?: string | null;
  }[];
}
