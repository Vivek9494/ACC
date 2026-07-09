import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';

import type { CorsOriginSetting } from './cors.config';

/** Applies CORS and, when configured, a Redis pub/sub adapter for multi-instance Socket.IO. */
export class CorsSocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(CorsSocketIoAdapter.name);

  constructor(
    app: INestApplicationContext,
    private readonly corsOrigin: CorsOriginSetting,
    private readonly redisUrl?: string,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.corsOrigin,
        credentials: true,
      },
    });

    if (this.redisUrl) {
      const pubClient = new Redis(this.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });
      const subClient = pubClient.duplicate();

      for (const client of [pubClient, subClient]) {
        client.on('error', (err: Error) => {
          this.logger.error('Socket.IO Redis adapter client error', err.stack);
        });
        client.on('reconnecting', () => {
          this.logger.warn('Socket.IO Redis adapter client reconnecting');
        });
      }

      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Socket.IO Redis adapter enabled');
    }

    return server;
  }
}
