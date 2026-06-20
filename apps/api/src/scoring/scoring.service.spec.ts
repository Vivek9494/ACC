import 'reflect-metadata';

import { type AuthUser, DeliveryType, DismissalType, STALE_SCORECARD_ERROR } from '@acc/types';
import { BadRequestException, ConflictException } from '@nestjs/common';

import { ScorecardDisplayBuilder } from './scorecard-display.builder';
import { ScorecardReader } from './scorecard-reader';
import { ScoringService } from './scoring.service';

/** Wires a ScoringService over the in-memory prisma mock with no-op deps. */
function makeService(prisma: unknown): ScoringService {
  const displayBuilder = new ScorecardDisplayBuilder(prisma as never);
  const reader = new ScorecardReader(prisma as never, displayBuilder);
  const live = { publish: async () => undefined } as never;
  const audit = { record: async () => undefined } as never;
  const confirmation = { evaluateAutoConfirm: async () => undefined } as never;
  return new ScoringService(prisma as never, live, reader, audit, confirmation);
}

const scorer: AuthUser = {
  id: 'scorer-1',
  firstName: 'Score',
  lastName: 'Keeper',
  mobileNumber: '+15555550000',
  email: 's@acc.local',
  centerId: 'c1',
  jerseyNumber: 1,
  profilePhotoUrl: null,
  role: 'PLAYER' as AuthUser['role'],
  isActive: true,
};

interface Row {
  [key: string]: unknown;
}

function makeDb() {
  const matches = new Map<string, Row>();
  const innings = new Map<string, Row>();
  const deliveries = new Map<string, Row>();
  let counter = 0;
  const newId = (p: string): string => `${p}-${++counter}`;

  const prisma = {
    match: {
      findUnique: async ({
        where,
        include,
        select,
      }: {
        where: { id: string };
        include?: { homeTeam?: unknown; awayTeam?: unknown };
        select?: unknown;
      }) => {
        const m = matches.get(where.id);
        if (!m) return null;
        if (select) {
          return {
            id: m.id,
            homeTeamId: m.homeTeamId ?? 'home',
            awayTeamId: m.awayTeamId ?? 'away',
            externalOpponentName: m.externalOpponentName ?? null,
            homeTeam: { id: m.homeTeamId ?? 'home', name: 'Home', logoUrl: null },
            awayTeam: { id: m.awayTeamId ?? 'away', name: 'Away', logoUrl: null },
            squads: [],
            externalPlayers: [],
          };
        }
        if (include?.homeTeam || include?.awayTeam) {
          return {
            ...m,
            homeTeam: { id: m.homeTeamId ?? 'home', name: 'Home' },
            awayTeam: { id: m.awayTeamId ?? 'away', name: 'Away' },
          };
        }
        return { ...m };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const m = matches.get(where.id) as Row;
        const inc = data.scorecardVersion as { increment?: number } | undefined;
        if (inc?.increment) m.scorecardVersion = (m.scorecardVersion as number) + inc.increment;
        if (data.dlsTarget !== undefined) m.dlsTarget = data.dlsTarget;
        if (data.originalTarget !== undefined) m.originalTarget = data.originalTarget;
        if (data.state !== undefined) m.state = data.state;
        if (data.completedAt !== undefined) m.completedAt = data.completedAt;
        if (data.winningTeamId !== undefined) m.winningTeamId = data.winningTeamId;
        if (data.resultNote !== undefined) m.resultNote = data.resultNote;
        return { ...m };
      },
    },
    innings: {
      findMany: async ({
        where,
        orderBy,
        take,
        include,
      }: {
        where: { matchId: string };
        orderBy?: { sequence: 'asc' | 'desc' };
        take?: number;
        include?: { deliveries: unknown };
      }) => {
        let rows = [...innings.values()].filter((i) => i.matchId === where.matchId);
        rows.sort((a, b) =>
          orderBy?.sequence === 'desc'
            ? (b.sequence as number) - (a.sequence as number)
            : (a.sequence as number) - (b.sequence as number),
        );
        if (take) rows = rows.slice(0, take);
        if (include?.deliveries) {
          rows = rows.map((r) => ({
            ...r,
            deliveries: [...deliveries.values()]
              .filter((d) => d.inningsId === r.id && !d.isVoided)
              .sort((a, b) => (a.sequence as number) - (b.sequence as number)),
          }));
        }
        return rows;
      },
      findUnique: async ({ where }: { where: { id: string } }) => innings.get(where.id) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row: Row = { id: newId('inn'), revisedTarget: null, ...data };
        innings.set(row.id as string, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const r = innings.get(where.id) as Row;
        Object.assign(r, data);
        return r;
      },
    },
    delivery: {
      findMany: async ({ where }: { where: { inningsId: string; isVoided?: boolean } }) =>
        [...deliveries.values()]
          .filter(
            (d) =>
              d.inningsId === where.inningsId &&
              (where.isVoided === undefined || d.isVoided === where.isVoided),
          )
          .sort((a, b) => (a.sequence as number) - (b.sequence as number)),
      findFirst: async ({ where }: { where: { inningsId: string } }) =>
        [...deliveries.values()]
          .filter((d) => d.inningsId === where.inningsId)
          .sort((a, b) => (b.sequence as number) - (a.sequence as number))[0] ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => deliveries.get(where.id) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row: Row = {
          id: newId('del'),
          isVoided: false,
          supersededByDeliveryId: null,
          revision: 1,
          ...data,
        };
        deliveries.set(row.id as string, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const r = deliveries.get(where.id) as Row;
        Object.assign(r, data);
        return r;
      },
    },
    externalPlayer: { findMany: async () => [] as Row[] },
    user: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id, firstName: id, lastName: '' })),
    },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };

  return { prisma, matches, innings, deliveries };
}

