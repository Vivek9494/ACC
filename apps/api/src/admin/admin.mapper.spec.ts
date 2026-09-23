import { UserRole } from '@acc/types';

import {
  buildAdminUserListWhere,
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
        passwordResetLockedAt: null,
        role: UserRole.Player,
        createdAt: new Date('2024-01-15T00:00:00.000Z'),
        roleAssignments: [{ role: UserRole.Captain }],
      });

      expect(summary.maskedMobileNumber).toBe('+1 (***) ***-0007');
      expect(summary.mobileNumber).toBeUndefined();
      expect(summary.isLocked).toBe(false);
      expect(summary.roles).toEqual([UserRole.Captain]);
    });

    it('includes full mobile when includeFullMobile is true', () => {
      const summary = toAdminUserSummary(
        {
          id: 'u1',
          firstName: 'Dev',
          lastName: 'Player',
          mobileNumber: '+15199955472',
          profilePhotoUrl: null,
          isActive: true,
          passwordResetLockedAt: null,
          role: UserRole.Player,
          createdAt: new Date('2024-01-15T00:00:00.000Z'),
          roleAssignments: [],
        },
        { includeFullMobile: true },
      );

      expect(summary.mobileNumber).toBe('+15199955472');
      expect(summary.maskedMobileNumber).toBe('+1 (***) ***-5472');
    });

    it('marks isLocked only within the 24h password-reset lock window', () => {
      const now = new Date('2026-09-23T12:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const locked = toAdminUserSummary({
        id: 'u1',
        firstName: 'Dev',
        lastName: 'Player',
        mobileNumber: '+15555550007',
        profilePhotoUrl: null,
        isActive: true,
        passwordResetLockedAt: new Date('2026-09-23T06:00:00.000Z'),
        role: UserRole.Player,
        createdAt: new Date('2024-01-15T00:00:00.000Z'),
        roleAssignments: [],
      });
      expect(locked.isLocked).toBe(true);

      const expired = toAdminUserSummary({
        id: 'u2',
        firstName: 'Old',
        lastName: 'Lock',
        mobileNumber: '+15555550008',
        profilePhotoUrl: null,
        isActive: true,
        passwordResetLockedAt: new Date('2026-09-22T11:00:00.000Z'),
        role: UserRole.Player,
        createdAt: new Date('2024-01-15T00:00:00.000Z'),
        roleAssignments: [],
      });
      expect(expired.isLocked).toBe(false);

      jest.useRealTimers();
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

  describe('buildAdminUserListWhere', () => {
    it('excludes soft-deleted users by default', () => {
      expect(buildAdminUserListWhere({})).toEqual({ deletedAt: null });
    });

    it('filters by province via the user registration center', () => {
      expect(buildAdminUserListWhere({ provinceId: 'prov-1' })).toEqual({
        AND: [{ deletedAt: null }, { center: { provinceId: 'prov-1' } }],
      });
    });

    it('filters by center id', () => {
      expect(buildAdminUserListWhere({ centerId: 'center-1' })).toEqual({
        AND: [{ deletedAt: null }, { centerId: 'center-1' }],
      });
    });

    it('combines search with geography filters', () => {
      const where = buildAdminUserListWhere({ q: 'Priya', provinceId: 'prov-1' });
      expect(where).toEqual({
        AND: [
          { deletedAt: null },
          {
            OR: [
              { firstName: { contains: 'Priya', mode: 'insensitive' } },
              { lastName: { contains: 'Priya', mode: 'insensitive' } },
            ],
          },
          { center: { provinceId: 'prov-1' } },
        ],
      });
    });

    it('prefers center filter over province when both are provided', () => {
      const where = buildAdminUserListWhere({
        provinceId: 'prov-1',
        centerId: 'center-1',
      });
      expect(where).toEqual({
        AND: [{ deletedAt: null }, { centerId: 'center-1' }],
      });
    });
  });
});
