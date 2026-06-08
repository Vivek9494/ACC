import type { CenterDetail, CenterSummary } from '@acc/types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateCenterDto } from './dto/create-center.dto';
import type { UpdateCenterDto } from './dto/update-center.dto';

function toDetail(row: {
  id: string;
  name: string;
  provinceId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  province: { name: string };
}): CenterDetail {
  return {
    id: row.id,
    name: row.name,
    provinceId: row.provinceId,
    provinceName: row.province.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CentersService {
  constructor(private readonly prisma: PrismaService) {}

  listActive(provinceId?: string): Promise<CenterSummary[]> {
    return this.prisma.center.findMany({
      where: {
        isActive: true,
        ...(provinceId ? { provinceId } : {}),
      },
      select: { id: true, name: true, provinceId: true },
      orderBy: { name: 'asc' },
    });
  }

  listAdmin(provinceId?: string): Promise<CenterDetail[]> {
    return this.prisma.center
      .findMany({
        where: provinceId ? { provinceId } : undefined,
        include: { province: { select: { name: true } } },
        orderBy: [{ province: { name: 'asc' } }, { name: 'asc' }],
      })
      .then((rows) => rows.map(toDetail));
  }

  async getById(id: string): Promise<CenterDetail> {
    const row = await this.prisma.center.findUnique({
      where: { id },
      include: { province: { select: { name: true } } },
    });
    if (!row) {
      throw new NotFoundException({ message: 'Center not found', error: 'NOT_FOUND' });
    }
    return toDetail(row);
  }

  async create(dto: CreateCenterDto): Promise<CenterDetail> {
    const name = dto.name.trim();
    await this.assertProvinceExists(dto.provinceId);
    try {
      const row = await this.prisma.center.create({
        data: { name, provinceId: dto.provinceId },
        include: { province: { select: { name: true } } },
      });
      return toDetail(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          message: `A center named "${name}" already exists in this province`,
          error: 'CENTER_NAME_TAKEN',
        });
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateCenterDto): Promise<CenterDetail> {
    await this.getById(id);
    if (dto.provinceId !== undefined) {
      await this.assertProvinceExists(dto.provinceId);
    }
    const data: Prisma.CenterUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.provinceId !== undefined) {
      data.province = { connect: { id: dto.provinceId } };
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    try {
      const row = await this.prisma.center.update({
        where: { id },
        data,
        include: { province: { select: { name: true } } },
      });
      return toDetail(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          message: `A center named "${dto.name}" already exists in this province`,
          error: 'CENTER_NAME_TAKEN',
        });
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.center.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!row) {
      throw new NotFoundException({ message: 'Center not found', error: 'NOT_FOUND' });
    }

    const [users, registrations, tournaments] = await Promise.all([
      this.prisma.user.count({ where: { centerId: id } }),
      this.prisma.registration.count({ where: { centerId: id } }),
      this.prisma.tournamentCenter.count({ where: { centerId: id } }),
    ]);

    if (users > 0 || registrations > 0 || tournaments > 0) {
      const parts: string[] = [];
      if (users > 0) parts.push(`${users} user(s)`);
      if (registrations > 0) parts.push(`${registrations} registration(s)`);
      if (tournaments > 0) parts.push(`${tournaments} tournament(s)`);
      throw new ConflictException({
        message:
          `Cannot delete Center "${row.name}": referenced by ${parts.join(', ')}. ` +
          'Archive the center by setting isActive to false instead.',
        error: 'CENTER_IN_USE',
        references: { users, registrations, tournaments },
      });
    }

    await this.prisma.center.delete({ where: { id } });
  }

  private async assertProvinceExists(provinceId: string): Promise<void> {
    const province = await this.prisma.province.findUnique({
      where: { id: provinceId },
      select: { id: true },
    });
    if (!province) {
      throw new BadRequestException({
        message: 'Province not found',
        error: 'INVALID_PROVINCE',
      });
    }
  }
}
