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
    firstName: 'Rahul',
    lastName: 'Manager',
    email: 'manager@acc.local',
    role: 'CLUB_MANAGER',
    centerId: primaryCenterId,
    passwordHash,
  });

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

  await upsertUser({
    mobileNumber: '+15555550005',
    firstName: 'Arjun',
    lastName: 'Sevak',
    email: 'sevak-player@acc.local',
    role: 'CENTER_SEVAK',
    centerId: primaryCenterId,
    passwordHash,
  });

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

  const sevakPlayer = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550005' },
  });
  const sevakOnly = await prisma.user.findFirstOrThrow({
    where: { mobileNumber: '+15555550006' },
  });

  await seedCenterSevakAssignment(sevakPlayer.id, primaryCenterId);
  await seedCenterSevakAssignment(sevakOnly.id, primaryCenterId);

  const [provinces, centers, users] = await Promise.all([
    prisma.province.count(),
    prisma.center.count(),
    prisma.user.count(),
  ]);
  console.log(
    `Seed complete. Provinces: ${provinces}, Centers: ${centers}, Users: ${users}. ` +
      `Password: "${SEED_PASSWORD}". ` +
      `Admin: 55555550001. Club Manager: 55555550002 / 55555550003. ` +
      `Captain: 55555550004. Center Sevak: 55555550005 / 55555550006. Player: 55555550007.`,
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
