/**
 * Phase 2 — Upsert APL 2026 tournament, teams, users, registrations from seed JSON.
 * Run: pnpm --filter @acc/api seed:apl2026
 *
 * Idempotent: re-runs use upserts on phone, (tournamentId+nameNormalized), (tournamentId+userId).
 * Uses one transaction for the full import (atomic; rolls back on any failure).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizeTeamName, TEMP_PASSWORD_TTL_HOURS } from '@acc/types';
import { PrismaClient, type PlayerRegistrationRole, type Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { BCRYPT_SALT_ROUNDS } from '../../src/auth/auth.constants';
import { generateSecureTemporaryPassword } from '../../src/auth/password.util';

import {
  resolvePlayerMobile,
  tryRepairLegacyMobile,
} from './apl-2026-phone.util';
import {
  type Apl2026SeedData,
  type Apl2026SeedPlayer,
} from './apl-2026.types';

const prisma = new PrismaClient();

const PROVINCE_NAME = 'Ontario';
const FALLBACK_CENTER_NAME = 'Unassigned';
const DEFAULT_ORGANIZER_MOBILE = '+15555550002';

function splitFullName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim();
  const space = trimmed.indexOf(' ');
  if (space === -1) {
    return { firstName: trimmed, lastName: '.' };
  }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim() || '.',
  };
}

async function loadSeedData(): Promise<Apl2026SeedData> {
  const jsonPath = path.resolve(__dirname, '..', 'seed-data', 'apl-2026.json');
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as Apl2026SeedData;
}

async function resolveOrganizerId(tx: Prisma.TransactionClient): Promise<string> {
  const mobile = process.env.APL_SEED_ORGANIZER_MOBILE ?? DEFAULT_ORGANIZER_MOBILE;
  const user = await tx.user.findUnique({
    where: { mobileNumber: mobile },
    select: { id: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    throw new Error(
      `Organizer user not found (${mobile}). Run "pnpm db:seed" first or set APL_SEED_ORGANIZER_MOBILE.`,
    );
  }
  return user.id;
}

async function upsertProvince(tx: Prisma.TransactionClient): Promise<string> {
  const province = await tx.province.upsert({
    where: { name: PROVINCE_NAME },
    update: { isActive: true },
    create: { name: PROVINCE_NAME },
  });
  return province.id;
}

async function upsertCenter(
  tx: Prisma.TransactionClient,
  provinceId: string,
  name: string,
): Promise<string> {
  const center = await tx.center.upsert({
    where: { provinceId_name: { provinceId, name } },
    update: { isActive: true },
    create: { name, provinceId },
  });
  return center.id;
}

async function upsertTournament(
  tx: Prisma.TransactionClient,
  data: Apl2026SeedData,
  provinceId: string,
  organizerId: string,
): Promise<string> {
  const existing = await tx.tournament.findFirst({
    where: {
      name: data.tournament.name,
      year: data.tournament.year,
      ballType: data.tournament.ballType,
      isDeleted: false,
    },
    select: { id: true },
  });

  const tournamentData = {
    name: data.tournament.name,
    year: data.tournament.year,
    ballType: data.tournament.ballType,
    type: 'APL' as const,
    state: 'NEW' as const,
    format: 'LEAGUE_SINGLE_ROUND_ROBIN' as const,
    maxOversPerBowler: 4,
    numberOfTeams: data.teams.length,
    playersPerTeam: null,
    substitutesAllowed: 2,
    startAt: new Date('2026-04-01T00:00:00.000Z'),
    endAt: new Date('2026-10-31T23:59:59.000Z'),
    registrationOpenAt: null,
    registrationCloseAt: null,
    auctionAt: null,
    impactPlayerEnabled: false,
    videoRequired: false,
    videoUploadEndDate: null,
    feeFullTime: null,
    feePartTime: null,
    defaultPlayerFeeCents: null,
    provinceId,
    createdByUserId: organizerId,
  };

  let tournamentId: string;
  if (existing) {
    const updated = await tx.tournament.update({
      where: { id: existing.id },
      data: {
        numberOfTeams: data.teams.length,
        provinceId,
      },
    });
    tournamentId = updated.id;
  } else {
    const created = await tx.tournament.create({ data: tournamentData });
    tournamentId = created.id;
  }

  await tx.tournamentDate.upsert({
    where: {
      tournamentId_date: {
        tournamentId,
        date: new Date('2026-06-01T00:00:00.000Z'),
      },
    },
    create: {
      tournamentId,
      date: new Date('2026-06-01T00:00:00.000Z'),
    },
    update: {},
  });

  return tournamentId;
}

async function repairLegacySeedMobileNumbers(
  tx: Prisma.TransactionClient,
  players: Apl2026SeedPlayer[],
): Promise<number> {
  const mobileByEmailPrefix = new Map<string, string>();
  for (const player of players) {
    mobileByEmailPrefix.set(player.sourceId.slice(0, 12), resolvePlayerMobile(player));
  }

  const seedUsers = await tx.user.findMany({
    where: { email: { startsWith: 'apl2026+' } },
    select: { id: true, mobileNumber: true, email: true },
  });

  let repaired = 0;
  for (const user of seedUsers) {
    const prefixMatch = user.email.match(/^apl2026\+([a-z0-9]{12})/i);
    const correctMobile =
      (prefixMatch ? mobileByEmailPrefix.get(prefixMatch[1]!) : null) ??
      tryRepairLegacyMobile(user.mobileNumber);

    if (!correctMobile || correctMobile === user.mobileNumber) {
      continue;
    }

    const conflict = await tx.user.findUnique({
      where: { mobileNumber: correctMobile },
      select: { id: true },
    });
    if (conflict && conflict.id !== user.id) {
      console.warn(
        `Skip mobile repair for ${user.email}: ${correctMobile} already assigned to another user`,
      );
      continue;
    }

    await tx.user.update({
      where: { id: user.id },
      data: { mobileNumber: correctMobile },
    });
    repaired += 1;
  }

  return repaired;
}

async function upsertUser(
  tx: Prisma.TransactionClient,
  player: Apl2026SeedPlayer,
  centerId: string,
  passwordHash: string,
  tempPasswordExpiresAt: Date,
): Promise<string> {
  const { firstName, lastName } = splitFullName(player.name);
  const mobileNumber = resolvePlayerMobile(player);

  const user = await tx.user.upsert({
    where: { mobileNumber },
    update: {
      firstName,
      lastName,
      centerId,
      isActive: true,
      deletedAt: null,
      passwordHash,
      mustChangePassword: true,
      tempPasswordExpiresAt,
    },
    create: {
      firstName,
      lastName,
      mobileNumber,
      email: `apl2026+${player.sourceId.slice(0, 12)}@acc.local`,
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      centerId,
      jerseyNumber: 0,
      emergencyContactName: 'APL 2026 Seed',
      emergencyContactNumber: '+15555550000',
      passwordHash,
      role: 'PLAYER',
      mustChangePassword: true,
      tempPasswordExpiresAt,
      tokenVersion: 0,
    },
    select: { id: true },
  });

  return user.id;
}

async function upsertTeam(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  teamName: string,
): Promise<string> {
  const nameNormalized = normalizeTeamName(teamName);
  const team = await tx.team.upsert({
    where: {
      tournamentId_nameNormalized: { tournamentId, nameNormalized },
    },
    update: { name: teamName, deletedAt: null },
    create: {
      tournamentId,
      name: teamName,
      nameNormalized,
    },
    select: { id: true },
  });
  return team.id;
}

async function upsertRegistrationAndMembership(
  tx: Prisma.TransactionClient,
  args: {
    tournamentId: string;
    teamId: string;
    userId: string;
    centerId: string;
    player: Apl2026SeedPlayer;
  },
): Promise<void> {
  const playerRole = args.player.role as PlayerRegistrationRole | null;

  await tx.registration.upsert({
    where: {
      tournamentId_userId: {
        tournamentId: args.tournamentId,
        userId: args.userId,
      },
    },
    update: {
      centerId: args.centerId,
      playerRole,
      battingRating: args.player.battingRating,
      bowlingRating: args.player.bowlingRating,
      fieldingRating: args.player.fieldingRating,
      status: 'CONFIRMED',
    },
    create: {
      tournamentId: args.tournamentId,
      userId: args.userId,
      centerId: args.centerId,
      playerRole,
      battingRating: args.player.battingRating,
      bowlingRating: args.player.bowlingRating,
      fieldingRating: args.player.fieldingRating,
      status: 'CONFIRMED',
    },
  });

  await tx.teamMembership.upsert({
    where: {
      tournamentId_userId: {
        tournamentId: args.tournamentId,
        userId: args.userId,
      },
    },
    update: { teamId: args.teamId },
    create: {
      tournamentId: args.tournamentId,
      teamId: args.teamId,
      userId: args.userId,
    },
  });
}

async function main(): Promise<void> {
  const data = await loadSeedData();
  const tempPassword = generateSecureTemporaryPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_SALT_ROUNDS);
  const tempPasswordExpiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000);

  const nullMandalPlayers: Apl2026SeedPlayer[] = [];
  const sentinelPhonePlayers: Apl2026SeedPlayer[] = [];

  const counts = await prisma.$transaction(async (tx) => {
    const provinceId = await upsertProvince(tx);
    const organizerId = await resolveOrganizerId(tx);

    const distinctCenters = [
      ...new Set(
        data.teams
          .flatMap((team) => team.players.map((player) => player.center))
          .filter((center): center is string => center != null),
      ),
    ].sort();

    const centerIdByName = new Map<string, string>();
    for (const centerName of distinctCenters) {
      centerIdByName.set(centerName, await upsertCenter(tx, provinceId, centerName));
    }

    const fallbackCenterId = await upsertCenter(tx, provinceId, FALLBACK_CENTER_NAME);
    centerIdByName.set(FALLBACK_CENTER_NAME, fallbackCenterId);

    const tournamentId = await upsertTournament(tx, data, provinceId, organizerId);

    const allPlayers = data.teams.flatMap((team) => team.players);
    const repairedMobiles = await repairLegacySeedMobileNumbers(tx, allPlayers);

    for (const centerId of centerIdByName.values()) {
      await tx.tournamentCenter.upsert({
        where: {
          tournamentId_centerId: { tournamentId, centerId },
        },
        create: { tournamentId, centerId },
        update: {},
      });
    }

    let userCount = 0;
    let registrationCount = 0;
    let membershipCount = 0;

    for (const teamSeed of data.teams) {
      const teamId = await upsertTeam(tx, tournamentId, teamSeed.name);

      for (const player of teamSeed.players) {
        if (player.phoneIsSentinel) {
          sentinelPhonePlayers.push(player);
        }
        if (player.center == null) {
          nullMandalPlayers.push(player);
        }

        const centerId =
          player.center != null
            ? centerIdByName.get(player.center)!
            : fallbackCenterId;

        const userId = await upsertUser(tx, player, centerId, passwordHash, tempPasswordExpiresAt);
        userCount += 1;

        await upsertRegistrationAndMembership(tx, {
          tournamentId,
          teamId,
          userId,
          centerId,
          player,
        });
        registrationCount += 1;
        membershipCount += 1;
      }
    }

    return {
      tournamentId,
      teamCount: data.teams.length,
      userCount,
      registrationCount,
      membershipCount,
      centerCount: centerIdByName.size,
      organizerId,
      repairedMobiles,
    };
  });

  const [dbTeams, dbUsers, dbRegistrations, dbMemberships] = await Promise.all([
    prisma.team.count({ where: { tournamentId: counts.tournamentId, deletedAt: null } }),
    prisma.user.count(),
    prisma.registration.count({ where: { tournamentId: counts.tournamentId } }),
    prisma.teamMembership.count({ where: { tournamentId: counts.tournamentId } }),
  ]);

  console.log('APL 2026 Phase 2 complete.');
  console.log(`  Tournament id: ${counts.tournamentId}`);
  console.log(`  Organizer id: ${counts.organizerId}`);
  console.log(`  Upserted teams: ${counts.teamCount} (db: ${dbTeams})`);
  console.log(`  Upserted users this run: ${counts.userCount} (db total users: ${dbUsers})`);
  console.log(`  Registrations: ${counts.registrationCount} (db: ${dbRegistrations})`);
  console.log(`  Team memberships: ${counts.membershipCount} (db: ${dbMemberships})`);
  console.log(`  Centers linked: ${counts.centerCount}`);
  if (counts.repairedMobiles > 0) {
    console.log(`  Repaired legacy mobile numbers: ${counts.repairedMobiles}`);
  }
  console.log(
    `  Seed temp password (refreshed each run): ${tempPassword} (expires ${tempPasswordExpiresAt.toISOString()})`,
  );

  if (sentinelPhonePlayers.length > 0) {
    console.log(`  Sentinel-phone players (${sentinelPhonePlayers.length}):`);
    for (const player of sentinelPhonePlayers) {
      console.log(`    ${player.name} → ${resolvePlayerMobile(player)}`);
    }
  }

  if (nullMandalPlayers.length > 0) {
    console.log(`  Null-mandal players assigned to "${FALLBACK_CENTER_NAME}" (${nullMandalPlayers.length}):`);
    for (const player of nullMandalPlayers) {
      console.log(`    ${player.name}`);
    }
  }
}

main()
  .catch((err) => {
    console.error('APL 2026 seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
