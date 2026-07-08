import type { TeamStandingRow } from '@acc/types';

import {
  accumulateInningsNrr,
  ballsToDecimalOvers,
  computeNetRunRate,
  effectiveInningsBalls,
  emptyNrrTotals,
  roundNetRunRate,
  type TeamNrrTotals,
} from './standings.nrr';
import { computeStandings } from './standings.compute';

describe('standings NRR', () => {
  it('converts balls to decimal overs (15.2 notation = 15 + 2/6 overs, not 15.2)', () => {
    // 15 overs + 2 balls = 92 legal balls
    expect(ballsToDecimalOvers(92)).toBeCloseTo(15 + 2 / 6, 5);
    expect(ballsToDecimalOvers(92)).not.toBeCloseTo(15.2, 5);
  });

  it('uses full allotted overs when the batting side is all out', () => {
    const balls = effectiveInningsBalls({
      legalBalls: 92,
      wasAllOut: true,
      oversAllotted: 20,
    });
    expect(balls).toBe(20 * 6);
    expect(ballsToDecimalOvers(balls)).toBe(20);
  });

  it('aggregates NRR across two matches instead of averaging per-match NRRs', () => {
    const totals = new Map<string, TeamNrrTotals>();

    accumulateInningsNrr(totals, [
      {
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        runs: 150,
        legalBalls: 120,
        wasAllOut: false,
        oversAllotted: 20,
      },
      {
        battingTeamId: 't2',
        bowlingTeamId: 't1',
        runs: 140,
        legalBalls: 120,
        wasAllOut: false,
        oversAllotted: 20,
      },
    ]);

    accumulateInningsNrr(totals, [
      {
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        runs: 100,
        legalBalls: 60,
        wasAllOut: false,
        oversAllotted: 10,
      },
      {
        battingTeamId: 't2',
        bowlingTeamId: 't1',
        runs: 90,
        legalBalls: 60,
        wasAllOut: false,
        oversAllotted: 10,
      },
    ]);

    const t1 = totals.get('t1') ?? emptyNrrTotals();
    expect(t1.runsScored).toBe(250);
    expect(t1.ballsFaced).toBe(180);
    expect(t1.runsConceded).toBe(230);
    expect(t1.ballsBowled).toBe(180);

    const aggregated = computeNetRunRate(t1);
    const wrongAverage =
      (computeNetRunRate({
        runsScored: 150,
        ballsFaced: 120,
        runsConceded: 140,
        ballsBowled: 120,
      }) +
        computeNetRunRate({
          runsScored: 100,
          ballsFaced: 60,
          runsConceded: 90,
          ballsBowled: 60,
        })) /
      2;

    expect(aggregated).not.toBeCloseTo(wrongAverage, 3);
    expect(roundNetRunRate(aggregated)).toBe(
      roundNetRunRate(250 / 30 - 230 / 30),
    );
  });

  it('excludes no-result matches from NRR while still awarding points', () => {
    const { tables, dataErrors } = computeStandings({
      tournamentId: 't',
      matchSchedulingFormat: null,
      groupCount: 0,
      teams: [
        { teamId: 'a', teamName: 'Alpha', logoUrl: null, groupId: null },
        { teamId: 'b', teamName: 'Beta', logoUrl: null, groupId: null },
      ],
      groups: [],
      matches: [
        {
          matchId: 'm1',
          groupId: null,
          homeTeamId: 'a',
          awayTeamId: 'b',
          isNoResult: false,
          winningTeamId: 'a',
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 120,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
            {
              battingTeamId: 'b',
              bowlingTeamId: 'a',
              runs: 100,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
          ],
        },
        {
          matchId: 'm2',
          groupId: null,
          homeTeamId: 'a',
          awayTeamId: 'b',
          isNoResult: true,
          winningTeamId: null,
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 50,
              legalBalls: 30,
              wasAllOut: false,
              oversAllotted: 20,
            },
          ],
        },
      ],
    });

    expect(dataErrors).toHaveLength(0);

    const alpha = tables[0]?.teams.find((row: TeamStandingRow) => row.teamId === 'a');
    expect(alpha?.matches).toBe(2);
    expect(alpha?.wins).toBe(1);
    expect(alpha?.noResults).toBe(1);
    expect(alpha?.points).toBe(3);
    expect(alpha?.netRunRate).toBe(roundNetRunRate(120 / 20 - 100 / 20));
  });

  it('treats cancelled matches like no-result (1 pt each, NR++, partial score excluded from NRR)', () => {
    const { tables, dataErrors } = computeStandings({
      tournamentId: 't',
      matchSchedulingFormat: null,
      groupCount: 0,
      teams: [
        { teamId: 'a', teamName: 'Alpha', logoUrl: null, groupId: null },
        { teamId: 'b', teamName: 'Beta', logoUrl: null, groupId: null },
      ],
      groups: [],
      matches: [
        {
          matchId: 'm1',
          groupId: null,
          homeTeamId: 'a',
          awayTeamId: 'b',
          isNoResult: false,
          winningTeamId: 'a',
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 120,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
            {
              battingTeamId: 'b',
              bowlingTeamId: 'a',
              runs: 100,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
          ],
        },
        {
          matchId: 'm-cancelled',
          groupId: null,
          homeTeamId: 'a',
          awayTeamId: 'b',
          isNoResult: true,
          winningTeamId: null,
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 9,
              legalBalls: 7,
              wasAllOut: false,
              oversAllotted: 20,
            },
          ],
        },
      ],
    });

    expect(dataErrors).toHaveLength(0);

    const alpha = tables[0]?.teams.find((row: TeamStandingRow) => row.teamId === 'a');
    const beta = tables[0]?.teams.find((row: TeamStandingRow) => row.teamId === 'b');
    expect(alpha?.matches).toBe(2);
    expect(alpha?.wins).toBe(1);
    expect(alpha?.noResults).toBe(1);
    expect(alpha?.points).toBe(3);
    expect(beta?.matches).toBe(2);
    expect(beta?.noResults).toBe(1);
    expect(beta?.points).toBe(1);
    expect(alpha?.netRunRate).toBe(roundNetRunRate(120 / 20 - 100 / 20));
    expect(beta?.netRunRate).toBe(roundNetRunRate(100 / 20 - 120 / 20));
  });

  it('awards 2/0 for a Super Over winner, not split points', () => {
    const tiedInnings = [
      {
        battingTeamId: 'a',
        bowlingTeamId: 'b',
        runs: 150,
        legalBalls: 120,
        wasAllOut: false,
        oversAllotted: 20,
      },
      {
        battingTeamId: 'b',
        bowlingTeamId: 'a',
        runs: 150,
        legalBalls: 120,
        wasAllOut: false,
        oversAllotted: 20,
      },
    ];

    const { tables, dataErrors } = computeStandings({
      tournamentId: 't',
      matchSchedulingFormat: null,
      groupCount: 0,
      teams: [
        { teamId: 'a', teamName: 'Alpha', logoUrl: null, groupId: null },
        { teamId: 'b', teamName: 'Beta', logoUrl: null, groupId: null },
      ],
      groups: [],
      matches: [
        {
          matchId: 'so-win',
          groupId: null,
          homeTeamId: 'a',
          awayTeamId: 'b',
          isNoResult: false,
          winningTeamId: 'a',
          innings: tiedInnings,
        },
      ],
    });

    expect(dataErrors).toHaveLength(0);

    const alpha = tables[0]?.teams.find((row: TeamStandingRow) => row.teamId === 'a');
    const beta = tables[0]?.teams.find((row: TeamStandingRow) => row.teamId === 'b');
    expect(alpha?.wins).toBe(1);
    expect(alpha?.points).toBe(2);
    expect(beta?.losses).toBe(1);
    expect(beta?.points).toBe(0);
    expect(alpha?.noResults).toBe(0);
    expect(beta?.noResults).toBe(0);
  });

  it('flags level-score matches with no Super Over winner instead of split points', () => {
    const { tables, dataErrors } = computeStandings({
      tournamentId: 't',
      matchSchedulingFormat: null,
      groupCount: 0,
      teams: [
        { teamId: 'a', teamName: 'Alpha', logoUrl: null, groupId: null },
        { teamId: 'b', teamName: 'Beta', logoUrl: null, groupId: null },
      ],
      groups: [],
      matches: [
        {
          matchId: 'bad-tie',
          groupId: null,
          homeTeamId: 'a',
          awayTeamId: 'b',
          isNoResult: false,
          winningTeamId: null,
          requiresSuperOver: true,
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 150,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
            {
              battingTeamId: 'b',
              bowlingTeamId: 'a',
              runs: 150,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
          ],
        },
      ],
    });

    expect(dataErrors).toHaveLength(1);
    expect(dataErrors[0]?.matchId).toBe('bad-tie');

    const alpha = tables[0]?.teams.find((row: TeamStandingRow) => row.teamId === 'a');
    const beta = tables[0]?.teams.find((row: TeamStandingRow) => row.teamId === 'b');
    expect(alpha?.matches).toBe(0);
    expect(alpha?.points).toBe(0);
    expect(beta?.matches).toBe(0);
    expect(beta?.points).toBe(0);
  });

  it('returns one combined table for round-robin format (all teams, all matches)', () => {
    const { tables, dataErrors } = computeStandings({
      tournamentId: 'rr',
      matchSchedulingFormat: 'ROUND_ROBIN',
      groupCount: 0,
      teams: [
        { teamId: 'a', teamName: 'Alpha', logoUrl: null, groupId: null },
        { teamId: 'b', teamName: 'Beta', logoUrl: null, groupId: null },
        { teamId: 'c', teamName: 'Charlie', logoUrl: null, groupId: null },
      ],
      groups: [],
      matches: [
        {
          matchId: 'm1',
          groupId: null,
          homeTeamId: 'a',
          awayTeamId: 'b',
          isNoResult: false,
          winningTeamId: 'a',
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'b',
              runs: 120,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
            {
              battingTeamId: 'b',
              bowlingTeamId: 'a',
              runs: 100,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
          ],
        },
        {
          matchId: 'm2',
          groupId: null,
          homeTeamId: 'a',
          awayTeamId: 'c',
          isNoResult: false,
          winningTeamId: 'c',
          innings: [
            {
              battingTeamId: 'a',
              bowlingTeamId: 'c',
              runs: 90,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
            {
              battingTeamId: 'c',
              bowlingTeamId: 'a',
              runs: 110,
              legalBalls: 120,
              wasAllOut: false,
              oversAllotted: 20,
            },
          ],
        },
      ],
    });

    expect(dataErrors).toHaveLength(0);
    expect(tables).toHaveLength(1);
    expect(tables[0]?.groupId).toBeNull();
    expect(tables[0]?.teams).toHaveLength(3);

    const alpha = tables[0]?.teams.find((row: TeamStandingRow) => row.teamId === 'a');
    const charlie = tables[0]?.teams.find((row: TeamStandingRow) => row.teamId === 'c');
    expect(alpha?.wins).toBe(1);
    expect(alpha?.losses).toBe(1);
    expect(alpha?.points).toBe(2);
    expect(charlie?.wins).toBe(1);
    expect(charlie?.points).toBe(2);
    expect(tables[0]?.teams[0]?.points).toBeGreaterThanOrEqual(
      tables[0]?.teams[1]?.points ?? 0,
    );
  });
});
