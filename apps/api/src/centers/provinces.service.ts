import type { ProvinceDetail, ProvinceSummary } from '@acc/types';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateProvinceDto } from './dto/create-province.dto';
import type { UpdateProvinceDto } from './dto/update-province.dto';

function toDetail(row: {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { centers: number };
}): ProvinceDetail {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    centerCount: row._count.centers,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProvincesService {
  constructor(private readonly prisma: PrismaService) {}

  listActive(): Promise<ProvinceSummary[]> {
    return this.prisma.province.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  listAdmin(): Promise<ProvinceDetail[]> {
    return this.prisma.province
      .findMany({
        include: { _count: { select: { centers: true } } },
        orderBy: { name: 'asc' },
      })
      .then((rows) => rows.map(toDetail));
  }

  async getById(id: string): Promise<ProvinceDetail> {
    const row = await this.prisma.province.findUnique({
      where: { id },
      include: { _count: { select: { centers: true } } },
    });
    if (!row) {
      throw new NotFoundException({ message: 'Province not found', error: 'NOT_FOUND' });
    }
    return toDetail(row);
  }

  async create(dto: CreateProvinceDto): Promise<ProvinceDetail> {
    const name = dto.name.trim();
    try {
      const row = await this.prisma.province.create({
        data: { name },
        include: { _count: { select: { centers: true } } },
      });
      return toDetail(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          message: `A province named "${name}" already exists`,
          error: 'PROVINCE_NAME_TAKEN',
        });
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateProvinceDto): Promise<ProvinceDetail> {
    await this.getById(id);
    const data: Prisma.ProvinceUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    try {
      const row = await this.prisma.province.update({
        where: { id },
        data,
        include: { _count: { select: { centers: true } } },
      });
      return toDetail(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          message: `A province named "${dto.name}" already exists`,
          error: 'PROVINCE_NAME_TAKEN',
        });
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.province.findUnique({
      where: { id },
      include: { _count: { select: { centers: true } } },
    });
    if (!row) {
      throw new NotFoundException({ message: 'Province not found', error: 'NOT_FOUND' });
    }
    if (row._count.centers > 0) {
      throw new ConflictException({
        message:
          `Cannot delete Province "${row.name}": it still has ${row._count.centers} center(s). ` +
          'Remove or reassign those centers first, or archive the province by setting isActive to false.',
        error: 'PROVINCE_HAS_CENTERS',
        references: { centers: row._count.centers },
      });
    }
    await this.prisma.province.delete({ where: { id } });
  }
}
