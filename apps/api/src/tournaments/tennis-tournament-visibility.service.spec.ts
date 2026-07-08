import { BallType, TournamentType } from '@acc/types';

import { PrismaService } from '../prisma/prisma.service';
import { TennisTournamentVisibilityService } from './tennis-tournament-visibility.service';

describe('TennisTournamentVisibilityService', () => {
  const prisma = {
    tournamentCenter: { findMany: jest.fn() },
  } as unknown as PrismaService;

  const service = new TennisTournamentVisibilityService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns linked active tennis APL and Center tournaments for a center', async () => {
    prisma.tournamentCenter.findMany = jest.fn().mockResolvedValue([
      { tournamentId: 'apl-1' },
      { tournamentId: 'center-1' },
      { tournamentId: 'apl-1' },
    ]);

    const ids = await service.getCenterParticipatingTournamentIds('center-a');

    expect(ids).toEqual(['apl-1', 'center-1']);
    expect(prisma.tournamentCenter.findMany).toHaveBeenCalledWith({
      where: {
        centerId: 'center-a',
        tournament: {
          isDeleted: false,
          ballType: BallType.Tennis,
          type: { in: [TournamentType.APL, TournamentType.Center] },
        },
      },
      select: { tournamentId: true },
    });
  });

  it('returns an empty list when the center has no linked tennis tournaments', async () => {
    prisma.tournamentCenter.findMany = jest.fn().mockResolvedValue([]);

    await expect(service.getCenterParticipatingTournamentIds('center-b')).resolves.toEqual([]);
  });
});
