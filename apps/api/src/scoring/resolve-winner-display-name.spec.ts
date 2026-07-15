import {
  formatMatchResultNote,
  replaceGenericHomeAwayInResultNote,
  resolveMatchWinnerDisplayName,
} from '@acc/types';

describe('resolveMatchWinnerDisplayName', () => {
  const leatherMatch = {
    homeTeamId: 'acc-3',
    awayTeamId: null as string | null,
    homeTeamName: 'ACC 3',
    awayTeamName: null as string | null,
    externalOpponentName: 'Gujarat Stars',
  };

  it('does not treat null === null as Away when an external side wins by wickets', () => {
    const name = resolveMatchWinnerDisplayName(
      leatherMatch,
      { winningTeamId: null },
      [
        { battingTeamId: 'acc-3', battingIsExternal: false, runs: 120 },
        { battingTeamId: null, battingIsExternal: true, runs: 121 },
      ],
    );
    expect(name).toBe('Gujarat Stars');
    expect(formatMatchResultNote(name, {
      decided: true,
      marginRuns: null,
      marginWickets: 4,
      isTie: false,
      superOverRequired: false,
      note: null,
    })).toBe('Gujarat Stars won by 4 wickets');
  });

  it('labels an external first-innings win by runs', () => {
    const name = resolveMatchWinnerDisplayName(
      leatherMatch,
      { winningTeamId: null },
      [
        { battingTeamId: null, battingIsExternal: true, runs: 160 },
        { battingTeamId: 'acc-3', battingIsExternal: false, runs: 140 },
      ],
    );
    expect(name).toBe('Gujarat Stars');
  });

  it('labels a registered home win by id without null pitfalls', () => {
    expect(
      resolveMatchWinnerDisplayName(
        {
          homeTeamId: 'home',
          awayTeamId: 'away',
          homeTeamName: 'ACC 3',
          awayTeamName: 'ACC 6',
          externalOpponentName: null,
        },
        { winningTeamId: 'home' },
        [
          { battingTeamId: 'home', battingIsExternal: false, runs: 150 },
          { battingTeamId: 'away', battingIsExternal: false, runs: 140 },
        ],
      ),
    ).toBe('ACC 3');
  });
});

describe('replaceGenericHomeAwayInResultNote', () => {
  it('rewrites legacy Away/Home winner labels', () => {
    expect(
      replaceGenericHomeAwayInResultNote('Away won by 4 wickets', 'ACC 3', 'Gujarat Stars'),
    ).toBe('Gujarat Stars won by 4 wickets');
    expect(
      replaceGenericHomeAwayInResultNote('Home won by 12 runs', 'ACC 3', 'Gujarat Stars'),
    ).toBe('ACC 3 won by 12 runs');
  });
});
