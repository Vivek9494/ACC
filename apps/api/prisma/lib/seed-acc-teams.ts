/**
 * Seeds the four fixed ACC teams from prisma/seed-data/acc-teams.seed-data.ts
 * into the BEDCL T25 Cricket Tournament.
 *
 * Schema mapping (see prisma/schema.prisma):
 * - Team: tournament-scoped row (name + nameNormalized unique per tournament).
 * - Player: User row (no separate Player model).
 * - Roster link: TeamMembership (one team per user per tournament).
 * - Captain / VC / Manager: RoleAssignment scoped to tournamentId + teamId.
 * - SUBSTITUTE: TeamMembership only (MatchSquadRole.SUBSTITUTE is per-match, not seeded here).
 * - squadNumber → User.jerseyNumber (required Int; see assignJerseyNumber).
 * - Registration: CONFIRMED row so players appear in tournament registration flows.
 */
import {
  PlayerCategory,
  Prisma,
  PrismaClient,
  RegistrationPlayerType,
  RegistrationStatus,
  UserRole,
} from '@prisma/client';
import { normalizeTeamName } from '@acc/types';
import * as bcrypt from 'bcrypt';

import {
  accTeamCounts,
  accTeams,
  type SeedPlayer,
  type SeedTeam,
  type SquadRole,
} from '../seed-data/acc-teams.seed-data';

const BEDCL_TOURNAMENT_NAME = 'BEDCL T25 Cricket Tournament';
const BEDCL_TIMEZONE = 'America/Toronto';
const BEDCL_OVERS = 25;
const BEDCL_MAX_OVERS_PER_BOWLER = 5;

/** Test defaults for required User / Registration fields not present in roster data. */
const SEED_DEFAULTS = {
  password: 'acc123',
  dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
  emergencyContactName: 'Seed Contact',
  emergencyContactNumber: '+15555550000',
  registrationStatus: RegistrationStatus.CONFIRMED,
  registrationPlayerType: RegistrationPlayerType.FULL_TIME,
  playerCategory: PlayerCategory.FULLTIME,
  platformRole: UserRole.PLAYER,
} as const;

const TEAM_MOBILE_PREFIX: Record<string, string> = {
  'ACC-3': '903',
  'ACC-6': '906',
  'ACC-9': '909',
  'ACC-0': '900',
};

function parseSeedPlayerName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { firstName: trimmed, lastName: 'Player' };
  }
  return {
    firstName: trimmed.slice(0, spaceIdx),
    lastName: trimmed.slice(spaceIdx + 1),
  };
}

function seedRoleToUserRole(role: SquadRole): UserRole | null {
  switch (role) {
    case 'CAPTAIN':
      return UserRole.CAPTAIN;
    case 'VICE_CAPTAIN':
      return UserRole.VICE_CAPTAIN;
    case 'MANAGER':
      return UserRole.MANAGER;
    default:
      return null;
  }
}

/** C/VC/MGR have no sheet number; substitutes get 16+ when squadNumber is null. */
function assignJerseyNumber(
  player: SeedPlayer,
  substituteIndex: number,
): number {
  if (player.squadNumber != null) {
    return player.squadNumber;
  }
  switch (player.role) {
    case 'CAPTAIN':
      return 1;
    case 'VICE_CAPTAIN':
      return 2;
    case 'MANAGER':
      return 3;
    case 'SUBSTITUTE':
      return 16 + substituteIndex;
    default:
      return 0;
  }
}

function buildSeedMobile(teamName: string, playerIndex: number): string {
  const prefix = TEAM_MOBILE_PREFIX[teamName];
  if (!prefix) {
    throw new Error(`No mobile prefix configured for team ${teamName}`);
  }
  return `+1555${prefix}${String(playerIndex + 1).padStart(4, '0')}`;
}

function buildSeedEmail(shortName: string, playerIndex: number): string {
  return `bedcl.${shortName.toLowerCase()}.${String(playerIndex + 1).padStart(3, '0')}@acc.local`;
}

