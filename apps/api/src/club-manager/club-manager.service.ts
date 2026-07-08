import {
  type AuthUser,
  type ClubManagerDashboard,
  type ManagerPlayerStats,
  MatchState,
  TournamentType,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { CaptainService } from '../captain/captain.service';
import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { TournamentsService } from '../tournaments/tournaments.service';

const PLAYED_STATES: MatchState[] = [
  MatchState.Live,
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

@Injectable()
export class ClubManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
    private readonly tournaments: TournamentsService,
    private readonly dashboardFeaturedMatches: DashboardFeaturedMatchesService,
    private readonly captain: CaptainService,
  ) {}

  async getDashboard(actor: AuthUser): Promise<ClubManagerDashboard> {
    const [tournaments, featuredMatches, playerStats, teamLeadMatchCards, squadParticipationPoll] =
      await Promise.all([
      this.tournaments.listDashboardEntries(actor),
      this.dashboardFeaturedMatches.loadTodayMatches(),
      this.loadPlayerStats(actor.id),
      this.captain.loadTeamLeadMatchCards(actor),
      this.captain.loadSquadParticipationPoll(actor.id),
    ]);

    return {
      featuredMatches,
      upcomingMatchCard: teamLeadMatchCards.upcomingMatchCard,
      participationPoll: teamLeadMatchCards.upcomingMatchCard ? null : squadParticipationPoll,
      playerStats,
      tournaments,
    };
  }

  private async loadPlayerStats(managerId: string): Promise<ManagerPlayerStats | null> {
    const registration = await this.prisma.registration.findFirst({
      where: { userId: managerId },
      select: { id: true },
    });
    if (!registration) {
      return null;
    }

    const squadRows = await this.prisma.matchSquadPlayer.findMany({
      where: {
        userId: managerId,
        squad: {
          match: {
            tournament: { type: TournamentType.APL },
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
        const batter = inn.batters.find((b) => b.playerId === managerId);
        if (batter) {
          runs += batter.runs;
        }
        const bowler = inn.bowlers.find((b) => b.playerId === managerId);
        if (bowler) {
          wickets += bowler.wickets;
        }
      }
    }

    return { matches: matchIds.length, runs, wickets };
  }
}
