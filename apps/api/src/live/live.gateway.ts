import {
  GraphicsCommandAction,
  GraphicsKind,
  LIVE_NAMESPACE,
  LiveEvent,
  type GraphicsCommandMessage,
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

const GRAPHICS_ACTIONS = new Set<string>(Object.values(GraphicsCommandAction));
const GRAPHICS_KINDS = new Set<string>(Object.values(GraphicsKind));

/**
 * Socket.IO gateway for live score push (spec §29). Read-only and
 * unauthenticated — Guests subscribe freely (spec §2). Scorers never write
 * through the socket; they mutate over REST and the server pushes the
 * recomputed state here via {@link LiveGateway.broadcastState}.
 *
 * Also relays room-scoped {@link LiveEvent.GraphicsCommand} for OBS graphics
 * (pure forward; does not touch scoring).
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

  /**
   * OBS graphics control — forward to the match room only. Caller must already
   * be subscribed (`live:subscribe`) so they sit in `match:{id}`.
   */
  @SubscribeMessage(LiveEvent.GraphicsCommand)
  async onGraphicsCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: GraphicsCommandMessage,
  ): Promise<{ ok: boolean }> {
    const matchId = typeof body?.matchId === 'string' ? body.matchId.trim() : '';
    const action = body?.action;
    if (!matchId || !action || !GRAPHICS_ACTIONS.has(action)) {
      return { ok: false };
    }
    if (action !== GraphicsCommandAction.HideAll) {
      const graphic = body.graphic;
      if (!graphic || !GRAPHICS_KINDS.has(graphic)) {
        return { ok: false };
      }
    }

    const room = liveMatchRoom(matchId);
    if (!client.rooms.has(room)) {
      return { ok: false };
    }

    const frame: GraphicsCommandMessage = {
      matchId,
      action,
      ...(body.graphic ? { graphic: body.graphic } : {}),
      ...(body.payload ? { payload: body.payload } : {}),
    };
    this.server.to(room).emit(LiveEvent.GraphicsCommand, frame);
    return { ok: true };
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
