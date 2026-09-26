/**
 * TEMPORARY perf probe — times heavy stats endpoints and counts ScorecardReader rebuilds.
 *
 * Usage (from apps/api):
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/measure-heavy-stats-perf.ts
 *
 * Optional env:
 *   PERF_TOURNAMENT_ID=<uuid>  — default: tournament with most scored matches
 *   PERF_USER_ID=<uuid>        — default: user with most Playing XI appearances
 */
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { BallType, MatchState, MatchSquadRole } from '@acc/types';
import type { Match } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { LeaderboardService } from '../src/leaderboard/leaderboard.service';
import { PlayerStatsService } from '../src/player-stats/player-stats.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ScorecardReader } from '../src/scoring/scorecard-reader';
import { StandingsService } from '../src/standings/standings.service';
import { TournamentAggregatesCacheService } from '../src/stats/tournament-aggregates-cache.service';
import { PlayerCareerCacheService } from '../src/stats/player-career-cache.service';
import { StatsInvalidationService } from '../src/stats/stats-invalidation.service';
import { RedisService } from '../src/redis/redis.service';

type ProbeResult = {
  label: string;
  totalMs: number;
  scorecardRebuilds: number;
  scorecardRebuildMs: number;
  otherMs: number | null;
  rebuildSharePct: number | null;
  notes?: string;
};

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const reader = app.get(ScorecardReader);
  const leaderboard = app.get(LeaderboardService);
  const standings = app.get(StandingsService);
  const playerStats = app.get(PlayerStatsService);
  const aggregatesCache = app.get(TournamentAggregatesCacheService);
  const careerCache = app.get(PlayerCareerCacheService);
  const statsInvalidation = app.get(StatsInvalidationService);
  const redis = app.get(RedisService);

  let rebuilds = 0;
  let rebuildMs = 0;

  const originalBuild = reader.build.bind(reader) as (
    match: Match,
  ) => ReturnType<ScorecardReader['build']>;

  // Count every scorecard derivation. byMatchId → build is counted once here.
  (reader as { build: typeof reader.build }).build = async (match: Match) => {
    rebuilds += 1;
    const t0 = performance.now();
    try {
      return await originalBuild(match);
    } finally {
      rebuildMs += performance.now() - t0;
    }
  };

  const tournamentId =
    process.env.PERF_TOURNAMENT_ID ??
    (
      await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT t.id
        FROM "Tournament" t
        LEFT JOIN "Match" m ON m."tournamentId" = t.id AND m."isDeleted" = false
          AND m.state IN ('COMPLETED', 'SCORECARD_LOCKED')
        WHERE t."isDeleted" = false
        GROUP BY t.id
        ORDER BY COUNT(m.id) DESC
        LIMIT 1
      `
    )[0]?.id;

  if (!tournamentId) {
    throw new Error('No tournament found to measure');
  }

  const tournamentMeta = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { id: true, name: true, ballType: true },
  });

  const scoredMatchCount = await prisma.match.count({
    where: {
      tournamentId,
      isDeleted: false,
      state: { in: [MatchState.Completed, MatchState.ScorecardLocked] },
    },
  });
  const standingsMatchCount = await prisma.match.count({
    where: {
      tournamentId,
      isDeleted: false,
      state: {
        in: [
          MatchState.Completed,
          MatchState.ScorecardLocked,
          MatchState.NoResult,
          MatchState.Cancelled,
        ],
      },
    },
  });
  const statsMatchCount = await prisma.match.count({
    where: {
      tournamentId,
      isDeleted: false,
      state: {
        in: [
          MatchState.Completed,
          MatchState.ScorecardLocked,
          MatchState.NoResult,
          MatchState.Cancelled,
        ],
      },
    },
  });

  const userId =
    process.env.PERF_USER_ID ??
    (
      await prisma.matchSquadPlayer.groupBy({
        by: ['userId'],
        where: {
          role: MatchSquadRole.PlayingXi,
          squad: {
            match: {
              isDeleted: false,
              state: { in: [MatchState.Completed, MatchState.ScorecardLocked] },
            },
          },
        },
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 1,
      })
    )[0]?.userId;

  if (!userId) {
    throw new Error('No Playing XI user found to measure career stats');
  }

  const userXiCount = await prisma.matchSquadPlayer.count({
    where: {
      userId,
      role: MatchSquadRole.PlayingXi,
      squad: {
        match: {
          isDeleted: false,
          state: { in: [MatchState.Completed, MatchState.ScorecardLocked] },
        },
      },
    },
  });

  async function probe(
    label: string,
    notes: string,
    run: () => Promise<unknown>,
    opts?: { parallelRebuilds?: boolean },
  ): Promise<ProbeResult> {
    rebuilds = 0;
    rebuildMs = 0;
    const t0 = performance.now();
    await run();
    const totalMs = performance.now() - t0;
    const parallel = opts?.parallelRebuilds === true;
    return {
      label,
      totalMs: Math.round(totalMs),
      scorecardRebuilds: rebuilds,
      scorecardRebuildMs: Math.round(rebuildMs),
      // When rebuilds run in parallel (Promise.all), summed rebuildMs can exceed wall time.
      otherMs: parallel ? null : Math.round(totalMs - rebuildMs),
      rebuildSharePct: parallel ? null : pct(rebuildMs, totalMs),
      notes: parallel
        ? `${notes}; rebuildMs is sum of overlapping builds (not wall-share)`
        : notes,
    };
  }

  const results: ProbeResult[] = [];

  // Warm connection / JIT a bit with a cheap query
  await prisma.match.count({ where: { tournamentId } });

  // Force a true cold miss for the three tournament aggregates.
  await aggregatesCache.invalidateTournamentAggregates(tournamentId);

  results.push(
    await probe(
      'GET tournaments/:id/leaderboard (cold)',
      `scoredMatches=${scoredMatchCount}`,
      () => leaderboard.getLeaderboard(tournamentId, null, null),
      { parallelRebuilds: true },
    ),
  );

  results.push(
    await probe(
      'GET tournaments/:id/stats (cold)',
      `statsMatches=${statsMatchCount} (excl Live/Rain — Option B)`,
      () => leaderboard.getTournamentStats(tournamentId, null, null),
      { parallelRebuilds: true },
    ),
  );

  results.push(
    await probe(
      'GET tournaments/:id/standings (cold)',
      `standingsMatches=${standingsMatchCount}`,
      () => standings.getStandings(tournamentId, null),
      { parallelRebuilds: true },
    ),
  );

  results.push(
    await probe(
      'GET tournaments/:id/leaderboard (warm)',
      'expect ~ms + 0 rebuilds',
      () => leaderboard.getLeaderboard(tournamentId, null, null),
    ),
  );

  results.push(
    await probe(
      'GET tournaments/:id/stats (warm)',
      'expect ~ms + 0 rebuilds',
      () => leaderboard.getTournamentStats(tournamentId, null, null),
    ),
  );

  results.push(
    await probe(
      'GET tournaments/:id/standings (warm)',
      'expect ~ms + 0 rebuilds',
      () => standings.getStandings(tournamentId, null),
    ),
  );

  // Force a true cold miss for this player's careers (both ball types).
  await careerCache.invalidatePlayers([userId]);

  results.push(
    await probe(
      'buildDashboardHighLevelStats (cold)',
      `userId=${userId} xiAppearances≈${userXiCount} (leather+tennis careers)`,
      () => playerStats.buildDashboardHighLevelStats(userId),
      { parallelRebuilds: true },
    ),
  );

  results.push(
    await probe(
      'buildDashboardHighLevelStats (warm)',
      'expect ~ms + 0 rebuilds',
      () => playerStats.buildDashboardHighLevelStats(userId),
    ),
  );

  results.push(
    await probe(
      `buildCareerStats ${tournamentMeta.ballType} (warm)`,
      'shared with dashboard key — expect 0 rebuilds',
      () => playerStats.buildCareerStats(userId, tournamentMeta.ballType as BallType),
    ),
  );

  // --- Invalidation correctness (no data mutation: call the helpers directly) ---
  const checks: Array<{ check: string; pass: boolean; detail: string }> = [];

  const sampleMatch = await prisma.match.findFirstOrThrow({
    where: {
      tournamentId,
      isDeleted: false,
      state: { in: [MatchState.Completed, MatchState.ScorecardLocked] },
      squads: { some: { players: { some: { userId } } } },
    },
    select: { id: true },
  });
  const squadUserIds = [
    ...new Set(
      (
        await prisma.matchSquadPlayer.findMany({
          where: { squad: { matchId: sampleMatch.id } },
          select: { userId: true },
        })
      ).map((row) => row.userId),
    ),
  ];
  const otherPlayer = squadUserIds.find((id) => id !== userId) ?? null;
  const outsider = (
    await prisma.matchSquadPlayer.findFirst({
      where: {
        role: MatchSquadRole.PlayingXi,
        userId: { notIn: squadUserIds },
        squad: { match: { isDeleted: false, state: { in: [MatchState.Completed, MatchState.ScorecardLocked] } } },
      },
      select: { userId: true },
    })
  )?.userId ?? null;

  async function rebuildsFor(run: () => Promise<unknown>): Promise<number> {
    rebuilds = 0;
    await run();
    return rebuilds;
  }

  if (otherPlayer) {
    await playerStats.buildDashboardHighLevelStats(otherPlayer);
  }
  if (outsider) {
    await playerStats.buildDashboardHighLevelStats(outsider);
  }
  await leaderboard.getLeaderboard(tournamentId, null, null);

  await statsInvalidation.invalidateMatchAggregates(sampleMatch.id, tournamentId);

  const selfRebuilds = await rebuildsFor(() => playerStats.buildDashboardHighLevelStats(userId));
  checks.push({
    check: 'match invalidation busts participant dashboard',
    pass: selfRebuilds > 0,
    detail: `match=${sampleMatch.id} squad=${squadUserIds.length} rebuilds=${selfRebuilds}`,
  });
  if (otherPlayer) {
    const otherRebuilds = await rebuildsFor(() =>
      playerStats.buildDashboardHighLevelStats(otherPlayer),
    );
    checks.push({
      check: 'match invalidation busts other squad player dashboard',
      pass: otherRebuilds > 0,
      detail: `userId=${otherPlayer} rebuilds=${otherRebuilds}`,
    });
  }
  if (outsider) {
    const outsiderRebuilds = await rebuildsFor(() =>
      playerStats.buildDashboardHighLevelStats(outsider),
    );
    checks.push({
      check: 'non-participant dashboard stays warm',
      pass: outsiderRebuilds === 0,
      detail: `userId=${outsider} rebuilds=${outsiderRebuilds}`,
    });
  }
  const lbRebuilds = await rebuildsFor(() => leaderboard.getLeaderboard(tournamentId, null, null));
  checks.push({
    check: 'match invalidation busts tournament leaderboard',
    pass: lbRebuilds > 0,
    detail: `rebuilds=${lbRebuilds}`,
  });

  const freshLeather = await playerStats.buildCareerStats(userId, BallType.Leather);
  const freshTennis = await playerStats.buildCareerStats(userId, BallType.Tennis);
  await careerCache.invalidatePlayers([userId]);
  const recomputedLeather = await playerStats.buildCareerStats(userId, BallType.Leather);
  const recomputedTennis = await playerStats.buildCareerStats(userId, BallType.Tennis);
  checks.push({
    check: 'cached leather + tennis careers equal a fresh recompute',
    pass:
      JSON.stringify(freshLeather) === JSON.stringify(recomputedLeather) &&
      JSON.stringify(freshTennis) === JSON.stringify(recomputedTennis),
    detail: `leather matches=${recomputedLeather.career.matches} tennis matches=${recomputedTennis.career.matches}`,
  });

  await statsInvalidation.invalidateTournamentAndPlayerCareers(tournamentId);
  const tournamentWideRebuilds = await rebuildsFor(() =>
    playerStats.buildCareerStats(userId, tournamentMeta.ballType as BallType),
  );
  checks.push({
    check: 'tournament rename/delete helper busts player careers',
    pass: tournamentWideRebuilds > 0,
    detail: `rebuilds=${tournamentWideRebuilds}`,
  });

  // Redis outage: every Redis call throws; endpoints must still answer.
  const redisProto = redis as unknown as Record<string, unknown>;
  const originals = new Map<string, unknown>();
  for (const method of ['get', 'setWithTtl', 'incr', 'incrMany']) {
    originals.set(method, redisProto[method]);
    redisProto[method] = async () => {
      throw new Error('simulated redis outage');
    };
  }
  let outageOk = true;
  let outageDetail = '';
  try {
    const board = await leaderboard.getLeaderboard(tournamentId, null, null);
    const dash = await playerStats.buildDashboardHighLevelStats(userId);
    await statsInvalidation.invalidateMatchAggregates(sampleMatch.id, tournamentId);
    outageDetail = `leaderboard batting=${board.batting.entries.length} dashboard leatherMatches=${dash.leather.matches}`;
  } catch (err) {
    outageOk = false;
    outageDetail = String(err);
  } finally {
    for (const [method, fn] of originals) {
      redisProto[method] = fn;
    }
  }
  checks.push({ check: 'redis down → computes uncached, no throw', pass: outageOk, detail: outageDetail });

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        tournament: {
          id: tournamentMeta.id,
          name: tournamentMeta.name,
          ballType: tournamentMeta.ballType,
          scoredMatchCount,
          standingsMatchCount,
          statsMatchCount,
        },
        dashboardUser: { id: userId, xiAppearances: userXiCount },
        results,
        checks,
      },
      null,
      2,
    ),
  );

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
