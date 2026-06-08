import 'reflect-metadata';

import { LiveEvent, type ScorecardResponse, liveMatchRoom, liveStateCacheKey } from '@acc/types';

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
      note: null,
    },
  };
}

describe('LiveGateway — guest read-only live push (§29, §2)', () => {
  it('joins the match room and pushes the cached snapshot on subscribe (no auth)', async () => {
    const redis = { get: jest.fn().mockResolvedValue(JSON.stringify(sampleState())) };
    const gateway = new LiveGateway(redis as never);
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
    const redis = { get: jest.fn().mockResolvedValue(null) };
    const gateway = new LiveGateway(redis as never);
    const client = { join: jest.fn(), emit: jest.fn(), leave: jest.fn() };

    const ack = await gateway.onSubscribe(client as never, { matchId: 'match-2' });

    expect(client.join).toHaveBeenCalledWith(liveMatchRoom('match-2'));
    expect(client.emit).not.toHaveBeenCalled();
    expect(ack).toEqual({ matchId: 'match-2', hasSnapshot: false });
  });

  it('broadcasts a state frame to the match room', () => {
    const redis = { get: jest.fn() };
    const gateway = new LiveGateway(redis as never);
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
});
