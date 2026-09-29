import { BallType, UserRole } from '@acc/types';
import { describe, expect, it } from 'vitest';

import { navItemForPath, navItemsFor } from '@/app/nav';

import {
  BALL_TYPE_OPTIONS,
  sortByActiveThenName,
  toggleId,
  validateGeographyName,
  validateTournamentTypeForm,
} from './geography';

describe('geography nav access', () => {
  it('is Admin-only, like the API and the mobile Geography tab', () => {
    expect(navItemsFor(UserRole.Admin).map((item) => item.path)).toContain('/geography');
    expect(navItemsFor(UserRole.ClubManager).map((item) => item.path)).not.toContain('/geography');
    expect(navItemForPath('/geography/provinces/p1')?.path).toBe('/geography');
  });
});

describe('tournament type form', () => {
  it('lists tennis before leather', () => {
    expect(BALL_TYPE_OPTIONS.map((o) => o.value)).toEqual([BallType.Tennis, BallType.Leather]);
  });

  it('requires a name, a province and at least one center', () => {
    expect(
      validateTournamentTypeForm({
        ballType: BallType.Tennis,
        name: '  ',
        provinceId: null,
        centerIds: [],
      }),
    ).toEqual({
      name: 'Name is required',
      provinceId: 'Select a province',
      centerIds: 'Select at least one participating center',
    });
    expect(
      validateTournamentTypeForm({
        ballType: BallType.Leather,
        name: 'APL',
        provinceId: 'p1',
        centerIds: ['c1'],
      }),
    ).toEqual({});
  });

  it('toggles center ids', () => {
    expect(toggleId(['a', 'b'], 'b')).toEqual(['a']);
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
  });
});

describe('geography lists', () => {
  it('validates province / center names', () => {
    expect(validateGeographyName('', 'Center')).toBe('Center name is required');
    expect(validateGeographyName('x'.repeat(121), 'Province')).toBe(
      'Province name must be at most 120 characters',
    );
    expect(validateGeographyName(' Ontario ', 'Province')).toBeNull();
  });

  it('puts archived rows after active ones', () => {
    const rows = [
      { name: 'B', isActive: false },
      { name: 'C', isActive: true },
      { name: 'A', isActive: true },
    ];
    expect(sortByActiveThenName(rows).map((r) => r.name)).toEqual(['A', 'C', 'B']);
  });
});