function seedMatch(matches: Map<string, Row>): void {
  matches.set('match-1', {
    id: 'match-1',
    state: 'LIVE',
    scorecardVersion: 0,
    originalTarget: null,
    dlsTarget: null,
    isNoResult: false,
    homeTeamId: 'home',
    awayTeamId: 'away',
    externalOpponentName: null,
    oversPerInnings: 20,
    resultNote: null,
    winningTeamId: null,
  });
}

/** Alternate bowlers each over so consecutive-over validation passes in multi-over tests. */
function bowlerForLegalBall(index: number): string {
  return Math.floor(index / 6) % 2 === 0 ? 'X' : 'Y';
}

describe('ScoringService — append-only persistence & derivation', () => {
  it('appends deliveries and derives the score by folding', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);

    await service.startInnings(scorer, 'match-1', {
      battingTeamId: 'home',
      bowlingTeamId: 'away',
      oversAllotted: 20,
      expectedVersion: 0,
    });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;

    const version = (): number => matches.get('match-1')!.scorecardVersion as number;
    const participantsCard = await service.setInningsParticipants(scorer, 'match-1', inningsId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    const live = participantsCard.innings[0];
    expect(live?.currentStrikerId).toBe('A');
    expect(live?.currentNonStrikerId).toBe('B');
    expect(live?.currentBowlerId).toBe('X');

    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 4,
      isBoundary: true,
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.Wide,
      extraRuns: 1,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 1,
      expectedVersion: version(),
    });

    const card = await service.getScorecard('match-1');
    expect(card.innings[0]!.runs).toBe(6);
    expect(card.innings[0]!.extras.wides).toBe(1);
    expect(card.innings[0]!.legalBalls).toBe(2);
    expect(card.version).toBe(version());
  });

  it('records a wide with completed runs (Wd + 4) as extras charged to the bowler', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;

    await service.setInningsParticipants(scorer, 'match-1', inningsId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });

    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.Wide,
      extraRuns: 5,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });

    const card = await service.getScorecard('match-1');
    expect(card.innings[0]!.runs).toBe(5);
    expect(card.innings[0]!.extras.wides).toBe(5);
    expect(card.innings[0]!.legalBalls).toBe(0);
    expect(card.innings[0]!.currentStrikerId).toBe('A');
    expect(card.innings[0]!.currentNonStrikerId).toBe('B');
    expect(card.innings[0]!.bowlers[0]).toMatchObject({ runsConceded: 5, legalBalls: 0, wides: 1 });
    expect(card.innings[0]!.batters.find((b) => b.playerId === 'A')).toMatchObject({ runs: 0, balls: 0 });
  });

  it('records Nb+4 off the bat and arms a free hit on the next delivery', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;

    await service.setInningsParticipants(scorer, 'match-1', inningsId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });

    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.NoBall,
      extraRuns: 1,
      runsBat: 4,
      isBoundary: true,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });

    const card = await service.getScorecard('match-1');
    expect(card.innings[0]!.runs).toBe(5);
    expect(card.innings[0]!.extras.noBalls).toBe(1);
    expect(card.innings[0]!.legalBalls).toBe(0);
    expect(card.innings[0]!.freeHitNext).toBe(true);
    expect(card.innings[0]!.batters.find((b) => b.playerId === 'A')).toMatchObject({ runs: 4, balls: 1 });
    expect(card.innings[0]!.bowlers[0]).toMatchObject({ runsConceded: 5, legalBalls: 0, noBalls: 1 });
  });

  it('records 4L NB as no-ball penalty plus leg-byes', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;

    await service.setInningsParticipants(scorer, 'match-1', inningsId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });

    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.NoBall,
      extraRuns: 1,
      noBallLegByeRuns: 4,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });

    const card = await service.getScorecard('match-1');
    expect(card.innings[0]!.runs).toBe(5);
    expect(card.innings[0]!.extras.noBalls).toBe(1);
    expect(card.innings[0]!.extras.legByes).toBe(4);
    expect(card.innings[0]!.freeHitNext).toBe(true);
    expect(card.innings[0]!.batters.find((b) => b.playerId === 'A')).toMatchObject({ runs: 0, balls: 1 });
    expect(card.innings[0]!.bowlers[0]).toMatchObject({ runsConceded: 1, legalBalls: 0, noBalls: 1 });
  });

  it('clears the selected bowler only when a legal ball completes the over', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;

    await service.setInningsParticipants(scorer, 'match-1', inningsId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });

    for (let i = 0; i < 6; i += 1) {
      await service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: 'X',
        runsBat: 0,
        expectedVersion: version(),
      });
    }

    let card = await service.getScorecard('match-1');
    expect(card.innings[0]!.legalBalls).toBe(6);
    expect(card.innings[0]!.currentBowlerId).toBeNull();

    await service.setInningsParticipants(scorer, 'match-1', inningsId, {
      bowlerId: 'Y',
      expectedVersion: version(),
    });
    card = await service.getScorecard('match-1');
    expect(card.innings[0]!.currentBowlerId).toBe('Y');

    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.PenaltyRuns,
      extraRuns: 3,
      expectedVersion: version(),
    });
    card = await service.getScorecard('match-1');
    expect(card.innings[0]!.runs).toBe(3);
    expect(card.innings[0]!.legalBalls).toBe(6);
    expect(card.innings[0]!.currentBowlerId).toBe('Y');

    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.Wide,
      extraRuns: 1,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'Y',
      expectedVersion: version(),
    });
    card = await service.getScorecard('match-1');
    expect(card.innings[0]!.legalBalls).toBe(6);
    expect(card.innings[0]!.currentBowlerId).toBe('Y');

    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'Y',
      runsBat: 0,
      expectedVersion: version(),
    });
    card = await service.getScorecard('match-1');
    expect(card.innings[0]!.legalBalls).toBe(7);
    expect(card.innings[0]!.currentBowlerId).toBe('Y');
  });

  it('undoes the last delivery by voiding it and re-deriving totals', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;

    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 4,
      isBoundary: true,
      expectedVersion: version(),
    });
    await service.undoLastDelivery(scorer, 'match-1', inningsId, { expectedVersion: version() });

    const card = await service.getScorecard('match-1');
    expect(card.innings[0]!.runs).toBe(0);
    expect(card.innings[0]!.legalBalls).toBe(0);
  });

  it('rejects a non-run-out dismissal on a free hit', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;

    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.NoBall,
      extraRuns: 1,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });

    await expect(
      service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: 'X',
        runsBat: 0,
        dismissal: { type: DismissalType.Bowled, dismissedId: 'A' },
        expectedVersion: version(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects the same bowler starting consecutive overs', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;

    for (let i = 0; i < 6; i += 1) {
      await service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: 'X',
        runsBat: 0,
        expectedVersion: version(),
      });
    }

    await expect(
      service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: 'X',
        runsBat: 0,
        expectedVersion: version(),
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ScoringService — concurrent editing (§12.3)', () => {
  it('rejects a stale save with the exact message "Scorecard got updated."', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);

    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 }); // version → 1
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;

    await expect(
      service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: 'X',
        runsBat: 1,
        expectedVersion: 0, // stale: real version is 1
      }),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ response: { message: STALE_SCORECARD_ERROR } });
  });
});

