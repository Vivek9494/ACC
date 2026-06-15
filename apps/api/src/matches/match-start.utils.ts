import { MatchSide, TossDecision, formatUtcIsoDate } from '@acc/types';

/** States where a scorer may still open the pre-scoring setup flow. */
export const SCORER_STARTABLE_MATCH_STATES = [
  'SCHEDULED',
  'PLAYING_XI_LOCKED',
  'TOSS_COMPLETED',
  'DELAYED',
] as const;

/** True when the fixture calendar day is today (UTC), using matchDate or startTime. */
export function isScorerMatchDayToday(match: {
  matchDate: Date | null;
  startTime: Date | null;
}): boolean {
  const today = formatUtcIsoDate(new Date());
  if (match.matchDate) {
    return formatUtcIsoDate(match.matchDate) === today;
  }
  if (match.startTime) {
    return formatUtcIsoDate(match.startTime) === today;
  }
  return false;
}

export function formatScorerMatchDateTimeLine(match: {
  matchDate: Date | null;
  startTime: Date | null;
}): string {
  const instant = match.startTime ?? match.matchDate;
  if (!instant) {
    return '—';
  }
  const datePart = instant
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase();
  if (!match.startTime) {
    return datePart;
  }
  const timePart = match.startTime
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    })
    .toUpperCase();
  return `${datePart} • ${timePart}`;
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
