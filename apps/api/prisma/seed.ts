import { PrismaClient } from '@prisma/client';
import { expandUtcDateRange, normalizeTeamName } from '@acc/types';
import * as bcrypt from 'bcrypt';

import { logScorerCardSeedInstructions, seedScorerStartMatchCard } from './lib/seed-scorer-card';
import { seedAccTeams } from './lib/seed-acc-teams';

const prisma = new PrismaClient();

/** Matches the auth service's bcrypt cost factor. */
const BCRYPT_SALT_ROUNDS = 12;
/** Spec §3.1: 6-char alphanumeric password. Dev-only seed credentials. */
const SEED_PASSWORD = 'acc123';

const PROVINCES: { name: string; centers: string[] }[] = [
  {
    name: 'Ontario',
    centers: [
      'North York',
      'Etobicoke',
      'Brampton',
      'Scarborough',
      'Mississauga',
      'Markham',
      'Richmond Hill',
      'Vaughan',
      'Oakville',
      'Hamilton',
      'London',
      'Kitchener',
      'Windsor',
    ],
  },
  {
    name: 'Gujarat',
    centers: ['Ahmedabad', 'Surat'],
  },
];

/** The four fixed ACC teams (spec §9.1). */
const ACC_TEAMS = ['ACC 3', 'ACC 6', 'ACC 9', 'ACC 0'];

async function seedProvincesAndCenters(): Promise<string> {
  let primaryCenterId = '';
  for (const provinceSeed of PROVINCES) {
    const province = await prisma.province.upsert({
      where: { name: provinceSeed.name },
      update: { isActive: true },
      create: { name: provinceSeed.name },
    });
    for (const centerName of provinceSeed.centers) {
      const center = await prisma.center.upsert({
        where: {
          provinceId_name: { provinceId: province.id, name: centerName },
        },
        update: { isActive: true },
        create: { name: centerName, provinceId: province.id },
      });
      if (provinceSeed.name === 'Ontario' && centerName === provinceSeed.centers[0]) {
        primaryCenterId = center.id;
      }
    }
  }
  if (!primaryCenterId) {
    throw new Error('Seed failed: Ontario primary center not created');
  }
  return primaryCenterId;
}

async function upsertUser(args: {
  mobileNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'CLUB_MANAGER' | 'CENTER_SEVAK' | 'PLAYER';
  centerId: string;
  passwordHash: string;
}): Promise<void> {
  await prisma.user.upsert({
    where: { mobileNumber: args.mobileNumber },
    update: { role: args.role, firstName: args.firstName, lastName: args.lastName },
    create: {
      firstName: args.firstName,
      lastName: args.lastName,
      mobileNumber: args.mobileNumber,
      email: args.email,
      // 18+ (spec §3.1).
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      centerId: args.centerId,
      jerseyNumber: 0,
      emergencyContactName: 'Seed Contact',
      emergencyContactNumber: '+15555550000',
      passwordHash: args.passwordHash,
      role: args.role,
    },
  });
}

async function seedTournamentDates(
  tournamentId: string,
  startAt: Date,
  endAt: Date,
): Promise<void> {
  const existing = await prisma.tournamentDate.count({ where: { tournamentId } });
  if (existing > 0) {
    return;
  }
  const dates = expandUtcDateRange(startAt, endAt);
  await prisma.tournamentDate.createMany({
    data: dates.map((date) => ({
      tournamentId,
      date: new Date(`${date}T00:00:00.000Z`),
    })),
  });
}

