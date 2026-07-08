import {
  MatchType,
  QualificationType,
  type QualifiedTeam,
} from '@acc/types';

import { computeKnockoutSeeding } from '../knockout-seeding/knockout-seeding.compute';
import {
  buildKnockoutBracketPlan,
  countPlannedKnockoutMatches,
  deriveKnockoutRoundLabel,
} from './knockout-bracket.generate';

function qualifiedTeam(
  index: number,
  type: QualificationType,
): QualifiedTeam {
  const groupIndex = Math.floor(index / 4);
  return {
    teamId: `team-${index + 1}`,
    teamName: `Team ${index + 1}`,
    qualificationType: type,
    groupId: `group-${groupIndex}`,
    groupRank: type === QualificationType.GroupTopper ? 1 : 2,
    points: 20 - index,
    netRunRate: 2 - index * 0.05,
  };
}

function seedingForTeamCount(teamCount: number) {
  const topperCount = teamCount <= 7 ? teamCount : 7;
  const teams: QualifiedTeam[] = [];
  for (let index = 0; index < topperCount; index += 1) {
    teams.push(qualifiedTeam(index, QualificationType.GroupTopper));
  }
  for (let index = topperCount; index < teamCount; index += 1) {
    teams.push(qualifiedTeam(index, QualificationType.Wildcard));
  }
  return computeKnockoutSeeding({ qualifiedTeams: teams });
}


describe('buildKnockoutBracketPlan', () => {
  it('N=16 -> 15 matches, 0 byes, 8 play-in matches with both real teams', () => {
    const seeding = seedingForTeamCount(16);
    expect(seeding.byeCount).toBe(0);
    expect(seeding.round1Matches).toHaveLength(8);

    const plan = buildKnockoutBracketPlan(seeding);
    expect(countPlannedKnockoutMatches(plan)).toBe(15);

    const playIn = plan.filter((match) => match.matchType === MatchType.PreQuarterFinal);
    expect(playIn).toHaveLength(8);
    expect(playIn.every((match) => match.homeTeamId && match.awayTeamId)).toBe(true);
    expect(playIn.every((match) => !match.awaitingTeams)).toBe(true);
    expect(plan.filter((match) => match.bracketRoundLabel === 'Final')).toHaveLength(1);
  });

  it('N=12 -> 11 matches, 4 play-in, bye seeds placed in quarter-final slots', () => {
    const seeding = seedingForTeamCount(12);
    expect(seeding.byeCount).toBe(4);
    expect(seeding.byeTeams.map((team) => team.seed)).toEqual([1, 2, 3, 4]);

    const plan = buildKnockoutBracketPlan(seeding);
    expect(countPlannedKnockoutMatches(plan)).toBe(11);

    const playIn = plan.filter((match) => match.matchType === MatchType.PreQuarterFinal);
    expect(playIn).toHaveLength(4);
    expect(playIn.every((match) => !match.awaitingTeams)).toBe(true);

    const quarterFinals = plan.filter((match) => match.bracketRoundLabel === 'Quarter Final');
    expect(quarterFinals).toHaveLength(4);
    expect(quarterFinals.filter((match) => match.homeTeamId || match.awayTeamId)).toHaveLength(4);
    expect(
      quarterFinals.filter((match) => match.homeTeamId && match.awayTeamId),
    ).toHaveLength(0);
    expect(quarterFinals.every((match) => match.awaitingTeams)).toBe(true);

    for (const bye of seeding.byeTeams) {
      const qf = quarterFinals.find((match) => match.bracketPosition === bye.feedsRound2Slot);
      expect(qf).toBeDefined();
      if (bye.round2SlotSide === 'HOME') {
        expect(qf?.homeTeamId).toBe(bye.teamId);
      } else {
        expect(qf?.awayTeamId).toBe(bye.teamId);
      }
    }
  });

  it('N=8 -> 7 matches, 4 play-in quarter-finals, 0 byes', () => {
    const teams = Array.from({ length: 8 }, (_, index) =>
      qualifiedTeam(index, QualificationType.GroupTopper),
    );
    const seeding = computeKnockoutSeeding({ qualifiedTeams: teams });
    const plan = buildKnockoutBracketPlan(seeding);

    expect(countPlannedKnockoutMatches(plan)).toBe(7);
    expect(seeding.byeCount).toBe(0);
    expect(plan.filter((match) => match.matchType === MatchType.PreQuarterFinal)).toHaveLength(4);
    expect(plan.filter((match) => match.bracketRoundLabel === 'Semi Final')).toHaveLength(2);
    expect(plan.filter((match) => match.bracketRoundLabel === 'Final')).toHaveLength(1);
  });

  it('N=14 -> 13 matches with 2 byes and 6 play-in matches (not the N=12 pattern)', () => {
    const seeding = seedingForTeamCount(14);
    expect(seeding.byeCount).toBe(2);
    expect(seeding.byeTeams.map((team) => team.seed)).toEqual([1, 2]);
    expect(seeding.round1Matches).toHaveLength(6);

    const plan = buildKnockoutBracketPlan(seeding);
    expect(countPlannedKnockoutMatches(plan)).toBe(13);
    expect(plan.filter((match) => match.matchType === MatchType.PreQuarterFinal)).toHaveLength(6);

    const quarterFinals = plan.filter((match) => match.bracketRoundLabel === 'Quarter Final');
    const byeSlots = quarterFinals.filter(
      (match) => match.homeTeamId === 'team-1' || match.awayTeamId === 'team-1' ||
        match.homeTeamId === 'team-2' || match.awayTeamId === 'team-2',
    );
    expect(byeSlots).toHaveLength(2);
  });

  it('wires feeds-into links for every non-final match', () => {
    const plan = buildKnockoutBracketPlan(seedingForTeamCount(12));
    const nonFinal = plan.filter((match) => match.bracketRoundLabel !== 'Final');
    expect(nonFinal.every((match) => match.nextMatchKey && match.nextMatchSlot)).toBe(true);
    expect(plan.filter((match) => match.bracketRoundLabel === 'Final')[0]?.nextMatchKey).toBeNull();
  });

  it('N=16 play-in pairings feed opposite slots on the same quarter-final', () => {
    const plan = buildKnockoutBracketPlan(seedingForTeamCount(16));
    const playIns = plan.filter((match) => match.bracketRoundLabel === 'Round of 16');
    const qf0Feeders = playIns.filter((match) => match.nextMatchKey?.endsWith(':0'));
    expect(qf0Feeders).toHaveLength(2);
    expect(new Set(qf0Feeders.map((match) => match.nextMatchSlot)).size).toBe(2);
  });

  it('derives round labels from bracket size', () => {
    expect(deriveKnockoutRoundLabel(16, 3)).toBe('Round of 16');
    expect(deriveKnockoutRoundLabel(16, 2)).toBe('Quarter Final');
    expect(deriveKnockoutRoundLabel(16, 1)).toBe('Semi Final');
    expect(deriveKnockoutRoundLabel(16, 0)).toBe('Final');
    expect(deriveKnockoutRoundLabel(8, 2)).toBe('Quarter Final');
  });
});
