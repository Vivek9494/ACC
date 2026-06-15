import {
  type AuthUser,
  type ClubManagerDashboard,
  type FeaturedMatchSummary,
  type ManagerPlayerStats,
  MatchState,
  type MatchSummaryTeamView,
  TournamentType,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { activeTournamentRelationWhere } from '../tournaments/tournament-query';
import { TournamentsService } from '../tournaments/tournaments.service';

type MatchWithTeams = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  tournament: { name: string };
};

const UPCOMING_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
  MatchState.Delayed,
];

const LIVE_STATES: MatchState[] = [MatchState.Live, MatchState.RainInterrupted];

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
  ) {}

  async getDashboard(actor: AuthUser): Promise<ClubManagerDashboard> {
    const [tournaments, featuredMatch, playerStats] = await Promise.all([
      this.tournaments.listDashboardEntries(actor),
      this.loadFeaturedMatch(),
      this.loadPlayerStats(actor.id),
    ]);

    return { featuredMatch, playerStats, tournaments };
  }

  private async loadFeaturedMatch(): Promise<FeaturedMatchSummary | null> {
    const match = await this.prisma.match.findFirst({
      where: { tournament: { type: TournamentType.APL, isDeleted: false } },
      orderBy: [{ matchDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        tournament: { select: { name: true } },
      },
    });

    if (!match) {
      return null;
    }

    return this.buildFeaturedMatch(match);
  }

  private async buildFeaturedMatch(match: MatchWithTeams): Promise<FeaturedMatchSummary> {
    const state = match.state as MatchState;
    const isUpcoming = UPCOMING_STATES.includes(state);
    const isLive = LIVE_STATES.includes(state);

    const homeName = match.homeTeam?.name ?? 'TBD';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';

    let teamA: MatchSummaryTeamView = {
      name: homeName,
      logoUrl: null,
      score: null,
      overs: null,
      isWinner: false,
    };
    let teamB: MatchSummaryTeamView = {
      name: awayName,
      logoUrl: null,
      score: null,
      overs: null,
      isWinner: false,
    };
    let resultNote: string | null = null;

    if (!isUpcoming) {
      try {
        const card = await this.scorecardReader.build(match);
        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;

        const homeInnings = card.innings.filter((inn) => inn.battingTeamId === homeId);
        const awayInnings = card.innings.filter((inn) => inn.battingTeamId === awayId);

        const homeAgg = this.aggregateInnings(homeInnings);
        const awayAgg = this.aggregateInnings(awayInnings);

        const winnerId = card.result.winningTeamId;
        const homeWinner = winnerId !== null && winnerId === homeId;
        const awayWinner = winnerId !== null && winnerId === awayId;

        teamA = {
          name: homeName,
          logoUrl: null,
          score: homeAgg.score,
          overs: homeAgg.overs,
          isWinner: homeWinner,
        };
        teamB = {
          name: awayName,
          logoUrl: null,
          score: awayAgg.score,
          overs: awayAgg.overs,
          isWinner: awayWinner,
        };

        if (!isLive && card.result.note) {
          resultNote = card.result.note;
        }
      } catch {
        // Match exists but scorecard not yet available — keep rows without scores.
      }
    }

    return {
      matchId: match.id,
      tournamentName: match.tournament.name,
      state,
      teamA,
      teamB,
      resultNote,
      isLive,
      isUpcoming,
    };
  }

  private aggregateInnings(
    innings: { runs: number; wickets: number; oversText: string; closed: boolean }[],
  ): { score: string | null; overs: string | null } {
    if (innings.length === 0) {
      return { score: null, overs: null };
    }

    const primary = innings[0]!;
    const runs = innings.reduce((sum, inn) => sum + inn.runs, 0);
    const wickets = innings.reduce((sum, inn) => sum + inn.wickets, 0);
    const score =
      primary.closed && wickets >= 10 ? `${runs}` : `${runs}/${wickets}`;
    const overs = `${primary.oversText} OVERS`;

    return { score, overs };
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