async function seedAccTournament(createdByUserId: string): Promise<void> {
  const year = new Date().getUTCFullYear();
  const name = `ACC ${year}`;

  let tournament = await prisma.tournament.findFirst({ where: { name, year } });
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name,
        year,
        // ACC: 25 overs, max 5 overs/bowler (spec §9.4).
        oversPerInnings: 25,
        maxOversPerBowler: 5,
        locationAddress: 'Toronto',
        latitude: 43.6532,
        longitude: -79.3832,
        timezone: 'America/Toronto',
        startAt: new Date(`${year}-05-01T00:00:00.000Z`),
        endAt: new Date(`${year}-09-30T00:00:00.000Z`),
        ballType: 'LEATHER',
        type: 'ACC',
        state: 'TEAMS_FINALIZED',
        format: 'LEAGUE_SINGLE_ROUND_ROBIN',
        createdByUserId,
      },
    });
  }

  await seedTournamentDates(
    tournament.id,
    new Date(`${year}-05-01T00:00:00.000Z`),
    new Date(`${year}-09-30T00:00:00.000Z`),
  );

  for (const teamName of ACC_TEAMS) {
    const nameNormalized = normalizeTeamName(teamName);
    const existing = await prisma.team.findFirst({
      where: { tournamentId: tournament.id, nameNormalized },
    });
    if (!existing) {
      await prisma.team.create({
        data: { tournamentId: tournament.id, name: teamName, nameNormalized },
      });
    }
  }
}

async function seedPlayerRegistration(
  userId: string,
  tournamentId: string,
  centerId: string,
): Promise<void> {
  await prisma.registration.upsert({
    where: {
      tournamentId_userId: { tournamentId, userId },
    },
    update: {},
    create: {
      tournamentId,
      userId,
      centerId,
      status: 'CONFIRMED',
    },
  });
}

async function seedAplTournament(
  createdByUserId: string,
  primaryCenterId: string,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const name = 'Atmiya Premier League';

  let tournament = await prisma.tournament.findFirst({
    where: { name, year, type: 'APL' },
  });
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name,
        year,
        oversPerInnings: 20,
        maxOversPerBowler: 4,
        locationAddress: 'Surat District Arena',
        startAt: new Date(`${year}-06-15T00:00:00.000Z`),
        endAt: new Date(`${year}-06-20T00:00:00.000Z`),
        ballType: 'TENNIS',
        type: 'APL',
        state: 'LIVE',
        format: 'LEAGUE_SINGLE_ROUND_ROBIN',
        createdByUserId,
      },
    });

    await prisma.tournamentCenter.upsert({
      where: {
        tournamentId_centerId: { tournamentId: tournament.id, centerId: primaryCenterId },
      },
      update: {},
      create: { tournamentId: tournament.id, centerId: primaryCenterId },
    });
  }

  await seedTournamentDates(
    tournament.id,
    new Date(`${year}-06-15T00:00:00.000Z`),
    new Date(`${year}-06-20T00:00:00.000Z`),
  );

  const teamNames = ['Barrie Cobras', 'Scarborough Strikeforce'];
  const teams: { id: string; name: string }[] = [];
  for (const teamName of teamNames) {
    const nameNormalized = normalizeTeamName(teamName);
    let team = await prisma.team.findFirst({
      where: { tournamentId: tournament.id, nameNormalized },
    });
    if (!team) {
      team = await prisma.team.create({
        data: { tournamentId: tournament.id, name: teamName, nameNormalized },
      });
    }
    teams.push({ id: team.id, name: team.name });
  }

  const existingMatch = await prisma.match.findFirst({
    where: { tournamentId: tournament.id },
  });
  if (!existingMatch && teams.length >= 2) {
    await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: teams[0]!.id,
        awayTeamId: teams[1]!.id,
        matchDate: new Date(`${year}-06-08T14:00:00.000Z`),
        state: 'SCHEDULED',
      },
    });
  }

  return tournament.id;
}

