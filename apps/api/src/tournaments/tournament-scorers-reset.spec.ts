import 'reflect-metadata';

import {
  BallType,
  MatchState,
  PRE_LIVE_MATCH_STATES,
  UserRole,
  type AuthUser,
} from '@acc/types';

import { TournamentScorersService } from './tournament-scorers.service';

describe('TournamentScorersService — removed scorer match reset', () => {
  const prisma = {
    tournament: { findFirst: jest.fn() },
    province: { findUnique: jest.fn() },
    tournamentCenter: { findMany: jest.fn() },
    tournamentScorer: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    registration: { findMany: jest.fn(), count: jest.fn() },
    match: { findFirst: jest.fn() },
    matchScorerGrant: { findMany: jest.fn(), updateMany: jest.fn() },
    user: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const mediaUrls = {
    resolveReadUrl: jest.fn(async (value: string | null) => value),
    resolveProfilePhotoUrls: jest.fn(async <T extends { profilePhotoUrl: string | null }>(rows: T[]) => rows),
  };

  const service = new TournamentScorersService(prisma as never, mediaUrls as never);

  const clubManager: AuthUser = {
    id: 'cm-1',
    firstName: 'Club',
    lastName: 'Manager',
    mobileNumber: '+15555551000',
    email: 'cm@acc.local',
    centerId: 'center-A',
    jerseyNumber: 1,
    profilePhotoUrl: null,
    role: UserRole.ClubManager,
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.tournament.findFirst.mockResolvedValue({
      id: 'tour-1',
      ballType: BallType.Tennis,
      type: 'APL',
      provinceId: 'prov-1',
    });
    prisma.province.findUnique.mockResolvedValue({ name: 'Ontario' });
    prisma.tournamentCenter.findMany.mockImplementation((args: { include?: unknown }) => {
      if (args?.include) {
        return Promise.resolve([{ center: { name: 'Center A', province: { name: 'Ontario' } } }]);
      }
      return Promise.resolve([{ centerId: 'center-A' }]);
    });
    prisma.match.findFirst.mockResolvedValue(null);
    prisma.registration.count.mockResolvedValue(5);
    prisma.tournamentScorer.findMany
      .mockResolvedValueOnce([{ userId: 'removed-1' }, { userId: 'kept-1' }])
      .mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'removed-1', firstName: 'Ravi', lastName: 'Patel' },
    ]);
    prisma.matchScorerGrant.findMany.mockResolvedValue([
      {
        id: 'grant-1',
        match: {
          id: 'match-1',
          matchCode: 'M1',
          matchDate: new Date('2026-07-15T12:00:00.000Z'),
          homeTeam: { name: 'Alpha' },
          awayTeam: { name: 'Beta' },
          externalOpponentName: null,
        },
      },
      {
        id: 'grant-2',
        match: {
          id: 'match-2',
          matchCode: 'M2',
          matchDate: new Date('2026-07-16T12:00:00.000Z'),
          homeTeam: { name: 'Gamma' },
          awayTeam: { name: 'Delta' },
          externalOpponentName: null,
        },
      },
    ]);
    prisma.matchScorerGrant.updateMany.mockResolvedValue({ count: 2 });
    prisma.registration.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  });

  it('revokes pre-live grants for removed scorers in the same transaction', async () => {
    const response = await service.setScorers(clubManager, 'tour-1', {
      userIds: ['kept-1', 'u2', 'u3', 'u4', 'u5'],
    });

    expect(prisma.tournamentScorer.deleteMany).toHaveBeenCalled();
    expect(prisma.tournamentScorer.createMany).toHaveBeenCalled();
    expect(prisma.matchScorerGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'removed-1',
          revokedAt: null,
          match: expect.objectContaining({
            tournamentId: 'tour-1',
            isDeleted: false,
            state: { in: [...PRE_LIVE_MATCH_STATES] },
          }),
        }),
      }),
    );
    expect(prisma.matchScorerGrant.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['grant-1', 'grant-2'] } },
      data: { revokedAt: expect.any(Date) },
    });
    expect(response.removedScorerResets).toEqual([
      {
        userId: 'removed-1',
        firstName: 'Ravi',
        lastName: 'Patel',
        resetMatches: [
          {
            matchId: 'match-1',
            label: 'Alpha vs Beta · M1 · 2026-07-15',
            matchCode: 'M1',
            matchDate: '2026-07-15T12:00:00.000Z',
          },
          {
            matchId: 'match-2',
            label: 'Gamma vs Delta · M2 · 2026-07-16',
            matchCode: 'M2',
            matchDate: '2026-07-16T12:00:00.000Z',
          },
        ],
      },
    ]);
  });

  it('does not reset completed-match grants', async () => {
    prisma.matchScorerGrant.findMany.mockResolvedValue([]);

    const response = await service.setScorers(clubManager, 'tour-1', {
      userIds: ['kept-1', 'u2', 'u3', 'u4', 'u5'],
    });

    expect(prisma.matchScorerGrant.updateMany).not.toHaveBeenCalled();
    expect(response.removedScorerResets).toEqual([]);
    expect(prisma.matchScorerGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          match: expect.objectContaining({
            state: { in: expect.not.arrayContaining([MatchState.Completed]) },
          }),
        }),
      }),
    );
  });
});
