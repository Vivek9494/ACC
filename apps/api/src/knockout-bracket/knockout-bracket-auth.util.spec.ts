import { type AuthUser, UserRole } from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

import { assertCanManageKnockoutBracket } from './knockout-bracket-auth.util';

function user(overrides: Partial<AuthUser> & Pick<AuthUser, 'id' | 'role'>): AuthUser {
  return {
    firstName: 'Test',
    lastName: 'User',
    mobileNumber: '+15555550000',
    email: 't@acc.local',
    centerId: 'c1',
    jerseyNumber: 1,
    profilePhotoUrl: null,
    isActive: true,
    ...overrides,
  };
}

describe('assertCanManageKnockoutBracket', () => {
  const tournament = { createdByUserId: 'cm-owner' };

  it('allows Admin regardless of creator', () => {
    expect(() =>
      assertCanManageKnockoutBracket(user({ id: 'admin-1', role: UserRole.Admin }), tournament),
    ).not.toThrow();
  });

  it('allows the Club Manager who created the tournament', () => {
    expect(() =>
      assertCanManageKnockoutBracket(
        user({ id: 'cm-owner', role: UserRole.ClubManager }),
        tournament,
      ),
    ).not.toThrow();
  });

  it('denies a different Club Manager', () => {
    expect(() =>
      assertCanManageKnockoutBracket(
        user({ id: 'cm-other', role: UserRole.ClubManager }),
        tournament,
      ),
    ).toThrow(ForbiddenException);
  });

  it('denies Center Sevak and Player', () => {
    expect(() =>
      assertCanManageKnockoutBracket(
        user({ id: 'sevak-1', role: UserRole.CenterSevak }),
        tournament,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertCanManageKnockoutBracket(user({ id: 'p-1', role: UserRole.Player }), tournament),
    ).toThrow(ForbiddenException);
  });
});
