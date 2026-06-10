import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
  role: 'ADMIN' | 'CLUB_MANAGER';
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
        location: 'Toronto',
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

  for (const teamName of ACC_TEAMS) {
    const existing = await prisma.team.findFirst({
      where: { tournamentId: tournament.id, name: teamName },
    });
    if (!existing) {
      await prisma.team.create({
        data: { tournamentId: tournament.id, name: teamName },
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
        location: 'Surat District Arena',
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

  const teamNames = ['Barrie Cobras', 'Scarborough Strikeforce'];
  const teams: { id: string; name: string }[] = [];
  for (const teamName of teamNames) {
    let team = await prisma.team.findFirst({
      where: { tournamentId: tournament.id, name: teamName },
    });
    if (!team) {
      team = await prisma.team.create({
        data: { tournamentId: tournament.id, name: teamName },
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

  // Club Manager only (no tournament registration — dashboard hides Your Performance).
  await upsertUser({
    mobileNumber: '+15555550002',
    firstName: 'Rahul',
    lastName: 'Manager',
    email: 'manager@acc.local',
    role: 'CLUB_MANAGER',
    centerId: primaryCenterId,
    passwordHash,
  });

  // Club Manager who is also a registered player (Your Performance shows 0/0/00).
  await upsertUser({
    mobileNumber: '+15555550003',
    firstName: 'Priya',
    lastName: 'Manager',
    email: 'manager-player@acc.local',
    role: 'CLUB_MANAGER',
    centerId: primaryCenterId,
    passwordHash,
  });

  const clubManager = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550002' },
  });
  const clubManagerPlayer = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550003' },
  });

  await seedAccTournament(clubManager.id);
  const aplTournamentId = await seedAplTournament(clubManager.id, primaryCenterId);
  await seedPlayerRegistration(clubManagerPlayer.id, aplTournamentId, primaryCenterId);

  const [provinces, centers, users, teams] = await Promise.all([
    prisma.province.count(),
    prisma.center.count(),
    prisma.user.count(),
    prisma.team.count(),
  ]);
  console.log(
    `Seed complete. Provinces: ${provinces}, Centers: ${centers}, Users: ${users}, Teams: ${teams}. ` +
      `Password: "${SEED_PASSWORD}". ` +
      `Club Manager (no player reg): 55555550002. ` +
      `Club Manager + player: 55555550003.`,
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