describe('ScoringService — scorer edit window (§12.2)', () => {
  async function setupThreeOvers() {
    const { prisma, matches, deliveries } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!.id as string;

    const version = (): number => matches.get('match-1')!.scorecardVersion as number;
    // 18 legal dot balls => three completed overs, now in over 3 boundary.
    for (let i = 0; i < 18; i += 1) {
      await service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: bowlerForLegalBall(i),
        runsBat: 0,
        expectedVersion: version(),
      });
    }
    return { service, prisma, matches, deliveries, inningsId, version };
  }

  it('rejects an edit to an over older than the previous one', async () => {
    const { service, deliveries, version } = await setupThreeOvers();
    const over1 = [...deliveries.values()].find((d) => d.overNumber === 1)!;

    await expect(
      service.editDelivery(scorer, 'match-1', {
        deliveryId: over1.id as string,
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: 'X',
        runsBat: 4,
        isBoundary: true,
        expectedVersion: version(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows an edit to the immediately previous over and supersedes the old ball', async () => {
    const { service, deliveries, version } = await setupThreeOvers();
    // After 18 legal balls the current over is 4 (empty); over 3 is the previous.
    const over3 = [...deliveries.values()].find((d) => d.overNumber === 3 && !d.isVoided)!;

    const card = await service.editDelivery(scorer, 'match-1', {
      deliveryId: over3.id as string,
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 6,
      isBoundary: true,
      expectedVersion: version(),
    });

    expect(card.innings[0]!.runs).toBe(6); // the single edited ball now scores 6
    const replaced = deliveries.get(over3.id as string)!;
    expect(replaced.isVoided).toBe(true);
    expect(replaced.supersededByDeliveryId).toBeTruthy();
  });
});

describe('ScoringService — DLS target (§12.1)', () => {
  async function setupChase() {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', {
      battingTeamId: 'home',
      bowlingTeamId: 'away',
      oversAllotted: 20,
      expectedVersion: 0,
    });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!
      .id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;
    await service.setInningsParticipants(scorer, 'match-1', inningsId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 50,
      expectedVersion: version(),
    });
    await service.endInnings(scorer, 'match-1', inningsId, { expectedVersion: version() });
    return { service, version };
  }

  it('rejects a target change while the first innings is still in progress', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', {
      battingTeamId: 'home',
      bowlingTeamId: 'away',
      oversAllotted: 20,
      expectedVersion: 0,
    });
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;

    await expect(
      service.setDlsTarget(scorer, 'match-1', {
        originalTarget: 180,
        dlsTarget: 165,
        expectedVersion: version(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('stores both targets and surfaces the DLS target as effective', async () => {
    const { service, version } = await setupChase();

    const card = await service.setDlsTarget(scorer, 'match-1', {
      originalTarget: 51,
      dlsTarget: 165,
      expectedVersion: version(),
    });
    expect(card.originalTarget).toBe(51);
    expect(card.dlsTarget).toBe(165);
    expect(card.effectiveTarget).toBe(165);
  });
});

describe('ScoringService — end innings transition (§12.2)', () => {
  async function setupFirstInnings(oversAllotted = 20, legalBallCount = 6, lastBallRuns = 4) {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', {
      battingTeamId: 'home',
      bowlingTeamId: 'away',
      oversAllotted,
      expectedVersion: 0,
    });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!
      .id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;
    await service.setInningsParticipants(scorer, 'match-1', inningsId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    for (let i = 0; i < legalBallCount; i += 1) {
      await service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: bowlerForLegalBall(i),
        runsBat: i === legalBallCount - 1 ? lastBallRuns : 0,
        expectedVersion: version(),
      });
    }
    return { service, prisma, matches, inningsId, version };
  }

  it('starts the chase after the first innings closes on overs complete', async () => {
    const { service, matches, inningsId, version } = await setupFirstInnings(1, 6, 50);
    const card = await service.endInnings(scorer, 'match-1', inningsId, {
      expectedVersion: version(),
    });
    expect(card.innings).toHaveLength(2);
    expect(card.originalTarget).toBe(51);
    expect(matches.get('match-1')!.state).toBe('LIVE');
  });

  it('completes the match with a result note after the chase ends short', async () => {
    const { service, matches, inningsId, version } = await setupFirstInnings(20, 6, 50);
    await service.endInnings(scorer, 'match-1', inningsId, { expectedVersion: version() });
    const chaseId = (await service.getScorecard('match-1')).innings[1]!.inningsId!;
    await service.setInningsParticipants(scorer, 'match-1', chaseId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', chaseId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 20,
      expectedVersion: version(),
    });

    const card = await service.endInnings(scorer, 'match-1', chaseId, {
      expectedVersion: version(),
    });
    expect(matches.get('match-1')!.state).toBe('COMPLETED');
    expect(card.result.decided).toBe(true);
    expect(card.result.winningTeamId).toBe('home');
    expect(matches.get('match-1')!.resultNote).toContain('won by');
  });

  it('starts a super over when the chase ends tied', async () => {
    const { service, matches, inningsId, version } = await setupFirstInnings(20, 6, 50);
    await service.endInnings(scorer, 'match-1', inningsId, { expectedVersion: version() });
    const chaseId = (await service.getScorecard('match-1')).innings[1]!.inningsId!;
    await service.setInningsParticipants(scorer, 'match-1', chaseId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', chaseId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 50,
      expectedVersion: version(),
    });

    const card = await service.endInnings(scorer, 'match-1', chaseId, {
      expectedVersion: version(),
    });

    expect(matches.get('match-1')!.state).toBe('LIVE');
    expect(card.result.superOverRequired).toBe(true);
    expect(card.innings).toHaveLength(3);
    const superOver = card.innings[2]!;
    expect(superOver.inningsType).toBe('SUPER_OVER');
    expect(superOver.battingTeamId).toBe('away');
    expect(superOver.bowlingTeamId).toBe('home');
  });

  it('completes the match after a super over decides the winner', async () => {
    const { service, matches, inningsId, version } = await setupFirstInnings(20, 6, 50);
    await service.endInnings(scorer, 'match-1', inningsId, { expectedVersion: version() });
    const chaseId = (await service.getScorecard('match-1')).innings[1]!.inningsId!;
    await service.setInningsParticipants(scorer, 'match-1', chaseId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', chaseId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 50,
      expectedVersion: version(),
    });
    await service.endInnings(scorer, 'match-1', chaseId, { expectedVersion: version() });

    const so1Id = (await service.getScorecard('match-1')).innings[2]!.inningsId!;
    await service.setInningsParticipants(scorer, 'match-1', so1Id, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', so1Id, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 10,
      expectedVersion: version(),
    });
    await service.endInnings(scorer, 'match-1', so1Id, { expectedVersion: version() });

    const so2Id = (await service.getScorecard('match-1')).innings[3]!.inningsId!;
    await service.setInningsParticipants(scorer, 'match-1', so2Id, {
      strikerId: 'C',
      nonStrikerId: 'D',
      bowlerId: 'Y',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', so2Id, {
      type: DeliveryType.Legal,
      strikerId: 'C',
      nonStrikerId: 'D',
      bowlerId: 'Y',
      runsBat: 11,
      expectedVersion: version(),
    });

    const final = await service.endInnings(scorer, 'match-1', so2Id, {
      expectedVersion: version(),
    });

    expect(matches.get('match-1')!.state).toBe('COMPLETED');
    expect(final.result.decided).toBe(true);
    expect(final.result.isTie).toBe(false);
    expect(final.result.winningTeamId).toBe('home');
    expect(matches.get('match-1')!.resultNote).toContain('Super Over');
  });

  it('starts another super over with alternated batting order when a super over ties', async () => {
    const { service, matches, inningsId, version } = await setupFirstInnings(20, 6, 50);
    await service.endInnings(scorer, 'match-1', inningsId, { expectedVersion: version() });
    const chaseId = (await service.getScorecard('match-1')).innings[1]!.inningsId!;
    await service.setInningsParticipants(scorer, 'match-1', chaseId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', chaseId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 50,
      expectedVersion: version(),
    });
    await service.endInnings(scorer, 'match-1', chaseId, { expectedVersion: version() });

    const so1Id = (await service.getScorecard('match-1')).innings[2]!.inningsId!;
    await service.setInningsParticipants(scorer, 'match-1', so1Id, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', so1Id, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 10,
      expectedVersion: version(),
    });
    await service.endInnings(scorer, 'match-1', so1Id, { expectedVersion: version() });

    const so2Id = (await service.getScorecard('match-1')).innings[3]!.inningsId!;
    await service.setInningsParticipants(scorer, 'match-1', so2Id, {
      strikerId: 'C',
      nonStrikerId: 'D',
      bowlerId: 'Y',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', so2Id, {
      type: DeliveryType.Legal,
      strikerId: 'C',
      nonStrikerId: 'D',
      bowlerId: 'Y',
      runsBat: 10,
      expectedVersion: version(),
    });

    const card = await service.endInnings(scorer, 'match-1', so2Id, {
      expectedVersion: version(),
    });

    expect(matches.get('match-1')!.state).toBe('LIVE');
    expect(card.result.superOverRequired).toBe(true);
    expect(card.innings).toHaveLength(5);
    const so3 = card.innings[4]!;
    expect(so3.inningsType).toBe('SUPER_OVER');
    expect(so3.battingTeamId).toBe('home');
    expect(so3.bowlingTeamId).toBe('away');
  });
});

