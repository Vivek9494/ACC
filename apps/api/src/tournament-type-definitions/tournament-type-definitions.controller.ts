import type {
  TournamentTypeDefinitionDetail,
  TournamentTypeDefinitionSummary,
} from '@acc/types';
import { type AuthUser, Permission } from '@acc/types';
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

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import {
  CreateTournamentTypeDefinitionDto,
  UpdateTournamentTypeDefinitionDto,
} from './dto/tournament-type-definition.dto';
import { TournamentTypeDefinitionsService } from './tournament-type-definitions.service';

@Controller('admin/tournament-types')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(Permission.MANAGE_CENTERS)
export class TournamentTypeDefinitionsController {
  constructor(private readonly definitions: TournamentTypeDefinitionsService) {}

  @Get()
  list(): Promise<TournamentTypeDefinitionSummary[]> {
    return this.definitions.list();
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<TournamentTypeDefinitionDetail> {
    return this.definitions.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTournamentTypeDefinitionDto,
  ): Promise<TournamentTypeDefinitionDetail> {
    return this.definitions.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTournamentTypeDefinitionDto,
  ): Promise<TournamentTypeDefinitionDetail> {
    return this.definitions.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.definitions.softDelete(user, id);
  }
}
