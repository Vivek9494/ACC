import { TournamentType } from '@acc/types';

import { canShowScorerAssignmentCard, isAccVsAccMatch } from './scorer-assignment.utils';

describe('scorer-assignment.utils', () => {
  describe('isAccVsAccMatch', () => {
    it('is true when both sides are registered ACC teams', () => {
      expect(
        isAccVsAccMatch({
          tournament: { type: TournamentType.ACC },
          homeTeamId: 'home',
          awayTeamId: 'away',
        }),
      ).toBe(true);
    });

    it('is false for ACC vs external (no away team id)', () => {
      expect(
        isAccVsAccMatch({
          tournament: { type: TournamentType.ACC },
          homeTeamId: 'home',
          awayTeamId: null,
        }),
      ).toBe(false);
    });
  });

  describe('canShowScorerAssignmentCard', () => {
    it('shows Assign when no grant exists', () => {
      expect(canShowScorerAssignmentCard('captain-a', null)).toBe(true);
    });

    it('shows Switch only to the captain who assigned', () => {
      expect(
        canShowScorerAssignmentCard('captain-a', { grantedByUserId: 'captain-a' }),
      ).toBe(true);
      expect(
        canShowScorerAssignmentCard('captain-b', { grantedByUserId: 'captain-a' }),
      ).toBe(false);
    });
  });
});
