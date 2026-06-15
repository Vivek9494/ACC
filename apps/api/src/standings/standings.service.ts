import {
  InningsType,
  MatchState,
  type StandingsInningsInput,
  type StandingsMatchInput,
  type TournamentStandings,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { computeStandings } from './standings.compute';
import { wasInningsAllOut } from './standings.nrr';

const STANDINGS_MATCH_STATES: MatchState[] = [
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

@Injectable()
export class StandingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecards: ScorecardReader,
  ) {}

  async getStandings(tournamentId: string): Promise<TournamentStandings> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: { select: { groups: true } },
        groups: {
          orderBy: { name: 'asc' },
          include: {
            teams: {
              select: { id: true },
              orderBy: { name: 'asc' },
            },
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            groupId: true,
          },
          orderBy: { name: 'asc' },
        },
        matches: {
          where: {
            isDeleted: false,
            state: { in: STANDINGS_MATCH_STATES },
          },
          orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    assertTournamentActive(tournament);

    const matchInputs: StandingsMatchInput[] = [];
    for (const match of tournament.matches) {
      const scorecard = await this.scorecards.build(match);
      const normalInnings: StandingsInningsInput[] = scorecard.innings
        .filter((inn) => inn.inningsType === InningsType.Normal)
        .map((inn) => ({
          battingTeamId: inn.battingTeamId,
          bowlingTeamId: inn.bowlingTeamId,
          runs: inn.runs,
          legalBalls: inn.legalBalls,
          wasAllOut: wasInningsAllOut(inn.closeReason),
          oversAllotted: inn.oversAllotted,
        }));

      matchInputs.push({
        matchId: match.id,
        groupId: match.groupId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        isNoResult:
          match.state === MatchState.NoResult ||
          match.isNoResult ||
          scorecard.result.isNoResult,
        winningTeamId:
          match.winningTeamId ??
          (scorecard.result.decided ? scorecard.result.winningTeamId : null),
        requiresSuperOver: scorecard.result.superOverRequired,
        innings: normalInnings,
      });
    }

    const { tables, dataErrors } = computeStandings({
      tournamentId,
      matchSchedulingFormat: tournament.matchSchedulingFormat,
      groupCount: tournament._count.groups,
      teams: tournament.teams.map((team) => ({
        teamId: team.id,
        teamName: team.name,
        logoUrl: team.logoUrl,
        groupId: team.groupId,
      })),
      groups: tournament.groups.map((group) => ({
        id: group.id,
        name: group.name,
        teamIds: group.teams.map((team) => team.id),
      })),
      matches: matchInputs,
    });

    return { tournamentId, tables, dataErrors };
  }
}
