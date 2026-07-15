import {
  BallType,
  MatchState,
  UserRole,
  canViewCaptainDashboardPunchTimeButton,
  canViewMatchPlayersPunchTimeButton,
  isPunchTimeReadOnly,
  resolvePunchTimeViewScope,
  type AuthUser,
} from '@acc/types';

const baseMatch = {
  ballType: BallType.Leather,
  state: MatchState.Live,
  tournamentId: 'tournament-1',
  tournamentCreatedByUserId: 'organizer-1',
  homeTeamId: 'team-a',
  awayTeamId: 'team-b',
  homeTeamName: 'ACC 3',
  awayTeamName: 'ACC 6',
  externalOpponentName: null,
};

function authUser(
  role: UserRole,
  teamLeadAssignments: AuthUser['teamLeadAssignments'] = [],
  id = 'user-1',
): AuthUser {
  return {
    id,
    role,
    teamLeadAssignments,
  } as AuthUser;
}

describe('punch time scope', () => {
  it('shows the Match Detail button for leather live matches to admin and match captains', () => {
    expect(canViewMatchPlayersPunchTimeButton(authUser(UserRole.Admin), baseMatch)).toBe(true);
    expect(
      canViewMatchPlayersPunchTimeButton(
        authUser(UserRole.Captain, [
          { tournamentId: 'tournament-1', teamId: 'team-a', role: UserRole.Captain },
        ]),
        baseMatch,
      ),
    ).toBe(true);
    expect(canViewMatchPlayersPunchTimeButton(authUser(UserRole.Player), baseMatch)).toBe(false);
    expect(
      canViewMatchPlayersPunchTimeButton(authUser(UserRole.Admin), {
        ...baseMatch,
        ballType: BallType.Tennis,
      }),
    ).toBe(false);
    expect(
      canViewMatchPlayersPunchTimeButton(authUser(UserRole.Admin), {
        ...baseMatch,
        state: MatchState.Cancelled,
      }),
    ).toBe(false);
  });

  it('shows Match Detail punch-time button for Scheduled and Completed (view always)', () => {
    const captain = authUser(UserRole.Captain, [
      { tournamentId: 'tournament-1', teamId: 'team-a', role: UserRole.Captain },
    ]);
    expect(
      canViewMatchPlayersPunchTimeButton(captain, {
        ...baseMatch,
        state: MatchState.Scheduled,
      }),
    ).toBe(true);
    expect(canViewCaptainDashboardPunchTimeButton(captain, {
      ...baseMatch,
      state: MatchState.Scheduled,
    })).toBe(true);
    expect(
      canViewMatchPlayersPunchTimeButton(captain, {
        ...baseMatch,
        state: MatchState.Completed,
      }),
    ).toBe(true);
  });

  it('marks completed / no-result / scorecard-locked as read-only for overrides', () => {
    expect(isPunchTimeReadOnly(MatchState.Completed)).toBe(true);
    expect(isPunchTimeReadOnly(MatchState.NoResult)).toBe(true);
    expect(isPunchTimeReadOnly(MatchState.ScorecardLocked)).toBe(true);
    expect(isPunchTimeReadOnly(MatchState.Live)).toBe(false);
    expect(isPunchTimeReadOnly(MatchState.Scheduled)).toBe(false);
  });

  it('allows club managers who organize the tournament and blocks others', () => {
    expect(
      canViewMatchPlayersPunchTimeButton(
        authUser(UserRole.ClubManager, [], 'organizer-1'),
        baseMatch,
      ),
    ).toBe(true);
    expect(
      canViewMatchPlayersPunchTimeButton(
        authUser(UserRole.ClubManager, [], 'other-cm'),
        baseMatch,
      ),
    ).toBe(false);
  });

  it('allows a Club Manager who is Captain/VC of a match team even if not the organizer', () => {
    const cmCaptain = authUser(
      UserRole.ClubManager,
      [{ tournamentId: 'tournament-1', teamId: 'team-a', role: UserRole.Captain }],
      'cm-captain-1',
    );
    expect(canViewMatchPlayersPunchTimeButton(cmCaptain, baseMatch)).toBe(true);
    expect(resolvePunchTimeViewScope(cmCaptain, baseMatch)).toEqual({
      teams: [{ id: 'team-a', name: 'ACC 3' }],
      showTeamTabs: false,
      defaultTeamId: 'team-a',
    });
    expect(
      canViewMatchPlayersPunchTimeButton(
        authUser(UserRole.ClubManager, [], 'cm-captain-1'),
        baseMatch,
      ),
    ).toBe(false);
    expect(
      resolvePunchTimeViewScope(authUser(UserRole.ClubManager, [], 'cm-captain-1'), baseMatch),
    ).toBeNull();
  });

  it('scopes captain to their own team even in ACC-vs-ACC', () => {
    const scope = resolvePunchTimeViewScope(
      authUser(UserRole.Captain, [
        { tournamentId: 'tournament-1', teamId: 'team-b', role: UserRole.ViceCaptain },
      ]),
      baseMatch,
    );
    expect(scope).toEqual({
      teams: [{ id: 'team-b', name: 'ACC 6' }],
      showTeamTabs: false,
      defaultTeamId: 'team-b',
    });
  });

  it('scopes admin to two tabs for ACC-vs-ACC and one team for external opponents', () => {
    const accVsAcc = resolvePunchTimeViewScope(
      authUser(UserRole.ClubManager, [], 'organizer-1'),
      baseMatch,
    );
    expect(accVsAcc?.showTeamTabs).toBe(true);
    expect(accVsAcc?.teams).toHaveLength(2);

    const external = resolvePunchTimeViewScope(authUser(UserRole.Admin), {
      ...baseMatch,
      awayTeamId: null,
      awayTeamName: null,
      externalOpponentName: 'BEDCL XI',
    });
    expect(external).toEqual({
      teams: [{ id: 'team-a', name: 'ACC 3' }],
      showTeamTabs: false,
      defaultTeamId: 'team-a',
    });
  });
});
