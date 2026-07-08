import {
  QualificationType,
  type QualifiedTeam,
} from '@acc/types';

import {
  buildBracketSeedLine,
  computeKnockoutSeeding,
  topSeedsInOppositeHalves,
} from '@acc/types';

function qualifiedTeam(
  id: string,
  name: string,
  type: QualificationType,
  points: number,
  netRunRate: number,
  groupId = 'group-a',
  groupRank = 1,
): QualifiedTeam {
  return {
    teamId: id,
    teamName: name,
    qualificationType: type,
    groupId,
    groupRank,
    points,
    netRunRate,
  };
}

function buildSixteenTeamInput(): QualifiedTeam[] {
  const teams: QualifiedTeam[] = [];
  for (let seed = 1; seed <= 7; seed += 1) {
    teams.push(
      qualifiedTeam(
        `topper-${seed}`,
        `Topper ${seed}`,
        QualificationType.GroupTopper,
        20 - seed,
        2 - seed * 0.1,
        `group-${seed}`,
        1,
      ),
    );
  }
  for (let seed = 1; seed <= 9; seed += 1) {
    teams.push(
      qualifiedTeam(
        `wildcard-${seed}`,
        `Wildcard ${seed}`,
        QualificationType.Wildcard,
        14 - seed,
        1 - seed * 0.05,
        `group-w${seed}`,
        2,
      ),
    );
  }
  return teams;
}

function round1PairKey(
  higherSeed: number,
  lowerSeed: number,
): string {
  return `${higherSeed}v${lowerSeed}`;
}

