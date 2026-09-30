import {
  isKnockoutMatchPlayedForDeleteWarning,
  knockoutMatchRequiresResolution,
  buildKnockoutBracketDeleteMessage,
  KNOCKOUT_BRACKET_MESSAGES,
  shouldShowKnockoutBracketEntry,
  TournamentType,
  UserRole,
} from '@acc/types';

import {
  isKnockoutMatchTouchedForCorrection,
} from './knockout-bracket-correction.guard';
import { KnockoutBracketService } from './knockout-bracket.service';
import { ACTIVE_KNOCKOUT_MATCH_WHERE } from './knockout-match-query';

describe('knockout bracket helpers', () => {
  describe('isKnockoutMatchPlayedForDeleteWarning', () => {
    it('returns true when confirmedAt is set', () => {
      expect(
        isKnockoutMatchPlayedForDeleteWarning({
          confirmedAt: '2026-07-01T00:00:00.000Z',
          inningsCount: 0,
        }),
      ).toBe(true);
    });

    it('returns true when innings exist without confirmation', () => {
      expect(
        isKnockoutMatchPlayedForDeleteWarning({
          confirmedAt: null,
          inningsCount: 2,
        }),
      ).toBe(true);
    });

    it('returns false for untouched scheduled matches', () => {
      expect(
        isKnockoutMatchPlayedForDeleteWarning({
          confirmedAt: null,
          inningsCount: 0,
        }),
      ).toBe(false);
    });
  });

  describe('knockoutMatchRequiresResolution', () => {
    it('flags confirmed ties and no-results', () => {
      expect(
        knockoutMatchRequiresResolution({
          confirmedAt: '2026-07-01T00:00:00.000Z',
          winningTeamId: null,
          isNoResult: false,
        }),
      ).toBe(true);
      expect(
        knockoutMatchRequiresResolution({
          confirmedAt: '2026-07-01T00:00:00.000Z',
          winningTeamId: 'team-1',
          isNoResult: true,
        }),
      ).toBe(true);
    });
  });

  describe('buildKnockoutBracketDeleteMessage', () => {
    it('uses standard message when nothing was played', () => {
      expect(
        buildKnockoutBracketDeleteMessage({
          totalKnockoutMatches: 7,
          playedKnockoutMatchCount: 0,
        }),
      ).toMatch(/Group-stage matches are not affected/i);
    });

    it('names the played count in the strong warning', () => {
      expect(
        buildKnockoutBracketDeleteMessage({
          totalKnockoutMatches: 7,
          playedKnockoutMatchCount: 3,
        }),
      ).toMatch(/3 knockout matches have results/i);
    });
  });

  describe('shouldShowKnockoutBracketEntry', () => {
    const admin = { id: 'a-1', role: UserRole.Admin, tokenVersion: 1 } as never;
    const ready = { canGenerateKnockout: true, hasKnockoutBracket: false };

    it('shows Generate when the server says the knockout is ready', () => {
      expect(shouldShowKnockoutBracketEntry(ready, admin)).toBe(true);
    });

    it('hides while not ready and no bracket exists', () => {
      expect(
        shouldShowKnockoutBracketEntry({ ...ready, canGenerateKnockout: false }, admin),
      ).toBe(false);
    });

    it('keeps Manage visible when a bracket already exists', () => {
      expect(
        shouldShowKnockoutBracketEntry(
          { canGenerateKnockout: false, hasKnockoutBracket: true },
          admin,
        ),
      ).toBe(true);
    });

    it('hides for non-managers', () => {
      expect(
        shouldShowKnockoutBracketEntry(ready, {
          id: 'c-1',
          role: UserRole.Captain,
          tokenVersion: 1,
        } as never),
      ).toBe(false);
    });
  });

  describe('ACTIVE_KNOCKOUT_MATCH_WHERE', () => {
    it('excludes soft-deleted rows', () => {
      expect(ACTIVE_KNOCKOUT_MATCH_WHERE).toEqual({
        isDeleted: false,
        bracketId: { not: null },
      });
    });
  });
});

