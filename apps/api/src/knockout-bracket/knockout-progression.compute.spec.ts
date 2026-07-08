import { MatchSide } from '@acc/types';

import {
  knockoutParentAwaitingTeams,
  parentProgressionUpdate,
  parentSlotUpdateForWinner,
  shouldAdvanceKnockoutWinner,
} from './knockout-progression.compute';

describe('knockout-progression.compute', () => {
  const feederBase = {
    id: 'play-in-1',
    tournamentId: 't-1',
    bracketId: 'bracket-1',
    isDeleted: false,
    winningTeamId: 'team-winner',
    isNoResult: false,
    nextMatchId: 'qf-1',
    nextMatchSlot: MatchSide.TeamB,
  };

  describe('shouldAdvanceKnockoutWinner', () => {
    it('returns false for non-knockout matches', () => {
      expect(shouldAdvanceKnockoutWinner({ ...feederBase, bracketId: null })).toBe(false);
    });

    it('returns false without a winner or on no-result', () => {
      expect(shouldAdvanceKnockoutWinner({ ...feederBase, winningTeamId: null })).toBe(false);
      expect(shouldAdvanceKnockoutWinner({ ...feederBase, isNoResult: true })).toBe(false);
    });

    it('returns true for a knockout match with a decided winner', () => {
      expect(shouldAdvanceKnockoutWinner(feederBase)).toBe(true);
    });
  });

  describe('parentSlotUpdateForWinner', () => {
    it('writes the winner into the home slot for TEAM_A', () => {
      expect(
        parentSlotUpdateForWinner(
          { homeTeamId: null, awayTeamId: 'bye-team' },
          MatchSide.TeamA,
          'team-winner',
        ),
      ).toEqual({ homeTeamId: 'team-winner', awayTeamId: 'bye-team' });
    });

    it('writes the winner into the away slot for TEAM_B', () => {
      expect(
        parentSlotUpdateForWinner(
          { homeTeamId: 'bye-team', awayTeamId: null },
          MatchSide.TeamB,
          'team-winner',
        ),
      ).toEqual({ homeTeamId: 'bye-team', awayTeamId: 'team-winner' });
    });
  });

  describe('knockoutParentAwaitingTeams', () => {
    it('is true until both slots are filled', () => {
      expect(knockoutParentAwaitingTeams('team-a', null)).toBe(true);
      expect(knockoutParentAwaitingTeams(null, 'team-b')).toBe(true);
      expect(knockoutParentAwaitingTeams('team-a', 'team-b')).toBe(false);
    });
  });

  describe('parentProgressionUpdate', () => {
    it('returns null when the parent is already in the target state (idempotent)', () => {
      expect(
        parentProgressionUpdate(
          {
            id: 'qf-1',
            homeTeamId: 'bye-team',
            awayTeamId: 'team-winner',
            awaitingTeams: false,
          },
          MatchSide.TeamB,
          'team-winner',
        ),
      ).toBeNull();
    });

    it('fills one slot and keeps awaitingTeams true', () => {
      expect(
        parentProgressionUpdate(
          {
            id: 'qf-1',
            homeTeamId: 'bye-team',
            awayTeamId: null,
            awaitingTeams: true,
          },
          MatchSide.TeamB,
          'team-winner',
        ),
      ).toEqual({
        id: 'qf-1',
        homeTeamId: 'bye-team',
        awayTeamId: 'team-winner',
        awaitingTeams: false,
      });
    });
  });
});