/** Gives the primary Club Manager APL player stats for the dashboard performance card. */
async function seedManagerPerformance(
  managerUserId: string,
  opponentUserId: string,
  tournamentId: string,
): Promise<void> {
  const match = await prisma.match.findFirst({
    where: { tournamentId },
    include: {
      homeTeam: { select: { id: true } },
      awayTeam: { select: { id: true } },
    },
  });
  if (!match?.homeTeamId || !match.awayTeamId) {
    return;
  }

  await prisma.match.update({
    where: { id: match.id },
    data: {
      state: 'COMPLETED',
      scorecardVersion: 3,
      winningTeamId: match.homeTeamId,
      resultNote: 'Barrie Cobras won by 40 runs',
    },
  });

  const homeSquad = await prisma.matchSquad.upsert({
    where: { matchId_teamId: { matchId: match.id, teamId: match.homeTeamId } },
    update: { lockedByUserId: managerUserId },
    create: {
      matchId: match.id,
      teamId: match.homeTeamId,
      lockedByUserId: managerUserId,
    },
  });
  const awaySquad = await prisma.matchSquad.upsert({
    where: { matchId_teamId: { matchId: match.id, teamId: match.awayTeamId } },
    update: { lockedByUserId: managerUserId },
    create: {
      matchId: match.id,
      teamId: match.awayTeamId,
      lockedByUserId: managerUserId,
    },
  });

  const squadPlayers: {
    squadId: string;
    userId: string;
    role: 'PLAYING_XI';
  }[] = [
    { squadId: homeSquad.id, userId: managerUserId, role: 'PLAYING_XI' },
    { squadId: homeSquad.id, userId: opponentUserId, role: 'PLAYING_XI' },
    { squadId: awaySquad.id, userId: opponentUserId, role: 'PLAYING_XI' },
  ];
  for (const row of squadPlayers) {
    await prisma.matchSquadPlayer.upsert({
      where: { squadId_userId: { squadId: row.squadId, userId: row.userId } },
      update: { role: row.role },
      create: row,
    });
  }

  const existingInnings = await prisma.innings.findFirst({ where: { matchId: match.id } });
  if (existingInnings) {
    return;
  }

  const innings = await prisma.innings.create({
    data: {
      matchId: match.id,
      sequence: 1,
      inningsType: 'NORMAL',
      battingTeamId: match.homeTeamId,
      bowlingTeamId: match.awayTeamId,
      oversAllotted: 20,
    },
  });

  const deliveries: {
    sequence: number;
    overNumber: number;
    ballNumber: number;
    type: 'LEGAL';
    strikerUserId: string;
    nonStrikerUserId: string;
    bowlerUserId: string;
    runsBat: number;
    isBoundary: boolean;
    dismissalType?: 'BOWLED' | 'CAUGHT';
    dismissedUserId?: string;
  }[] = [
    {
      sequence: 1,
      overNumber: 1,
      ballNumber: 1,
      type: 'LEGAL',
      strikerUserId: managerUserId,
      nonStrikerUserId: opponentUserId,
      bowlerUserId: opponentUserId,
      runsBat: 47,
      isBoundary: false,
    },
    {
      sequence: 2,
      overNumber: 1,
      ballNumber: 2,
      type: 'LEGAL',
      strikerUserId: opponentUserId,
      nonStrikerUserId: managerUserId,
      bowlerUserId: managerUserId,
      runsBat: 0,
      isBoundary: false,
      dismissalType: 'BOWLED',
      dismissedUserId: opponentUserId,
    },
    {
      sequence: 3,
      overNumber: 1,
      ballNumber: 3,
      type: 'LEGAL',
      strikerUserId: managerUserId,
      nonStrikerUserId: opponentUserId,
      bowlerUserId: managerUserId,
      runsBat: 0,
      isBoundary: false,
      dismissalType: 'CAUGHT',
      dismissedUserId: opponentUserId,
    },
  ];

  for (const ball of deliveries) {
    await prisma.delivery.create({
      data: {
        inningsId: innings.id,
        type: ball.type,
        sequence: ball.sequence,
        overNumber: ball.overNumber,
        ballNumber: ball.ballNumber,
        strikerUserId: ball.strikerUserId,
        nonStrikerUserId: ball.nonStrikerUserId,
        bowlerUserId: ball.bowlerUserId,
        runsBat: ball.runsBat,
        isBoundary: ball.isBoundary,
        dismissalType: ball.dismissalType ?? null,
        dismissedUserId: ball.dismissedUserId ?? null,
        createdByUserId: managerUserId,
      },
    });
  }
}

async function seedCenterSevakAssignment(userId: string, centerId: string): Promise<void> {
  const existing = await prisma.roleAssignment.findFirst({
    where: { userId, role: 'CENTER_SEVAK', centerId },
  });
  if (!existing) {
    await prisma.roleAssignment.create({
      data: { userId, role: 'CENTER_SEVAK', centerId },
    });
  }
}

