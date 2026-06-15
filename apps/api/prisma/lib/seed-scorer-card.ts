import { formatUtcIsoDate } from '@acc/types';
import type { PrismaClient } from '@prisma/client';

const SCORER_TEST_MATCH_CODE = 'SCORER-TODAY';
const SCORER_FUTURE_MATCH_CODE = 'SCORER-FUTURE';
export const SCORER_PLAYER_MOBILE = '+15555550007';

function utcTodayAt(hour: number, minute: number): Date {
  const day = formatUtcIsoDate(new Date());
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${day}T${hh}:${mm}:00.000Z`);
}

function utcDaysFromToday(offsetDays: number, hour: number, minute: number): Date {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + offsetDays);
  const day = formatUtcIsoDate(base);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${day}T${hh}:${mm}:00.000Z`);
}

async function upsertActiveScorerGrant(
  prisma: PrismaClient,
  matchId: string,
  userId: string,
  grantedByUserId: string,
): Promise<void> {
  const existing = await prisma.matchScorerGrant.findFirst({
    where: { matchId, userId, revokedAt: null },
  });
  if (existing) {
    return;
  }
  await prisma.matchScorerGrant.create({
    data: { matchId, userId, grantedByUserId },
  });
}

async function seedLockedSquads(
  prisma: PrismaClient,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  homePlayerIds: string[],
  awayPlayerIds: string[],
  lockedByUserId: string,
): Promise<void> {
  const homeSquad = await prisma.matchSquad.upsert({
    where: { matchId_teamId: { matchId, teamId: homeTeamId } },
    update: { lockedByUserId },
    create: { matchId, teamId: homeTeamId, lockedByUserId },
  });
  const awaySquad = await prisma.matchSquad.upsert({
    where: { matchId_teamId: { matchId, teamId: awayTeamId } },
    update: { lockedByUserId },
    create: { matchId, teamId: awayTeamId, lockedByUserId },
  });

  for (const userId of homePlayerIds) {
    await prisma.matchSquadPlayer.upsert({
      where: { squadId_userId: { squadId: homeSquad.id, userId } },
      update: { role: 'PLAYING_XI' },
      create: { squadId: homeSquad.id, userId, role: 'PLAYING_XI' },
    });
  }
  for (const userId of awayPlayerIds) {
    await prisma.matchSquadPlayer.upsert({
      where: { squadId_userId: { squadId: awaySquad.id, userId } },
      update: { role: 'PLAYING_XI' },
      create: { squadId: awaySquad.id, userId, role: 'PLAYING_XI' },
    });
  }
}

async function upsertMatchByCode(
  prisma: PrismaClient,
  matchCode: string,
  data: {
    tournamentId: string;
    homeTeamId: string;
    awayTeamId: string;
    matchDate: Date;
    startTime: Date;
    state: 'PLAYING_XI_LOCKED';
    oversPerInnings: number;
    maxOversPerBowler: number;
  },
): Promise<{ id: string }> {
  const existing = await prisma.match.findFirst({ where: { matchCode } });
  if (existing) {
    return prisma.match.update({ where: { id: existing.id }, data });
  }
  return prisma.match.create({ data: { matchCode, ...data } });
}

export type SeedScorerCardResult = {
  todayMatchId: string;
  futureMatchId: string;
  scorerUserId: string;
};

/**
 * Seeds a today-dated match + active scorer grant for manual Start Match card testing
 * (§11.1). Also seeds a future-dated grant on the same player to verify the dashboard
 * hides non-match-day fixtures.
 */
export async function seedScorerStartMatchCard(prisma: PrismaClient): Promise<SeedScorerCardResult | null> {
  const scorer = await prisma.user.findFirst({ where: { mobileNumber: SCORER_PLAYER_MOBILE } });
  const captain = await prisma.user.findFirst({ where: { mobileNumber: '+15555550004' } });
  const squadMate = await prisma.user.findFirst({ where: { mobileNumber: '+15555550003' } });
  const aplTournament = await prisma.tournament.findFirst({
    where: { type: 'APL', name: 'Atmiya Premier League' },
    orderBy: { year: 'desc' },
  });
  const homeTeam = aplTournament
    ? await prisma.team.findFirst({
        where: { tournamentId: aplTournament.id, name: 'Barrie Cobras' },
      })
    : null;
  const awayTeam = aplTournament
    ? await prisma.team.findFirst({
        where: { tournamentId: aplTournament.id, name: 'Scarborough Strikeforce' },
      })
    : null;

  if (!scorer || !captain || !squadMate || !aplTournament || !homeTeam || !awayTeam) {
    console.warn(
      'seedScorerStartMatchCard skipped: run the full seed first (APL tournament + test users).',
    );
    return null;
  }

  const todayStart = utcTodayAt(10, 30);
  const todayMatch = await upsertMatchByCode(prisma, SCORER_TEST_MATCH_CODE, {
    tournamentId: aplTournament.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    matchDate: todayStart,
    startTime: todayStart,
    state: 'PLAYING_XI_LOCKED',
    oversPerInnings: 20,
    maxOversPerBowler: 4,
  });

  await seedLockedSquads(
    prisma,
    todayMatch.id,
    homeTeam.id,
    awayTeam.id,
    [captain.id, squadMate.id],
    [scorer.id, squadMate.id],
    captain.id,
  );
  await upsertActiveScorerGrant(prisma, todayMatch.id, scorer.id, captain.id);

  const futureStart = utcDaysFromToday(7, 14, 0);
  const futureMatch = await upsertMatchByCode(prisma, SCORER_FUTURE_MATCH_CODE, {
    tournamentId: aplTournament.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    matchDate: futureStart,
    startTime: futureStart,
    state: 'PLAYING_XI_LOCKED',
    oversPerInnings: 20,
    maxOversPerBowler: 4,
  });
  await upsertActiveScorerGrant(prisma, futureMatch.id, scorer.id, captain.id);

  return {
    todayMatchId: todayMatch.id,
    futureMatchId: futureMatch.id,
    scorerUserId: scorer.id,
  };
}

export function logScorerCardSeedInstructions(result: SeedScorerCardResult): void {
  console.log(
    `Scorer Start Match card seed: today match ${result.todayMatchId} (code ${SCORER_TEST_MATCH_CODE}), ` +
      `future control match ${result.futureMatchId} (code ${SCORER_FUTURE_MATCH_CODE}). ` +
      `Log in as Dev Player (${SCORER_PLAYER_MOBILE.slice(-4)}) on the Player home tab — ` +
      `card shows TODAY only; future grant shows nothing until match day.`,
  );
}
