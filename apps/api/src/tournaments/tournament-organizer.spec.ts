import {
  TournamentType,
  UserRole,
  canCenterSevakOrganizeTournament,
  canSevakManageVerificationAtCenter,
  isMultiCenterTournament,
  canOrganizeTournament,
  resolveSevakVerificationCenterIds,
} from '@acc/types';

describe('tournament organizer helpers', () => {
  const apl = {
    type: TournamentType.APL,
    createdByUserId: 'cm-1',
    participatingCenterIds: ['c1', 'c2', 'c3'],
  };
  const multi = {
    type: TournamentType.Center,
    createdByUserId: 'creator-sevak',
    participatingCenterIds: ['c1', 'c2'],
  };
  const single = {
    type: TournamentType.Center,
    createdByUserId: 'creator-sevak',
    participatingCenterIds: ['c1'],
  };
  const leather = {
    type: TournamentType.ACC,
    createdByUserId: 'cm-1',
    participatingCenterIds: [],
  };

  it('detects multi-center CENTER tournaments by participating count', () => {
    expect(isMultiCenterTournament(TournamentType.Center, ['c1', 'c2'])).toBe(true);
    expect(isMultiCenterTournament(TournamentType.Center, ['c1'])).toBe(false);
    expect(isMultiCenterTournament(TournamentType.APL, ['c1', 'c2'])).toBe(false);
  });

  describe('canOrganizeTournament', () => {
    it('Admin is always organizer', () => {
      expect(
        canOrganizeTournament({ userId: 'a', role: UserRole.Admin }, apl),
      ).toBe(true);
      expect(
        canOrganizeTournament({ userId: 'a', role: UserRole.Admin }, multi),
      ).toBe(true);
    });

    it('APL: Club Manager yes, Sevak no', () => {
      expect(
        canOrganizeTournament({ userId: 'cm', role: UserRole.ClubManager }, apl),
      ).toBe(true);
      expect(
        canOrganizeTournament(
          { userId: 's', role: UserRole.CenterSevak, sevakCenterIds: ['c1'] },
          apl,
        ),
      ).toBe(false);
    });

    it('multi-center: participating Sevak yes (creator irrelevant), CM no', () => {
      expect(
        canOrganizeTournament(
          { userId: 'other', role: UserRole.CenterSevak, sevakCenterIds: ['c2'] },
          multi,
        ),
      ).toBe(true);
      expect(
        canOrganizeTournament(
          { userId: 'z', role: UserRole.CenterSevak, sevakCenterIds: ['c9'] },
          multi,
        ),
      ).toBe(false);
      expect(
        canOrganizeTournament({ userId: 'cm', role: UserRole.ClubManager }, multi),
      ).toBe(false);
    });

    it('single-center: Sevak creator or own center; CM yes', () => {
      expect(
        canCenterSevakOrganizeTournament(['c9'], 'creator-sevak', single),
      ).toBe(true);
      expect(canCenterSevakOrganizeTournament(['c1'], 'other', single)).toBe(true);
      expect(canCenterSevakOrganizeTournament(['c9'], 'other', single)).toBe(false);
      expect(
        canOrganizeTournament({ userId: 'cm', role: UserRole.ClubManager }, single),
      ).toBe(true);
    });

    it('leather ACC: CM yes; Sevak creator or own center (unchanged)', () => {
      expect(
        canOrganizeTournament({ userId: 'cm', role: UserRole.ClubManager }, leather),
      ).toBe(true);
      expect(
        canOrganizeTournament(
          { userId: 'cm-1', role: UserRole.CenterSevak, sevakCenterIds: [] },
          leather,
        ),
      ).toBe(true);
      expect(
        canOrganizeTournament(
          { userId: 's', role: UserRole.CenterSevak, sevakCenterIds: ['c1'] },
          { ...leather, participatingCenterIds: ['c1'] },
        ),
      ).toBe(true);
      expect(
        canOrganizeTournament(
          { userId: 's', role: UserRole.CenterSevak, sevakCenterIds: ['c9'] },
          leather,
        ),
      ).toBe(false);
    });
  });

  describe('resolveSevakVerificationCenterIds', () => {
    it('APL / single: own ∩ participating', () => {
      expect(resolveSevakVerificationCenterIds(['c1', 'c9'], apl)).toEqual(['c1']);
      expect(resolveSevakVerificationCenterIds(['c1'], single)).toEqual(['c1']);
      expect(resolveSevakVerificationCenterIds(['c9'], single)).toEqual([]);
    });

    it('multi-center organizer Sevak gets all participating centers', () => {
      expect(resolveSevakVerificationCenterIds(['c1'], multi)).toEqual(['c1', 'c2']);
      expect(resolveSevakVerificationCenterIds(['c9'], multi)).toEqual([]);
      expect(canSevakManageVerificationAtCenter(['c1'], multi, 'c2')).toBe(true);
      expect(canSevakManageVerificationAtCenter(['c1'], apl, 'c2')).toBe(false);
    });
  });
});
