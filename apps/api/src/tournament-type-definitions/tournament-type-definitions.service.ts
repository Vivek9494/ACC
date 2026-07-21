import {
  APL_TOURNAMENT_TYPE_CODE,
  BallType,
  type CreateTournamentTypeDefinitionRequest,
  type TournamentTypeDefinitionDetail,
  type TournamentTypeDefinitionSummary,
  type UpdateTournamentTypeDefinitionRequest,
  TournamentType,
  tournamentTypeDefinitionCodeFromName,
} from '@acc/types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const activeDefinitionWhere: Prisma.TournamentTypeDefinitionWhereInput = {
  isDeleted: false,
};

@Injectable()
export class TournamentTypeDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<TournamentTypeDefinitionSummary[]> {
    const rows = await this.prisma.tournamentTypeDefinition.findMany({
      where: activeDefinitionWhere,
      include: {
        province: { select: { name: true } },
        _count: { select: { centerLinks: true } },
      },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map((row) => this.toSummary(row));
  }

  async getById(id: string): Promise<TournamentTypeDefinitionDetail> {
    const row = await this.requireActive(id);
    return this.toDetail(row);
  }

  /**
   * Active APL catalog definition for a province, if configured.
   * Used when linking centers for Tennis + citySelection APL.
   */
  async findActiveAplForProvince(provinceId: string): Promise<{
    centerIds: string[];
  } | null> {
    const row = await this.prisma.tournamentTypeDefinition.findFirst({
      where: {
        ...activeDefinitionWhere,
        code: APL_TOURNAMENT_TYPE_CODE,
        provinceId,
        ballType: BallType.Tennis,
      },
      include: {
        centerLinks: { select: { centerId: true } },
      },
    });
    if (!row || row.centerLinks.length === 0) {
      return null;
    }
    return { centerIds: row.centerLinks.map((link) => link.centerId) };
  }

  async create(dto: CreateTournamentTypeDefinitionRequest): Promise<TournamentTypeDefinitionDetail> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException({
        message: 'Name is required',
        error: 'NAME_REQUIRED',
        fields: { name: 'Name is required' },
      });
    }

    const code = (dto.code?.trim()
      ? dto.code.trim().toUpperCase()
      : tournamentTypeDefinitionCodeFromName(name));
    if (!code) {
      throw new BadRequestException({
        message: 'Code is required',
        error: 'CODE_REQUIRED',
        fields: { name: 'Enter a name that yields a valid code' },
      });
    }

