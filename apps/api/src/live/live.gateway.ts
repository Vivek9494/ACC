import {
  LIVE_NAMESPACE,
  LiveEvent,
  type LiveScorerRevokedMessage,
  type LiveStateMessage,
  type LiveSubscribeMessage,
  type LiveSubscribedMessage,
  type ScorecardResponse,
  type ScorerRevokedReason,
  ScorerRevokedReason as ScorerRevokedReasonConst,
  liveMatchRoom,
  liveStateCacheKey,
} from '@acc/types';
import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { RedisService } from '../redis/redis.service';

/**
 * Socket.IO gateway for live score push (spec §29). Read-only and
 * unauthenticated — Guests subscribe freely (spec §2). Scorers never write
 * through the socket; they mutate over REST and the server pushes the
 * recomputed state here via {@link LiveGateway.broadcastState}.
 */
@WebSocketGateway({
  namespace: LIVE_NAMESPACE,
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly redis: RedisService) {}

  handleConnection(client: Socket): void {
    this.logger.debug(`live client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`live client disconnected: ${client.id}`);
  }

  /** Join a match room and immediately deliver the cached snapshot, if any. */
  @SubscribeMessage(LiveEvent.Subscribe)
  async onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: LiveSubscribeMessage,
  ): Promise<LiveSubscribedMessage> {
    const matchId = body?.matchId;
    if (!matchId) {
      return { matchId: '', hasSnapshot: false };
    }
    await client.join(liveMatchRoom(matchId));

    const snapshot = await this.readCached(matchId);
    if (snapshot) {
      const frame: LiveStateMessage = {
        matchId,
        state: snapshot,
        updatedAt: new Date().toISOString(),
      };
      client.emit(LiveEvent.State, frame);
    }
    return { matchId, hasSnapshot: snapshot !== null };
  }

  @SubscribeMessage(LiveEvent.Unsubscribe)
  async onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: LiveSubscribeMessage,
  ): Promise<void> {
    if (body?.matchId) {
      await client.leave(liveMatchRoom(body.matchId));
    }
  }

  /** Push a live-state frame to every subscriber of the match room. */
  broadcastState(matchId: string, state: ScorecardResponse): void {
    if (!this.server) {
      return;
    }
    const frame: LiveStateMessage = {
      matchId,
      state,
      updatedAt: new Date().toISOString(),
    };
    this.server.to(liveMatchRoom(matchId)).emit(LiveEvent.State, frame);
  }

  /** Notify match-room subscribers that the per-match scorer lost access mid-match. */
  broadcastScorerRevoked(
    matchId: string,
    userId: string,
    reason: ScorerRevokedReason = ScorerRevokedReasonConst.Swap,
  ): void {
    if (!this.server) {
      return;
    }
    const frame: LiveScorerRevokedMessage = { matchId, userId, reason };
    this.server.to(liveMatchRoom(matchId)).emit(LiveEvent.ScorerRevoked, frame);
  }

  private async readCached(matchId: string): Promise<ScorecardResponse | null> {
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
