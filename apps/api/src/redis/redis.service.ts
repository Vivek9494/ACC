import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin wrapper over a single ioredis connection plus the small set of
 * operations the auth slice needs: a per-key sliding counter (login rate
 * limiting, §31 #6) and a value-with-sliding-TTL store (refresh-token idle
 * timeout, §3.2).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    const url = configService.getOrThrow<string>('REDIS_URL');
    this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (err) {
      this.logger.error('Failed to connect to Redis', err as Error);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Increment a counter and (re)assert its TTL. Returns the new count. Used to
   * count failed login attempts inside a sliding window.
   */
  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Store a value with an absolute TTL (seconds). */
  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  /**
   * Read a value and, if present, slide its TTL forward. Returns null if the
   * key is absent/expired. Used so an actively-used refresh token never hits
   * the 10-day idle cutoff, but an unused one does.
   */
  async getAndSlideTtl(key: string, ttlSeconds: number): Promise<string | null> {
    const value = await this.client.get(key);
    if (value !== null) {
      await this.client.expire(key, ttlSeconds);
    }
    return value;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
