import {
  isAplTournamentType,
  MATCH_END_STATES,
  normalizeTeamPairKey,
  QualificationReadinessStatus,
  type KnockoutQualificationResponse,
} from '@acc/types';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StandingsService } from '../standings/standings.service';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { groupStageMatchesForTournament } from './group-stage-match-query';
import {
  computeKnockoutQualification,
  type HeadToHeadWinnerLookup,
} from './knockout-qualification.compute';

interface GroupStageMatchHeadToHeadRow {
  homeTeamId: string | null;
  awayTeamId: string | null;
  winningTeamId: string | null;
  isNoResult: boolean;
}

@Injectable()
export class KnockoutQualificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly standings: StandingsService,
  ) {}

  async getQualification(tournamentId: string): Promise<KnockoutQualificationResponse> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        isDeleted: true,
        type: true,
        knockoutTeamCount: true,
        _count: { select: { groups: true } },
      },
    });
    assertTournamentActive(tournament);

    if (!isAplTournamentType(tournament.type)) {
      return { status: QualificationReadinessStatus.NotApplicable };
    }

    if (tournament.knockoutTeamCount == null) {
      return { status: QualificationReadinessStatus.NotConfigured };
    }

    const groupStageWhere = groupStageMatchesForTournament(tournamentId);
    const [scheduledGroupMatchCount, incompleteGroupMatchCount] = await Promise.all([
      this.prisma.match.count({ where: groupStageWhere }),
      this.prisma.match.count({
        where: {
          ...groupStageWhere,
          state: { notIn: [...MATCH_END_STATES] },
        },
      }),
    ]);

    if (scheduledGroupMatchCount === 0 || incompleteGroupMatchCount > 0) {
      return {
        status: QualificationReadinessStatus.NotReady,
        incompleteGroupMatchCount,
        scheduledGroupMatchCount,
      };
    }

    const [standingsResult, headToHeadMatches] = await Promise.all([
      this.standings.getStandings(tournamentId),
      this.prisma.match.findMany({
        where: {
          ...groupStageWhere,
          state: { in: [...MATCH_END_STATES] },
        },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          winningTeamId: true,
          isNoResult: true,
        },
      }),
    ]);

    const groups = standingsResult.tables
      .filter((table) => table.groupId != null)
      .map((table) => ({
        groupId: table.groupId!,
        teams: table.teams,
      }));

    if (groups.length === 0) {
      throw new NotFoundException({
        message: 'Tournament has no groups for qualification',
        error: 'NO_GROUPS',
      });
    }

    const headToHeadWinner = buildHeadToHeadWinnerLookup(headToHeadMatches);
    const { qualifiedTeams, ties } = computeKnockoutQualification({
      knockoutTeamCount: tournament.knockoutTeamCount,
      groups,
      headToHeadWinner,
    });

    return {
      status: QualificationReadinessStatus.Ready,
      knockoutTeamCount: tournament.knockoutTeamCount,
      groupCount: tournament._count.groups,
      qualifiedTeams,
      ties,
    };
  }
}

function buildHeadToHeadWinnerLookup(
  matches: readonly GroupStageMatchHeadToHeadRow[],
): HeadToHeadWinnerLookup {
  const winnersByPair = new Map<string, string>();

  for (const match of matches) {
    const { homeTeamId, awayTeamId, winningTeamId, isNoResult } = match;
    if (!homeTeamId || !awayTeamId || !winningTeamId || isNoResult) {
      continue;
    }
    if (winningTeamId !== homeTeamId && winningTeamId !== awayTeamId) {
      continue;
    }
    winnersByPair.set(normalizeTeamPairKey(homeTeamId, awayTeamId), winningTeamId);
  }

  return (teamAId: string, teamBId: string): string | null => {
    const winner = winnersByPair.get(normalizeTeamPairKey(teamAId, teamBId));
    return winner ?? null;
  };
}
