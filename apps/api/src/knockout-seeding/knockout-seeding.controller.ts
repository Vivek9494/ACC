import { type KnockoutSeedingResponse } from '@acc/types';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KnockoutSeedingService } from './knockout-seeding.service';

@Controller('tournaments/:tournamentId/knockout-seeding')
@UseGuards(JwtAuthGuard)
export class KnockoutSeedingController {
  constructor(private readonly seeding: KnockoutSeedingService) {}

  @Get()
  getSeeding(
    @Param('tournamentId') tournamentId: string,
  ): Promise<KnockoutSeedingResponse> {
    return this.seeding.getSeeding(tournamentId);
  }
}
