import { BallType, type AuthUser, Permission, UserRole } from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

import {
  assertCanCreateMatchFixture,
  assertCanScheduleTournamentMatches,
  canActorScheduleTournamentMatches,
} from './create-match-auth.util';
import type { PermissionService } from '../authz/permission.service';
import type { PrismaService } from '../prisma/prisma.service';

const captainActor: AuthUser = {
  id: 'captain-1',
  firstName: 'Cap',
  lastName: 'Tain',
  mobileNumber: '+15555551000',
  email: 'cap@acc.local',
  centerId: 'center-A',
  jerseyNumber: 7,
  profilePhotoUrl: null,
  role: UserRole.Captain,
  isActive: true,
  teamLeadAssignments: [{ role: UserRole.Captain, tournamentId: 'tour-1', teamId: 'team-a' }],
};

const leatherTournament = { id: 'tour-1', ballType: BallType.Leather };
const tennisTournament = { id: 'tour-2', ballType: BallType.Tennis };

function mockPrisma(leaderTeamIds: string[]): PrismaService {
  return {
    roleAssignment: {
      findMany: jest.fn().mockResolvedValue(
        leaderTeamIds.map((teamId) => ({ teamId })),
      ),
      findFirst: jest.fn().mockResolvedValue(
        leaderTeamIds.length > 0 ? { teamId: leaderTeamIds[0] } : null,
      ),
    },
  } as unknown as PrismaService;
}

function mockPermissions(checkImpl: jest.Mock): PermissionService {
  return { check: checkImpl } as unknown as PermissionService;
}

describe('create-match-auth.util', () => {
  describe('assertCanCreateMatchFixture', () => {
    it('allows organizers without team scope checks', async () => {
      const permissions = mockPermissions(
        jest.fn().mockResolvedValueOnce(true),
      );
      const prisma = mockPrisma([]);

      await expect(
        assertCanCreateMatchFixture(
          permissions,
          prisma,
          captainActor,
          leatherTournament,
          'team-other',
        ),
      ).resolves.toBeUndefined();
    });

    it('allows captain with own team as Team A on leather', async () => {
      const permissions = mockPermissions(
        jest.fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true),
      );
      const prisma = mockPrisma(['team-a']);

      await expect(
        assertCanCreateMatchFixture(
          permissions,
          prisma,
          captainActor,
          leatherTournament,
          'team-a',
        ),
      ).resolves.toBeUndefined();
    });

    it('rejects captain creating a fixture between two other teams', async () => {
      const permissions = mockPermissions(jest.fn().mockResolvedValue(false));
      const prisma = mockPrisma(['team-a']);

      await expect(
        assertCanCreateMatchFixture(
          permissions,
          prisma,
          captainActor,
          leatherTournament,
          'team-b',
        ),
      ).rejects.toMatchObject({
        response: {
          message: 'Captains can only create matches with their own team as Team A',
        },
      });
    });

    it('rejects captain on tennis tournaments', async () => {
      const permissions = mockPermissions(jest.fn().mockResolvedValue(false));
      const prisma = mockPrisma(['team-a']);

      await expect(
        assertCanCreateMatchFixture(
          permissions,
          prisma,
          captainActor,
          tennisTournament,
          'team-a',
        ),
      ).rejects.toMatchObject({
        response: { message: 'You do not have permission to create matches' },
      });
    });

    it('rejects captain without leadership assignments', async () => {
      const permissions = mockPermissions(jest.fn().mockResolvedValue(false));
      const prisma = mockPrisma([]);

      await expect(
        assertCanCreateMatchFixture(
          permissions,
          prisma,
          captainActor,
          leatherTournament,
          'team-a',
        ),
      ).rejects.toMatchObject({
        response: { message: 'You do not have permission to create matches' },
      });
    });
  });

  describe('canActorScheduleTournamentMatches', () => {
    it('allows captain to open schedule flow for leather tournament', async () => {
      const permissions = mockPermissions(
        jest.fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true),
      );
      const prisma = mockPrisma(['team-a']);

      await expect(
        canActorScheduleTournamentMatches(permissions, prisma, captainActor, leatherTournament),
      ).resolves.toBe(true);
    });

    it('denies captain on tennis tournament', async () => {
      const permissions = mockPermissions(jest.fn().mockResolvedValue(false));
      const prisma = mockPrisma(['team-a']);

      await expect(
        canActorScheduleTournamentMatches(permissions, prisma, captainActor, tennisTournament),
      ).resolves.toBe(false);
    });
  });

  describe('assertCanScheduleTournamentMatches', () => {
    it('allows captain to open schedule flow for leather tournament', async () => {
      const permissions = mockPermissions(
        jest.fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true),
      );
      const prisma = mockPrisma(['team-a']);

      await expect(
        assertCanScheduleTournamentMatches(permissions, prisma, captainActor, leatherTournament),
      ).resolves.toBeUndefined();
    });

    it('rejects captain on tennis tournament', async () => {
      const permissions = mockPermissions(jest.fn().mockResolvedValue(false));
      const prisma = mockPrisma(['team-a']);

      await expect(
        assertCanScheduleTournamentMatches(permissions, prisma, captainActor, tennisTournament),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
