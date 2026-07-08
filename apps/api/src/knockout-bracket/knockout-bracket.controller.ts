import { Controller, Delete, Get, Param, Post, Body, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '@acc/types';
import { GenerateKnockoutBracketDto } from './dto/generate-knockout-bracket.dto';
import { KnockoutBracketService } from './knockout-bracket.service';

@Controller('tournaments/:tournamentId/knockout-bracket')
@UseGuards(JwtAuthGuard)
export class KnockoutBracketController {
  constructor(private readonly knockoutBracket: KnockoutBracketService) {}

  @Post('generate')
  generateBracket(
    @CurrentUser() actor: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: GenerateKnockoutBracketDto,
  ) {
    return this.knockoutBracket.generateKnockoutBracket(
      actor,
      tournamentId,
      dto.teamIds,
    );
  }

  @Get()
  getBracket(@Param('tournamentId') tournamentId: string) {
    return this.knockoutBracket.getBracket(tournamentId);
  }

  @Get('delete-preview')
  getDeletePreview(@Param('tournamentId') tournamentId: string) {
    return this.knockoutBracket.getDeletePreview(tournamentId);
  }

  @Delete()
  deleteBracket(
    @CurrentUser() actor: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.knockoutBracket.deleteKnockoutBracket(actor, tournamentId);
  }
}