describe('computeKnockoutSeeding', () => {
  it('N=16 -> bracketSize 16, 0 byes, 8 round-1 matches, all teams play round 1', () => {
    const qualifiedTeams = buildSixteenTeamInput();
    const result = computeKnockoutSeeding({ qualifiedTeams });

    expect(result.knockoutTeamCount).toBe(16);
    expect(result.bracketSize).toBe(16);
    expect(result.byeCount).toBe(0);
    expect(result.byeTeams).toHaveLength(0);
    expect(result.round1Matches).toHaveLength(8);
    expect(result.seeds.every((seed) => !seed.hasBye)).toBe(true);
    expect(result.seeds.every((seed) => seed.entersAtRound === 1)).toBe(true);

    const pairings = new Set(
      result.round1Matches.map((match) =>
        round1PairKey(match.higherSeed, match.lowerSeed),
      ),
    );
    expect(pairings).toEqual(
      new Set(['1v16', '8v9', '5v12', '4v13', '3v14', '6v11', '7v10', '2v15']),
    );
  });

  it('N=12 -> bracketSize 16, 4 byes for seeds 1-4, 4 round-1 matches', () => {
    const qualifiedTeams = buildSixteenTeamInput().slice(0, 12);
    const result = computeKnockoutSeeding({ qualifiedTeams });

    expect(result.bracketSize).toBe(16);
    expect(result.byeCount).toBe(4);
    expect(result.byeTeams.map((team) => team.seed)).toEqual([1, 2, 3, 4]);
    expect(result.round1Matches).toHaveLength(4);

    const pairings = new Set(
      result.round1Matches.map((match) =>
        round1PairKey(match.higherSeed, match.lowerSeed),
      ),
    );
    expect(pairings).toEqual(new Set(['5v12', '6v11', '7v10', '8v9']));

    expect(result.seeds.filter((seed) => seed.hasBye)).toHaveLength(4);
    expect(result.seeds.filter((seed) => !seed.hasBye)).toHaveLength(8);
  });

  it('N=8 -> bracketSize 8, 0 byes, 4 round-1 matches', () => {
    const qualifiedTeams = buildSixteenTeamInput().slice(0, 8);
    const result = computeKnockoutSeeding({ qualifiedTeams });

    expect(result.bracketSize).toBe(8);
    expect(result.byeCount).toBe(0);
    expect(result.round1Matches).toHaveLength(4);

    const pairings = new Set(
      result.round1Matches.map((match) =>
        round1PairKey(match.higherSeed, match.lowerSeed),
      ),
    );
    expect(pairings).toEqual(new Set(['1v8', '4v5', '3v6', '2v7']));
  });

  it('N=14 -> bracketSize 16, 2 byes for seeds 1-2, 6 round-1 matches', () => {
    const qualifiedTeams = buildSixteenTeamInput().slice(0, 14);
    const result = computeKnockoutSeeding({ qualifiedTeams });

    expect(result.bracketSize).toBe(16);
    expect(result.byeCount).toBe(2);
    expect(result.byeTeams.map((team) => team.seed)).toEqual([1, 2]);
    expect(result.round1Matches).toHaveLength(6);

    const pairings = new Set(
      result.round1Matches.map((match) =>
        round1PairKey(match.higherSeed, match.lowerSeed),
      ),
    );
    expect(pairings).toEqual(
      new Set(['3v14', '4v13', '5v12', '6v11', '7v10', '8v9']),
    );
  });

  it('assigns seeds 1..N in Phase 1 order (toppers then wildcards)', () => {
    const qualifiedTeams = [
      qualifiedTeam('t1', 'Topper A', QualificationType.GroupTopper, 10, 1.5, 'g1', 1),
      qualifiedTeam('t2', 'Topper B', QualificationType.GroupTopper, 9, 1.2, 'g2', 1),
      qualifiedTeam('w1', 'Wildcard A', QualificationType.Wildcard, 8, 0.9, 'g3', 2),
      qualifiedTeam('w2', 'Wildcard B', QualificationType.Wildcard, 7, 0.4, 'g4', 2),
    ];

    const result = computeKnockoutSeeding({ qualifiedTeams });

    expect(result.seeds.map((seed) => seed.teamId)).toEqual(['t1', 't2', 'w1', 'w2']);
    expect(result.seeds.map((seed) => seed.qualificationType)).toEqual([
      QualificationType.GroupTopper,
      QualificationType.GroupTopper,
      QualificationType.Wildcard,
      QualificationType.Wildcard,
    ]);
  });

  it('preserves tie-break order from Phase 1 input without re-sorting', () => {
    const qualifiedTeams = [
      qualifiedTeam('a1', 'Alpha', QualificationType.GroupTopper, 6, 1.0, 'g1', 1),
      qualifiedTeam('a2', 'Beta', QualificationType.GroupTopper, 6, 1.0, 'g2', 1),
      qualifiedTeam('w1', 'Wildcard', QualificationType.Wildcard, 4, 0.2, 'g3', 2),
      qualifiedTeam('w2', 'Wildcard B', QualificationType.Wildcard, 3, 0.1, 'g4', 2),
    ];

    const result = computeKnockoutSeeding({ qualifiedTeams });

    expect(result.seeds[0]?.teamId).toBe('a1');
    expect(result.seeds[1]?.teamId).toBe('a2');
  });

  it('places seeds 1 and 2 in opposite bracket halves', () => {
    for (const n of [8, 12, 14, 16]) {
      const result = computeKnockoutSeeding({
        qualifiedTeams: buildSixteenTeamInput().slice(0, n),
      });
      const seedLine = buildBracketSeedLine(result.bracketSize);
      expect(topSeedsInOppositeHalves(seedLine, result.bracketSize)).toBe(true);
    }
  });

  it('includes round-2 feed positions for round-1 matches and bye teams', () => {
    const result = computeKnockoutSeeding({
      qualifiedTeams: buildSixteenTeamInput().slice(0, 12),
    });

    expect(result.round1Matches.every((match) => match.feedsRound2Slot >= 0)).toBe(
      true,
    );
    expect(result.byeTeams.every((team) => team.feedsRound2Slot >= 0)).toBe(true);
    expect(result.byeTeams.every((team) => team.round2SlotSide)).toBeTruthy();
  });
});

describe('nextPowerOfTwo via computeKnockoutSeeding bracket sizes', () => {
  it('maps team counts to expected bracket sizes', () => {
    const sizes: Array<[number, number]> = [
      [8, 8],
      [9, 16],
      [12, 16],
      [14, 16],
      [16, 16],
    ];

    for (const [teamCount, expectedBracketSize] of sizes) {
      const result = computeKnockoutSeeding({
        qualifiedTeams: buildSixteenTeamInput().slice(0, teamCount),
      });
      expect(result.bracketSize).toBe(expectedBracketSize);
    }
  });
});
