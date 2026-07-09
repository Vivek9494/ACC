import {
  USER_NAMESPACE,
  UserEvent,
  type UserScorerAssignedMessage,
  userNotificationRoom,
} from '@acc/types';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import type { AccessTokenPayload } from '../auth/auth.constants';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Authenticated user notification channel. Clients connect with
 * `auth: { token: <accessToken> }` and join a private `user:{userId}` room.
 */
@WebSocketGateway({
  namespace: USER_NAMESPACE,
})
export class UserGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(UserGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      client.disconnect(true);
      return;
    }

    if (payload.type !== 'access') {
      client.disconnect(true);
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, deletedAt: true, tokenVersion: true },
    });
    if (
      !user ||
      !user.isActive ||
      user.deletedAt ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      client.disconnect(true);
      return;
    }

    await client.join(userNotificationRoom(user.id));
    this.logger.debug(`user socket joined ${userNotificationRoom(user.id)}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`user socket disconnected: ${client.id}`);
  }

  /** Notify the incoming scorer that they may score this match (dashboard card). */
  notifyScorerAssigned(userId: string, matchId: string): void {
    if (!this.server) {
      return;
    }
    const frame: UserScorerAssignedMessage = { matchId };
    this.server.to(userNotificationRoom(userId)).emit(UserEvent.ScorerAssigned, frame);
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    return typeof auth?.token === 'string' && auth.token.length > 0 ? auth.token : null;
  }
}
