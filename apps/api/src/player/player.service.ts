import {
  type AuthUser,
  type PlayerDashboard,
  type ScorerStartableMatch,
  type TournamentSummary,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { ScorerDashboardMatchService } from '../matches/scorer-dashboard-match.service';
import { DashboardFeaturedMatchesService } from '../matches/dashboard-featured-matches.service';
import { ParticipationPollService } from '../participation-poll/participation-poll.service';
import { PlayerStatsService } from '../player-stats/player-stats.service';
import { TournamentsService } from '../tournaments/tournaments.service';

@Injectable()
export class PlayerService {
  constructor(
    private readonly playerStats: PlayerStatsService,
    private readonly participationPolls: ParticipationPollService,
    private readonly scorerDashboardMatch: ScorerDashboardMatchService,
    private readonly dashboardFeaturedMatches: DashboardFeaturedMatchesService,
    private readonly tournaments: TournamentsService,
  ) {}

  async getDashboard(actor: AuthUser): Promise<PlayerDashboard> {
    const userId = actor.id;

    const [featuredMatchesRaw, participationPoll, scorerMatch, playerStats, tournaments] =
      await Promise.all([
        this.dashboardFeaturedMatches.loadTodayMatches(actor),
        this.participationPolls.loadDashboardPoll(userId),
        this.scorerDashboardMatch.loadStartableMatch(userId),
        this.playerStats.buildDashboardHighLevelStats(userId),
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

  private async listDashboardTournaments(actor: AuthUser): Promise<TournamentSummary[]> {
    return this.tournaments.listDashboardSummaries(actor);
  }
}
