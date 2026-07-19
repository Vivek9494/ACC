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
      { winningTeamId: null, marginWickets: 4, marginRuns: null },
      [
        { battingTeamId: 'acc-3', battingIsExternal: false, runs: 120 },
        { battingTeamId: null, battingIsExternal: true, runs: 121 },
      ],
    );
    expect(name).toBe('Gujarat Stars');
    expect(
      formatMatchResultNote(name, {
        decided: true,
        marginRuns: null,
        marginWickets: 4,
        isTie: false,
        superOverRequired: false,
        note: null,
      }),
    ).toBe('Gujarat Stars won by 4 wickets');
  });

  it('labels an external chase win under a revised/DLS target below the first-innings total', () => {
    // ACC 3 133; revised target 129; Brampton reaches 129 with 5 wickets down.
    const name = resolveMatchWinnerDisplayName(
      {
        ...leatherMatch,
        externalOpponentName: 'Brampton Sauga',
      },
      { winningTeamId: null, marginWickets: 5, marginRuns: null },
      [
        { battingTeamId: 'acc-3', battingIsExternal: false, runs: 133 },
        { battingTeamId: null, battingIsExternal: true, runs: 129 },
      ],
    );
    expect(name).toBe('Brampton Sauga');
    expect(
      formatMatchResultNote(name, {
        decided: true,
        marginRuns: null,
        marginWickets: 5,
        isTie: false,
        superOverRequired: false,
        note: null,
      }),
    ).toBe('Brampton Sauga won by 5 wickets');
  });

  it('labels an external first-innings win by runs', () => {
    const name = resolveMatchWinnerDisplayName(
      leatherMatch,
      { winningTeamId: null, marginWickets: null, marginRuns: 20 },
      [
        { battingTeamId: null, battingIsExternal: true, runs: 160 },
        { battingTeamId: 'acc-3', battingIsExternal: false, runs: 140 },
      ],
    );
    expect(name).toBe('Gujarat Stars');
  });

  it('labels ACC defending a chase shortfall by runs when the external chase scored fewer', () => {
    const name = resolveMatchWinnerDisplayName(
      {
        ...leatherMatch,
        externalOpponentName: 'Brampton Sauga',
      },
      { winningTeamId: null, marginWickets: null, marginRuns: 4 },
      [
        { battingTeamId: 'acc-3', battingIsExternal: false, runs: 133 },
        { battingTeamId: null, battingIsExternal: true, runs: 120 },
      ],
    );
    expect(name).toBe('ACC 3');
    expect(
      formatMatchResultNote(name, {
        decided: true,
        marginRuns: 4,
        marginWickets: null,
        isTie: false,
        superOverRequired: false,
        note: null,
      }),
    ).toBe('ACC 3 won by 4 runs');
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
        { winningTeamId: 'home', marginWickets: null, marginRuns: 10 },
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
