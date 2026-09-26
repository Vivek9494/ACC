import {
  BallType,
  MatchState,
  MatchSquadRole,
  type DashboardPlayerPerformance,
  type ManagerPlayerStats,
  type PlayerProfileCareerStats,
  type PlayerProfilePeriodStats,
  type PlayerProfileTournamentSummary,
  type PlayerProfileYearSummary,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { mapPool } from '../stats/map-pool';
import { PlayerCareerCacheService } from '../stats/player-career-cache.service';
import { SCORECARD_BUILD_CONCURRENCY } from '../stats/tournament-aggregates-cache.service';
import { activeTeamMembershipWhere } from '../teams/team-membership-query';
import { activeTournamentWhere } from '../tournaments/tournament-query';
import {
  applyMatchToPlayerStats,
  buildPlayerProfileCareerStats,
  buildPlayerProfilePeriodStats,
  createPlayerStatsAccumulator,
  type PlayerMatchStatsContext,
  type PlayerStatsAccumulator,
} from './player-stats.compute';

const PROFILE_MATCH_STATES: MatchState[] = [MatchState.Completed, MatchState.ScorecardLocked];

export interface PlayerCareerStatsBundle {
  career: PlayerProfileCareerStats;
  byYear: PlayerProfileYearSummary[];
  byTournament: PlayerProfileTournamentSummary[];
}

@Injectable()
export class PlayerStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecards: ScorecardReader,
    private readonly careerCache: PlayerCareerCacheService,
  ) {}

  /** Dashboard “Your Performance” — Matches / Runs / Wickets per ball type. */
  async buildDashboardHighLevelStats(userId: string): Promise<DashboardPlayerPerformance> {
    const [leather, tennis] = await Promise.all([
      this.buildCareerStats(userId, BallType.Leather),
      this.buildCareerStats(userId, BallType.Tennis),
    ]);
    return {
      leather: toManagerPlayerStats(leather.career),
      tennis: toManagerPlayerStats(tennis.career),
    };
  }

  /**
   * True when the player has leather involvement: locked XI on any leather match,
   * active leather roster, or registration for a leather tournament.
   */
  async hasLeatherParticipation(userId: string): Promise<boolean> {
    const [lockedXi, activeRoster, registered] = await Promise.all([
      this.prisma.matchSquadPlayer.findFirst({
        where: {
          userId,
          squad: {
            match: {
              isDeleted: false,
              tournament: { ballType: BallType.Leather, isDeleted: false },
            },
          },
        },
        select: { id: true },
      }),
      this.prisma.teamMembership.findFirst({
        where: {
          userId,
          ...activeTeamMembershipWhere,
          tournament: { ballType: BallType.Leather, ...activeTournamentWhere },
        },
        select: { id: true },
      }),
      this.prisma.registration.findFirst({
        where: {
          userId,
          tournament: { ballType: BallType.Leather, isDeleted: false },
        },
        select: { id: true },
      }),
    ]);
    return lockedXi != null || activeRoster != null || registered != null;
  }

  async buildCareerStats(userId: string, ballType: BallType): Promise<PlayerCareerStatsBundle> {
    const cached = await this.careerCache.get<PlayerCareerStatsBundle>(userId, ballType);
    if (cached) {
      return cached;
    }
    const computed = await this.computeCareerStats(userId, ballType);
    await this.careerCache.set(userId, ballType, computed);
    return computed;
  }

  private async computeCareerStats(
    userId: string,
    ballType: BallType,
  ): Promise<PlayerCareerStatsBundle> {
    const appearances = await this.prisma.matchSquadPlayer.findMany({
      where: {
        userId,
        role: MatchSquadRole.PlayingXi,
        squad: {
          match: {
            isDeleted: false,
            state: { in: PROFILE_MATCH_STATES },
            tournament: { ...activeTournamentWhere, ballType },
          },
        },
      },
      select: {
        squad: {
          select: {
            teamId: true,
            team: { select: { name: true } },
            match: {
              include: {
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
                tournament: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const uniqueByMatch = new Map<string, (typeof appearances)[number]>();
    for (const row of appearances) {
      uniqueByMatch.set(row.squad.match.id, row);
    }
    const rows = [...uniqueByMatch.values()];
    const scorecards = await mapPool(rows, SCORECARD_BUILD_CONCURRENCY, (row) =>
      this.scorecards.build(row.squad.match),
    );

    const careerAcc = createPlayerStatsAccumulator();
    const byYear = new Map<number, PlayerStatsAccumulator>();
    const byTournament = new Map<
      string,
      { acc: PlayerStatsAccumulator; tournamentName: string; year: number; teamName: string }
    >();

    for (const [index, row] of rows.entries()) {
      const { match } = row.squad;
      const scorecard = scorecards[index]!;
      const year = resolveMatchYear(match.matchDate);
      const opponentName = resolveOpponentName(match, row.squad.teamId);
      const context: PlayerMatchStatsContext = {
        matchId: match.id,
        matchDate: match.matchDate,
        opponentName,
        groundLocation: match.groundLocation,
        year,
      };

      applyMatchToPlayerStats(careerAcc, userId, context, scorecard);

      let yearAcc = byYear.get(year);
      if (!yearAcc) {
        yearAcc = createPlayerStatsAccumulator();
        byYear.set(year, yearAcc);
      }
      applyMatchToPlayerStats(yearAcc, userId, context, scorecard);

      let tournamentBucket = byTournament.get(match.tournamentId);
      if (!tournamentBucket) {
        tournamentBucket = {
          acc: createPlayerStatsAccumulator(),
          tournamentName: match.tournament.name,
          year,
          teamName: row.squad.team.name,
        };
        byTournament.set(match.tournamentId, tournamentBucket);
      }
      applyMatchToPlayerStats(tournamentBucket.acc, userId, context, scorecard);
    }

    const career = buildPlayerProfileCareerStats(careerAcc);

    const yearSummaries: PlayerProfileYearSummary[] = [...byYear.entries()]
      .sort(([left], [right]) => right - left)
      .map(([year, acc]) => ({
        year,
        stats: buildPlayerProfilePeriodStats(acc),
      }));

    const tournamentSummaries: PlayerProfileTournamentSummary[] = [...byTournament.entries()]
      .map(([tournamentId, bucket]) => ({
        tournamentId,
        tournamentName: bucket.tournamentName,
        year: bucket.year,
        teamName: bucket.teamName,
        stats: buildPlayerProfilePeriodStats(bucket.acc),
      }))
      .sort((left, right) => {
        const yearDiff = right.year - left.year;
        if (yearDiff !== 0) {
          return yearDiff;
        }
        return left.tournamentName.localeCompare(right.tournamentName);
      });

    return {
      career,
      byYear: yearSummaries,
      byTournament: tournamentSummaries,
    };
  }
}

function toManagerPlayerStats(career: PlayerProfileCareerStats): ManagerPlayerStats {
  return {
    matches: career.matches,
    runs: career.runs,
    wickets: career.wickets,
  };
}

function resolveMatchYear(matchDate: Date | null): number {
  if (!matchDate) {
    return new Date().getUTCFullYear();
  }
  return matchDate.getUTCFullYear();
}

function resolveOpponentName(
  match: {
    homeTeamId: string | null;
    awayTeamId: string | null;
    externalOpponentName: string | null;
    homeTeam: { name: string } | null;
    awayTeam: { name: string } | null;
  },
  playerTeamId: string,
): string | null {
  if (match.homeTeamId === playerTeamId) {
    return match.awayTeam?.name ?? match.externalOpponentName ?? null;
  }
  if (match.awayTeamId === playerTeamId) {
    return match.homeTeam?.name ?? null;
  }
  return match.externalOpponentName ?? match.awayTeam?.name ?? match.homeTeam?.name ?? null;
}

export type { PlayerProfilePeriodStats };
