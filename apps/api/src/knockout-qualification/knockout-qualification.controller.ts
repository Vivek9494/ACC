import { type KnockoutQualificationResponse } from '@acc/types';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KnockoutQualificationService } from './knockout-qualification.service';

@Controller('tournaments/:tournamentId/knockout-qualification')
@UseGuards(JwtAuthGuard)
export class KnockoutQualificationController {
  constructor(private readonly qualification: KnockoutQualificationService) {}

  @Get()
  getQualification(
    @Param('tournamentId') tournamentId: string,
  ): Promise<KnockoutQualificationResponse> {
    return this.qualification.getQualification(tournamentId);
  }
}