/** Center Sevak role assignment and optional APL player stats for the performance card. */
async function seedCenterSevakDashboard(
  sevakUserId: string,
  centerId: string,
  tournamentId: string,
  withPlayerStats: boolean,
  squadMateUserId: string,
): Promise<void> {
  await seedCenterSevakAssignment(sevakUserId, centerId);

  if (!withPlayerStats) {
    return;
  }

  await seedPlayerRegistration(sevakUserId, tournamentId, centerId);

  const match = await prisma.match.findFirst({
    where: { tournamentId, state: 'COMPLETED' },
    include: {
      homeTeam: { select: { id: true } },
      awayTeam: { select: { id: true } },
    },
  });
  if (!match?.homeTeamId || !match.awayTeamId) {
    return;
  }

  const homeSquad = await prisma.matchSquad.findUnique({
    where: { matchId_teamId: { matchId: match.id, teamId: match.homeTeamId } },
  });
  if (homeSquad) {
    await prisma.matchSquadPlayer.upsert({
      where: { squadId_userId: { squadId: homeSquad.id, userId: sevakUserId } },
      update: { role: 'PLAYING_XI' },
      create: { squadId: homeSquad.id, userId: sevakUserId, role: 'PLAYING_XI' },
    });
  }

  const awaySquad = await prisma.matchSquad.findUnique({
    where: { matchId_teamId: { matchId: match.id, teamId: match.awayTeamId } },
  });
  if (awaySquad && squadMateUserId !== sevakUserId) {
    await prisma.matchSquadPlayer.upsert({
      where: { squadId_userId: { squadId: awaySquad.id, userId: squadMateUserId } },
      update: { role: 'PLAYING_XI' },
      create: { squadId: awaySquad.id, userId: squadMateUserId, role: 'PLAYING_XI' },
    });
  }
}

/** Center-level tournament created by the sevak (deletable on dashboard). */
async function seedSevakOwnedCenterTournament(
  sevakUserId: string,
  centerId: string,
): Promise<void> {
  const year = new Date().getUTCFullYear();
  const name = 'North York Summer League';

  let tournament = await prisma.tournament.findFirst({
    where: { name, year, type: 'CENTER', createdByUserId: sevakUserId },
  });
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name,
        year,
        oversPerInnings: 20,
        maxOversPerBowler: 4,
        locationAddress: 'North York',
        startAt: new Date(`${year}-07-01T00:00:00.000Z`),
        endAt: new Date(`${year}-07-05T00:00:00.000Z`),
        ballType: 'TENNIS',
        type: 'CENTER',
        state: 'NEW',
        format: 'LEAGUE_SINGLE_ROUND_ROBIN',
        impactPlayerEnabled: false,
        videoRequired: false,
        createdByUserId: sevakUserId,
      },
    });
    await prisma.tournamentCenter.upsert({
      where: {
        tournamentId_centerId: { tournamentId: tournament.id, centerId },
      },
      update: {},
      create: { tournamentId: tournament.id, centerId },
    });
  }

  await seedTournamentDates(
    tournament.id,
    new Date(`${year}-07-01T00:00:00.000Z`),
    new Date(`${year}-07-05T00:00:00.000Z`),
  );
}

type SeedPlayerIds = {
  striker: string;
  nonStriker: string;
  bowler: string;
  createdBy: string;
};

type InningsTotals = {
  runs: number;
  wickets: number;
  legalBalls: number;
};

/** Seeds legal deliveries to reach target runs, wickets, and overs for dashboard scorecards. */
async function seedLegalBallSequence(
  inningsId: string,
  totals: InningsTotals,
  playerIds: SeedPlayerIds,
): Promise<void> {
  const { runs, wickets, legalBalls } = totals;
  const wicketIndices = new Set<number>();
  if (wickets > 0) {
    const step = Math.max(1, Math.floor(legalBalls / (wickets + 1)));
    for (let w = 1; w <= wickets; w++) {
      wicketIndices.add(Math.min(w * step, legalBalls));
    }
  }

  let runsLeft = runs;
  let sequence = 1;
  let overNumber = 1;
  let ballNumber = 1;

  for (let i = 1; i <= legalBalls; i++) {
    const isWicket = wicketIndices.has(i);
    const ballsAfter = legalBalls - i;
    let runsBat = 0;
    if (!isWicket) {
      runsBat = ballsAfter === 0 ? runsLeft : Math.min(runsLeft, Math.ceil(runsLeft / (ballsAfter + 1)));
      runsLeft -= runsBat;
    }

    await prisma.delivery.create({
      data: {
        inningsId,
        type: 'LEGAL',
        sequence,
        overNumber,
        ballNumber,
        strikerUserId: playerIds.striker,
        nonStrikerUserId: playerIds.nonStriker,
        bowlerUserId: playerIds.bowler,
        runsBat,
        isBoundary: runsBat === 4 || runsBat === 6,
        dismissalType: isWicket ? 'BOWLED' : null,
        dismissedUserId: isWicket ? playerIds.striker : null,
        createdByUserId: playerIds.createdBy,
      },
    });

    sequence += 1;
    ballNumber += 1;
    if (ballNumber > 6) {
      ballNumber = 1;
      overNumber += 1;
    }
  }
}

