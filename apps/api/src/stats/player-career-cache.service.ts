import { playerCareerCacheKey, playerCareerVersionKey } from '@acc/types';
import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { TOURNAMENT_AGGREGATES_CACHE_TTL_SECONDS } from './tournament-aggregates-cache.service';

/**
 * Read-through Redis cache for per-player career stats (one entry per ball
 * type). Fail-open: Redis errors never 500 the request path.
 */
@Injectable()
export class PlayerCareerCacheService {
  private readonly logger = new Logger(PlayerCareerCacheService.name);

  constructor(private readonly redis: RedisService) {}

  async invalidatePlayers(userIds: readonly string[]): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) {
      return;
    }
    try {
      await this.redis.incrMany(unique.map((userId) => playerCareerVersionKey(userId)));
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate career cache for ${unique.length} player(s): ${String(err)}`,
      );
    }
  }

  async get<T>(userId: string, ballType: string): Promise<T | null> {
    const key = await this.key(userId, ballType);
    if (key == null) {
      return null;
    }
    try {
      const raw = await this.redis.get(key);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch (err) {
      this.logger.warn(`Failed to read career cache key ${key}: ${String(err)}`);
      return null;
    }
  }

  async set(userId: string, ballType: string, value: unknown): Promise<void> {
    const key = await this.key(userId, ballType);
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
      this.logger.warn(`Failed to write career cache key ${key}: ${String(err)}`);
    }
  }

  /** Null when Redis is unavailable (caller skips cache). */
  private async key(userId: string, ballType: string): Promise<string | null> {
    try {
      const version = (await this.redis.get(playerCareerVersionKey(userId))) ?? '0';
      return playerCareerCacheKey(userId, ballType, version);
    } catch (err) {
      this.logger.warn(`Failed to read career cache version for ${userId}: ${String(err)}`);
      return null;
    }
  }
}
