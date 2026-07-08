import 'reflect-metadata';

import {
  BallType,
  MatchState,
  MATCH_SCORER_CHANGE_LOCKED_LIVE_ERROR,
  MATCH_SCORER_CHANGE_LOCKED_LIVE_MESSAGE,
  SCORERS_LOCKED_LIVE_MATCH_ERROR,
  SCORERS_LOCKED_LIVE_MATCH_MESSAGE,
  UserRole,
  type AuthUser,
} from '@acc/types';

import { TournamentScorersService } from './tournament-scorers.service';

describe('TournamentScorersService — live-match lock', () => {
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
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  });

  it('rejects setScorers when a match is LIVE', async () => {
    prisma.match.findFirst.mockResolvedValue({ id: 'match-live' });
    prisma.registration.count.mockResolvedValue(5);
    prisma.tournamentScorer.findMany.mockResolvedValue([]);

    await expect(
      service.setScorers(clubManager, 'tour-1', {
        userIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
      }),
    ).rejects.toMatchObject({
      response: {
        message: SCORERS_LOCKED_LIVE_MATCH_MESSAGE,
        error: SCORERS_LOCKED_LIVE_MATCH_ERROR,
      },
    });

    expect(prisma.tournamentScorer.deleteMany).not.toHaveBeenCalled();
  });

  it('returns scorersEditLocked on getSelectionView when a match is in progress', async () => {
    prisma.match.findFirst.mockResolvedValue({ id: 'match-live' });
    prisma.tournamentScorer.findMany.mockResolvedValue([]);
    prisma.registration.findMany.mockResolvedValue([]);

    const view = await service.getSelectionView(clubManager, 'tour-1');

    expect(view.scorersEditLocked).toBe(true);
    expect(view.scorersEditLockedMessage).toBe(SCORERS_LOCKED_LIVE_MATCH_MESSAGE);
  });

  it('queries Match.state for LIVE and RAIN_INTERRUPTED', async () => {
    prisma.match.findFirst.mockResolvedValue(null);
    prisma.tournamentScorer.findMany.mockResolvedValue([]);
    prisma.registration.findMany.mockResolvedValue([]);

    await service.getSelectionView(clubManager, 'tour-1');

    expect(prisma.match.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tournamentId: 'tour-1',
          isDeleted: false,
          state: { in: ['LIVE', 'RAIN_INTERRUPTED'] },
        }),
      }),
    );
  });

  it('blocks per-match scorer assignment while the fixture is live', () => {
    expect(() =>
      service.assertMatchScorerAssignable(MatchState.Live),
    ).toThrow(
      expect.objectContaining({
        response: {
          message: MATCH_SCORER_CHANGE_LOCKED_LIVE_MESSAGE,
          error: MATCH_SCORER_CHANGE_LOCKED_LIVE_ERROR,
        },
      }),
    );
  });
});
