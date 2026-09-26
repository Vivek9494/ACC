import {
  leaderboardCacheKey,
  standingsCacheKey,
  statsCacheTeamScope,
  tournamentAggregatesVersionKey,
  tournamentStatsCacheKey,
} from '@acc/types';
import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

/** Safety-net TTL; correctness comes from version bump on data change. */
export const TOURNAMENT_AGGREGATES_CACHE_TTL_SECONDS = 24 * 60 * 60;

/** Cap concurrent ScorecardReader.build calls on a cold miss. */
export const SCORECARD_BUILD_CONCURRENCY = 6;

/**
 * Read-through Redis cache for tournament leaderboard / standings /
 * tournament-stats. Fail-open: Redis errors never 500 the request path.
 */
@Injectable()
export class TournamentAggregatesCacheService {
  private readonly logger = new Logger(TournamentAggregatesCacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Bust all cached aggregates for a tournament by bumping the version stamp.
   * Old value keys are orphaned and expire via TTL.
   */
  async invalidateTournamentAggregates(tournamentId: string): Promise<void> {
    try {
      await this.redis.incr(tournamentAggregatesVersionKey(tournamentId));
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate tournament aggregates cache for ${tournamentId}: ${String(err)}`,
      );
    }
  }

  async getLeaderboard<T>(tournamentId: string, teamId?: string | null): Promise<T | null> {
    return this.getJson(await this.leaderboardKey(tournamentId, teamId));
  }

  async setLeaderboard(
    tournamentId: string,
    teamId: string | null | undefined,
    value: unknown,
  ): Promise<void> {
    await this.setJson(await this.leaderboardKey(tournamentId, teamId), value);
  }

  async getStandings<T>(tournamentId: string): Promise<T | null> {
    return this.getJson(await this.standingsKey(tournamentId));
  }

  async setStandings(tournamentId: string, value: unknown): Promise<void> {
    await this.setJson(await this.standingsKey(tournamentId), value);
  }

  async getTournamentStats<T>(
    tournamentId: string,
    teamId?: string | null,
  ): Promise<T | null> {
    return this.getJson(await this.tournamentStatsKey(tournamentId, teamId));
  }

  async setTournamentStats(
    tournamentId: string,
    teamId: string | null | undefined,
    value: unknown,
  ): Promise<void> {
    await this.setJson(await this.tournamentStatsKey(tournamentId, teamId), value);
  }

  private async leaderboardKey(
    tournamentId: string,
    teamId?: string | null,
  ): Promise<string | null> {
    const version = await this.readVersion(tournamentId);
    if (version == null) {
      return null;
    }
    return leaderboardCacheKey(tournamentId, statsCacheTeamScope(teamId), version);
  }

  private async standingsKey(tournamentId: string): Promise<string | null> {
    const version = await this.readVersion(tournamentId);
    if (version == null) {
      return null;
    }
    return standingsCacheKey(tournamentId, version);
  }

  private async tournamentStatsKey(
    tournamentId: string,
    teamId?: string | null,
  ): Promise<string | null> {
    const version = await this.readVersion(tournamentId);
    if (version == null) {
      return null;
    }
    return tournamentStatsCacheKey(tournamentId, statsCacheTeamScope(teamId), version);
  }

  /** Returns null when Redis is unavailable (caller skips cache). */
  private async readVersion(tournamentId: string): Promise<string | null> {
    try {
      const raw = await this.redis.get(tournamentAggregatesVersionKey(tournamentId));
      return raw ?? '0';
    } catch (err) {
      this.logger.warn(
        `Failed to read tournament aggregates version for ${tournamentId}: ${String(err)}`,
      );
      return null;
    }
  }

  private async getJson<T>(key: string | null): Promise<T | null> {
    if (key == null) {
      return null;
    }
    try {
      const raw = await this.redis.get(key);
      if (raw == null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Failed to read tournament aggregates cache key ${key}: ${String(err)}`);
      return null;
    }
  }

  private async setJson(key: string | null, value: unknown): Promise<void> {
    if (key == null) {
      return;
    }
    try {
      await this.redis.setWithTtl(
        key,
        JSON.stringify(value),
        TOURNAMENT_AGGREGATES_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(`Failed to write tournament aggregates cache key ${key}: ${String(err)}`);
    }
  }
}
