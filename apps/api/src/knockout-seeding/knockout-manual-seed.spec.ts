import {
  KnockoutManualSeedOrderError,
  QualificationType,
  reorderQualifiedTeamsBySeedOrder,
  validateManualSeedOrder,
  buildKnockoutSeedingPreviewHint,
  type QualifiedTeam,
} from '@acc/types';

function team(id: string, groupId = 'g1'): QualifiedTeam {
  return {
    teamId: id,
    teamName: `Team ${id}`,
    qualificationType: QualificationType.GroupTopper,
    groupId,
    groupRank: 1,
    points: 10,
    netRunRate: 1,
  };
}

describe('knockout manual seed', () => {
  const qualified = [team('a', 'g1'), team('b', 'g2'), team('c', 'g1'), team('d', 'g2')];

  it('accepts a valid reorder', () => {
    expect(reorderQualifiedTeamsBySeedOrder(qualified, ['d', 'c', 'b', 'a']).map((t) => t.teamId)).toEqual([
      'd',
      'c',
      'b',
      'a',
    ]);
  });

  it('rejects duplicate team ids', () => {
    expect(() => validateManualSeedOrder(qualified, ['a', 'a', 'b', 'c'])).toThrow(
      KnockoutManualSeedOrderError,
    );
  });

  it('rejects unknown team ids', () => {
    expect(() => validateManualSeedOrder(qualified, ['a', 'b', 'c', 'x'])).toThrow(
      KnockoutManualSeedOrderError,
    );
  });

  it('rejects wrong length', () => {
    expect(() => validateManualSeedOrder(qualified, ['a', 'b'])).toThrow(
      KnockoutManualSeedOrderError,
    );
  });

  it('builds bye hint for N=12 pattern (4 byes when 12 teams)', () => {
    const twelve = Array.from({ length: 12 }, (_, index) =>
      team(`t${index + 1}`, `g${(index % 4) + 1}`),
    );
    const hint = buildKnockoutSeedingPreviewHint(twelve);
    expect(hint.byeSummary).toMatch(/Seeds 1–4 receive byes/);
    expect(hint.playInMatchCount).toBe(4);
  });

  it('flags same-group round-1 meetings as non-blocking warnings', () => {
    const ordered = [team('a', 'g1'), team('b', 'g1')];
    const hint = buildKnockoutSeedingPreviewHint(ordered);
    expect(hint.sameGroupRound1Warnings.length).toBeGreaterThan(0);
  });
});
