import type { ProvinceDetail, ProvinceSummary } from '@acc/types';
import { Permission } from '@acc/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CreateProvinceDto } from './dto/create-province.dto';
import { UpdateProvinceDto } from './dto/update-province.dto';
import { ProvincesService } from './provinces.service';

@Controller('provinces')
export class ProvincesController {
  constructor(private readonly provinces: ProvincesService) {}

  /** Active provinces for signup and tournament dropdowns (no auth). */
  @Get()
  listActive(): Promise<ProvinceSummary[]> {
    return this.provinces.listActive();
  }

  /** Full province list for Admin management (includes archived). */
  @Get('admin')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_PROVINCES)
  listAdmin(): Promise<ProvinceDetail[]> {
    return this.provinces.listAdmin();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getById(@Param('id') id: string): Promise<ProvinceDetail> {
    return this.provinces.getById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_PROVINCES)
  create(@Body() dto: CreateProvinceDto): Promise<ProvinceDetail> {
    return this.provinces.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_PROVINCES)
  update(@Param('id') id: string, @Body() dto: UpdateProvinceDto): Promise<ProvinceDetail> {
    return this.provinces.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_PROVINCES)
  async remove(@Param('id') id: string): Promise<void> {
    await this.provinces.remove(id);
  }
}
