import { BallType, TournamentType, UserRole, type AuthUser } from '@acc/types';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TennisTournamentVisibilityService } from './tennis-tournament-visibility.service';

describe('TennisTournamentVisibilityService', () => {
  const prisma = {
    tournamentCenter: { findMany: jest.fn(), findFirst: jest.fn() },
    tournament: { findMany: jest.fn() },
  } as unknown as PrismaService;

  const service = new TennisTournamentVisibilityService(prisma);

  const player = (centerId: string): AuthUser =>
    ({
      id: 'u1',
      firstName: 'P',
      lastName: 'Layer',
      mobileNumber: '+15555550100',
      email: 'p@acc.local',
      centerId,
      jerseyNumber: 1,
      profilePhotoUrl: null,
      role: UserRole.Player,
      isActive: true,
    }) as AuthUser;

  const admin: AuthUser = {
    ...player('center-a'),
    id: 'admin-1',
    role: UserRole.Admin,
  };

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

  describe('centerTournamentListWhere', () => {
    it('returns null for Admin / Club Manager (no filter)', () => {
      expect(service.centerTournamentListWhere(admin)).toBeNull();
      expect(
        service.centerTournamentListWhere({ ...admin, role: UserRole.ClubManager }),
      ).toBeNull();
    });

    it('excludes APL and CENTER tournaments for guests', () => {
      expect(service.centerTournamentListWhere(null)).toEqual({
        type: { notIn: [TournamentType.APL, TournamentType.Center] },
      });
    });

    it('scopes APL and CENTER tournaments to the player center', () => {
      expect(service.centerTournamentListWhere(player('center-brampton'))).toEqual({
        OR: [
          { type: { notIn: [TournamentType.APL, TournamentType.Center] } },
          {
            type: { in: [TournamentType.APL, TournamentType.Center] },
            centerLinks: { some: { centerId: { in: ['center-brampton'] } } },
          },
        ],
      });
    });
  });

  describe('assertCanViewCenterLevelTournament', () => {
    it('no-ops for ACC', async () => {
      await expect(
        service.assertCanViewCenterLevelTournament(player('center-a'), {
          id: 't1',
          type: TournamentType.ACC,
        }),
      ).resolves.toBeUndefined();
      expect(prisma.tournamentCenter.findFirst).not.toHaveBeenCalled();
    });

    it('requires participation for APL', async () => {
      prisma.tournamentCenter.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.assertCanViewCenterLevelTournament(player('windsor'), {
          id: 'apl-1',
          type: TournamentType.APL,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows Admin for any APL tournament', async () => {
      await expect(
        service.assertCanViewCenterLevelTournament(admin, {
          id: 'apl-1',
          type: TournamentType.APL,
        }),
      ).resolves.toBeUndefined();
      expect(prisma.tournamentCenter.findFirst).not.toHaveBeenCalled();
    });

    it('allows a participating player for APL', async () => {
      prisma.tournamentCenter.findFirst = jest.fn().mockResolvedValue({ centerId: 'center-a' });
      await expect(
        service.assertCanViewCenterLevelTournament(player('center-a'), {
          id: 'apl-1',
          type: TournamentType.APL,
        }),
      ).resolves.toBeUndefined();
    });

    it('allows a participating player for CENTER', async () => {
      prisma.tournamentCenter.findFirst = jest.fn().mockResolvedValue({ centerId: 'center-a' });
      await expect(
        service.assertCanViewCenterLevelTournament(player('center-a'), {
          id: 't1',
          type: TournamentType.Center,
        }),
      ).resolves.toBeUndefined();
    });

    it('denies a non-participating player for CENTER', async () => {
      prisma.tournamentCenter.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.assertCanViewCenterLevelTournament(player('center-brampton'), {
          id: 'ny-etob',
          type: TournamentType.Center,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies guests unless allowUnauthenticated', async () => {
      await expect(
        service.assertCanViewCenterLevelTournament(null, {
          id: 't1',
          type: TournamentType.Center,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      await expect(
        service.assertCanViewCenterLevelTournament(
          null,
          { id: 't1', type: TournamentType.Center },
          { allowUnauthenticated: true },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('filterTournamentIdsVisibleToViewer', () => {
    it('hides APL from non-participating centers (e.g. Windsor)', async () => {
      prisma.tournament.findMany = jest.fn().mockResolvedValue([
        {
          id: 'apl-1',
          type: TournamentType.APL,
          centerLinks: [{ centerId: 'center-a' }, { centerId: 'center-b' }],
        },
      ]);

      const visible = await service.filterTournamentIdsVisibleToViewer(player('windsor'), [
        'apl-1',
      ]);
      expect(visible.has('apl-1')).toBe(false);
    });

    it('keeps APL for participating centers', async () => {
      prisma.tournament.findMany = jest.fn().mockResolvedValue([
        {
          id: 'apl-1',
          type: TournamentType.APL,
          centerLinks: [{ centerId: 'center-a' }],
        },
      ]);

      const visible = await service.filterTournamentIdsVisibleToViewer(player('center-a'), [
        'apl-1',
      ]);
      expect(visible.has('apl-1')).toBe(true);
    });
  });
});
