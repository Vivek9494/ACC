import { UserRole } from '@acc/types';

import {
  resolveOrHealCenterSevakCenterIds,
  syncCenterSevakRoleAssignment,
} from './center-sevak-assignment';

describe('center-sevak-assignment', () => {
  function mockDb(overrides?: {
    assignments?: { centerId: string | null }[];
    user?: { role: string; centerId: string } | null;
  }) {
    const assignments = overrides?.assignments ?? [];
    const user = overrides?.user ?? null;
    return {
      roleAssignment: {
        findMany: jest.fn().mockResolvedValue(assignments),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'ra-1' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
    };
  }

  describe('syncCenterSevakRoleAssignment', () => {
    it('creates a Sevak assignment when platform role is Center Sevak', async () => {
      const db = mockDb();
      await syncCenterSevakRoleAssignment(
        db as never,
        'user-1',
        UserRole.CenterSevak,
        'center-A',
      );

      expect(db.roleAssignment.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', role: UserRole.CenterSevak },
      });
      expect(db.roleAssignment.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          role: UserRole.CenterSevak,
          centerId: 'center-A',
        },
      });
    });

    it('removes Sevak assignments when demoting away from Center Sevak', async () => {
      const db = mockDb();
      await syncCenterSevakRoleAssignment(db as never, 'user-1', UserRole.Player, 'center-A');

      expect(db.roleAssignment.deleteMany).toHaveBeenCalled();
      expect(db.roleAssignment.create).not.toHaveBeenCalled();
    });
  });

  describe('resolveOrHealCenterSevakCenterIds', () => {
    it('returns existing assignment centers without healing', async () => {
      const db = mockDb({ assignments: [{ centerId: 'center-A' }] });
      const ids = await resolveOrHealCenterSevakCenterIds(db as never, 'user-1');

      expect(ids).toEqual(['center-A']);
      expect(db.roleAssignment.create).not.toHaveBeenCalled();
    });

    it('heals from User.centerId when platform Sevak has no assignment', async () => {
      const db = mockDb({
        assignments: [],
        user: { role: UserRole.CenterSevak, centerId: 'center-B' },
      });
      const ids = await resolveOrHealCenterSevakCenterIds(db as never, 'user-1');

      expect(ids).toEqual(['center-B']);
      expect(db.roleAssignment.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          role: UserRole.CenterSevak,
          centerId: 'center-B',
        },
      });
    });

    it('returns empty when user is not a platform Center Sevak', async () => {
      const db = mockDb({
        assignments: [],
        user: { role: UserRole.Player, centerId: 'center-B' },
      });
      const ids = await resolveOrHealCenterSevakCenterIds(db as never, 'user-1');

      expect(ids).toEqual([]);
      expect(db.roleAssignment.create).not.toHaveBeenCalled();
    });
  });
});