async function seedChaseLiveScorecard(
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeBatting: InningsTotals,
  awayChasing: InningsTotals,
  homeBatters: SeedPlayerIds,
  awayBatters: SeedPlayerIds,
): Promise<void> {
  const existing = await prisma.innings.findFirst({ where: { matchId } });
  if (existing) {
    return;
  }

  const firstInnings = await prisma.innings.create({
    data: {
      matchId,
      sequence: 1,
      inningsType: 'NORMAL',
      battingTeamId: homeTeamId,
      bowlingTeamId: awayTeamId,
      oversAllotted: 20,
    },
  });

  await seedLegalBallSequence(firstInnings.id, homeBatting, homeBatters);

  const secondInnings = await prisma.innings.create({
    data: {
      matchId,
      sequence: 2,
      inningsType: 'NORMAL',
      battingTeamId: awayTeamId,
      bowlingTeamId: homeTeamId,
      oversAllotted: 20,
    },
  });

  await seedLegalBallSequence(secondInnings.id, awayChasing, awayBatters);

  await prisma.match.update({
    where: { id: matchId },
    data: {
      scorecardVersion: 2,
      originalTarget: homeBatting.runs + 1,
      state: 'LIVE',
    },
  });
}

/** Plain player dashboard: Scarborough team, LIVE chase featured match, APL registration. */
async function seedPlayerDashboard(
  playerUserId: string,
  tournamentId: string,
  centerId: string,
  teamId: string,
  opponentUserId: string,
  captainUserId: string,
): Promise<void> {
  await seedPlayerRegistration(playerUserId, tournamentId, centerId);

  await prisma.teamMembership.upsert({
    where: { tournamentId_userId: { tournamentId, userId: playerUserId } },
    update: { teamId },
    create: { tournamentId, userId: playerUserId, teamId },
  });

  const homeTeam = await prisma.team.findFirst({ where: { tournamentId, name: 'Barrie Cobras' } });
  const awayTeam = await prisma.team.findFirst({
    where: { tournamentId, name: 'Scarborough Strikeforce' },
  });
  if (!homeTeam || !awayTeam) {
    return;
  }

  const liveMatch = await prisma.match.findFirst({
    where: { tournamentId, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id, state: 'LIVE' },
  });
  if (!liveMatch) {
    return;
  }

  await seedChaseLiveScorecard(
    liveMatch.id,
    homeTeam.id,
    awayTeam.id,
    { runs: 202, wickets: 5, legalBalls: 120 },
    { runs: 163, wickets: 8, legalBalls: 112 },
    {
      striker: captainUserId,
      nonStriker: opponentUserId,
      bowler: opponentUserId,
      createdBy: captainUserId,
    },
    {
      striker: playerUserId,
      nonStriker: opponentUserId,
      bowler: captainUserId,
      createdBy: captainUserId,
    },
  );

  const completedMatch = await prisma.match.findFirst({
    where: { tournamentId, state: 'COMPLETED', homeTeamId: homeTeam.id },
  });
  if (!completedMatch) {
    return;
  }

  const awaySquad = await prisma.matchSquad.findUnique({
    where: { matchId_teamId: { matchId: completedMatch.id, teamId: awayTeam.id } },
  });
  if (awaySquad) {
    await prisma.matchSquadPlayer.upsert({
      where: { squadId_userId: { squadId: awaySquad.id, userId: playerUserId } },
      update: { role: 'PLAYING_XI' },
      create: { squadId: awaySquad.id, userId: playerUserId, role: 'PLAYING_XI' },
    });
  }
}

