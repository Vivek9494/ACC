import {
  MatchSide,
  QualificationType,
  type QualifiedTeam,
} from '@acc/types';
import type { Prisma } from '@prisma/client';

import { computeKnockoutSeeding } from '../knockout-seeding/knockout-seeding.compute';
import {
  buildKnockoutBracketPlan,
  type PlannedKnockoutMatch,
} from './knockout-bracket.generate';
import { KnockoutProgressionService } from './knockout-progression.service';

interface StoredMatch {
  id: string;
  tournamentId: string;
  bracketId: string;
  isDeleted: boolean;
  homeTeamId: string | null;
  awayTeamId: string | null;
  awaitingTeams: boolean;
  nextMatchId: string | null;
  nextMatchSlot: MatchSide | null;
  winningTeamId: string | null;
  isNoResult: boolean;
  bracketRoundIndex: number;
  bracketRoundLabel: string | null;
}

function qualifiedTeam(index: number, type: QualificationType): QualifiedTeam {
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

function buildStoreFromPlan(
  plan: PlannedKnockoutMatch[],
  tournamentId: string,
  bracketId: string,
): {
  matches: Map<string, StoredMatch>;
  tournament: { id: string; championTeamId: string | null };
  tx: Prisma.TransactionClient;
} {
  const matches = new Map<string, StoredMatch>();
  const idByKey = new Map<string, string>();

  for (const entry of plan) {
    const id = `m-${entry.bracketRoundIndex}-${entry.bracketPosition}`;
    idByKey.set(`${entry.bracketRoundIndex}:${entry.bracketPosition}`, id);
    matches.set(id, {
      id,
      tournamentId,
      bracketId,
      isDeleted: false,
      homeTeamId: entry.homeTeamId,
      awayTeamId: entry.awayTeamId,
      awaitingTeams: entry.awaitingTeams,
      nextMatchId: null,
      nextMatchSlot: null,
      winningTeamId: null,
      isNoResult: false,
      bracketRoundIndex: entry.bracketRoundIndex,
      bracketRoundLabel: entry.bracketRoundLabel,
    });
  }

  for (const entry of plan) {
    if (!entry.nextMatchKey || !entry.nextMatchSlot) {
      continue;
    }
    const matchId = idByKey.get(`${entry.bracketRoundIndex}:${entry.bracketPosition}`);
    const nextMatchId = idByKey.get(entry.nextMatchKey);
    if (!matchId || !nextMatchId) {
      continue;
    }
    const row = matches.get(matchId);
    if (row) {
      row.nextMatchId = nextMatchId;
      row.nextMatchSlot = entry.nextMatchSlot;
    }
  }

  const tournament = { id: tournamentId, championTeamId: null as string | null };

  const tx = {
    match: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; isDeleted: boolean } }) => {
        const row = matches.get(where.id);
        if (!row || row.isDeleted !== where.isDeleted) {
          return null;
        }
        return {
          id: row.id,
          homeTeamId: row.homeTeamId,
          awayTeamId: row.awayTeamId,
          awaitingTeams: row.awaitingTeams,
        };
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<StoredMatch>;
        }) => {
          const row = matches.get(where.id);
          if (!row) {
            throw new Error(`Missing match ${where.id}`);
          }
          Object.assign(row, data);
          return row;
        },
      ),
    },
    tournament: {
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { championTeamId: string };
        }) => {
          if (where.id !== tournament.id) {
            throw new Error('Unexpected tournament');
          }
          tournament.championTeamId = data.championTeamId;
          return tournament;
        },
      ),
    },
  } as unknown as Prisma.TransactionClient;

  return { matches, tournament, tx };
}

async function confirmMatch(
  service: KnockoutProgressionService,
  tx: Prisma.TransactionClient,
  row: StoredMatch,
  winnerId: string,
): Promise<void> {
  row.winningTeamId = winnerId;
  await service.advanceWinnerOnConfirmation(tx, row);
}

