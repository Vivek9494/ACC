import {
  ADMIN_ASSIGNABLE_ROLES,
  AuthErrorCode,
  MOBILE_NUMBER_EXISTS_MESSAGE,
  SIGNUP_VALIDATION_MESSAGES,
  UserRole,
  mapAdminUserApiErrorToFields,
  validateAdminUserCreateForm,
  validateAdminUserEditForm,
  type CenterSummary,
} from '@acc/types';
import { describe, expect, it } from 'vitest';

import {
  adminUsersSearchParams,
  currentCursor,
  DEFAULT_USER_FILTERS,
  FIRST_PAGE,
  nextPage,
  previousPage,
  toListParams,
  userMobileLabel,
  withCenter,
  withProvince,
} from './user-list';

const centers: CenterSummary[] = [
  { id: 'c-bra', name: 'Brampton', provinceId: 'p-on' },
  { id: 'c-mis', name: 'Mississauga', provinceId: 'p-on' },
  { id: 'c-cal', name: 'Calgary', provinceId: 'p-ab' },
];

describe('province → center cascade', () => {
  it('keeps a center that belongs to the new province', () => {
    const f = withProvince({ ...DEFAULT_USER_FILTERS, centerId: 'c-bra' }, 'p-on', centers);
    expect(f).toMatchObject({ provinceId: 'p-on', centerId: 'c-bra' });
  });

  it('clears a center from another province', () => {
    const f = withProvince({ ...DEFAULT_USER_FILTERS, provinceId: 'p-on', centerId: 'c-bra' }, 'p-ab', centers);
    expect(f).toMatchObject({ provinceId: 'p-ab', centerId: null });
  });

  it('picking a center selects its province', () => {
    expect(withCenter(DEFAULT_USER_FILTERS, 'c-cal', centers)).toMatchObject({
      provinceId: 'p-ab',
      centerId: 'c-cal',
    });
  });

  it('clearing the center keeps the province', () => {
    const f = withCenter({ ...DEFAULT_USER_FILTERS, provinceId: 'p-on', centerId: 'c-bra' }, null, centers);
    expect(f).toMatchObject({ provinceId: 'p-on', centerId: null });
  });
});

describe('list params', () => {
  it('omits empty filters and trims search', () => {
    const params = toListParams({ ...DEFAULT_USER_FILTERS, search: '  priya ', role: UserRole.Player }, null, 25);
    expect(params).toEqual({ q: 'priya', role: UserRole.Player, limit: 25 });
    expect(adminUsersSearchParams(params)).toBe('q=priya&role=PLAYER&limit=25');
  });

  it('passes geography and cursor', () => {
    expect(
      adminUsersSearchParams(
        toListParams({ ...DEFAULT_USER_FILTERS, provinceId: 'p-on', centerId: 'c-bra' }, 'u-9', 10),
      ),
    ).toBe('provinceId=p-on&centerId=c-bra&cursor=u-9&limit=10');
  });
});

describe('cursor paging', () => {
  it('walks forward and back through remembered cursors', () => {
    const p1 = nextPage(FIRST_PAGE, 'u-25');
    const p2 = nextPage(p1, 'u-50');
    expect(currentCursor(p2)).toBe('u-50');
    expect(currentCursor(previousPage(p2))).toBe('u-25');
    expect(currentCursor(previousPage(previousPage(p2)))).toBeNull();
    expect(previousPage(FIRST_PAGE)).toBe(FIRST_PAGE);
  });

  it('does not advance past the last page', () => {
    expect(nextPage(FIRST_PAGE, null)).toBe(FIRST_PAGE);
  });

  it('drops stale forward cursors after stepping back', () => {
    const back = previousPage(nextPage(nextPage(FIRST_PAGE, 'a'), 'b'));
    expect(nextPage(back, 'c').cursors).toEqual([null, 'a', 'c']);
  });
});

describe('mobile label', () => {
  it('formats full numbers and falls back to the masked one', () => {
    expect(userMobileLabel({ mobileNumber: '+14165550123', maskedMobileNumber: 'x' })).toContain('416');
    expect(userMobileLabel({ maskedMobileNumber: '+1 (***) ***-0123' })).toBe('+1 (***) ***-0123');
  });
});

describe('shared admin user form rules', () => {
  const valid = {
    firstName: 'Priya',
    lastName: 'Patel',
    mobileNumber: '4165550123',
    email: '',
    dateOfBirth: '',
    provinceId: 'p-on',
    centerId: 'c-bra',
  };

  it('role dropdown excludes team-scoped roles', () => {
    expect(ADMIN_ASSIGNABLE_ROLES).toEqual([
      UserRole.Admin,
      UserRole.ClubManager,
      UserRole.CenterSevak,
      UserRole.Player,
    ]);
  });

  it('create: date of birth optional; province and center required', () => {
    expect(validateAdminUserCreateForm(valid)).toEqual({});
    expect(validateAdminUserCreateForm({ ...valid, provinceId: null, centerId: null })).toEqual({
      province: SIGNUP_VALIDATION_MESSAGES.province.required,
      center: SIGNUP_VALIDATION_MESSAGES.center.required,
    });
  });

  it('edit: date of birth required and jersey number range checked', () => {
    const errors = validateAdminUserEditForm({ ...valid, jerseyNumber: '1000', jerseyName: '' });
    expect(errors.dateOfBirth).toBe(SIGNUP_VALIDATION_MESSAGES.dateOfBirth.required);
    expect(errors.jerseyNumber).toBe('Jersey number must be between 0 and 999');
  });

  it('maps api conflicts onto fields', () => {
    expect(
      mapAdminUserApiErrorToFields({ code: AuthErrorCode.MobileNumberExists, message: MOBILE_NUMBER_EXISTS_MESSAGE }),
    ).toEqual({ mobileNumber: MOBILE_NUMBER_EXISTS_MESSAGE });
  });
});
