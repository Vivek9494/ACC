import {
  BallType,
  type TournamentTypeDefinitionCatalogEntry,
} from '@acc/types';
import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TournamentTypeDefinitionsService } from './tournament-type-definitions.service';

/**
 * Authenticated catalog for Create Tournament — any signed-in creator can list
 * types for a province (Admin Geography CRUD stays on /admin/tournament-types).
 */
@Controller('tournament-types')
@UseGuards(JwtAuthGuard)
export class TournamentTypesCatalogController {
  constructor(private readonly definitions: TournamentTypeDefinitionsService) {}

  @Get()
  list(
    @Query('provinceId') provinceId: string,
    @Query('ballType') ballType?: string,
  ): Promise<TournamentTypeDefinitionCatalogEntry[]> {
    if (!provinceId?.trim()) {
      throw new BadRequestException({
        message: 'provinceId is required',
        error: 'PROVINCE_REQUIRED',
      });
    }
    const resolvedBallType =
      ballType === BallType.Tennis || ballType === BallType.Leather
        ? ballType
        : undefined;
    return this.definitions.listCatalogForProvince(provinceId.trim(), resolvedBallType);
  }
}