describe('KnockoutBracketService', () => {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const seeding = { getSeeding: jest.fn() };

  function makeService(prisma: object): KnockoutBracketService {
    return new KnockoutBracketService(prisma as never, audit as never, seeding as never);
  }

  it('hasKnockoutBracket checks the metadata row only', async () => {
    const prisma = {
      knockoutBracket: {
        findUnique: jest.fn().mockResolvedValue({ id: 'bracket-1' }),
      },
    };
    const service = makeService(prisma);
    await expect(service.hasKnockoutBracket('t-1')).resolves.toBe(true);
    expect(prisma.knockoutBracket.findUnique).toHaveBeenCalledWith({
      where: { tournamentId: 't-1' },
      select: { id: true },
    });
  });

  it('generateKnockoutBracket blocks when a bracket already exists', async () => {
    const prisma = {
      knockoutBracket: {
        findUnique: jest.fn().mockResolvedValue({ id: 'bracket-1' }),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.generateKnockoutBracket(
        { id: 'admin-1', role: 'ADMIN', tokenVersion: 1 } as never,
        't-1',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'KNOCKOUT_BRACKET_ALREADY_EXISTS',
      }),
    });
    expect(seeding.getSeeding).not.toHaveBeenCalled();
  });

  it('generateKnockoutBracket rejects a tournament with no groups', async () => {
    const computeForGeneration = jest.fn();
    const prisma = {
      knockoutBracket: { findUnique: jest.fn().mockResolvedValue(null) },
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          isDeleted: false,
          type: TournamentType.APL,
          knockoutTeamCount: 4,
          _count: { groups: 0 },
        }),
      },
    };
    const service = new KnockoutBracketService(
      prisma as never,
      audit as never,
      { computeForGeneration } as never,
    );

    await expect(
      service.generateKnockoutBracket(
        { id: 'admin-1', role: 'ADMIN', tokenVersion: 1 } as never,
        't-1',
      ),
    ).rejects.toMatchObject({
      response: {
        error: 'KNOCKOUT_BRACKET_NO_GROUPS',
        message: KNOCKOUT_BRACKET_MESSAGES.noGroups,
      },
    });
    expect(computeForGeneration).not.toHaveBeenCalled();
  });

  it('generateKnockoutBracket rejects while group-stage matches are incomplete', async () => {
    const computeForGeneration = jest.fn();
    const prisma = {
      knockoutBracket: { findUnique: jest.fn().mockResolvedValue(null) },
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          isDeleted: false,
          type: TournamentType.Center,
          knockoutTeamCount: 4,
          _count: { groups: 2 },
        }),
      },
      match: { count: jest.fn().mockResolvedValueOnce(6).mockResolvedValueOnce(2) },
    };
    const service = new KnockoutBracketService(
      prisma as never,
      audit as never,
      { computeForGeneration } as never,
    );

    await expect(
      service.generateKnockoutBracket(
        { id: 'admin-1', role: 'ADMIN', tokenVersion: 1 } as never,
        't-1',
      ),
    ).rejects.toMatchObject({
      response: {
        error: 'KNOCKOUT_QUALIFICATION_NOT_READY',
        message: KNOCKOUT_BRACKET_MESSAGES.qualificationNotReady,
        incompleteGroupMatchCount: 2,
        scheduledGroupMatchCount: 6,
      },
    });
    expect(computeForGeneration).not.toHaveBeenCalled();
  });

  describe('canGenerateKnockout', () => {
    const tennis = { type: TournamentType.Center, groupCount: 2, knockoutTeamCount: 4 };

    function serviceWithCounts(total: number, incomplete: number) {
      const count = jest.fn().mockResolvedValueOnce(total).mockResolvedValueOnce(incomplete);
      return {
        count,
        service: makeService({ match: { count } }),
      };
    }

    it('is true once every group-stage match is finished', async () => {
      const { service } = serviceWithCounts(6, 0);
      await expect(service.canGenerateKnockout('t-1', tennis, false)).resolves.toBe(true);
    });

    it('is false while any group-stage match is unfinished or none exist', async () => {
      await expect(
        serviceWithCounts(6, 1).service.canGenerateKnockout('t-1', tennis, false),
      ).resolves.toBe(false);
      await expect(
        serviceWithCounts(0, 0).service.canGenerateKnockout('t-1', tennis, false),
      ).resolves.toBe(false);
    });

    it('skips the match query without groups, knockout size, bracket, or for ACC', async () => {
      const { count, service } = serviceWithCounts(6, 0);
      await expect(
        service.canGenerateKnockout('t-1', { ...tennis, groupCount: 0 }, false),
      ).resolves.toBe(false);
      await expect(
        service.canGenerateKnockout('t-1', { ...tennis, knockoutTeamCount: null }, false),
      ).resolves.toBe(false);
      await expect(service.canGenerateKnockout('t-1', tennis, true)).resolves.toBe(false);
      await expect(
        service.canGenerateKnockout('t-1', { ...tennis, type: TournamentType.ACC }, false),
      ).resolves.toBe(false);
      expect(count).not.toHaveBeenCalled();
    });
  });

  it('deleteKnockoutBracket soft-deletes matches and hard-deletes the bracket row', async () => {
    const tx = {
      match: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      knockoutBracket: {
        delete: jest.fn().mockResolvedValue({ id: 'bracket-1' }),
      },
      tournament: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't-1',
          isDeleted: false,
        }),
      },
      knockoutBracket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'bracket-1',
          tournamentId: 't-1',
        }),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([{ id: 'm-1' }, { id: 'm-2' }]),
      },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };
    const service = makeService(prisma);

    await service.deleteKnockoutBracket(
      { id: 'admin-1', role: 'ADMIN', tokenVersion: 1 } as never,
      't-1',
    );

    expect(tx.match.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.match.updateMany.mock.calls[1]?.[0]?.data).toMatchObject({
      isDeleted: true,
      bracketId: null,
    });
    expect(tx.knockoutBracket.delete).toHaveBeenCalledWith({ where: { id: 'bracket-1' } });
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { championTeamId: null },
    });
  });

  it('countActiveKnockoutMatches filters isDeleted false', async () => {
    const prisma = {
      match: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = makeService(prisma);
    await service.countActiveKnockoutMatches('t-1');
    expect(prisma.match.count).toHaveBeenCalledWith({
      where: {
        tournamentId: 't-1',
        isDeleted: false,
        bracketId: { not: null },
      },
    });
  });

  it('after delete, active knockout count is zero even if soft-deleted rows remain', async () => {
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({ id: 't-1', isDeleted: false }),
      },
      knockoutBracket: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'bracket-1', tournamentId: 't-1' })
          .mockResolvedValue(null),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([{ id: 'm-1' }]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (fn: (client: object) => Promise<void>) =>
        fn({
          match: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          knockoutBracket: { delete: jest.fn().mockResolvedValue({}) },
          tournament: { update: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };
    const service = makeService(prisma);
    await service.deleteKnockoutBracket(
      { id: 'admin-1', role: 'ADMIN', tokenVersion: 1 } as never,
      't-1',
    );
    await service.countActiveKnockoutMatches('t-1');
    expect(prisma.match.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ isDeleted: false, bracketId: { not: null } }),
    });
    expect(await service.hasKnockoutBracket('t-1')).toBe(false);
  });
});

describe('isKnockoutMatchTouchedForCorrection', () => {
  it('includes post-scheduled states', () => {
    expect(isKnockoutMatchTouchedForCorrection('LIVE')).toBe(true);
    expect(isKnockoutMatchTouchedForCorrection('SCHEDULED')).toBe(false);
  });
});
