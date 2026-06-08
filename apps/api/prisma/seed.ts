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
    update: { role: args.role },
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

  await upsertUser({
    mobileNumber: '+15555550002',
    firstName: 'Club',
    lastName: 'Manager',
    email: 'manager@acc.local',
    role: 'CLUB_MANAGER',
    centerId: primaryCenterId,
    passwordHash,
  });

  const clubManager = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550002' },
  });

  await seedAccTournament(clubManager.id);

  const [provinces, centers, users, teams] = await Promise.all([
    prisma.province.count(),
    prisma.center.count(),
    prisma.user.count(),
    prisma.team.count(),
  ]);
  console.log(
    `Seed complete. Provinces: ${provinces}, Centers: ${centers}, Users: ${users}, Teams: ${teams}. ` +
      `Admin/Manager login password: "${SEED_PASSWORD}".`,
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
