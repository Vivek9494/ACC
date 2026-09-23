import { BallType, TournamentType, UserRole, type AuthUser } from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

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
    it('does not filter tennis tournaments for any viewer (view-all)', () => {
      expect(service.centerTournamentListWhere(admin)).toBeNull();
      expect(service.centerTournamentListWhere(null)).toBeNull();
      expect(service.centerTournamentListWhere(player('windsor'))).toBeNull();
    });
  });

  describe('assertCanViewCenterLevelTournament', () => {
    it('allows view for non-participating players and guests', async () => {
      await expect(
        service.assertCanViewCenterLevelTournament(player('windsor'), {
          id: 'apl-1',
          type: TournamentType.APL,
        }),
      ).resolves.toBeUndefined();
      await expect(
        service.assertCanViewCenterLevelTournament(null, {
          id: 't1',
          type: TournamentType.Center,
        }),
      ).resolves.toBeUndefined();
      expect(prisma.tournamentCenter.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('filterTournamentIdsVisibleToViewer', () => {
    it('keeps APL for non-participating centers (view-all)', async () => {
      const visible = await service.filterTournamentIdsVisibleToViewer(player('windsor'), [
        'apl-1',
      ]);
      expect(visible.has('apl-1')).toBe(true);
      expect(prisma.tournament.findMany).not.toHaveBeenCalled();
    });
  });

  describe('canRegisterForTennisTournament', () => {
    it('allows Admin without checking TournamentCenter', async () => {
      await expect(
        service.canRegisterForTennisTournament(admin, {
          id: 'apl-1',
          type: TournamentType.APL,
          ballType: BallType.Tennis,
        }),
      ).resolves.toBe(true);
      expect(prisma.tournamentCenter.findFirst).not.toHaveBeenCalled();
    });

    it('allows a participating center player', async () => {
      prisma.tournamentCenter.findFirst = jest.fn().mockResolvedValue({ centerId: 'center-a' });
      await expect(
        service.canRegisterForTennisTournament(player('center-a'), {
          id: 'apl-1',
          type: TournamentType.APL,
          ballType: BallType.Tennis,
        }),
      ).resolves.toBe(true);
    });

    it('denies a non-participating center player', async () => {
      prisma.tournamentCenter.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.canRegisterForTennisTournament(player('windsor'), {
          id: 'apl-1',
          type: TournamentType.APL,
          ballType: BallType.Tennis,
        }),
      ).resolves.toBe(false);

      await expect(
        service.assertCanRegisterForTennisTournament(player('windsor'), {
          id: 'apl-1',
          type: TournamentType.APL,
          ballType: BallType.Tennis,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
