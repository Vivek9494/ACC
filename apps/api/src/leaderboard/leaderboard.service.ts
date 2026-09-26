import {
  BallType,
  MatchSquadRole,
  MatchState,
  filterAccFixedTeamsInTournament,
  type AuthUser,
  type TournamentLeaderboard,
  type TournamentStatsView,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { SCORECARD_BUILD_CONCURRENCY } from '../stats/tournament-aggregates-cache.service';
import { TournamentAggregatesCacheService } from '../stats/tournament-aggregates-cache.service';
import { mapPool } from '../stats/map-pool';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { TennisTournamentVisibilityService } from '../tournaments/tennis-tournament-visibility.service';
import { activeTeamWhere } from '../teams/team-query';
import { activeTeamMembershipWhere } from '../teams/team-membership-query';
import {
  applyBatterInnings,
  applyBowlerInnings,
  applyBowlingXiMatch,
  buildBattingLeaderboardEntries,
  buildBowlingLeaderboardEntries,
  createBattingAccumulator,
  createBowlingAccumulator,
  type BattingAccumulator,
  type BowlingAccumulator,
} from './leaderboard.compute';
import {
  buildBoundaryLeaderboardEntries,
  createTournamentStatsAccumulators,
  foldScorecardIntoTournamentStats,
  tournamentStatsHasScoring,
} from './tournament-stats.compute';

const LEADERBOARD_MATCH_STATES: MatchState[] = [
  MatchState.Completed,
  MatchState.ScorecardLocked,
];

/**
 * Option B: cached tournament-stats exclude Live / RainInterrupted — those
 * matches contribute only after completion (via invalidation).
 */
const TOURNAMENT_STATS_MATCH_STATES: MatchState[] = [
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
  MatchState.Cancelled,
];

const EMPTY_STATS_AGGREGATES = {
  totalRuns: 0,
  totalWickets: 0,
  sixes: 0,
  fours: 0,
  fifties: 0,
  hundreds: 0,
  fifers: 0,
};

const EMPTY_LEADERBOARD = {
  batting: { entries: [] },
  bowling: { entries: [] },
};

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecards: ScorecardReader,
    private readonly mediaUrls: MediaUrlResolver,
    private readonly tennisVisibility: TennisTournamentVisibilityService,
    private readonly aggregatesCache: TournamentAggregatesCacheService,
  ) {}

  async getLeaderboard(
    tournamentId: string,
    teamId?: string | null,
    viewer: AuthUser | null = null,
  ): Promise<TournamentLeaderboard> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    assertTournamentActive(tournament);
    await this.tennisVisibility.assertCanViewCenterLevelTournament(viewer, tournament, {
      allowUnauthenticated: true,
    });

    const cached = await this.aggregatesCache.getLeaderboard<TournamentLeaderboard>(
      tournamentId,
      teamId,
    );
    if (cached) {
      return this.resolveLeaderboardMedia(cached);
    }

    const teams = await this.prisma.team.findMany({
      where: { tournamentId },
      select: { id: true, name: true, logoUrl: true },
      orderBy: { name: 'asc' },
    });
    const teamOptions = teams.map((team) => ({
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
    }));

    if (teamId && !teams.some((team) => team.id === teamId)) {
      return {
        tournamentId,
        hasRecords: false,
        teams: teamOptions,
        ...EMPTY_LEADERBOARD,
      };
    }

    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        isDeleted: false,
        state: { in: LEADERBOARD_MATCH_STATES },
      },
      orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
    });

    const computed = await this.computeLeaderboard(
      tournamentId,
      matches,
      teamOptions,
      teamId,
    );
    await this.aggregatesCache.setLeaderboard(tournamentId, teamId, computed);
    return this.resolveLeaderboardMedia(computed);
  }

  async getTournamentStats(
    tournamentId: string,
    teamId?: string | null,
    viewer: AuthUser | null = null,
  ): Promise<TournamentStatsView> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    assertTournamentActive(tournament);
    await this.tennisVisibility.assertCanViewCenterLevelTournament(viewer, tournament, {
      allowUnauthenticated: true,
    });

    const cached = await this.aggregatesCache.getTournamentStats<TournamentStatsView>(
      tournamentId,
      teamId,
    );
    if (cached) {
      return this.resolveTournamentStatsMedia(cached);
    }

    const allTeams = await this.prisma.team.findMany({
      where: { tournamentId, ...activeTeamWhere },
      select: { id: true, name: true, logoUrl: true },
      orderBy: { name: 'asc' },
    });

    const isLeather = tournament.ballType === BallType.Leather;
    const statsTeams = isLeather
      ? filterAccFixedTeamsInTournament(allTeams)
      : allTeams;
    const allowedTeamIds = isLeather
      ? new Set(statsTeams.map((team) => team.id))
      : null;

    const teams = statsTeams.map((team) => ({
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
    }));

    if (teamId && !statsTeams.some((team) => team.id === teamId)) {
      return {
        tournamentId,
        hasRecords: false,
        teams,
        aggregates: EMPTY_STATS_AGGREGATES,
        mostSixes: [],
        mostFours: [],
      };
    }

    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        isDeleted: false,
        state: { in: TOURNAMENT_STATS_MATCH_STATES },
      },
      orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
    });

    const computed = await this.computeTournamentStats(
      tournamentId,
      matches,
      teams,
      teamId,
      allowedTeamIds,
    );
    await this.aggregatesCache.setTournamentStats(tournamentId, teamId, computed);
    return this.resolveTournamentStatsMedia(computed);
  }

  private async computeLeaderboard(
    tournamentId: string,
    matches: Match[],
    teams: TournamentLeaderboard['teams'],
    teamId?: string | null,
  ): Promise<TournamentLeaderboard> {
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        tournamentId,
        ...(teamId ? { teamId } : {}),
        ...activeTeamMembershipWhere,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
      },
    });

    const membershipByUserId = new Map(memberships.map((row) => [row.userId, row]));
    const battingAccumulators = new Map<string, BattingAccumulator>();
    const bowlingAccumulators = new Map<string, BowlingAccumulator>();

    const scorecards = await mapPool(matches, SCORECARD_BUILD_CONCURRENCY, (match) =>
      this.scorecards.build(match),
    );

    for (const scorecard of scorecards) {
      for (const innings of scorecard.innings) {
        for (const batter of innings.batters) {
          const membership = membershipByUserId.get(batter.playerId);
          if (!membership) {
            continue;
          }
          let acc = battingAccumulators.get(batter.playerId);
          if (!acc) {
            acc = createBattingAccumulator();
            battingAccumulators.set(batter.playerId, acc);
          }
          applyBatterInnings(acc, scorecard.matchId, batter);
        }

        for (const bowler of innings.bowlers) {
          const membership = membershipByUserId.get(bowler.playerId);
          if (!membership) {
            continue;
          }
          let acc = bowlingAccumulators.get(bowler.playerId);
          if (!acc) {
            acc = createBowlingAccumulator();
            bowlingAccumulators.set(bowler.playerId, acc);
          }
          applyBowlerInnings(acc, scorecard.matchId, bowler);
        }
      }
    }

    if (matches.length > 0 && bowlingAccumulators.size > 0) {
      const xiRows = await this.prisma.matchSquadPlayer.findMany({
        where: {
          role: MatchSquadRole.PlayingXi,
          userId: { in: [...bowlingAccumulators.keys()] },
          squad: {
            matchId: { in: matches.map((match) => match.id) },
          },
        },
        select: {
          userId: true,
          squad: { select: { matchId: true } },
        },
      });
      for (const row of xiRows) {
        const acc = bowlingAccumulators.get(row.userId);
        if (acc) {
          applyBowlingXiMatch(acc, row.squad.matchId);
        }
      }
    }

    const battingPlayers = memberships
      .map((membership) => {
        const acc = battingAccumulators.get(membership.userId);
        if (!acc || acc.battedMatchIds.size === 0) {
          return null;
        }
        return {
          userId: membership.userId,
          firstName: membership.user.firstName,
          lastName: membership.user.lastName,
          profilePhotoUrl: membership.user.profilePhotoUrl,
          teamId: membership.team.id,
          teamName: membership.team.name,
          teamLogoUrl: membership.team.logoUrl,
          accumulator: acc,
        };
      })
      .filter((player): player is NonNullable<typeof player> => player != null);

    const bowlingPlayers = memberships
      .map((membership) => {
        const acc = bowlingAccumulators.get(membership.userId);
        if (!acc || acc.innings === 0) {
          return null;
        }
        return {
          userId: membership.userId,
          firstName: membership.user.firstName,
          lastName: membership.user.lastName,
          profilePhotoUrl: membership.user.profilePhotoUrl,
          teamId: membership.team.id,
          teamName: membership.team.name,
          teamLogoUrl: membership.team.logoUrl,
          accumulator: acc,
        };
      })
      .filter((player): player is NonNullable<typeof player> => player != null);

    // Cache storage keys (not presigned URLs). Resolve on every response.
    const battingEntries = buildBattingLeaderboardEntries(battingPlayers);
    const bowlingEntries = buildBowlingLeaderboardEntries(bowlingPlayers);

    return {
      tournamentId,
      hasRecords: battingEntries.length > 0 || bowlingEntries.length > 0,
      teams,
      batting: { entries: battingEntries },
      bowling: { entries: bowlingEntries },
    };
  }

  private async computeTournamentStats(
    tournamentId: string,
    matches: Match[],
    teams: TournamentStatsView['teams'],
    teamId: string | null | undefined,
    allowedTeamIds: Set<string> | null,
  ): Promise<TournamentStatsView> {
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        tournamentId,
        ...(teamId
          ? { teamId }
          : allowedTeamIds
            ? { teamId: { in: [...allowedTeamIds] } }
            : {}),
        team: activeTeamWhere,
        ...activeTeamMembershipWhere,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const membershipUserIds = new Set(memberships.map((row) => row.userId));
    const acc = createTournamentStatsAccumulators();

    const scorecards = await mapPool(matches, SCORECARD_BUILD_CONCURRENCY, (match) =>
      this.scorecards.build(match),
    );

    for (const scorecard of scorecards) {
      foldScorecardIntoTournamentStats(
        acc,
        scorecard,
        membershipUserIds,
        teamId,
        allowedTeamIds,
      );
    }

    const boundaryPlayers = memberships.map((membership) => ({
      userId: membership.userId,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      profilePhotoUrl: membership.user.profilePhotoUrl,
      teamId: membership.team.id,
      teamName: membership.team.name,
    }));

    const mostSixes = buildBoundaryLeaderboardEntries(
      boundaryPlayers.map((player) => ({
        ...player,
        count: acc.playerSixes.get(player.userId) ?? 0,
        runs: acc.playerRuns.get(player.userId) ?? 0,
      })),
    );

    const mostFours = buildBoundaryLeaderboardEntries(
      boundaryPlayers.map((player) => ({
        ...player,
        count: acc.playerFours.get(player.userId) ?? 0,
        runs: acc.playerRuns.get(player.userId) ?? 0,
      })),
    );

    return {
      tournamentId,
      hasRecords: tournamentStatsHasScoring(acc),
      teams,
      aggregates: {
        totalRuns: acc.totalRuns,
        totalWickets: acc.totalWickets,
        sixes: acc.sixes,
        fours: acc.fours,
        fifties: acc.fifties,
        hundreds: acc.hundreds,
        fifers: acc.fifers,
      },
      mostSixes,
      mostFours,
    };
  }

  private async resolveLeaderboardMedia(
    board: TournamentLeaderboard,
  ): Promise<TournamentLeaderboard> {
    const [battingEntries, bowlingEntries] = await Promise.all([
      this.mediaUrls.resolveProfilePhotoUrls(board.batting.entries),
      this.mediaUrls.resolveProfilePhotoUrls(board.bowling.entries),
    ]);
    return {
      ...board,
      batting: { entries: battingEntries },
      bowling: { entries: bowlingEntries },
    };
  }

  private async resolveTournamentStatsMedia(
    stats: TournamentStatsView,
  ): Promise<TournamentStatsView> {
    const [mostSixes, mostFours] = await Promise.all([
      this.mediaUrls.resolveProfilePhotoUrls(stats.mostSixes),
      this.mediaUrls.resolveProfilePhotoUrls(stats.mostFours),
    ]);
    return { ...stats, mostSixes, mostFours };
  }
}
