import {
  formatMatchDateTimeLine,
  isMatchDayTodayInZone,
  MatchSide,
  serverVenueTimezone,
  TossDecision,
} from '@acc/types';

/** States where a scorer may still open the pre-scoring setup flow. */
export const SCORER_STARTABLE_MATCH_STATES = [
  'SCHEDULED',
  'PLAYING_XI_LOCKED',
  'TOSS_COMPLETED',
  'DELAYED',
] as const;

/** In-progress states where the scorer dashboard shows "Continue Scoring". */
export const SCORER_IN_PROGRESS_MATCH_STATES = ['LIVE', 'RAIN_INTERRUPTED'] as const;

/** All match states that surface the scorer dashboard card on match day. */
export const SCORER_DASHBOARD_CARD_STATES = [
  ...SCORER_STARTABLE_MATCH_STATES,
  ...SCORER_IN_PROGRESS_MATCH_STATES,
] as const;

/** Scheduled kickoff instant — prefers startTime, falls back to matchDate (§11.1). */
export function matchScheduledInstant(match: {
  matchDate: Date | null;
  startTime: Date | null;
}): Date | null {
  return match.startTime ?? match.matchDate;
}

/** True when the fixture calendar day is today in the venue timezone. */
export function isScorerMatchDayToday(
  match: {
    matchDate: Date | null;
    startTime: Date | null;
  },
  tournamentTimezone: string | null | undefined = null,
): boolean {
  const timeZone = serverVenueTimezone(tournamentTimezone);
  if (!matchScheduledInstant(match)) {
    return false;
  }
  return isMatchDayTodayInZone(match, timeZone);
}

const SCORER_ASSIGNMENT_LEAD_MS = 2 * 60 * 60 * 1000;

/**
 * Captain scorer-assignment card window (§11.1): match day, from 2 hours before
 * scheduled start until the fixture leaves pre-live states (handled by caller).
 */
export function isWithinScorerAssignmentWindow(
  match: { matchDate: Date | null; startTime: Date | null },
  now: Date = new Date(),
  tournamentTimezone: string | null | undefined = null,
): boolean {
  if (!isScorerMatchDayToday(match, tournamentTimezone)) {
    return false;
  }
  const instant = matchScheduledInstant(match);
  if (!instant) {
    return false;
  }
  const windowOpens = new Date(instant.getTime() - SCORER_ASSIGNMENT_LEAD_MS);
  return now >= windowOpens;
}

export function formatScorerMatchDateTimeLine(
  match: {
    matchDate: Date | null;
    startTime: Date | null;
  },
  tournamentTimezone: string | null | undefined = null,
  options: { includeZoneAbbrev?: boolean } = {},
): string {
  const timeZone = serverVenueTimezone(tournamentTimezone);
  return formatMatchDateTimeLine(match, timeZone, options);
}

export function deriveInningsTeamsFromToss(
  match: {
    homeTeamId: string | null;
    awayTeamId: string | null;
    externalOpponentName: string | null;
  },
  tossWinner: MatchSide,
  tossDecision: TossDecision,
): {
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  battingIsExternal: boolean;
  bowlingIsExternal: boolean;
} {
  const teamAId = match.homeTeamId;
  const teamBId = match.awayTeamId;
  const teamBIsExternal = teamBId == null && Boolean(match.externalOpponentName?.trim());

  const winnerIsTeamA = tossWinner === MatchSide.TeamA;
  const winnerTeamId = winnerIsTeamA ? teamAId : teamBId;
  const loserTeamId = winnerIsTeamA ? teamBId : teamAId;
  const winnerIsExternal = winnerIsTeamA ? false : teamBIsExternal;
  const loserIsExternal = winnerIsTeamA ? teamBIsExternal : false;

  if (tossDecision === TossDecision.Bat) {
    return {
      battingTeamId: winnerTeamId,
      bowlingTeamId: loserTeamId,
      battingIsExternal: winnerIsExternal,
      bowlingIsExternal: loserIsExternal,
    };
  }

  return {
    battingTeamId: loserTeamId,
    bowlingTeamId: winnerTeamId,
    battingIsExternal: loserIsExternal,
    bowlingIsExternal: winnerIsExternal,
  };
}