describe('KnockoutProgressionService', () => {
  const service = new KnockoutProgressionService();

  it('does not advance non-knockout matches', async () => {
    const tx = {
      match: { findFirst: jest.fn(), update: jest.fn() },
      tournament: { update: jest.fn() },
    } as unknown as Prisma.TransactionClient;

    await service.advanceWinnerOnConfirmation(tx, {
      id: 'm-1',
      tournamentId: 't-1',
      bracketId: null,
      isDeleted: false,
      winningTeamId: 'team-1',
      isNoResult: false,
      nextMatchId: 'm-2',
      nextMatchSlot: MatchSide.TeamA,
    });

    expect(tx.match.findFirst).not.toHaveBeenCalled();
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it('does not advance tie/no-result knockouts', async () => {
    const tx = {
      match: { findFirst: jest.fn(), update: jest.fn() },
      tournament: { update: jest.fn() },
    } as unknown as Prisma.TransactionClient;

    await service.advanceWinnerOnConfirmation(tx, {
      id: 'm-1',
      tournamentId: 't-1',
      bracketId: 'bracket-1',
      isDeleted: false,
      winningTeamId: null,
      isNoResult: true,
      nextMatchId: 'm-2',
      nextMatchSlot: MatchSide.TeamA,
    });

    expect(tx.match.findFirst).not.toHaveBeenCalled();
  });

  it('is idempotent when confirmation re-fires for the same winner', async () => {
    const tx = {
      match: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'qf-1',
          homeTeamId: 'bye-team',
          awayTeamId: 'team-winner',
          awaitingTeams: false,
        }),
        update: jest.fn(),
      },
      tournament: { update: jest.fn() },
    } as unknown as Prisma.TransactionClient;

    const feeder = {
      id: 'play-in-1',
      tournamentId: 't-1',
      bracketId: 'bracket-1',
      isDeleted: false,
      winningTeamId: 'team-winner',
      isNoResult: false,
      nextMatchId: 'qf-1',
      nextMatchSlot: MatchSide.TeamB,
    };

    await service.advanceWinnerOnConfirmation(tx, feeder);
    await service.advanceWinnerOnConfirmation(tx, feeder);

    expect(tx.match.update).not.toHaveBeenCalled();
  });

  describe('N=12 with byes', () => {
    it('play-in confirmations populate quarter-finals, then cascade to champion', async () => {
      const plan = buildKnockoutBracketPlan(seedingForTeamCount(12));
      const { matches, tournament, tx } = buildStoreFromPlan(plan, 't-12', 'bracket-12');

      const playIns = [...matches.values()].filter(
        (row) => row.bracketRoundLabel === 'Pre Quarter Final',
      );
      expect(playIns).toHaveLength(4);

      for (const playIn of playIns) {
        const winnerId = playIn.homeTeamId ?? playIn.awayTeamId;
        expect(winnerId).toBeTruthy();
        await confirmMatch(service, tx, playIn, winnerId!);
      }

      const quarterFinals = [...matches.values()].filter(
        (row) => row.bracketRoundLabel === 'Quarter Final',
      );
      expect(quarterFinals.every((row) => !row.awaitingTeams)).toBe(true);

      for (const qf of quarterFinals) {
        await confirmMatch(service, tx, qf, qf.homeTeamId!);
      }

      const semiFinals = [...matches.values()].filter(
        (row) => row.bracketRoundLabel === 'Semi Final',
      );
      expect(semiFinals.every((row) => !row.awaitingTeams)).toBe(true);

      for (const sf of semiFinals) {
        await confirmMatch(service, tx, sf, sf.homeTeamId!);
      }

      const finalMatch = [...matches.values()].find((row) => row.bracketRoundLabel === 'Final');
      expect(finalMatch?.awaitingTeams).toBe(false);

      await confirmMatch(service, tx, finalMatch!, finalMatch!.homeTeamId!);
      expect(tournament.championTeamId).toBe(finalMatch!.homeTeamId);
      expect(finalMatch!.nextMatchId).toBeNull();
    });
  });

  describe('N=16 without byes', () => {
    it('play-in confirmations cascade through the full tree to champion', async () => {
      const plan = buildKnockoutBracketPlan(seedingForTeamCount(16));
      const { matches, tournament, tx } = buildStoreFromPlan(plan, 't-16', 'bracket-16');

      const maxRoundIndex = Math.max(...plan.map((entry) => entry.bracketRoundIndex));
      const playIns = [...matches.values()].filter(
        (row) =>
          row.bracketRoundIndex === maxRoundIndex &&
          row.homeTeamId != null &&
          row.awayTeamId != null,
      );
      expect(playIns).toHaveLength(8);

      for (const playIn of playIns) {
        await confirmMatch(service, tx, playIn, playIn.homeTeamId!);
      }

      let roundMatches = [...matches.values()].filter(
        (row) => row.bracketRoundLabel === 'Quarter Final',
      );
      expect(roundMatches.every((row) => !row.awaitingTeams)).toBe(true);

      for (const qf of roundMatches) {
        await confirmMatch(service, tx, qf, qf.homeTeamId!);
      }

      roundMatches = [...matches.values()].filter((row) => row.bracketRoundLabel === 'Semi Final');
      expect(roundMatches.every((row) => !row.awaitingTeams)).toBe(true);

      for (const sf of roundMatches) {
        await confirmMatch(service, tx, sf, sf.homeTeamId!);
      }

      const finalMatch = [...matches.values()].find((row) => row.bracketRoundLabel === 'Final');
      expect(finalMatch?.awaitingTeams).toBe(false);

      await confirmMatch(service, tx, finalMatch!, finalMatch!.homeTeamId!);
      expect(tournament.championTeamId).toBe(finalMatch!.homeTeamId);
    });
  });
});
