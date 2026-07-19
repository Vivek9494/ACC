import {
  type AuthUser,
  BallType,
  buildTournamentFeeCardSubtitle,
  FeeStatus,
  isAllCentersTennisScope,
  resolveTournamentFeeDisplayCents,
  TournamentFeesTrackerLayout,
  TOURNAMENT_FEE_UNASSIGNED_CENTER_LABEL,
  TournamentType,
  type RegistrationPlayerType,
  type TournamentFeeEntry,
  type TournamentFeesTracker,
  type TournamentFeeTeamGroup,
  UserRole,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeeStatus as PrismaFeeStatus, type Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { decimalToNumberOrNull } from '../common/decimal.util';
import { PrismaService } from '../prisma/prisma.service';
import { activeTeamMembershipWhere } from '../teams/team-membership-query';
import { buildTournamentScopeDisplay } from '../tournaments/tournament-scope-display';

const FEE_INCLUDE = {
  user: {
    select: {
      firstName: true,
      lastName: true,
      profilePhotoUrl: true,
    },
  },
  team: {
    select: {
      name: true,
    },
  },
  registration: {
    select: {
      id: true,
      centerId: true,
      playerType: true,
      center: { select: { name: true } },
    },
  },
} satisfies Prisma.FeeInclude;

type FeeRow = Prisma.FeeGetPayload<{ include: typeof FEE_INCLUDE }>;

type FeesScope =
  | { type: 'center'; centerIds: string[] }
  | { type: 'team'; teamIds: string[] }
  | { type: 'all_teams' }
  | { type: 'all_centers' };

interface FeesAccessContext {
  layout:
    | typeof TournamentFeesTrackerLayout.Flat
    | typeof TournamentFeesTrackerLayout.GroupedByTeam
    | typeof TournamentFeesTrackerLayout.GroupedByCenter;
  scope: FeesScope;
}

interface TournamentFeeContext {
  ballType: BallType;
  feeFullTime: number | null;
  feePartTime: number | null;
}

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** §20: role- and ball-type-aware fee tracker (manual tracking only). */
  async getTracker(actor: AuthUser, tournamentId: string): Promise<TournamentFeesTracker> {
    const access = await this.resolveAccess(actor, tournamentId);
    const feeContext = await this.loadTournamentFeeContext(tournamentId);
    await this.syncFees(tournamentId, access.scope);

    const fees = await this.prisma.fee.findMany({
      where: this.buildFeeWhere(tournamentId, access.scope),
      include: FEE_INCLUDE,
      orderBy: [
        { registration: { center: { name: 'asc' } } },
        { team: { name: 'asc' } },
        { user: { lastName: 'asc' } },
        { user: { firstName: 'asc' } },
      ],
    });

    const paidEntries = fees
      .filter((fee) => fee.status === PrismaFeeStatus.PAID)
      .map((fee) => this.toEntry(fee, feeContext));
    const unpaidEntries = fees
      .filter((fee) => fee.status === PrismaFeeStatus.PENDING)
      .map((fee) => this.toEntry(fee, feeContext));

    const format = this.buildGroupFormatter(access.layout);

    return {
      ballType: feeContext.ballType,
      layout: access.layout,
      paid: format(paidEntries),
      unpaid: format(unpaidEntries),
      paidCount: paidEntries.length,
      unpaidCount: unpaidEntries.length,
    };
  }

  /** §20: manually record offline payment — flips status to PAID (no gateway). */
  async markPaid(actor: AuthUser, tournamentId: string, feeId: string): Promise<TournamentFeeEntry> {
    const access = await this.resolveAccess(actor, tournamentId);

    const existing = await this.prisma.fee.findUnique({
      where: { id: feeId },
      include: FEE_INCLUDE,
    });
    if (!existing || existing.tournamentId !== tournamentId) {
      throw new NotFoundException({ message: 'Fee record not found', error: 'NOT_FOUND' });
    }

    const registration =
      existing.registration ??
      (await this.prisma.registration.findUnique({
        where: {
          tournamentId_userId: { tournamentId, userId: existing.userId },
        },
        select: { id: true, centerId: true },
      }));
    if (!registration) {
      throw new NotFoundException({ message: 'Registration not found', error: 'NOT_FOUND' });
    }

    this.assertFeeInScope(existing, registration.centerId, access.scope);

    if (existing.status === PrismaFeeStatus.PAID) {
      throw new BadRequestException({ message: 'Fee is already marked paid', error: 'ALREADY_PAID' });
    }

    const paidAt = new Date();
    const row = await this.prisma.fee.update({
      where: { id: feeId },
      data: {
        status: PrismaFeeStatus.PAID,
        paidAt,
        recordedByUserId: actor.id,
        registrationId: registration.id,
      },
      include: FEE_INCLUDE,
    });

    await this.audit.record({
      action: 'FEE_PAYMENT_RECORDED',
      actorUserId: actor.id,
      targetUserId: existing.userId,
      targetEntityType: 'fee',
      targetEntityId: feeId,
      before: {
        status: existing.status,
        amountCents: existing.amountCents.toString(),
      },
      after: {
        status: FeeStatus.Paid,
        amountCents: row.amountCents.toString(),
        paidAt: paidAt.toISOString(),
        recordedByUserId: actor.id,
      },
    });

    // TODO(§20): enqueue fee reminder notification 1 day before tournament start (FCM later phase).

    return this.toEntry(row, await this.loadTournamentFeeContext(tournamentId));
  }

  /** @deprecated alias */
  async markReceived(actor: AuthUser, tournamentId: string, feeId: string): Promise<TournamentFeeEntry> {
    return this.markPaid(actor, tournamentId, feeId);
  }

  private async resolveAccess(actor: AuthUser, tournamentId: string): Promise<FeesAccessContext> {
    const tournament = await this.requireTournament(tournamentId);

    if (actor.role === UserRole.Admin) {
      if (tournament.ballType === BallType.Leather) {
        return {
          layout: TournamentFeesTrackerLayout.GroupedByTeam,
          scope: { type: 'all_teams' },
        };
      }
      return {
        layout: TournamentFeesTrackerLayout.GroupedByCenter,
        scope: { type: 'all_centers' },
      };
    }

    if (tournament.ballType === BallType.Tennis) {
      if (actor.role === UserRole.ClubManager) {
        const scopeDisplay = await buildTournamentScopeDisplay(
          this.prisma,
          tournamentId,
          tournament.type as TournamentType,
          BallType.Tennis,
          tournament.provinceId,
        );
        if (isAllCentersTennisScope(scopeDisplay)) {
          return {
            layout: TournamentFeesTrackerLayout.GroupedByCenter,
            scope: { type: 'all_centers' },
          };
        }
        throw new ForbiddenException({
          message: 'Fees tracker is not available for your role on this tournament',
          error: 'FORBIDDEN',
        });
      }

      const centerIds = await this.getSevakCenterIds(actor);
      if (centerIds.length === 0) {
        throw new ForbiddenException({
          message: 'Fees tracker is not available for your role on this tournament',
          error: 'FORBIDDEN',
        });
      }
      return {
        layout: TournamentFeesTrackerLayout.Flat,
        scope: { type: 'center', centerIds },
      };
    }

    if (tournament.ballType === BallType.Leather) {
      if (actor.role === UserRole.ClubManager) {
        return {
          layout: TournamentFeesTrackerLayout.GroupedByTeam,
          scope: { type: 'all_teams' },
        };
      }

      const teamIds = await this.getCaptainTeamIds(actor, tournamentId);
      if (teamIds.length > 0) {
        return {
          layout: TournamentFeesTrackerLayout.Flat,
          scope: { type: 'team', teamIds },
        };
      }

      throw new ForbiddenException({
        message: 'Fees tracker is not available for your role on this tournament',
        error: 'FORBIDDEN',
      });
    }

    throw new ForbiddenException({
      message: 'Fees tracker is not available for your role on this tournament',
      error: 'FORBIDDEN',
    });
  }

  private assertFeeInScope(fee: FeeRow, registrationCenterId: string, scope: FeesScope): void {
    switch (scope.type) {
      case 'center':
        if (!scope.centerIds.includes(registrationCenterId)) {
          throw new ForbiddenException({
            message: 'You can only manage fees for players from your own center',
            error: 'FORBIDDEN',
          });
        }
        return;
      case 'team':
        if (!fee.teamId || !scope.teamIds.includes(fee.teamId)) {
          throw new ForbiddenException({
            message: 'You can only manage fees for players on your own team',
            error: 'FORBIDDEN',
          });
        }
        return;
      case 'all_teams':
      case 'all_centers':
        return;
      default: {
        const _exhaustive: never = scope;
        return _exhaustive;
      }
    }
  }

  private buildFeeWhere(tournamentId: string, scope: FeesScope): Prisma.FeeWhereInput {
    const confirmedRegistration = { status: 'CONFIRMED' as const };

    switch (scope.type) {
      case 'center':
        return {
          tournamentId,
          registration: {
            ...confirmedRegistration,
            centerId: { in: scope.centerIds },
          },
        };
      case 'team':
        return {
          tournamentId,
          teamId: { in: scope.teamIds },
          registration: confirmedRegistration,
        };
      case 'all_teams':
      case 'all_centers':
        return {
          tournamentId,
          registration: confirmedRegistration,
        };
      default: {
        const _exhaustive: never = scope;
        return _exhaustive;
      }
    }
  }

  private async syncFees(tournamentId: string, scope: FeesScope): Promise<void> {
    switch (scope.type) {
      case 'center':
        await this.syncFeesForCenters(tournamentId, scope.centerIds);
        return;
      case 'team':
        await this.syncFeesForTeams(tournamentId, scope.teamIds);
        return;
      case 'all_teams':
      case 'all_centers':
        await this.syncFeesForTournament(tournamentId);
        return;
      default: {
        const _exhaustive: never = scope;
        return _exhaustive;
      }
    }
  }

  private async syncFeesForTournament(tournamentId: string): Promise<void> {
    const registrations = await this.prisma.registration.findMany({
      where: { tournamentId, status: 'CONFIRMED' },
      select: { id: true, userId: true, feeAmountCents: true },
    });
    await this.upsertFeesForRegistrations(tournamentId, registrations);
  }

  private async syncFeesForTeams(tournamentId: string, teamIds: string[]): Promise<void> {
    const memberships = await this.prisma.teamMembership.findMany({
      where: { tournamentId, teamId: { in: teamIds }, ...activeTeamMembershipWhere },
      select: { userId: true },
    });
    const userIds = memberships.map((membership) => membership.userId);
    if (userIds.length === 0) {
      return;
    }

    const registrations = await this.prisma.registration.findMany({
      where: { tournamentId, status: 'CONFIRMED', userId: { in: userIds } },
      select: { id: true, userId: true, feeAmountCents: true },
    });
    await this.upsertFeesForRegistrations(tournamentId, registrations);
  }

  private async syncFeesForCenters(tournamentId: string, centerIds: string[]): Promise<void> {
    const registrations = await this.prisma.registration.findMany({
      where: {
        tournamentId,
        centerId: { in: centerIds },
        status: 'CONFIRMED',
      },
      select: {
        id: true,
        userId: true,
        feeAmountCents: true,
      },
    });
    await this.upsertFeesForRegistrations(tournamentId, registrations);
  }

  private async upsertFeesForRegistrations(
    tournamentId: string,
    registrations: { id: string; userId: string; feeAmountCents: bigint | null }[],
  ): Promise<void> {
    if (registrations.length === 0) {
      return;
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { defaultPlayerFeeCents: true },
    });
    if (!tournament) {
      return;
    }

    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        tournamentId,
        userId: { in: registrations.map((registration) => registration.userId) },
        ...activeTeamMembershipWhere,
      },
      select: { userId: true, teamId: true },
    });
    const teamByUserId = new Map(memberships.map((membership) => [membership.userId, membership.teamId]));

    for (const registration of registrations) {
      const amountCents =
        registration.feeAmountCents ?? tournament.defaultPlayerFeeCents ?? BigInt(0);
      const teamId = teamByUserId.get(registration.userId) ?? null;

      await this.prisma.fee.upsert({
        where: {
          tournamentId_userId: { tournamentId, userId: registration.userId },
        },
        create: {
          tournamentId,
          userId: registration.userId,
          registrationId: registration.id,
          teamId,
          amountCents,
          status: PrismaFeeStatus.PENDING,
        },
        update: {
          registrationId: registration.id,
          teamId,
          amountCents,
        },
      });
    }
  }

  private buildGroupFormatter(
    layout: FeesAccessContext['layout'],
  ): (entries: TournamentFeeEntry[]) => TournamentFeeTeamGroup[] {
    switch (layout) {
      case TournamentFeesTrackerLayout.GroupedByTeam:
        return (entries) => this.groupByTeam(entries);
      case TournamentFeesTrackerLayout.GroupedByCenter:
        return (entries) => this.groupByCenter(entries);
      case TournamentFeesTrackerLayout.Flat:
        return (entries) => this.asFlatList(entries);
      default: {
        const _exhaustive: never = layout;
        return _exhaustive;
      }
    }
  }

  private async loadTournamentFeeContext(tournamentId: string): Promise<TournamentFeeContext> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { ballType: true, feeFullTime: true, feePartTime: true },
    });
    if (!tournament) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
    return {
      ballType: tournament.ballType as BallType,
      feeFullTime: decimalToNumberOrNull(tournament.feeFullTime),
      feePartTime: decimalToNumberOrNull(tournament.feePartTime),
    };
  }

  private asFlatList(entries: TournamentFeeEntry[]): TournamentFeeTeamGroup[] {
    if (entries.length === 0) {
      return [];
    }
    return [
      {
        teamId: null,
        teamName: '',
        entries: [...entries].sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
        ),
      },
    ];
  }

  private groupByTeam(entries: TournamentFeeEntry[]): TournamentFeeTeamGroup[] {
    const groups = new Map<string, TournamentFeeTeamGroup>();
    for (const entry of entries) {
      const key = entry.teamId ?? '__unassigned__';
      const existing = groups.get(key);
      if (existing) {
        existing.entries.push(entry);
        continue;
      }
      groups.set(key, {
        teamId: entry.teamId,
        teamName: entry.teamName,
        entries: [entry],
      });
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
        ),
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  }

  private groupByCenter(entries: TournamentFeeEntry[]): TournamentFeeTeamGroup[] {
    const groups = new Map<string, TournamentFeeTeamGroup>();
    for (const entry of entries) {
      const key = entry.centerId ?? '__unassigned__';
      const existing = groups.get(key);
      if (existing) {
        existing.entries.push(entry);
        continue;
      }
      groups.set(key, {
        teamId: entry.centerId,
        teamName: entry.centerName,
        entries: [entry],
      });
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
        ),
      }))
      .sort((a, b) => {
        if (a.teamName === TOURNAMENT_FEE_UNASSIGNED_CENTER_LABEL) {
          return 1;
        }
        if (b.teamName === TOURNAMENT_FEE_UNASSIGNED_CENTER_LABEL) {
          return -1;
        }
        return a.teamName.localeCompare(b.teamName);
      });
  }

  private toEntry(row: FeeRow, feeContext: TournamentFeeContext): TournamentFeeEntry {
    const teamName = row.team?.name ?? 'Unassigned';
    const centerId = row.registration?.centerId ?? null;
    const centerName =
      row.registration?.center?.name ?? TOURNAMENT_FEE_UNASSIGNED_CENTER_LABEL;
    const playerType = (row.registration?.playerType as RegistrationPlayerType | null) ?? null;
    const cardSubtitle = buildTournamentFeeCardSubtitle(
      feeContext.ballType,
      teamName,
      centerName,
      playerType,
    );
    const amountCents = resolveTournamentFeeDisplayCents(
      feeContext.ballType,
      feeContext.feeFullTime,
      feeContext.feePartTime,
      playerType,
    );

    return {
      id: row.id,
      registrationId: row.registrationId ?? row.registration?.id ?? '',
      userId: row.userId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      profilePhotoUrl: row.user.profilePhotoUrl,
      teamId: row.teamId,
      teamName,
      centerId,
      centerName,
      playerType,
      cardSubtitle,
      amountCents,
      status: row.status === PrismaFeeStatus.PAID ? FeeStatus.Paid : FeeStatus.Pending,
      paidAt: row.paidAt?.toISOString() ?? null,
    };
  }

  private async requireTournament(tournamentId: string): Promise<{
    id: string;
    isDeleted: boolean;
    ballType: string;
    type: string;
    provinceId: string | null;
  }> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, isDeleted: true, ballType: true, type: true, provinceId: true },
    });
    if (!tournament || tournament.isDeleted) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
    return tournament;
  }

  private async getSevakCenterIds(actor: AuthUser): Promise<string[]> {
    const sevakAssignments = await this.prisma.roleAssignment.findMany({
      where: { userId: actor.id, role: UserRole.CenterSevak, centerId: { not: null } },
      select: { centerId: true },
    });
    return sevakAssignments
      .map((assignment) => assignment.centerId)
      .filter((id): id is string => typeof id === 'string');
  }

  private async getCaptainTeamIds(actor: AuthUser, tournamentId: string): Promise<string[]> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: {
        userId: actor.id,
        tournamentId,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain] },
        teamId: { not: null },
      },
      select: { teamId: true },
    });
    return assignments
      .map((assignment) => assignment.teamId)
      .filter((id): id is string => typeof id === 'string');
  }
}