async function upsertBedclTournament(
  tx: Prisma.TransactionClient,
  createdByUserId: string,
): Promise<{ id: string; year: number }> {
  const year = new Date().getUTCFullYear();
  let tournament = await tx.tournament.findFirst({
    where: { name: BEDCL_TOURNAMENT_NAME, isDeleted: false },
    orderBy: { year: 'desc' },
  });

  if (!tournament) {
    tournament = await tx.tournament.create({
      data: {
        name: BEDCL_TOURNAMENT_NAME,
        year,
        oversPerInnings: BEDCL_OVERS,
        maxOversPerBowler: BEDCL_MAX_OVERS_PER_BOWLER,
        locationAddress: 'Toronto, ON',
        latitude: 43.6532,
        longitude: -79.3832,
        timezone: BEDCL_TIMEZONE,
        startAt: new Date(`${year}-05-01T00:00:00.000Z`),
        endAt: new Date(`${year}-09-30T00:00:00.000Z`),
        ballType: 'LEATHER',
        type: 'ACC',
        state: 'TEAMS_FINALIZED',
        format: 'LEAGUE_SINGLE_ROUND_ROBIN',
        numberOfTeams: 4,
        playersPerTeam: 15,
        substitutesAllowed: 2,
        createdByUserId,
      },
    });
  } else {
    tournament = await tx.tournament.update({
      where: { id: tournament.id },
      data: {
        oversPerInnings: BEDCL_OVERS,
        maxOversPerBowler: BEDCL_MAX_OVERS_PER_BOWLER,
        timezone: BEDCL_TIMEZONE,
        ballType: 'LEATHER',
        type: 'ACC',
      },
    });
  }

  return { id: tournament.id, year: tournament.year };
}

async function upsertScopedRole(
  tx: Prisma.TransactionClient,
  args: {
    userId: string;
    role: UserRole;
    tournamentId: string;
    teamId: string;
  },
): Promise<void> {
  const existing = await tx.roleAssignment.findFirst({
    where: {
      userId: args.userId,
      role: args.role,
      tournamentId: args.tournamentId,
      teamId: args.teamId,
      centerId: null,
    },
  });
  if (existing) {
    return;
  }
  await tx.roleAssignment.create({
    data: {
      userId: args.userId,
      role: args.role,
      tournamentId: args.tournamentId,
      teamId: args.teamId,
    },
  });
}

async function seedTeamRoster(
  tx: Prisma.TransactionClient,
  args: {
    tournamentId: string;
    centerId: string;
    passwordHash: string;
    seedTeam: SeedTeam;
  },
): Promise<{ teamId: string; playerCount: number }> {
  const { tournamentId, centerId, passwordHash, seedTeam } = args;
  const nameNormalized = normalizeTeamName(seedTeam.name);

  const team = await tx.team.upsert({
    where: {
      tournamentId_nameNormalized: { tournamentId, nameNormalized },
    },
    update: { name: seedTeam.name },
    create: {
      tournamentId,
      name: seedTeam.name,
      nameNormalized,
    },
  });

  let substituteIndex = 0;

  for (let playerIndex = 0; playerIndex < seedTeam.players.length; playerIndex++) {
    const player = seedTeam.players[playerIndex]!;
    const { firstName, lastName } = parseSeedPlayerName(player.name);
    const mobileNumber = buildSeedMobile(seedTeam.name, playerIndex);
    const email = buildSeedEmail(seedTeam.shortName, playerIndex);
    const jerseyNumber =
      player.role === 'SUBSTITUTE'
        ? assignJerseyNumber(player, substituteIndex++)
        : assignJerseyNumber(player, 0);

    const user = await tx.user.upsert({
      where: { mobileNumber },
      update: {
        firstName,
        lastName,
        email,
        jerseyNumber,
        centerId,
      },
      create: {
        firstName,
        lastName,
        mobileNumber,
        email,
        dateOfBirth: SEED_DEFAULTS.dateOfBirth,
        centerId,
        jerseyNumber,
        emergencyContactName: SEED_DEFAULTS.emergencyContactName,
        emergencyContactNumber: SEED_DEFAULTS.emergencyContactNumber,
        passwordHash,
        role: SEED_DEFAULTS.platformRole,
      },
    });

    await tx.registration.upsert({
      where: {
        tournamentId_userId: { tournamentId, userId: user.id },
      },
      update: {
        status: SEED_DEFAULTS.registrationStatus,
        centerId,
        playerType: SEED_DEFAULTS.registrationPlayerType,
      },
      create: {
        tournamentId,
        userId: user.id,
        centerId,
        status: SEED_DEFAULTS.registrationStatus,
        playerType: SEED_DEFAULTS.registrationPlayerType,
      },
    });

    await tx.teamMembership.upsert({
      where: {
        tournamentId_userId: { tournamentId, userId: user.id },
      },
      update: {
        teamId: team.id,
        playerCategory: SEED_DEFAULTS.playerCategory,
      },
      create: {
        tournamentId,
        teamId: team.id,
        userId: user.id,
        playerCategory: SEED_DEFAULTS.playerCategory,
      },
    });

    const scopedRole = seedRoleToUserRole(player.role);
    if (scopedRole) {
      await upsertScopedRole(tx, {
        userId: user.id,
        role: scopedRole,
        tournamentId,
        teamId: team.id,
      });
    }
  }

  return { teamId: team.id, playerCount: seedTeam.players.length };
}

