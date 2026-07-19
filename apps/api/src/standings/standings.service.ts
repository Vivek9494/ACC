import {
  BallType,
  InningsType,
  MatchState,
  resolveStandingsSplitPointOutcome,
  type StandingsInningsInput,
  type StandingsMatchInput,
  type TournamentStandings,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { activeTeamWhere } from '../teams/team-query';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { computeStandings } from './standings.compute';
import { wasInningsAllOut } from './standings.nrr';

const STANDINGS_MATCH_STATES: MatchState[] = [
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
  MatchState.Cancelled,
];

@Injectable()
export class StandingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecards: ScorecardReader,
    private readonly mediaUrls: MediaUrlResolver,
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
              where: activeTeamWhere,
              select: { id: true },
              orderBy: { name: 'asc' },
            },
          },
        },
        teams: {
          where: activeTeamWhere,
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

    const isLeather = tournament.ballType === BallType.Leather;
    const showNetRunRate = !isLeather;

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

      const isNoResult = resolveStandingsSplitPointOutcome({
        state: match.state as MatchState,
        isNoResult: match.isNoResult,
        scorecardIsNoResult: scorecard.result.isNoResult,
      });

      matchInputs.push({
        matchId: match.id,
        groupId: match.groupId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        isNoResult,
        winningTeamId:
          match.winningTeamId ??
          (scorecard.result.decided ? scorecard.result.winningTeamId : null),
        isDecided: scorecard.result.decided && !isNoResult,
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
      includeNetRunRate: showNetRunRate,
    });

    const resolvedTables = await Promise.all(
      tables.map(async (table) => ({
        ...table,
        teams: await Promise.all(
          table.teams.map(async (team) => ({
            ...team,
            logoUrl: await this.mediaUrls.resolveReadUrl(team.logoUrl),
          })),
        ),
      })),
    );

    return { tournamentId, tables: resolvedTables, dataErrors, showNetRunRate };
  }
}
