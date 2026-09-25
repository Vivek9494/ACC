import 'reflect-metadata';

import { AuthErrorCode, UserRole, type AuthUser } from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

import { CaptainRoleGuard } from './captain-role.guard';

describe('CaptainRoleGuard', () => {
  const prisma = {
    roleAssignment: { findFirst: jest.fn() },
  };
  const guard = new CaptainRoleGuard(prisma as never);

  const actor: AuthUser = {
    id: 'user-1',
    firstName: 'Test',
    lastName: 'User',
    mobileNumber: '+15555550001',
    email: 'user@acc.local',
    centerId: 'center-A',
    jerseyNumber: 1,
    profilePhotoUrl: null,
    role: UserRole.Player,
    isActive: true,
  };

  function contextFor(user: AuthUser) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as never;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a user with a Cap/VC RoleAssignment', async () => {
    prisma.roleAssignment.findFirst.mockResolvedValue({ id: 'ra-1' });

    await expect(guard.canActivate(contextFor(actor))).resolves.toBe(true);
    expect(prisma.roleAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        role: { in: [UserRole.Captain, UserRole.ViceCaptain] },
      },
      select: { id: true },
    });
  });

  it('rejects a global Captain with no RoleAssignment', async () => {
    prisma.roleAssignment.findFirst.mockResolvedValue(null);
    const globalCaptain: AuthUser = { ...actor, role: UserRole.Captain };

    try {
      await guard.canActivate(contextFor(globalCaptain));
      fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ error: AuthErrorCode.Forbidden }),
      );
    }
  });
});
