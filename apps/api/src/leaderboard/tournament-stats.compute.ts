import type { ScorecardResponse } from '@acc/types';
import type { TournamentBoundaryLeaderboardEntry } from '@acc/types';

export interface TournamentStatsAccumulators {
  totalRuns: number;
  totalWickets: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  fifers: number;
  playerFours: Map<string, number>;
  playerSixes: Map<string, number>;
}

export function createTournamentStatsAccumulators(): TournamentStatsAccumulators {
  return {
    totalRuns: 0,
    totalWickets: 0,
    fours: 0,
    sixes: 0,
    fifties: 0,
    hundreds: 0,
    fifers: 0,
    playerFours: new Map(),
    playerSixes: new Map(),
  };
}

/**
 * Fold one match scorecard into running tournament totals.
 * When `teamId` is set: runs/boundaries/milestones from batting innings for that team;
 * wickets/fifers from bowling innings for that team.
 */
export function foldScorecardIntoTournamentStats(
  acc: TournamentStatsAccumulators,
  scorecard: ScorecardResponse,
  membershipUserIds: ReadonlySet<string>,
  teamId?: string | null,
): void {
  for (const innings of scorecard.innings) {
    const isBattingTeam = teamId == null || innings.battingTeamId === teamId;
    const isBowlingTeam = teamId == null || innings.bowlingTeamId === teamId;

    if (isBattingTeam) {
      acc.totalRuns += innings.runs;
    }
    if (isBowlingTeam) {
      acc.totalWickets += innings.wickets;
    }

    if (isBattingTeam) {
      for (const batter of innings.batters) {
        acc.fours += batter.fours;
        acc.sixes += batter.sixes;

        if (batter.runs >= 100) {
          acc.hundreds += 1;
        } else if (batter.runs >= 50) {
          acc.fifties += 1;
        }

        if (!membershipUserIds.has(batter.playerId)) {
          continue;
        }

        acc.playerFours.set(
          batter.playerId,
          (acc.playerFours.get(batter.playerId) ?? 0) + batter.fours,
        );
        acc.playerSixes.set(
          batter.playerId,
          (acc.playerSixes.get(batter.playerId) ?? 0) + batter.sixes,
        );
      }
    }

    if (isBowlingTeam) {
      for (const bowler of innings.bowlers) {
        if (bowler.wickets >= 5) {
          acc.fifers += 1;
        }
      }
    }
  }
}

export interface BuildBoundaryLeaderboardPlayerInput {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  teamId: string;
  teamName: string;
  count: number;
}

/** Top N by boundary count; tie-break alphabetically by name. */
export function buildBoundaryLeaderboardEntries(
  players: BuildBoundaryLeaderboardPlayerInput[],
  limit = 5,
): TournamentBoundaryLeaderboardEntry[] {
  const sorted = [...players]
    .filter((player) => player.count > 0)
    .sort((left, right) => {
      const countDiff = right.count - left.count;
      if (countDiff !== 0) {
        return countDiff;
      }
      const leftName = `${left.lastName} ${left.firstName}`.trim();
      const rightName = `${right.lastName} ${right.firstName}`.trim();
      return leftName.localeCompare(rightName);
    })
    .slice(0, limit);

  return sorted.map((player, index) => ({
    rank: index + 1,
    userId: player.userId,
    firstName: player.firstName,
    lastName: player.lastName,
    profilePhotoUrl: player.profilePhotoUrl,
    teamId: player.teamId,
    teamName: player.teamName,
    count: player.count,
  }));
}

export function tournamentStatsHasScoring(acc: TournamentStatsAccumulators): boolean {
  return (
    acc.totalRuns > 0 ||
    acc.totalWickets > 0 ||
    acc.fours > 0 ||
    acc.sixes > 0 ||
    acc.fifties > 0 ||
    acc.hundreds > 0 ||
    acc.fifers > 0
  );
}
