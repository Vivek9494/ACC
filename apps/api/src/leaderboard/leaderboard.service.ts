import { LIVE_MATCH_STATES, MatchState, type TournamentLeaderboard, type TournamentStatsView } from '@acc/types';
import { Injectable } from '@nestjs/common';

import { LiveService } from '../live/live.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { assertTournamentActive } from '../tournaments/tournament-query';
import {
  applyBatterInnings,
  applyBowlerInnings,
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

const TOURNAMENT_STATS_MATCH_STATES: MatchState[] = [
  MatchState.Live,
  MatchState.RainInterrupted,
  MatchState.Completed,
  MatchState.ScorecardLocked,
];

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
    private readonly live: LiveService,
  ) {}

  async getLeaderboard(
    tournamentId: string,
    teamId?: string | null,
  ): Promise<TournamentLeaderboard> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: {
          select: { id: true, name: true, logoUrl: true },
          orderBy: { name: 'asc' },
        },
        matches: {
          where: {
            isDeleted: false,
            state: { in: LEADERBOARD_MATCH_STATES },
          },
          orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    assertTournamentActive(tournament);

    const teams = tournament.teams.map((team) => ({
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
    }));

    if (teamId && !tournament.teams.some((team) => team.id === teamId)) {
      return {
        tournamentId,
        hasRecords: false,
        teams,
        ...EMPTY_LEADERBOARD,
      };
    }

    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        tournamentId,
        ...(teamId ? { teamId } : {}),
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

    for (const match of tournament.matches) {
      const scorecard = await this.scorecards.build(match);
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
          applyBatterInnings(acc, match.id, batter);
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
          applyBowlerInnings(acc, match.id, bowler);
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
        if (!acc || acc.bowledMatchIds.size === 0) {
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

    const battingEntries = buildBattingLeaderboardEntries(
      await this.mediaUrls.resolveProfilePhotoUrls(battingPlayers),
    );
    const bowlingEntries = buildBowlingLeaderboardEntries(
      await this.mediaUrls.resolveProfilePhotoUrls(bowlingPlayers),
    );

    return {
      tournamentId,
      hasRecords: battingEntries.length > 0 || bowlingEntries.length > 0,
      teams,
      batting: { entries: battingEntries },
      bowling: { entries: bowlingEntries },
    };
  }

  async getTournamentStats(tournamentId: string): Promise<TournamentStatsView> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        matches: {
          where: {
            isDeleted: false,
            state: { in: TOURNAMENT_STATS_MATCH_STATES },
          },
          orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    assertTournamentActive(tournament);

    const memberships = await this.prisma.teamMembership.findMany({
      where: { tournamentId },
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

    for (const match of tournament.matches) {
      const scorecard = await this.resolveStatsScorecard(match);
      foldScorecardIntoTournamentStats(acc, scorecard, membershipUserIds);
    }

    const boundaryPlayers = memberships.map((membership) => ({
      userId: membership.userId,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      profilePhotoUrl: membership.user.profilePhotoUrl,
      teamId: membership.team.id,
      teamName: membership.team.name,
    }));

    const resolvedPlayers = await this.mediaUrls.resolveProfilePhotoUrls(boundaryPlayers);

    const mostSixes = buildBoundaryLeaderboardEntries(
      resolvedPlayers.map((player) => ({
        ...player,
        count: acc.playerSixes.get(player.userId) ?? 0,
      })),
    );

    const mostFours = buildBoundaryLeaderboardEntries(
      resolvedPlayers.map((player) => ({
        ...player,
        count: acc.playerFours.get(player.userId) ?? 0,
      })),
    );

    return {
      tournamentId,
      hasRecords: tournamentStatsHasScoring(acc),
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

  private async resolveStatsScorecard(
    match: Parameters<ScorecardReader['build']>[0],
  ): Promise<Awaited<ReturnType<ScorecardReader['build']>>> {
    if (LIVE_MATCH_STATES.includes(match.state as MatchState)) {
      const cached = await this.live.getCached(match.id);
      if (cached) {
        return cached;
      }
    }
    return this.scorecards.build(match);
  }
}
