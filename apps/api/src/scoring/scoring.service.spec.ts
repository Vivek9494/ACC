import 'reflect-metadata';

import { type AuthUser, DeliveryType, STALE_SCORECARD_ERROR } from '@acc/types';
import { BadRequestException, ConflictException } from '@nestjs/common';

import { ScorecardReader } from './scorecard-reader';
import { ScoringService } from './scoring.service';

/** Wires a ScoringService over the in-memory prisma mock with no-op deps. */
function makeService(prisma: unknown): ScoringService {
  const reader = new ScorecardReader(prisma as never);
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
      findUnique: async ({ where }: { where: { id: string } }) => matches.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const m = matches.get(where.id) as Row;
        const inc = data.scorecardVersion as { increment?: number } | undefined;
        if (inc?.increment) m.scorecardVersion = (m.scorecardVersion as number) + inc.increment;
        if (data.dlsTarget !== undefined) m.dlsTarget = data.dlsTarget;
        if (data.originalTarget !== undefined) m.originalTarget = data.originalTarget;
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
  });
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
      expectedVersion: version(),
    });
    await service.recordDelivery(scorer, 'match-1', inningsId, {
      type: DeliveryType.Legal,
      runsBat: 1,
      expectedVersion: version(),
    });

    const card = await service.getScorecard('match-1');
    expect(card.innings[0]!.runs).toBe(6);
    expect(card.innings[0]!.extras.wides).toBe(1);
    expect(card.innings[0]!.legalBalls).toBe(2);
    expect(card.version).toBe(version());
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
        bowlerId: 'X',
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
  it('stores both targets and surfaces the DLS target as effective', async () => {
    const { prisma, matches } = makeDb();
    seedMatch(matches);
    const service = makeService(prisma);

    const card = await service.setDlsTarget(scorer, 'match-1', {
      originalTarget: 180,
      dlsTarget: 165,
      expectedVersion: 0,
    });
    expect(card.originalTarget).toBe(180);
    expect(card.dlsTarget).toBe(165);
    expect(card.effectiveTarget).toBe(165);
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
        bowlerId: 'X',
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
