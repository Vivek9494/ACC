import { MatchState, type TournamentLeaderboard } from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
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

const LEADERBOARD_MATCH_STATES: MatchState[] = [
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
}
