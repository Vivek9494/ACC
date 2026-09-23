import 'reflect-metadata';

import {
  LiveEvent,
  Permission,
  UserRole,
  type AuthUser,
  type ScorecardResponse,
  liveMatchRoom,
  liveStateCacheKey,
} from '@acc/types';

import { LiveGateway } from './live.gateway';

function sampleState(matchId = 'match-1'): ScorecardResponse {
  return {
    matchId,
    version: 3,
    originalTarget: null,
    dlsTarget: null,
    effectiveTarget: null,
    innings: [],
    result: {
      decided: false,
      isTie: false,
      isNoResult: false,
      winningTeamId: null,
      superOverRequired: false,
      marginRuns: null,
      marginWickets: null,
      note: null,
    },
    display: { players: {}, innings: [] },
  };
}

function scorerUser(): AuthUser {
  return {
    id: 'scorer-1',
    firstName: 'Score',
    lastName: 'Keeper',
    mobileNumber: '+15555550000',
    email: 's@acc.local',
    centerId: 'c1',
    jerseyNumber: 1,
    profilePhotoUrl: null,
    role: UserRole.Player,
    isActive: true,
  };
}

function makeGateway(overrides?: {
  permissionsCheck?: jest.Mock;
}): {
  gateway: LiveGateway;
  redis: { get: jest.Mock };
  permissions: { check: jest.Mock };
} {
  const redis = { get: jest.fn() };
  const permissions = {
    check: overrides?.permissionsCheck ?? jest.fn().mockResolvedValue(true),
  };
  const gateway = new LiveGateway(
    redis as never,
    {} as never,
    {} as never,
    {} as never,
    permissions as never,
  );
  return { gateway, redis, permissions };
}

describe('LiveGateway — guest read-only live push (§29, §2)', () => {
  it('joins the match room and pushes the cached snapshot on subscribe (no auth)', async () => {
    const { gateway, redis } = makeGateway();
    redis.get.mockResolvedValue(JSON.stringify(sampleState()));
    const client = { join: jest.fn(), emit: jest.fn(), leave: jest.fn() };

    const ack = await gateway.onSubscribe(client as never, { matchId: 'match-1' });

    expect(client.join).toHaveBeenCalledWith(liveMatchRoom('match-1'));
    expect(redis.get).toHaveBeenCalledWith(liveStateCacheKey('match-1'));
    expect(client.emit).toHaveBeenCalledWith(
      LiveEvent.State,
      expect.objectContaining({ matchId: 'match-1', state: expect.objectContaining({ version: 3 }) }),
    );
    expect(ack).toEqual({ matchId: 'match-1', hasSnapshot: true });
  });

  it('subscribes without a snapshot when nothing is cached yet', async () => {
    const { gateway, redis } = makeGateway();
    redis.get.mockResolvedValue(null);
    const client = { join: jest.fn(), emit: jest.fn(), leave: jest.fn() };

    const ack = await gateway.onSubscribe(client as never, { matchId: 'match-2' });

    expect(client.join).toHaveBeenCalledWith(liveMatchRoom('match-2'));
    expect(client.emit).not.toHaveBeenCalled();
    expect(ack).toEqual({ matchId: 'match-2', hasSnapshot: false });
  });

  it('broadcasts a state frame to the match room', () => {
    const { gateway } = makeGateway();
    const emit = jest.fn();
    const server = { to: jest.fn().mockReturnValue({ emit }) };
    (gateway as unknown as { server: unknown }).server = server;

    gateway.broadcastState('match-1', sampleState());

    expect(server.to).toHaveBeenCalledWith(liveMatchRoom('match-1'));
    expect(emit).toHaveBeenCalledWith(
      LiveEvent.State,
      expect.objectContaining({ matchId: 'match-1', state: expect.objectContaining({ version: 3 }) }),
    );
  });

  describe('graphics:command', () => {
    it('forwards when authenticated, SCORE_BALL allowed, and socket is in the match room', async () => {
      const check = jest.fn().mockResolvedValue(true);
      const { gateway, permissions } = makeGateway({ permissionsCheck: check });
      const emit = jest.fn();
      const server = { to: jest.fn().mockReturnValue({ emit }) };
      (gateway as unknown as { server: unknown }).server = server;

      const room = liveMatchRoom('match-1');
      const user = scorerUser();
      const inRoom = {
        rooms: new Set([room]),
        data: { user },
      };
      const ack = await gateway.onGraphicsCommand(inRoom as never, {
        matchId: 'match-1',
        action: 'show',
        graphic: 'hello',
      });

      expect(ack).toEqual({ ok: true });
      expect(permissions.check).toHaveBeenCalledWith(Permission.SCORE_BALL, user, {
        matchId: 'match-1',
      });
      expect(server.to).toHaveBeenCalledWith(room);
      expect(emit).toHaveBeenCalledWith(LiveEvent.GraphicsCommand, {
        matchId: 'match-1',
        action: 'show',
        graphic: 'hello',
      });
    });

    it('rejects when the socket is anonymous (no JWT user)', async () => {
      const { gateway } = makeGateway();
      const emit = jest.fn();
      const server = { to: jest.fn().mockReturnValue({ emit }) };
      (gateway as unknown as { server: unknown }).server = server;

      const room = liveMatchRoom('match-1');
      const ack = await gateway.onGraphicsCommand(
        { rooms: new Set([room]), data: {} } as never,
        { matchId: 'match-1', action: 'show', graphic: 'hello' },
      );

      expect(ack).toEqual({ ok: false });
      expect(emit).not.toHaveBeenCalled();
    });

    it('rejects when SCORE_BALL is denied for the match', async () => {
      const { gateway } = makeGateway({
        permissionsCheck: jest.fn().mockResolvedValue(false),
      });
      const emit = jest.fn();
      const server = { to: jest.fn().mockReturnValue({ emit }) };
      (gateway as unknown as { server: unknown }).server = server;

      const room = liveMatchRoom('match-1');
      const ack = await gateway.onGraphicsCommand(
        { rooms: new Set([room]), data: { user: scorerUser() } } as never,
        { matchId: 'match-1', action: 'hide_all' },
      );

      expect(ack).toEqual({ ok: false });
      expect(emit).not.toHaveBeenCalled();
    });

    it('rejects when the socket is not in the match room', async () => {
      const { gateway } = makeGateway();
      const emit = jest.fn();
      const server = { to: jest.fn().mockReturnValue({ emit }) };
      (gateway as unknown as { server: unknown }).server = server;

      const ack = await gateway.onGraphicsCommand(
        { rooms: new Set<string>(), data: { user: scorerUser() } } as never,
        { matchId: 'match-1', action: 'show', graphic: 'hello' },
      );

      expect(ack).toEqual({ ok: false });
      expect(emit).not.toHaveBeenCalled();
    });
  });
});
