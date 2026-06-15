import { MatchSide, TossDecision } from '@acc/types';

/** Derive batting/bowling sides from toss outcome (§11.2). */
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
} {
  const teamBIsExternal = match.awayTeamId == null && Boolean(match.externalOpponentName?.trim());
  const winnerIsTeamA = tossWinner === MatchSide.TeamA;
  const winnerTeamId = winnerIsTeamA ? match.homeTeamId : match.awayTeamId;
  const loserTeamId = winnerIsTeamA ? match.awayTeamId : match.homeTeamId;

  if (tossDecision === TossDecision.Bat) {
    return { battingTeamId: winnerTeamId, bowlingTeamId: loserTeamId };
  }
  return { battingTeamId: loserTeamId, bowlingTeamId: winnerTeamId };
}

export function playingXiPlayers(
  squads: Array<{
    teamId: string;
    players: Array<{ userId: string; firstName: string; lastName: string; role: string }>;
  }>,
  teamId: string | null,
): Array<{ userId: string; label: string }> {
  if (!teamId) {
    return [];
  }
  const squad = squads.find((row) => row.teamId === teamId);
  if (!squad) {
    return [];
  }
  return squad.players
    .filter((player) => player.role === 'PLAYING_XI')
    .map((player) => ({
      userId: player.userId,
      label: `${player.firstName} ${player.lastName}`.trim(),
    }));
}