describe('ScoringService — overs revision (§12.2)', () => {
  async function setupActiveInnings(legalBallCount = 18) {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', {
      battingTeamId: 'home',
      bowlingTeamId: 'away',
      oversAllotted: 20,
      expectedVersion: 0,
    });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!
      .id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;
    await service.setInningsParticipants(scorer, 'match-1', inningsId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    for (let i = 0; i < legalBallCount; i += 1) {
      await service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: bowlerForLegalBall(i),
        runsBat: 0,
        expectedVersion: version(),
      });
    }
    return { service, prisma, matches, inningsId, version };
  }

  it('rejects overs below what has already been bowled', async () => {
    const { service, inningsId, version } = await setupActiveInnings(18);
    await expect(
      service.setOversAllotted(scorer, 'match-1', {
        inningsId,
        oversAllotted: 2,
        expectedVersion: version(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('revises overs for the active innings and re-derives the scorecard', async () => {
    const { service, inningsId, version } = await setupActiveInnings(18);
    const card = await service.setOversAllotted(scorer, 'match-1', {
      inningsId,
      oversAllotted: 15,
      expectedVersion: version(),
    });
    expect(card.innings[0]!.oversAllotted).toBe(15);
  });

  it('uses revised first-innings overs when the chase innings begins', async () => {
    const { service, inningsId, version } = await setupActiveInnings(6);
    await service.setOversAllotted(scorer, 'match-1', {
      inningsId,
      oversAllotted: 15,
      expectedVersion: version(),
    });
    await service.endInnings(scorer, 'match-1', inningsId, { expectedVersion: version() });
    const card = await service.getScorecard('match-1');
    expect(card.innings[0]!.oversAllotted).toBe(15);
    expect(card.innings[1]!.oversAllotted).toBe(15);
  });

  it('revises chase overs without changing the first innings allotment', async () => {
    const { service, inningsId, version } = await setupActiveInnings(6);
    await service.endInnings(scorer, 'match-1', inningsId, { expectedVersion: version() });
    const cardBefore = await service.getScorecard('match-1');
    const chaseId = cardBefore.innings[1]!.inningsId!;
    await service.setInningsParticipants(scorer, 'match-1', chaseId, {
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', chaseId, {
      type: DeliveryType.Legal,
      strikerId: 'A',
      nonStrikerId: 'B',
      bowlerId: 'X',
      runsBat: 4,
      expectedVersion: version(),
    });

    const card = await service.setOversAllotted(scorer, 'match-1', {
      inningsId: chaseId,
      oversAllotted: 12,
      expectedVersion: version(),
    });
    expect(card.innings[0]!.oversAllotted).toBe(20);
    expect(card.innings[1]!.oversAllotted).toBe(12);
  });
});

describe('ScoringService — post-confirmation edits (§13.2)', () => {
  async function setupLocked() {
    const { prisma, matches, deliveries } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!
      .id as string;
    const version = (): number => matches.get('match-1')!.scorecardVersion as number;
    // 18 legal dot balls => three completed overs.
    for (let i = 0; i < 18; i += 1) {
      await service.recordDelivery(scorer, 'match-1', inningsId, {
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: bowlerForLegalBall(i),
        runsBat: 0,
        expectedVersion: version(),
      });
    }
    // The match is completed and the scorecard locked (§13.1).
    matches.get('match-1')!.state = 'SCORECARD_LOCKED';
    return { service, matches, deliveries, version };
  }

  it('lets an authorised editor correct ANY over once locked (edit-window exempt)', async () => {
    const { service, deliveries, version } = await setupLocked();
    const over1 = [...deliveries.values()].find((d) => d.overNumber === 1 && !d.isVoided)!;

    const card = await service.editDelivery(
      scorer,
      'match-1',
      {
        deliveryId: over1.id as string,
        type: DeliveryType.Legal,
        strikerId: 'A',
        nonStrikerId: 'B',
        bowlerId: 'X',
        runsBat: 4,
        isBoundary: true,
        expectedVersion: version(),
      },
      { postConfirm: true },
    );

    expect(card.innings[0]!.runs).toBe(4);
    expect(deliveries.get(over1.id as string)!.isVoided).toBe(true);
  });

  it('still rejects a NON-post-confirm edit once locked (match not live)', async () => {
    const { service, deliveries, version } = await setupLocked();
    const over1 = [...deliveries.values()].find((d) => d.overNumber === 1 && !d.isVoided)!;

    await expect(
      service.editDelivery(scorer, 'match-1', {
        deliveryId: over1.id as string,
        type: DeliveryType.Legal,
        runsBat: 4,
        isBoundary: true,
        expectedVersion: version(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a post-confirm edit when the scorecard is not locked', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches); // state LIVE
    const service = makeService(prisma);
    await service.startInnings(scorer, 'match-1', { expectedVersion: 0 });
    const inningsId = (await prisma.innings.findMany({ where: { matchId: 'match-1' } }))[0]!
      .id as string;

    await expect(
      service.recordDelivery(
        scorer,
        'match-1',
        inningsId,
        {
          type: DeliveryType.Legal,
          strikerId: 'A',
          nonStrikerId: 'B',
          bowlerId: 'X',
          runsBat: 1,
          expectedVersion: matches.get('match-1')!.scorecardVersion as number,
        },
        { postConfirm: true },
      ),
    ).rejects.toMatchObject({ response: { error: 'SCORECARD_NOT_LOCKED' } });
  });
});
