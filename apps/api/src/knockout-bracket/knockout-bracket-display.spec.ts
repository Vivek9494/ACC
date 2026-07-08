import { KnockoutBracketSlotKind, MatchSide, MatchState } from '@acc/types';

import {
  enrichKnockoutBracketMatches,
  formatKnockoutFeederLabel,
  type KnockoutBracketMatchDisplayRow,
} from './knockout-bracket-display';

function baseRow(
  overrides: Partial<KnockoutBracketMatchDisplayRow>,
): KnockoutBracketMatchDisplayRow {
  return {
    id: 'm-1',
    bracketRoundIndex: 0,
    bracketPosition: 0,
    bracketRoundLabel: 'Final',
    homeTeamId: null,
    awayTeamId: null,
    nextMatchId: null,
    nextMatchSlot: null,
    state: MatchState.Scheduled,
    confirmedAt: null,
    winningTeamId: null,
    isNoResult: false,
    awaitingTeams: true,
    requiresResolution: false,
    homeTeam: null,
    awayTeam: null,
    ...overrides,
  };
}

describe('knockout-bracket-display', () => {
  describe('formatKnockoutFeederLabel', () => {
    it('includes round label and 1-based match number', () => {
      expect(
        formatKnockoutFeederLabel({
          bracketRoundLabel: 'Pre Quarter Final',
          bracketPosition: 2,
        }),
      ).toBe('Winner of Pre Quarter Final · Match 3');
    });
  });

  describe('enrichKnockoutBracketMatches', () => {
    it('marks bye teams in parent slots and winner-of placeholders for play-in feeders', () => {
      const matches = enrichKnockoutBracketMatches([
        baseRow({
          id: 'qf-1',
          bracketRoundIndex: 2,
          bracketPosition: 0,
          bracketRoundLabel: 'Quarter Final',
          homeTeamId: 'seed-1',
          homeTeam: { name: 'Seed 1', logoUrl: null },
          awaitingTeams: true,
        }),
        baseRow({
          id: 'play-in-1',
          bracketRoundIndex: 3,
          bracketPosition: 0,
          bracketRoundLabel: 'Pre Quarter Final',
          homeTeamId: 'seed-5',
          awayTeamId: 'seed-12',
          homeTeam: { name: 'Seed 5', logoUrl: null },
          awayTeam: { name: 'Seed 12', logoUrl: null },
          nextMatchId: 'qf-1',
          nextMatchSlot: MatchSide.TeamB,
          awaitingTeams: false,
        }),
      ]);

      expect(matches[0]?.homeSlot).toMatchObject({
        kind: KnockoutBracketSlotKind.Bye,
        teamName: 'Seed 1',
      });
      expect(matches[0]?.awaySlot).toMatchObject({
        kind: KnockoutBracketSlotKind.WinnerOf,
        feederLabel: 'Winner of Pre Quarter Final · Match 1',
      });
    });

    it('maps play-in participants as real teams', () => {
      const matches = enrichKnockoutBracketMatches([
        baseRow({
          id: 'play-in-1',
          bracketRoundIndex: 3,
          bracketPosition: 0,
          bracketRoundLabel: 'Pre Quarter Final',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          homeTeam: { name: 'Team A', logoUrl: 'a.png' },
          awayTeam: { name: 'Team B', logoUrl: 'b.png' },
          awaitingTeams: false,
        }),
      ]);

      expect(matches[0]?.homeSlot.kind).toBe(KnockoutBracketSlotKind.Team);
      expect(matches[0]?.awaySlot.kind).toBe(KnockoutBracketSlotKind.Team);
    });

    it('flags completed-unconfirmed feeders and awaiting confirmation on the match', () => {
      const matches = enrichKnockoutBracketMatches([
        baseRow({
          id: 'final',
          bracketRoundIndex: 0,
          bracketPosition: 0,
          bracketRoundLabel: 'Final',
          awaitingTeams: true,
        }),
        baseRow({
          id: 'semi-1',
          bracketRoundIndex: 1,
          bracketPosition: 0,
          bracketRoundLabel: 'Semi Final',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          homeTeam: { name: 'Team A', logoUrl: null },
          awayTeam: { name: 'Team B', logoUrl: null },
          nextMatchId: 'final',
          nextMatchSlot: MatchSide.TeamB,
          state: MatchState.Completed,
          winningTeamId: 'team-a',
          awaitingTeams: false,
        }),
      ]);

      const final = matches.find((row) => row.id === 'final');
      const semi = matches.find((row) => row.id === 'semi-1');

      expect(semi?.awaitingScorecardConfirmation).toBe(true);
      expect(final?.awaySlot).toMatchObject({
        kind: KnockoutBracketSlotKind.WinnerOf,
        feederLabel: 'Winner of Semi Final · Match 1',
        feederAwaitingConfirmation: true,
      });
    });
  });
});
