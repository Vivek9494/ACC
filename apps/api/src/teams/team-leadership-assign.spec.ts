import {
  TournamentType,
  UserRole,
  canAssignTeamLeadershipRoles,
  isTeamLeadershipAssignmentWindowOpen,
  REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS,
} from '@acc/types';

describe('canAssignTeamLeadershipRoles', () => {
  const admin = { userId: 'a1', role: UserRole.Admin };
  const cm = { userId: 'cm1', role: UserRole.ClubManager };
  const sevak = {
    userId: 's1',
    role: UserRole.CenterSevak,
    sevakCenterIds: ['center-A'],
  };

  it('allows Admin everywhere', () => {
    expect(
      canAssignTeamLeadershipRoles(admin, {
        type: TournamentType.ACC,
        createdByUserId: 'x',
        participatingCenterIds: [],
      }),
    ).toBe(true);
  });

  it('multi-center CENTER: Admin + participating Sevak; denies CM', () => {
    const tournament = {
      type: TournamentType.Center,
      createdByUserId: 'x',
      participatingCenterIds: ['center-A', 'center-B'],
    };
    expect(canAssignTeamLeadershipRoles(admin, tournament)).toBe(true);
    expect(canAssignTeamLeadershipRoles(sevak, tournament)).toBe(true);
    expect(canAssignTeamLeadershipRoles(cm, tournament)).toBe(false);
    expect(
      canAssignTeamLeadershipRoles({ ...sevak, sevakCenterIds: ['center-Z'] }, tournament),
    ).toBe(false);
  });

  it('single-center CENTER: Admin + that center Sevak; denies CM', () => {
    const tournament = {
      type: TournamentType.Center,
      createdByUserId: 'x',
      participatingCenterIds: ['center-A'],
    };
    expect(canAssignTeamLeadershipRoles(sevak, tournament)).toBe(true);
    expect(canAssignTeamLeadershipRoles(cm, tournament)).toBe(false);
  });

  it('APL: Admin + CM only', () => {
    const tournament = {
      type: TournamentType.APL,
      createdByUserId: 'x',
      participatingCenterIds: ['center-A', 'center-B'],
    };
    expect(canAssignTeamLeadershipRoles(cm, tournament)).toBe(true);
    expect(canAssignTeamLeadershipRoles(sevak, tournament)).toBe(false);
  });

  it('Leather: Admin + CM only; Sevak denied', () => {
    const tournament = {
      type: TournamentType.ACC,
      createdByUserId: sevak.userId,
      participatingCenterIds: ['center-A'],
    };
    expect(canAssignTeamLeadershipRoles(cm, tournament)).toBe(true);
    expect(canAssignTeamLeadershipRoles(sevak, tournament)).toBe(false);
  });
});

describe('isTeamLeadershipAssignmentWindowOpen', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('opens after registrationCloseAt', () => {
    expect(
      isTeamLeadershipAssignmentWindowOpen(
        {
          registrationOpenAt: '2026-06-01T00:00:00.000Z',
          registrationCloseAt: '2026-06-14T00:00:00.000Z',
        },
        now,
      ),
    ).toBe(true);
    expect(
      isTeamLeadershipAssignmentWindowOpen(
        {
          registrationOpenAt: '2026-06-01T00:00:00.000Z',
          registrationCloseAt: '2026-06-20T00:00:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('falls back to openAt + 48h when close is unset', () => {
    const openAt = new Date(now.getTime() - REGISTRATION_VERIFICATION_NO_AUCTION_GRACE_MS - 1000);
    expect(
      isTeamLeadershipAssignmentWindowOpen(
        {
          registrationOpenAt: openAt.toISOString(),
          registrationCloseAt: null,
        },
        now,
      ),
    ).toBe(true);
    expect(
      isTeamLeadershipAssignmentWindowOpen(
        {
          registrationOpenAt: now.toISOString(),
          registrationCloseAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it('stays closed when neither open nor close is set', () => {
    expect(
      isTeamLeadershipAssignmentWindowOpen(
        { registrationOpenAt: null, registrationCloseAt: null },
        now,
      ),
    ).toBe(false);
  });
});
