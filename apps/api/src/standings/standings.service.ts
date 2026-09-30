import {
  BallType,
  InningsType,
  MatchSchedulingFormat,
  MatchState,
  schedulingFormatForBallType,
  resolveStandingsSplitPointOutcome,
  LEATHER_STANDINGS_POINTS,
  TENNIS_STANDINGS_POINTS,
  showsNetRunRateForBallType,
  type AuthUser,
  type StandingsInningsInput,
  type StandingsMatchInput,
  type TournamentStandings,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { mapPool } from '../stats/map-pool';
import {
  SCORECARD_BUILD_CONCURRENCY,
  TournamentAggregatesCacheService,
} from '../stats/tournament-aggregates-cache.service';
import { activeTeamWhere } from '../teams/team-query';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { TennisTournamentVisibilityService } from '../tournaments/tennis-tournament-visibility.service';
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
    private readonly tennisVisibility: TennisTournamentVisibilityService,
    private readonly aggregatesCache: TournamentAggregatesCacheService,
  ) {}

  async getStandings(
    tournamentId: string,
    viewer: AuthUser | null = null,
  ): Promise<TournamentStandings> {
    const tournamentMeta = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    assertTournamentActive(tournamentMeta);
    await this.tennisVisibility.assertCanViewCenterLevelTournament(viewer, tournamentMeta, {
      allowUnauthenticated: true,
    });

    const cached = await this.aggregatesCache.getStandings<TournamentStandings>(tournamentId);
    if (cached) {
      return this.resolveStandingsMedia(cached);
    }

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
    const showNetRunRate = showsNetRunRateForBallType(tournament.ballType as BallType);
    const points = isLeather ? LEATHER_STANDINGS_POINTS : TENNIS_STANDINGS_POINTS;

    const scorecards = await mapPool(
      tournament.matches,
      SCORECARD_BUILD_CONCURRENCY,
      (match) => this.scorecards.build(match),
    );

    const matchInputs: StandingsMatchInput[] = tournament.matches.map((match, index) => {
      const scorecard = scorecards[index]!;
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

      return {
        matchId: match.id,
        groupId: match.groupId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        isNoResult,
        winningTeamId:
          match.winningTeamId ??
          (scorecard.result.decided ? scorecard.result.winningTeamId : null),
        isDecided: scorecard.result.decided && !scorecard.result.isTie && !isNoResult,
        requiresSuperOver: scorecard.result.superOverRequired,
        innings: normalInnings,
      };
    });

    const { tables, dataErrors } = computeStandings({
      tournamentId: tournament.id,
      matchSchedulingFormat: schedulingFormatForBallType(
        tournament.ballType as BallType,
        tournament.matchSchedulingFormat as MatchSchedulingFormat | null,
      ),
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
      points,
      awardUndecidedAsSplit: isLeather,
    });

    const computed: TournamentStandings = {
      tournamentId: tournament.id,
      tables,
      dataErrors,
      showNetRunRate,
    };
    await this.aggregatesCache.setStandings(tournamentId, computed);
    return this.resolveStandingsMedia(computed);
  }

  private async resolveStandingsMedia(
    standings: TournamentStandings,
  ): Promise<TournamentStandings> {
    const tables = await Promise.all(
      standings.tables.map(async (table) => ({
        ...table,
        teams: await Promise.all(
          table.teams.map(async (team) => ({
            ...team,
            logoUrl: await this.mediaUrls.resolveReadUrl(team.logoUrl),
          })),
        ),
      })),
    );
    return { ...standings, tables };
  }
}
