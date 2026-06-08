import { type ScorecardResponse, liveStateCacheKey } from '@acc/types';
import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { LiveGateway } from './live.gateway';

/** Live state is cached for six hours — comfortably longer than any match. */
const LIVE_CACHE_TTL_SECONDS = 6 * 60 * 60;

/**
 * Bridges the scoring engine to real-time subscribers (spec §29). On every
 * accepted scoring mutation the recomputed {@link ScorecardResponse} is cached
 * in Redis (so a late/guest subscriber gets an immediate snapshot) and pushed
 * to everyone in the match room.
 */
@Injectable()
export class LiveService {
  constructor(
    private readonly redis: RedisService,
    private readonly gateway: LiveGateway,
  ) {}

  /** Cache + broadcast the latest live state for a match. */
  async publish(state: ScorecardResponse): Promise<void> {
    await this.redis.setWithTtl(
      liveStateCacheKey(state.matchId),
      JSON.stringify(state),
      LIVE_CACHE_TTL_SECONDS,
    );
    this.gateway.broadcastState(state.matchId, state);
  }

  /** The cached live snapshot for a match, or null if nothing is cached yet. */
  async getCached(matchId: string): Promise<ScorecardResponse | null> {
    const raw = await this.redis.get(liveStateCacheKey(matchId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as ScorecardResponse;
    } catch {
      return null;
    }
  }
}
