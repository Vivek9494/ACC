import { TournamentType } from '@acc/types';

import {
  assertKnockoutTeamCountOnCreate,
  assertKnockoutTeamCountOnUpdate,
} from './tournament-knockout-team-count.validation';

describe('tournament-knockout-team-count.validation', () => {
  describe('assertKnockoutTeamCountOnCreate', () => {
    it('rejects any value on create', () => {
      expect(() =>
        assertKnockoutTeamCountOnCreate(TournamentType.APL, 8),
      ).toThrow(/Set groups and teams first/i);
    });

    it('allows null on create', () => {
      expect(() =>
        assertKnockoutTeamCountOnCreate(TournamentType.APL, null),
      ).not.toThrow();
    });
  });

  describe('assertKnockoutTeamCountOnUpdate', () => {
    it('rejects knockout count for non-APL tournaments', async () => {
      await expect(
        assertKnockoutTeamCountOnUpdate(TournamentType.Center, 4, 16, null, 8, false),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          fields: expect.objectContaining({
            knockoutTeamCount: expect.stringMatching(/APL tournaments only/i),
          }),
        }),
      });
    });

    it('validates bounds for APL tournaments', async () => {
      await expect(
        assertKnockoutTeamCountOnUpdate(TournamentType.APL, 7, 28, null, 6, false),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          fields: expect.objectContaining({
            knockoutTeamCount: expect.stringMatching(/at least 8/i),
          }),
        }),
      });
    });

    it('accepts valid APL values', async () => {
      await expect(
        assertKnockoutTeamCountOnUpdate(TournamentType.APL, 7, 28, null, 16, false),
      ).resolves.toBeUndefined();
    });

    it('rejects N change when a bracket exists', async () => {
      await expect(
        assertKnockoutTeamCountOnUpdate(TournamentType.APL, 7, 28, 16, 8, true),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'KNOCKOUT_TEAM_COUNT_LOCKED',
        }),
      });
    });

    it('allows unchanged N when a bracket exists', async () => {
      await expect(
        assertKnockoutTeamCountOnUpdate(TournamentType.APL, 7, 28, 16, 16, true),
      ).resolves.toBeUndefined();
    });
  });
});
