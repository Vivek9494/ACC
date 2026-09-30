import { TournamentType } from '@acc/types';

import {
  assertKnockoutTeamCountOnCreate,
  assertKnockoutTeamCountOnUpdate,
} from './tournament-knockout-team-count.validation';

describe('tournament-knockout-team-count.validation', () => {
  describe('assertKnockoutTeamCountOnCreate', () => {
    it('allows null on create', () => {
      expect(() =>
        assertKnockoutTeamCountOnCreate(TournamentType.APL, 16, null),
      ).not.toThrow();
    });

    it('accepts a valid even knockout size on APL create', () => {
      expect(() =>
        assertKnockoutTeamCountOnCreate(TournamentType.APL, 16, 8),
      ).not.toThrow();
    });

    it('rejects odd knockout size on create', () => {
      expect(() =>
        assertKnockoutTeamCountOnCreate(TournamentType.APL, 16, 7),
      ).toThrow(/even number/i);
    });

    it('rejects knockout above team count on create', () => {
      expect(() =>
        assertKnockoutTeamCountOnCreate(TournamentType.APL, 10, 12),
      ).toThrow(/Cannot exceed 10/i);
    });

    it('rejects knockout for ACC on create', () => {
      expect(() =>
        assertKnockoutTeamCountOnCreate(TournamentType.ACC, 16, 8),
      ).toThrow(/tennis-ball tournaments only/i);
    });
  });

  describe('assertKnockoutTeamCountOnUpdate', () => {
    it('rejects knockout count for ACC tournaments', async () => {
      await expect(
        assertKnockoutTeamCountOnUpdate(TournamentType.ACC, 4, 16, null, 8, false),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          fields: expect.objectContaining({
            knockoutTeamCount: expect.stringMatching(/tennis-ball tournaments only/i),
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
