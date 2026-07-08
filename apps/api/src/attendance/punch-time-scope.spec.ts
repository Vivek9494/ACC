import {
  BallType,
  MatchState,
  UserRole,
  canViewMatchPlayersPunchTimeButton,
  resolvePunchTimeViewScope,
  type AuthUser,
} from '@acc/types';

const baseMatch = {
  ballType: BallType.Leather,
  state: MatchState.Live,
  tournamentId: 'tournament-1',
  homeTeamId: 'team-a',
  awayTeamId: 'team-b',
  homeTeamName: 'ACC 3',
  awayTeamName: 'ACC 6',
  externalOpponentName: null,
};

function authUser(
  role: UserRole,
  teamLeadAssignments: AuthUser['teamLeadAssignments'] = [],
): AuthUser {
  return {
    id: 'user-1',
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
    const accVsAcc = resolvePunchTimeViewScope(authUser(UserRole.ClubManager), baseMatch);
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
