import {
  type AuthUser,
  GraphicsCommandAction,
  GraphicsKind,
  LIVE_NAMESPACE,
  LiveEvent,
  Permission,
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
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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

import type { AccessTokenPayload } from '../auth/auth.constants';
import { loadAuthUser } from '../auth/auth.service';
import { PermissionService } from '../authz/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const GRAPHICS_ACTIONS = new Set<string>(Object.values(GraphicsCommandAction));
const GRAPHICS_KINDS = new Set<string>(Object.values(GraphicsKind));

/** Optional operator identity attached when handshake carries a valid access JWT. */
interface LiveSocketData {
  user?: AuthUser;
}

/**
 * Socket.IO gateway for live score push (spec §29). Subscribe/listen stays
 * unauthenticated so Guests and OBS Browser Sources can join freely (spec §2).
 * Scorers mutate over REST; the server pushes recomputed state via
 * {@link LiveGateway.broadcastState}.
 *
 * {@link LiveEvent.GraphicsCommand} emission requires a valid access JWT on the
 * handshake plus {@link Permission.SCORE_BALL} for that match (operators only).
 */
@WebSocketGateway({
  namespace: LIVE_NAMESPACE,
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.resolveOptionalHandshakeUser(client);
    if (user) {
      this.socketData(client).user = user;
    }
    this.logger.debug(
      `live client connected: ${client.id}${user ? ` (user ${user.id})` : ' (anonymous)'}`,
    );
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
   * OBS graphics control — forward to the match room only when the emitter is
   * authenticated and allowed to score this match ({@link Permission.SCORE_BALL}).
   * Caller must already be subscribed so they sit in `match:{id}`.
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

    const user = this.socketData(client).user;
    if (!user) {
      return { ok: false };
    }

    const allowed = await this.permissions.check(Permission.SCORE_BALL, user, { matchId });
    if (!allowed) {
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

  private socketData(client: Socket): LiveSocketData {
    return client.data as LiveSocketData;
  }

  /**
   * Optional operator auth — missing/invalid token leaves the socket anonymous
   * so OBS display pages can still subscribe without credentials.
   */
  private async resolveOptionalHandshakeUser(client: Socket): Promise<AuthUser | null> {
    const token = this.extractHandshakeToken(client);
    if (!token) {
      return null;
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }

    if (payload.type !== 'access') {
      return null;
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.deletedAt || user.tokenVersion !== payload.tokenVersion) {
      return null;
    }

    return loadAuthUser(this.prisma, user);
  }

  private extractHandshakeToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    return typeof auth?.token === 'string' && auth.token.length > 0 ? auth.token : null;
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
