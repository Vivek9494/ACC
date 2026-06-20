import { UserRole } from '@acc/types';

import {
  buildAdminUserSearchWhere,
  toAdminUserSummary,
} from './admin.mapper';

describe('admin.mapper', () => {
  describe('toAdminUserSummary', () => {
    it('masks mobile and dedupes roles', () => {
      const summary = toAdminUserSummary({
        id: 'u1',
        firstName: 'Dev',
        lastName: 'Player',
        mobileNumber: '+15555550007',
        profilePhotoUrl: null,
        isActive: true,
        role: UserRole.Player,
        createdAt: new Date('2024-01-15T00:00:00.000Z'),
        roleAssignments: [{ role: UserRole.Captain }],
      });

      expect(summary.maskedMobileNumber).toBe('+1 (***) ***-0007');
      expect(summary.roles).toEqual([UserRole.Captain]);
    });
  });

  describe('buildAdminUserSearchWhere', () => {
    it('returns undefined for empty query', () => {
      expect(buildAdminUserSearchWhere(undefined)).toBeUndefined();
      expect(buildAdminUserSearchWhere('   ')).toBeUndefined();
    });

    it('searches name and mobile digits', () => {
      const where = buildAdminUserSearchWhere('55550007');
      expect(where?.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ mobileNumber: { contains: '55550007' } }),
        ]),
      );
    });
  });
});
