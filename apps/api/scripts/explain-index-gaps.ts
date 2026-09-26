/**
 * TEMPORARY — EXPLAIN probe for the index audit. Applies the pending index
 * migration inside a transaction, EXPLAINs with seq scans disabled (tables are
 * too small for the planner to pick an index otherwise), then ROLLS BACK.
 *
 * Usage (from apps/api):
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/explain-index-gaps.ts
 */
import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class Rollback extends Error {}

async function explain(tx: Prisma.TransactionClient, label: string, sql: string): Promise<void> {
  const rows = await tx.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(`EXPLAIN ${sql}`);
  console.log(`\n### ${label}\n${rows.map((row) => row['QUERY PLAN']).join('\n')}`);
}

async function main(): Promise<void> {
  const migrationSql = readFileSync(
    join(__dirname, '../prisma/migrations/20260926010000_match_user_query_indexes/migration.sql'),
    'utf8',
  );
  const statements = migrationSql
    .split(';')
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter((s) => s.length > 0);

  const tournament = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "tournamentId" AS id FROM "Match" GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1`,
  );
  const tid = tournament[0]?.id ?? '00000000-0000-0000-0000-000000000000';

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const statement of statements) await tx.$executeRawUnsafe(statement);
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');

        const indexes = await tx.$queryRawUnsafe<Array<{ tablename: string; indexdef: string }>>(`
          SELECT tablename, indexdef FROM pg_indexes
          WHERE tablename IN ('Match', 'User') ORDER BY tablename, indexname
        `);
        console.log('### indexes after migration (in-transaction)');
        for (const row of indexes) console.log(`${row.tablename}: ${row.indexdef}`);

        await explain(
          tx,
          'leaderboard/standings match list (tournamentId + isDeleted + state IN)',
          `SELECT * FROM "Match" WHERE "tournamentId" = '${tid}' AND "isDeleted" = false
             AND state IN ('COMPLETED','SCORECARD_LOCKED','NO_RESULT','CANCELLED')
             ORDER BY "matchDate" ASC, "createdAt" ASC`,
        );
        await explain(
          tx,
          'tournament match list by tournamentId only (was Match_tournamentId_idx)',
          `SELECT id FROM "Match" WHERE "tournamentId" = '${tid}'`,
        );
        await explain(
          tx,
          'admin matches-today count (matchDate range + tournament join)',
          `SELECT COUNT(*) FROM "Match" m JOIN "Tournament" t ON t.id = m."tournamentId"
             WHERE m."matchDate" >= date_trunc('day', now()) AND m."matchDate" < date_trunc('day', now()) + interval '1 day'
             AND t."isDeleted" = false`,
        );
        await explain(
          tx,
          'dashboard featured (state IN + matchDate >= cutoff)',
          `SELECT id FROM "Match" WHERE "isDeleted" = false AND state IN ('COMPLETED','SCORECARD_LOCKED')
             AND "matchDate" >= now() - interval '7 days' ORDER BY "matchDate" DESC LIMIT 5`,
        );
        await explain(
          tx,
          'admin directory active-user count',
          `SELECT COUNT(*) FROM "User" WHERE "deletedAt" IS NULL AND "isActive" = true`,
        );
        await explain(
          tx,
          'admin users-by-geography groupBy (deletedAt only — prefix of composite)',
          `SELECT "centerId", COUNT(*) FROM "User" WHERE "deletedAt" IS NULL GROUP BY "centerId"`,
        );
        throw new Rollback();
      },
      { timeout: 30_000 },
    );
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
    console.log('\n(rolled back — no schema change persisted)');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
