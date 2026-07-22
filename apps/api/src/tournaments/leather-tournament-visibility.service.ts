import {
  type AuthUser,
  BallType,
  type CenterPlayerRosterEntry,
  clubManagerCanSelfRegisterForLeather,
  isLeatherInviteWindowOpen,
  type LeatherInviteCandidate,
  type LeatherTournamentInvite,
  UserRole,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { selectableUserWhere } from '../users/user-query';
import { activeTeamMembershipWhere } from '../teams/team-membership-query';
import { activeTournamentWhere } from './tournament-query';

export interface LeatherTournamentViewOptions {
  /** Club Manager may open leather tournaments to manage invites. */
  allowClubManagerManagement?: boolean;
  /** Admin / organizer with edit permission. */
  allowEditor?: boolean;
}

/** Path A — any locked-XI appearance in a leather tournament match. */
function leatherLockedXiWhere(userId?: string): Prisma.MatchSquadPlayerWhereInput {
  return {
    ...(userId ? { userId } : {}),
    squad: {
      match: {
        isDeleted: false,
        tournament: {
          ballType: BallType.Leather,
          isDeleted: false,
        },
      },
    },
  };
}

/** Path B — rostered to a leather team in an active tournament. */
function activeLeatherRosterWhere(userId?: string): Prisma.TeamMembershipWhereInput {
  return {
    ...(userId ? { userId } : {}),
    ...activeTeamMembershipWhere,
    tournament: {
      ballType: BallType.Leather,
      ...activeTournamentWhere,
    },
  };
}

@Injectable()
export class LeatherTournamentVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Existing Leather Player (Path A): any locked-XI in a leather tournament OR
   * currently rostered to a leather team in an active tournament (Path B).
   */
  async isExistingLeatherPlayer(userId: string): Promise<boolean> {
    const [lockedXiAppearance, activeRoster] = await Promise.all([
      this.prisma.matchSquadPlayer.findFirst({
        where: leatherLockedXiWhere(userId),
        select: { id: true },
      }),
      this.prisma.teamMembership.findFirst({
        where: activeLeatherRosterWhere(userId),
        select: { id: true },
      }),
    ]);
    return Boolean(lockedXiAppearance ?? activeRoster);
  }

  async getInvitedTournamentIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.tournamentLeatherInvite.findMany({
      where: {
        userId,
        tournament: activeTournamentWhere,
      },
      select: { tournamentId: true },
    });
    return rows.map((row) => row.tournamentId);
  }

  /** Admin / Club Manager may view every leather tournament (listing + detail). */
  bypassesLeatherTournamentScope(actor: AuthUser | null | undefined): boolean {
    return actor?.role === UserRole.Admin || actor?.role === UserRole.ClubManager;
  }

  /**
   * Leather tournament IDs visible to the actor — same rule as
   * {@link canViewLeatherTournament} (Admin/CM → all; existing leather → all;
   * otherwise invites only).
   */
  async getVisibleLeatherTournamentIds(
    actor: AuthUser,
    options: { includeSoftDeleted?: boolean } = {},
  ): Promise<string[]> {
    const leatherWhere: Prisma.TournamentWhereInput = {
      ballType: BallType.Leather,
      ...(options.includeSoftDeleted ? {} : activeTournamentWhere),
    };

    if (this.bypassesLeatherTournamentScope(actor)) {
      const rows = await this.prisma.tournament.findMany({
        where: leatherWhere,
        select: { id: true },
      });
      return rows.map((row) => row.id);
    }

    const [isExisting, invitedIds] = await Promise.all([
      this.isExistingLeatherPlayer(actor.id),
      this.getInvitedTournamentIds(actor.id),
    ]);

    if (isExisting) {
      const rows = await this.prisma.tournament.findMany({
        where: leatherWhere,
        select: { id: true },
      });
      return rows.map((row) => row.id);
    }

    return invitedIds;
  }

  async canViewLeatherTournament(
    userId: string,
    tournamentId: string,
    actor: AuthUser | null | undefined,
    options: LeatherTournamentViewOptions = {},
  ): Promise<boolean> {
    if (this.bypassesLeatherTournamentScope(actor)) {
      return true;
    }
    if (options.allowClubManagerManagement && actor?.role === UserRole.ClubManager) {
      return true;
    }
    if (options.allowEditor) {
      return true;
    }

    const [isExisting, invited] = await Promise.all([
      this.isExistingLeatherPlayer(userId),
      this.prisma.tournamentLeatherInvite.findUnique({
        where: { tournamentId_userId: { tournamentId, userId } },
        select: { id: true },
      }),
    ]);
    if (isExisting) {
      return true;
    }
    return invited != null;
  }

  async canRegisterForLeatherTournament(
    userId: string,
    tournamentId: string,
    actor?: AuthUser | null,
  ): Promise<boolean> {
    if (clubManagerCanSelfRegisterForLeather(actor, BallType.Leather)) {
      return true;
    }
    const [isExisting, invited] = await Promise.all([
      this.isExistingLeatherPlayer(userId),
      this.prisma.tournamentLeatherInvite.findUnique({
        where: { tournamentId_userId: { tournamentId, userId } },
        select: { id: true },
      }),
    ]);
    return isExisting || invited != null;
  }

  async assertCanViewLeatherTournament(
    actor: AuthUser | null | undefined,
    tournamentId: string,
    ballType: BallType,
    options: LeatherTournamentViewOptions = {},
  ): Promise<void> {
    if (ballType !== BallType.Leather) {
      return;
    }
    if (!actor) {
      throw new ForbiddenException({
        message: 'Sign in to view this tournament',
        error: 'FORBIDDEN',
      });
    }
    const allowed = await this.canViewLeatherTournament(
      actor.id,
      tournamentId,
      actor,
      options,
    );
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have access to this leather tournament',
        error: 'LEATHER_TOURNAMENT_NOT_VISIBLE',
      });
    }
  }

  async assertCanRegisterForLeather(
    actor: AuthUser,
    tournamentId: string,
    ballType: BallType,
  ): Promise<void> {
    if (ballType !== BallType.Leather) {
      return;
    }
    const allowed = await this.canRegisterForLeatherTournament(
      actor.id,
      tournamentId,
      actor,
    );
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You must be invited to register for this leather tournament',
        error: 'LEATHER_REGISTRATION_NOT_ALLOWED',
        fields: { registration: 'Leather tournament registration requires an invite' },
      });
    }
  }

  /**
   * Registered app users eligible for New Invite — exact inverse of
   * {@link isExistingLeatherPlayer}, minus invites/registrations for this tournament.
   */
  async listInviteCandidates(
    tournamentId: string,
    search: string | undefined,
  ): Promise<LeatherInviteCandidate[]> {
    const tournament = await this.requireLeatherTournament(tournamentId);
    this.assertInviteWindowOpen(tournament);

    const [existingLeatherUserIds, alreadyInvited, alreadyRegistered] = await Promise.all([
      this.findExistingLeatherPlayerUserIds(),
      this.prisma.tournamentLeatherInvite.findMany({
        where: { tournamentId },
        select: { userId: true },
      }),
      this.prisma.registration.findMany({
        where: { tournamentId },
        select: { userId: true },
      }),
    ]);

    const excluded = new Set([
      ...existingLeatherUserIds,
      ...alreadyInvited.map((row) => row.userId),
      ...alreadyRegistered.map((row) => row.userId),
    ]);

    const normalizedSearch = search?.trim().toLowerCase() ?? '';
    const users = await this.prisma.user.findMany({
      where: {
        ...selectableUserWhere,
        id: excluded.size > 0 ? { notIn: [...excluded] } : undefined,
        ...(normalizedSearch
          ? {
              OR: [
                { firstName: { contains: normalizedSearch, mode: 'insensitive' as const } },
                { lastName: { contains: normalizedSearch, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        centerId: true,
        center: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 100,
    });

    return users.map((user) => ({
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      centerId: user.centerId,
      centerName: user.center.name,
    }));
  }

  async listInvites(tournamentId: string): Promise<LeatherTournamentInvite[]> {
    const tournament = await this.requireLeatherTournament(tournamentId);
    this.assertInviteWindowOpen(tournament);

    const rows = await this.prisma.tournamentLeatherInvite.findMany({
      where: { tournamentId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            center: { select: { name: true } },
            registrations: {
              where: { tournamentId },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    return rows.map((row) => ({
      userId: row.userId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      centerName: row.user.center.name,
      invitedAt: row.invitedAt.toISOString(),
      canRevoke: row.user.registrations.length === 0,
    }));
  }

  async createInvites(
    actor: AuthUser,
    tournamentId: string,
    userIds: string[],
  ): Promise<number> {
    this.assertAdmin(actor);
    const tournament = await this.requireLeatherTournament(tournamentId);
    this.assertInviteWindowOpen(tournament);

    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new BadRequestException({
        message: 'Select at least one player to invite',
        error: 'NO_INVITEES',
      });
    }

    for (const userId of uniqueIds) {
      if (await this.isExistingLeatherPlayer(userId)) {
        throw new BadRequestException({
          message: 'One or more selected players are already leather players',
          error: 'ALREADY_LEATHER_PLAYER',
        });
      }
    }

    const selectableUsers = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds }, ...selectableUserWhere },
      select: { id: true },
    });
    if (selectableUsers.length !== uniqueIds.length) {
      throw new BadRequestException({
        message: 'One or more selected players are inactive or unavailable',
        error: 'USER_NOT_SELECTABLE',
      });
    }

    const alreadyRegistered = await this.prisma.registration.findMany({
      where: { tournamentId, userId: { in: uniqueIds } },
      select: { userId: true },
    });
    if (alreadyRegistered.length > 0) {
      throw new BadRequestException({
        message: 'One or more selected players are already registered for this tournament',
        error: 'ALREADY_REGISTERED',
      });
    }

    const result = await this.prisma.tournamentLeatherInvite.createMany({
      data: uniqueIds.map((userId) => ({
        tournamentId,
        userId,
        invitedByUserId: actor.id,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  async revokeInvite(actor: AuthUser, tournamentId: string, userId: string): Promise<void> {
    this.assertAdmin(actor);
    const tournament = await this.requireLeatherTournament(tournamentId);
    this.assertInviteWindowOpen(tournament);

    const registration = await this.prisma.registration.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
      select: { id: true },
    });
    if (registration) {
      throw new BadRequestException({
        message: 'Cannot revoke an invite after the player has registered',
        error: 'INVITE_ALREADY_REGISTERED',
      });
    }

    const deleted = await this.prisma.tournamentLeatherInvite.deleteMany({
      where: { tournamentId, userId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException({
        message: 'Invite not found',
        error: 'NOT_FOUND',
      });
    }
  }

  private assertAdmin(actor: AuthUser): void {
    if (actor.role !== UserRole.Admin) {
      throw new ForbiddenException({
        message: 'Only Admins may manage leather invites',
        error: 'FORBIDDEN',
      });
    }
  }

  private async requireLeatherTournament(tournamentId: string): Promise<{
    id: string;
    startAt: Date;
    endAt: Date;
    timezone: string | null;
    ballType: string;
  }> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        timezone: true,
        ballType: true,
        isDeleted: true,
      },
    });
    if (!tournament || tournament.isDeleted) {
      throw new NotFoundException({
        message: 'Tournament not found',
        error: 'NOT_FOUND',
      });
    }
    if (tournament.ballType !== BallType.Leather) {
      throw new BadRequestException({
        message: 'Invites apply to leather tournaments only',
        error: 'NOT_LEATHER_TOURNAMENT',
      });
    }
    return tournament;
  }

  private assertInviteWindowOpen(tournament: {
    startAt: Date;
    endAt: Date;
    timezone: string | null;
  }): void {
    if (
      !isLeatherInviteWindowOpen({
        startAt: tournament.startAt.toISOString(),
        endAt: tournament.endAt.toISOString(),
        timezone: tournament.timezone,
      })
    ) {
      throw new BadRequestException({
        message: 'Invites are closed once the tournament has ended',
        error: 'INVITE_WINDOW_CLOSED',
      });
    }
  }

  /**
   * §7.6 leather late-add picker: existing leather players + this tournament's invitees,
   * minus anyone already registered.
   */
  async listLateRegisterCandidates(tournamentId: string): Promise<CenterPlayerRosterEntry[]> {
    await this.requireLeatherTournament(tournamentId);

    const [existingLeatherUserIds, invited, alreadyRegistered] = await Promise.all([
      this.findExistingLeatherPlayerUserIds(),
      this.prisma.tournamentLeatherInvite.findMany({
        where: { tournamentId },
        select: { userId: true },
      }),
      this.prisma.registration.findMany({
        where: { tournamentId },
        select: { userId: true },
      }),
    ]);

    const registeredIds = new Set(alreadyRegistered.map((row) => row.userId));
    const eligibleIds = [
      ...new Set([...existingLeatherUserIds, ...invited.map((row) => row.userId)]),
    ].filter((userId) => !registeredIds.has(userId));

    if (eligibleIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: eligibleIds },
        ...selectableUserWhere,
        role: UserRole.Player,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNumber: true,
        profilePhotoUrl: true,
        centerId: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return users.map((user) => ({
      userId: user.id,
      centerId: user.centerId,
      firstName: user.firstName,
      lastName: user.lastName,
      mobileNumber: user.mobileNumber,
      profilePhotoUrl: user.profilePhotoUrl,
    }));
  }

  /** Bulk inverse of {@link isExistingLeatherPlayer} for the invite candidate list. */
  private async findExistingLeatherPlayerUserIds(): Promise<string[]> {
    const [fromLockedXi, fromActiveRosters] = await Promise.all([
      this.prisma.matchSquadPlayer.findMany({
        where: leatherLockedXiWhere(),
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.teamMembership.findMany({
        where: activeLeatherRosterWhere(),
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    return [
      ...new Set([
        ...fromLockedXi.map((row) => row.userId),
        ...fromActiveRosters.map((row) => row.userId),
      ]),
    ];
  }
}