    await this.assertProvince(dto.provinceId);
    await this.assertUniqueCode(code);
    const centerIds = await this.validateCenters(dto.provinceId, dto.centerIds);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.tournamentTypeDefinition.create({
        data: {
          code,
          name,
          provinceId: dto.provinceId,
          ballType: dto.ballType,
          formatConfig: dto.formatConfig === undefined ? undefined : (dto.formatConfig as Prisma.InputJsonValue),
          centerLinks: {
            create: centerIds.map((centerId) => ({ centerId })),
          },
        },
        include: this.detailInclude,
      });
      return row;
    });

    if (code === APL_TOURNAMENT_TYPE_CODE && dto.ballType === BallType.Tennis) {
      await this.resyncAplTournamentCenters(dto.provinceId, centerIds);
    }

    return this.toDetail(created);
  }

  async update(
    id: string,
    dto: UpdateTournamentTypeDefinitionRequest,
  ): Promise<TournamentTypeDefinitionDetail> {
    const existing = await this.requireActive(id);
    const provinceId = dto.provinceId ?? existing.provinceId;
    const ballType = dto.ballType ?? (existing.ballType as BallType);
    const name = dto.name !== undefined ? dto.name.trim() : existing.name;

    if (!name) {
      throw new BadRequestException({
        message: 'Name is required',
        error: 'NAME_REQUIRED',
        fields: { name: 'Name is required' },
      });
    }

    if (dto.provinceId) {
      await this.assertProvince(dto.provinceId);
    }

    const centerIds =
      dto.centerIds !== undefined
        ? await this.validateCenters(provinceId, dto.centerIds)
        : existing.centerLinks.map((link) => link.centerId);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.centerIds !== undefined) {
        await tx.tournamentTypeDefinitionCenter.deleteMany({
          where: { tournamentTypeDefinitionId: id },
        });
        if (centerIds.length > 0) {
          await tx.tournamentTypeDefinitionCenter.createMany({
            data: centerIds.map((centerId) => ({
              tournamentTypeDefinitionId: id,
              centerId,
            })),
          });
        }
      }

      return tx.tournamentTypeDefinition.update({
        where: { id },
        data: {
          name,
          provinceId,
          ballType,
          ...(dto.formatConfig !== undefined
            ? { formatConfig: dto.formatConfig as Prisma.InputJsonValue }
            : {}),
        },
        include: this.detailInclude,
      });
    });

    if (updated.code === APL_TOURNAMENT_TYPE_CODE && ballType === BallType.Tennis) {
      await this.resyncAplTournamentCenters(provinceId, centerIds);
    }

    return this.toDetail(updated);
  }

  /**
   * Align existing APL tournaments in the province with the type's participating
   * centers (fixes all-Ontario snapshots from before the type was defined).
   */
  async resyncAplTournamentCenters(provinceId: string, centerIds: string[]): Promise<void> {
    if (centerIds.length === 0) {
      return;
    }
    const tournaments = await this.prisma.tournament.findMany({
      where: {
        type: TournamentType.APL,
        provinceId,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (tournaments.length === 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const tournament of tournaments) {
        await tx.tournamentCenter.deleteMany({ where: { tournamentId: tournament.id } });
        await tx.tournamentCenter.createMany({
          data: centerIds.map((centerId) => ({
            tournamentId: tournament.id,
            centerId,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.requireActive(id);
    await this.prisma.tournamentTypeDefinition.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  private readonly detailInclude = {
    province: { select: { name: true } },
    centerLinks: {
      include: { center: { select: { id: true, name: true } } },
      orderBy: { center: { name: 'asc' as const } },
    },
    _count: { select: { centerLinks: true } },
  } satisfies Prisma.TournamentTypeDefinitionInclude;

  private async requireActive(id: string) {
    const row = await this.prisma.tournamentTypeDefinition.findFirst({
      where: { id, ...activeDefinitionWhere },
      include: this.detailInclude,
    });
    if (!row) {
      throw new NotFoundException('Tournament type not found');
    }
    return row;
  }

  private async assertProvince(provinceId: string): Promise<void> {
    const province = await this.prisma.province.findUnique({
      where: { id: provinceId },
      select: { id: true, isActive: true },
    });
    if (!province || !province.isActive) {
      throw new BadRequestException({
        message: 'Invalid or inactive province',
        error: 'INVALID_PROVINCE',
        fields: { provinceId: 'Select a valid province' },
      });
    }
  }

  private async assertUniqueCode(code: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.tournamentTypeDefinition.findFirst({
      where: {
        code,
        ...activeDefinitionWhere,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        message: `A tournament type with code "${code}" already exists`,
        error: 'CODE_EXISTS',
        fields: { name: `Code "${code}" is already in use` },
      });
    }
  }

  private async validateCenters(provinceId: string, centerIds: string[]): Promise<string[]> {
    const unique = [...new Set(centerIds)];
    if (unique.length === 0) {
      throw new BadRequestException({
        message: 'Select at least one participating center',
        error: 'CENTERS_REQUIRED',
        fields: { centerIds: 'Select at least one center' },
      });
    }

    const centers = await this.prisma.center.findMany({
      where: { id: { in: unique }, provinceId, isActive: true },
      select: { id: true },
    });
    if (centers.length !== unique.length) {
      throw new BadRequestException({
        message: 'One or more centers are invalid, inactive, or not in the selected province',
        error: 'INVALID_CENTER',
        fields: { centerIds: 'Select valid centers in this province' },
      });
    }
    return unique;
  }

  private toSummary(row: {
    id: string;
    code: string;
    name: string;
    provinceId: string;
    ballType: string;
    createdAt: Date;
    updatedAt: Date;
    province: { name: string };
    _count: { centerLinks: number };
  }): TournamentTypeDefinitionSummary {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      provinceId: row.provinceId,
      provinceName: row.province.name,
      ballType: row.ballType as BallType,
      centerCount: row._count.centerLinks,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: {
    id: string;
    code: string;
    name: string;
    provinceId: string;
    ballType: string;
    formatConfig: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    province: { name: string };
    centerLinks: { centerId: string; center: { id: string; name: string } }[];
    _count: { centerLinks: number };
  }): TournamentTypeDefinitionDetail {
    return {
      ...this.toSummary(row),
      centerIds: row.centerLinks.map((link) => link.centerId),
      centerNames: row.centerLinks.map((link) => link.center.name),
      formatConfig: row.formatConfig,
    };
  }
}