async function seedCaptainDashboard(
  captainUserId: string,
  tournamentId: string,
  centerId: string,
  teamId: string,
  squadMateUserId: string,
): Promise<void> {
  await seedPlayerRegistration(captainUserId, tournamentId, centerId);

  await prisma.teamMembership.upsert({
    where: { tournamentId_userId: { tournamentId, userId: captainUserId } },
    update: { teamId },
    create: { tournamentId, userId: captainUserId, teamId },
  });

  const existingAssignment = await prisma.roleAssignment.findFirst({
    where: { userId: captainUserId, role: 'CAPTAIN', tournamentId, teamId },
  });
  if (!existingAssignment) {
    await prisma.roleAssignment.create({
      data: { userId: captainUserId, role: 'CAPTAIN', tournamentId, teamId },
    });
  }

  const homeTeam = await prisma.team.findFirst({ where: { id: teamId } });
  const awayTeam = await prisma.team.findFirst({
    where: { tournamentId, name: 'Scarborough Strikeforce' },
  });
  if (!homeTeam || !awayTeam) {
    return;
  }

  let liveMatch = await prisma.match.findFirst({
    where: { tournamentId, homeTeamId: homeTeam.id, state: 'LIVE' },
  });
  if (!liveMatch) {
    await prisma.match.create({
      data: {
        tournamentId,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        matchDate: new Date(`${new Date().getUTCFullYear()}-06-09T18:00:00.000Z`),
        state: 'LIVE',
        tossWinner: 'TEAM_A',
        tossDecision: 'BAT',
      },
    });
  } else {
    await prisma.match.update({
      where: { id: liveMatch.id },
      data: { tossWinner: 'TEAM_A', tossDecision: 'BAT', state: 'LIVE' },
    });
  }

  const completedMatch = await prisma.match.findFirst({
    where: { tournamentId, state: 'COMPLETED', homeTeamId: homeTeam.id },
  });
  if (!completedMatch) {
    return;
  }

  const homeSquad = await prisma.matchSquad.findUnique({
    where: { matchId_teamId: { matchId: completedMatch.id, teamId: homeTeam.id } },
  });
  if (homeSquad) {
    await prisma.matchSquadPlayer.upsert({
      where: { squadId_userId: { squadId: homeSquad.id, userId: captainUserId } },
      update: { role: 'PLAYING_XI' },
      create: { squadId: homeSquad.id, userId: captainUserId, role: 'PLAYING_XI' },
    });
  }

  const awaySquad = await prisma.matchSquad.findUnique({
    where: { matchId_teamId: { matchId: completedMatch.id, teamId: awayTeam.id } },
  });
  if (awaySquad && squadMateUserId !== captainUserId) {
    await prisma.matchSquadPlayer.upsert({
      where: { squadId_userId: { squadId: awaySquad.id, userId: squadMateUserId } },
      update: { role: 'PLAYING_XI' },
      create: { squadId: awaySquad.id, userId: squadMateUserId, role: 'PLAYING_XI' },
    });
  }
}

