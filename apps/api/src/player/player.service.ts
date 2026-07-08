import {
  type AuthUser,
  type ManagerPlayerStats,
  MatchState,
  type PlayerDashboard,
  type PlayerFeaturedMatchSummary,
  type ScorerStartableMatch,
  type TournamentSummary,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { ScorerDashboardMatchService } from '../matches/scorer-dashboard-match.service';
import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { ParticipationPollService } from '../participation-poll/participation-poll.service';
import { LeatherTournamentVisibilityService } from '../tournaments/leather-tournament-visibility.service';
import { TennisTournamentVisibilityService } from '../tournaments/tennis-tournament-visibility.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { ScorecardReader } from '../scoring/scorecard-reader';

const PLAYED_STATES: MatchState[] = [
  MatchState.Live,
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

@Injectable()
export class PlayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
    private readonly participationPolls: ParticipationPollService,
    private readonly leatherVisibility: LeatherTournamentVisibilityService,
    private readonly tennisVisibility: TennisTournamentVisibilityService,
    private readonly scorerDashboardMatch: ScorerDashboardMatchService,
    private readonly dashboardFeaturedMatches: DashboardFeaturedMatchesService,
    private readonly tournaments: TournamentsService,
  ) {}

  async getDashboard(actor: AuthUser): Promise<PlayerDashboard> {
    const userId = actor.id;
    const [memberships, registrations, centerTennisIds, visibleLeatherIds] = await Promise.all([
      this.prisma.teamMembership.findMany({
        where: { userId },
        select: { teamId: true, tournamentId: true },
      }),
      this.prisma.registration.findMany({
        where: { userId, status: 'CONFIRMED' },
        select: { tournamentId: true },
      }),
      this.tennisVisibility.getCenterParticipatingTournamentIds(actor.centerId),
      this.leatherVisibility.getVisibleLeatherTournamentIds(userId),
    ]);

    const tournamentIds = [
      ...new Set([
        ...memberships.map((row) => row.tournamentId),
        ...registrations.map((row) => row.tournamentId),
        ...centerTennisIds,
      ]),
    ];

    const mergedTournamentIds = [...new Set([...tournamentIds, ...visibleLeatherIds])];

    const [featuredMatchesRaw, participationPoll, scorerMatch, playerStats, tournaments] =
      await Promise.all([
      this.dashboardFeaturedMatches.loadTodayMatches(),
      this.participationPolls.loadDashboardPoll(userId),
      this.scorerDashboardMatch.loadStartableMatch(userId),
      this.loadPlayerStats(userId, mergedTournamentIds),
      this.listDashboardTournaments(actor),
    ]);

    const featuredMatches = scorerMatch
      ? featuredMatchesRaw.filter((match) => match.matchId !== scorerMatch.matchId)
      : featuredMatchesRaw;

    return { featuredMatches, participationPoll, scorerMatch, playerStats, tournaments };
  }

  /** Active per-match Scorer grant for a startable fixture (§11.1). */
  async getScorerMatch(userId: string): Promise<ScorerStartableMatch | null> {
    return this.scorerDashboardMatch.loadStartableMatch(userId);
  }

  private async loadPlayerStats(
    userId: string,
    tournamentIds: string[],
  ): Promise<ManagerPlayerStats> {
    if (tournamentIds.length === 0) {
      return { matches: 0, runs: 0, wickets: 0 };
    }

    const squadRows = await this.prisma.matchSquadPlayer.findMany({
      where: {
        userId,
        squad: {
          match: {
            tournamentId: { in: tournamentIds },
            state: { in: PLAYED_STATES },
          },
        },
      },
      select: { squad: { select: { matchId: true } } },
    });

    const matchIds = [...new Set(squadRows.map((row) => row.squad.matchId))];
    if (matchIds.length === 0) {
      return { matches: 0, runs: 0, wickets: 0 };
    }

    let runs = 0;
    let wickets = 0;

    for (const matchId of matchIds) {
      const card = await this.scorecardReader.byMatchId(matchId);
      for (const inn of card.innings) {
        const batter = inn.batters.find((b) => b.playerId === userId);
        if (batter) {
          runs += batter.runs;
        }
        const bowler = inn.bowlers.find((b) => b.playerId === userId);
        if (bowler) {
          wickets += bowler.wickets;
        }
      }
    }

    return { matches: matchIds.length, runs, wickets };
  }

  private async listDashboardTournaments(actor: AuthUser): Promise<TournamentSummary[]> {
    return this.tournaments.listDashboardSummaries(actor);
  }
}
