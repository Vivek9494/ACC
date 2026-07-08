import 'reflect-metadata';

import { type InningsScorecard, InningsType } from '@acc/types';

import { deriveMatchResult } from './result';

function inn(
  sequence: number,
  inningsType: InningsType,
  battingTeamId: string,
  runs: number,
  closed: boolean,
): InningsScorecard {
  return {
    inningsId: `i${sequence}`,
    sequence,
    inningsType,
    battingTeamId,
    bowlingTeamId: null,
    runs,
    wickets: 0,
    legalBalls: 0,
    oversText: '0.0',
    oversAllotted: null,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0, total: 0 },
    batters: [],
    bowlers: [],
    fallOfWickets: [],
    recentOvers: [],
    timeline: [],
    partnership: null,
    partnerships: [],
    currentStrikerId: null,
    currentNonStrikerId: null,
    currentBowlerId: null,
    freeHitNext: false,
    closed,
    closeReason: null,
    target: null,
    droppedCatches: [],
    droppedCatchEvents: [],
  };
}

const N = InningsType.Normal;
const SO = InningsType.SuperOver;

describe('Scoring engine — match result & Super Over (§14)', () => {
  it('declares the defending side the winner when the chase closes short', () => {
    const result = deriveMatchResult([inn(1, N, 'home', 150, true), inn(2, N, 'away', 140, true)]);
    expect(result).toMatchObject({
      decided: true,
      isTie: false,
      winningTeamId: 'home',
      marginRuns: 10,
      marginWickets: null,
      superOverRequired: false,
    });
  });

  it('declares the chasing side the winner the moment it passes the target', () => {
    const chase = inn(2, N, 'away', 151, false);
    chase.wickets = 3;
    const result = deriveMatchResult([inn(1, N, 'home', 150, true), chase]);
    expect(result).toMatchObject({
      decided: true,
      winningTeamId: 'away',
      marginWickets: 7,
      marginRuns: null,
    });
  });

  it('does not decide while the chase is still in progress and behind', () => {
    const result = deriveMatchResult([inn(1, N, 'home', 150, true), inn(2, N, 'away', 120, false)]);
    expect(result.decided).toBe(false);
    expect(result.superOverRequired).toBe(false);
  });

  it('requires a Super Over when the scores are level (§14)', () => {
    const result = deriveMatchResult([inn(1, N, 'home', 150, true), inn(2, N, 'away', 150, true)]);
    expect(result).toMatchObject({ decided: false, superOverRequired: true });
  });

  it('resolves the tie via a decided Super Over', () => {
    const result = deriveMatchResult([
      inn(1, N, 'home', 150, true),
      inn(2, N, 'away', 150, true),
      inn(3, SO, 'home', 15, true),
      inn(4, SO, 'away', 12, true),
    ]);
    expect(result).toMatchObject({ decided: true, winningTeamId: 'home', note: 'Decided by Super Over' });
  });

  it('chains another Super Over when the Super Over also ties (§14)', () => {
    const result = deriveMatchResult([
      inn(1, N, 'home', 150, true),
      inn(2, N, 'away', 150, true),
      inn(3, SO, 'home', 15, true),
      inn(4, SO, 'away', 15, true),
    ]);
    expect(result).toMatchObject({ decided: false, superOverRequired: true });
  });

  it('resolves a chained Super Over once a winner emerges', () => {
    const result = deriveMatchResult([
      inn(1, N, 'home', 150, true),
      inn(2, N, 'away', 150, true),
      inn(3, SO, 'home', 15, true),
      inn(4, SO, 'away', 15, true),
      inn(5, SO, 'home', 20, true),
      inn(6, SO, 'away', 21, false),
    ]);
    expect(result).toMatchObject({ decided: true, winningTeamId: 'away' });
  });
});
