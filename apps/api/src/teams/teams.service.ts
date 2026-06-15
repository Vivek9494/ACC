import {
  type AuthUser,
  Permission,
  TEAM_FORM_MESSAGES,
  normalizeTeamName,
  type TeamSummary,
  teamCapError,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PermissionService } from '../authz/permission.service';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { TournamentsService } from '../tournaments/tournaments.service';
import type { CreateTeamDto } from './dto/create-team.dto';

const TEAM_NAME_TAKEN = TEAM_FORM_MESSAGES.name.duplicate;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly media: MediaService,
    private readonly tournaments: TournamentsService,
  ) {}

  async list(tournamentId: string): Promise<TeamSummary[]> {
    await this.requireTournament(tournamentId);
    const rows = await this.prisma.team.findMany({
      where: { tournamentId },
      orderBy: { name: 'asc' },
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
      },
    });
    return rows.map((row) => this.toSummary(row));
  }

  async create(actor: AuthUser, tournamentId: string, dto: CreateTeamDto): Promise<TeamSummary> {
    const tournament = await this.requireTournament(tournamentId);

    const allowed = await this.permissions.check(Permission.EDIT_TOURNAMENT, actor, {
      tournamentId,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to add teams to this tournament',
        error: 'FORBIDDEN',
      });
    }

    await this.tournaments.assertCenterSevakTournamentAccess(actor, tournament);

    const teamCount = await this.prisma.team.count({ where: { tournamentId } });
    if (teamCount >= tournament.numberOfTeams) {
      throw new BadRequestException({
        message: teamCapError(tournament.numberOfTeams),
        error: 'TEAM_CAP_REACHED',
      });
    }

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException({
        message: 'Team name is required',
        error: 'TEAM_NAME_REQUIRED',
        fields: { name: 'Team name is required' },
      });
    }

    const nameNormalized = normalizeTeamName(name);
    await this.assertTeamNameAvailable(tournamentId, nameNormalized);

    try {
      const created = await this.prisma.team.create({
        data: {
          tournamentId,
          name,
          nameNormalized,
          logoUrl: dto.logoUrl ?? null,
        },
        include: { _count: { select: { memberships: true } } },
      });
      return this.toSummary(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.teamNameTakenException();
      }
      throw err;
    }
  }

  async uploadLogo(actor: AuthUser, buffer: Buffer): Promise<string> {
    return this.media.uploadTeamLogo(actor.id, buffer);
  }

  /**
   * Reject duplicate display names within a tournament (case-insensitive, trimmed).
   * Pass `excludeTeamId` when renaming an existing team.
   */
  async assertTeamNameAvailable(
    tournamentId: string,
    nameNormalized: string,
    excludeTeamId?: string,
  ): Promise<void> {
    const existing = await this.prisma.team.findFirst({
      where: {
        tournamentId,
        nameNormalized,
        ...(excludeTeamId ? { id: { not: excludeTeamId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw this.teamNameTakenException();
    }
  }

  private teamNameTakenException(): BadRequestException {
    return new BadRequestException({
      message: TEAM_NAME_TAKEN,
      error: 'TEAM_NAME_TAKEN',
      fields: { name: TEAM_NAME_TAKEN },
    });
  }

  private async requireTournament(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    assertTournamentActive(tournament);
    return tournament;
  }

  private toSummary(row: {
    id: string;
    tournamentId: string;
    name: string;
    logoUrl: string | null;
    groupId?: string | null;
    group?: { id: string; name: string } | null;
    _count?: { memberships: number };
  }): TeamSummary {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      name: row.name,
      logoUrl: row.logoUrl,
      memberCount: row._count?.memberships ?? 0,
      groupId: row.groupId ?? row.group?.id ?? null,
      groupName: row.group?.name ?? null,
    };
  }
}