async function main(): Promise<void> {
  const primaryCenterId = await seedProvincesAndCenters();
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_SALT_ROUNDS);

  await upsertUser({
    mobileNumber: '+15555550001',
    firstName: 'Platform',
    lastName: 'Admin',
    email: 'admin@acc.local',
    role: 'ADMIN',
    centerId: primaryCenterId,
    passwordHash,
  });

  // Primary Club Manager — also registered as an APL player (Your Performance card).
  await upsertUser({
    mobileNumber: '+15555550002',
    firstName: 'Rahul',
    lastName: 'Manager',
    email: 'manager@acc.local',
    role: 'CLUB_MANAGER',
    centerId: primaryCenterId,
    passwordHash,
  });

  // Secondary Club Manager + player (zeros when no squad/scorecard data).
  await upsertUser({
    mobileNumber: '+15555550003',
    firstName: 'Priya',
    lastName: 'Manager',
    email: 'manager-player@acc.local',
    role: 'CLUB_MANAGER',
    centerId: primaryCenterId,
    passwordHash,
  });

  await upsertUser({
    mobileNumber: '+15555550004',
    firstName: 'Vikram',
    lastName: 'Captain',
    email: 'captain@acc.local',
    role: 'PLAYER',
    centerId: primaryCenterId,
    passwordHash,
  });

  // Center Sevak + registered player (Your Performance card).
  await upsertUser({
    mobileNumber: '+15555550005',
    firstName: 'Arjun',
    lastName: 'Sevak',
    email: 'sevak-player@acc.local',
    role: 'CENTER_SEVAK',
    centerId: primaryCenterId,
    passwordHash,
  });

  // Center Sevak — performance card always shown (zeros when no squad data).
  await upsertUser({
    mobileNumber: '+15555550006',
    firstName: 'Seema',
    lastName: 'Sevak',
    email: 'sevak@acc.local',
    role: 'CENTER_SEVAK',
    centerId: primaryCenterId,
    passwordHash,
  });

  await upsertUser({
    mobileNumber: '+15555550007',
    firstName: 'Dev',
    lastName: 'Player',
    email: 'player@acc.local',
    role: 'PLAYER',
    centerId: primaryCenterId,
    passwordHash,
  });

  const clubManager = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550002' },
  });
  const clubManagerPlayer = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550003' },
  });
  const captain = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550004' },
  });
  const sevakPlayer = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550005' },
  });
  const sevakOnly = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550006' },
  });
  const plainPlayer = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550007' },
  });

  await seedAccTournament(clubManager.id);
  await seedAccTeams(prisma, {
    createdByUserId: clubManager.id,
    centerId: primaryCenterId,
    passwordHash,
  });
  const aplTournamentId = await seedAplTournament(clubManager.id, primaryCenterId);
  await seedPlayerRegistration(clubManager.id, aplTournamentId, primaryCenterId);
  await seedPlayerRegistration(clubManagerPlayer.id, aplTournamentId, primaryCenterId);
  await seedManagerPerformance(clubManager.id, clubManagerPlayer.id, aplTournamentId);

  const barrieTeam = await prisma.team.findFirstOrThrow({
    where: { tournamentId: aplTournamentId, name: 'Barrie Cobras' },
  });
  await seedCaptainDashboard(
    captain.id,
    aplTournamentId,
    primaryCenterId,
    barrieTeam.id,
    clubManagerPlayer.id,
  );
  const scarboroughTeam = await prisma.team.findFirstOrThrow({
    where: { tournamentId: aplTournamentId, name: 'Scarborough Strikeforce' },
  });
  await seedPlayerDashboard(
    plainPlayer.id,
    aplTournamentId,
    primaryCenterId,
    scarboroughTeam.id,
    clubManagerPlayer.id,
    captain.id,
  );
  await seedCenterSevakDashboard(
    sevakPlayer.id,
    primaryCenterId,
    aplTournamentId,
    true,
    clubManagerPlayer.id,
  );
  await seedCenterSevakDashboard(
    sevakOnly.id,
    primaryCenterId,
    aplTournamentId,
    false,
    clubManagerPlayer.id,
  );
  await seedSevakOwnedCenterTournament(sevakPlayer.id, primaryCenterId);

  const scorerCardSeed = await seedScorerStartMatchCard(prisma);
  if (scorerCardSeed) {
    logScorerCardSeedInstructions(scorerCardSeed);
  }

  const [provinces, centers, users, teams] = await Promise.all([
    prisma.province.count(),
    prisma.center.count(),
    prisma.user.count(),
    prisma.team.count(),
  ]);
  console.log(
    `Seed complete. Provinces: ${provinces}, Centers: ${centers}, Users: ${users}, Teams: ${teams}. ` +
      `Password: "${SEED_PASSWORD}". ` +
      `Club Manager + player (with stats): 55555550002. ` +
      `Club Manager + player (zeros): 55555550003. ` +
      `Captain (live match + stats): 55555550004. ` +
      `Center Sevak + player stats: 55555550005. ` +
      `Center Sevak (zeros performance): 55555550006. ` +
      `Plain Player (LIVE chase dashboard): 55555550007. ` +
      `Scorer Start Match card (today only): 55555550007 after db:seed or db:seed-scorer-card.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