function assertTeamCounts(
  teamName: string,
  actualTotal: number,
  captainCount: number,
  viceCaptainCount: number,
): void {
  const expected = accTeamCounts.find((row) => row.team === teamName);
  if (!expected) {
    throw new Error(`Missing accTeamCounts entry for ${teamName}`);
  }
  if (actualTotal !== expected.total) {
    throw new Error(
      `${teamName}: expected ${expected.total} players, got ${actualTotal}`,
    );
  }
  if (captainCount !== 1) {
    throw new Error(`${teamName}: expected 1 CAPTAIN, got ${captainCount}`);
  }
  if (viceCaptainCount !== 1) {
    throw new Error(`${teamName}: expected 1 VICE_CAPTAIN, got ${viceCaptainCount}`);
  }
}

export async function seedAccTeams(
  prisma: PrismaClient,
  args: { createdByUserId: string; centerId: string; passwordHash?: string },
): Promise<void> {
  const passwordHash =
    args.passwordHash ??
    (await bcrypt.hash(SEED_DEFAULTS.password, 12));

  const tournamentId = await prisma.$transaction(async (tx) => {
    const tournament = await upsertBedclTournament(tx, args.createdByUserId);
    return tournament.id;
  });

  const summaries: {
    team: string;
    squad: number;
    substitutes: number;
    total: number;
  }[] = [];

  for (const seedTeam of accTeams) {
    const result = await prisma.$transaction(async (tx) => {
      const { teamId, playerCount } = await seedTeamRoster(tx, {
        tournamentId,
        centerId: args.centerId,
        passwordHash,
        seedTeam,
      });

      const memberships = await tx.teamMembership.count({
        where: { teamId, tournamentId },
      });
      const captainCount = await tx.roleAssignment.count({
        where: { teamId, tournamentId, role: UserRole.CAPTAIN },
      });
      const viceCaptainCount = await tx.roleAssignment.count({
        where: { teamId, tournamentId, role: UserRole.VICE_CAPTAIN },
      });

      assertTeamCounts(seedTeam.name, memberships, captainCount, viceCaptainCount);

      const expected = accTeamCounts.find((row) => row.team === seedTeam.name)!;
      return {
        team: seedTeam.name,
        squad: expected.squad,
        substitutes: expected.substitutes,
        total: playerCount,
      };
    });

    summaries.push(result);
    console.log(
      `[seedAccTeams] ${result.team}: squad=${result.squad}, subs=${result.substitutes}, total=${result.total}`,
    );
  }

  const teamCount = await prisma.team.count({ where: { tournamentId } });
  if (teamCount !== 4) {
    throw new Error(`Expected 4 BEDCL teams, found ${teamCount}`);
  }

  console.log(
    `[seedAccTeams] BEDCL tournament "${BEDCL_TOURNAMENT_NAME}" — ${teamCount} teams, ` +
      `${summaries.reduce((sum, row) => sum + row.total, 0)} players seeded. ` +
      `Login password for roster users: "${SEED_DEFAULTS.password}".`,
  );
}
