import type { CenterDetail, CenterSummary } from '@acc/types';
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
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CentersService } from './centers.service';
import { CreateCenterDto } from './dto/create-center.dto';
import { UpdateCenterDto } from './dto/update-center.dto';

@Controller('centers')
export class CentersController {
  constructor(private readonly centers: CentersService) {}

  /** Active centers for signup and tournament dropdowns (no auth). */
  @Get()
  listActive(@Query('provinceId') provinceId?: string): Promise<CenterSummary[]> {
    return this.centers.listActive(provinceId);
  }

  /** Full center list for Admin management (includes archived). */
  @Get('admin')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_CENTERS)
  listAdmin(@Query('provinceId') provinceId?: string): Promise<CenterDetail[]> {
    return this.centers.listAdmin(provinceId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getById(@Param('id') id: string): Promise<CenterDetail> {
    return this.centers.getById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_CENTERS)
  create(@Body() dto: CreateCenterDto): Promise<CenterDetail> {
    return this.centers.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_CENTERS)
  update(@Param('id') id: string, @Body() dto: UpdateCenterDto): Promise<CenterDetail> {
    return this.centers.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_CENTERS)
  async remove(@Param('id') id: string): Promise<void> {
    await this.centers.remove(id);
  }
}
