import {
  buildKnockoutManualBracketLayout,
  buildTeamIdsFromManualPlacements,
  KnockoutManualSeedOrderError,
  KnockoutManualSlotKind,
  QualificationType,
  type KnockoutManualBracketLayout,
  type QualifiedTeam,
} from '@acc/types';

function fillableSeedCount(layout: KnockoutManualBracketLayout): number {
  let count = 0;
  for (const round of layout.rounds) {
    for (const match of round.matches) {
      if (match.homeSlot.kind === KnockoutManualSlotKind.Seed) count += 1;
      if (match.awaySlot.kind === KnockoutManualSlotKind.Seed) count += 1;
    }
  }
  return count;
}

function collectSeeds(layout: KnockoutManualBracketLayout): number[] {
  const seeds: number[] = [];
  for (const round of layout.rounds) {
    for (const match of round.matches) {
      if (match.homeSlot.seed != null) seeds.push(match.homeSlot.seed);
      if (match.awaySlot.seed != null) seeds.push(match.awaySlot.seed);
    }
  }
  return seeds.sort((a, b) => a - b);
}

function qualifiedTeam(id: string): QualifiedTeam {
  return {
    teamId: id,
    teamName: `Team ${id}`,
    qualificationType: QualificationType.GroupTopper,
    groupId: 'g1',
    groupRank: 1,
    points: 10,
    netRunRate: 1,
  };
}

describe('buildKnockoutManualBracketLayout', () => {
  it.each([4, 8, 16])('N=%d (power of two): all teams in first-round slots, no byes', (n) => {
    const layout = buildKnockoutManualBracketLayout(n);
    expect(layout.byeCount).toBe(0);
    expect(layout.byeSeeds).toEqual([]);
    expect(layout.fillableSlotCount).toBe(n);
    expect(fillableSeedCount(layout)).toBe(n);
    expect(collectSeeds(layout)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  });

  it('N=12: 4 byes + 8 play-in slots = 12 fillable', () => {
    const layout = buildKnockoutManualBracketLayout(12);
    expect(layout.bracketSize).toBe(16);
    expect(layout.byeCount).toBe(4);
    expect(layout.byeSeeds).toEqual([1, 2, 3, 4]);
    expect(fillableSeedCount(layout)).toBe(12);
    expect(collectSeeds(layout)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('N=14: 2 byes + 12 play-in slots = 14 fillable', () => {
    const layout = buildKnockoutManualBracketLayout(14);
    expect(layout.byeCount).toBe(2);
    expect(layout.byeSeeds).toEqual([1, 2]);
    expect(fillableSeedCount(layout)).toBe(14);
  });

  it('marks bye seed slots with isBye and non-bye slots without', () => {
    const layout = buildKnockoutManualBracketLayout(12);
    const byeSlots = layout.rounds
      .flatMap((round) => round.matches)
      .flatMap((match) => [match.homeSlot, match.awaySlot])
      .filter((slot) => slot.kind === KnockoutManualSlotKind.Seed && slot.isBye);
    expect(byeSlots.map((slot) => slot.seed).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('exposes WINNER_OF feeder labels for later rounds (display-only)', () => {
    const layout = buildKnockoutManualBracketLayout(4);
    const finalRound = layout.rounds[layout.rounds.length - 1];
    expect(finalRound?.roundLabel).toBe('Final');
    expect(finalRound?.hasFillableSlot).toBe(false);
    expect(finalRound?.matches[0]?.homeSlot.kind).toBe(KnockoutManualSlotKind.WinnerOf);
    expect(finalRound?.matches[0]?.homeSlot.feederLabel).toMatch(/Winner of Semi Final/);
  });

  it('orders rounds earliest-first (Final last)', () => {
    const layout = buildKnockoutManualBracketLayout(8);
    const labels = layout.rounds.map((round) => round.roundLabel);
    expect(labels[0]).toBe('Quarter Final');
    expect(labels[labels.length - 1]).toBe('Final');
  });
});

describe('buildTeamIdsFromManualPlacements', () => {
  const qualified = [
    qualifiedTeam('a'),
    qualifiedTeam('b'),
    qualifiedTeam('c'),
    qualifiedTeam('d'),
  ];

  it('maps seed placements to an ordered teamIds list', () => {
    const placements = new Map<number, string>([
      [1, 'c'],
      [2, 'a'],
      [3, 'd'],
      [4, 'b'],
    ]);
    expect(buildTeamIdsFromManualPlacements(qualified, placements)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('throws when a seed slot is unplaced', () => {
    const placements = new Map<number, string>([
      [1, 'c'],
      [2, 'a'],
      [3, 'd'],
    ]);
    expect(() => buildTeamIdsFromManualPlacements(qualified, placements)).toThrow(
      KnockoutManualSeedOrderError,
    );
  });

  it('throws when placements are not exactly the qualified set', () => {
    const placements = new Map<number, string>([
      [1, 'c'],
      [2, 'a'],
      [3, 'd'],
      [4, 'x'],
    ]);
    expect(() => buildTeamIdsFromManualPlacements(qualified, placements)).toThrow(
      KnockoutManualSeedOrderError,
    );
  });
});
