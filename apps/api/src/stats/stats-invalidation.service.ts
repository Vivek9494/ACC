import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { PlayerCareerCacheService } from './player-career-cache.service';
import { TournamentAggregatesCacheService } from './tournament-aggregates-cache.service';

/**
 * Single entry point for busting cached stats. Every method is best-effort:
 * a failed lookup or Redis error is logged and never fails the write path.
 */
@Injectable()
export class StatsInvalidationService {
  private readonly logger = new Logger(StatsInvalidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tournamentCache: TournamentAggregatesCacheService,
    private readonly careerCache: PlayerCareerCacheService,
  ) {}

  /**
   * A match's scoring outcome changed: bust its tournament's aggregates and
   * the career cache of every squad player (external opponents have no user).
   */
  async invalidateMatchAggregates(matchId: string, tournamentId: string): Promise<void> {
    await this.tournamentCache.invalidateTournamentAggregates(tournamentId);
    try {
      const rows = await this.prisma.matchSquadPlayer.findMany({
        where: { squad: { matchId } },
        select: { userId: true },
      });
      await this.careerCache.invalidatePlayers(rows.map((row) => row.userId));
    } catch (err) {
      this.logger.warn(`Failed to resolve squad for match ${matchId}: ${String(err)}`);
    }
  }

  /** Tournament-level data (teams, groups, roster, format) changed. */
  async invalidateTournamentAggregates(tournamentId: string): Promise<void> {
    await this.tournamentCache.invalidateTournamentAggregates(tournamentId);
  }

  /**
   * Tournament change that also surfaces in player careers (tournament
   * rename/delete, team rename): bust aggregates plus every player who
   * appeared in any of its matches.
   */
  async invalidateTournamentAndPlayerCareers(tournamentId: string): Promise<void> {
    await this.tournamentCache.invalidateTournamentAggregates(tournamentId);
    try {
      const rows = await this.prisma.matchSquadPlayer.findMany({
        where: { squad: { match: { tournamentId } } },
        select: { userId: true },
        distinct: ['userId'],
      });
      await this.careerCache.invalidatePlayers(rows.map((row) => row.userId));
    } catch (err) {
      this.logger.warn(
        `Failed to resolve players for tournament ${tournamentId}: ${String(err)}`,
      );
    }
  }
}
