import type {
  LateArrivalPenaltyActionResponse,
  PlayerLateArrivalPenaltyStatus,
  TeamOutstandingPenaltiesView,
} from '@acc/types';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '@acc/types';
import {
  CancelLateArrivalPenaltyDto,
  DesignatePenaltyServeDto,
} from './dto/late-arrival-penalty.dto';
import { LateArrivalPenaltyService } from './late-arrival-penalty.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class LateArrivalPenaltyController {
  constructor(private readonly penalties: LateArrivalPenaltyService) {}

  @Get('teams/:teamId/late-arrival-penalties/outstanding')
  listOutstanding(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
  ): Promise<TeamOutstandingPenaltiesView> {
    return this.penalties.listOutstandingForTeam(user, teamId);
  }

  @Post('teams/:teamId/late-arrival-penalties/:penaltyId/designate')
  designate(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Param('penaltyId') penaltyId: string,
    @Body() dto: DesignatePenaltyServeDto,
  ): Promise<LateArrivalPenaltyActionResponse> {
    return this.penalties.designateToServe(user, teamId, penaltyId, dto);
  }

  @Post('teams/:teamId/late-arrival-penalties/:penaltyId/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Param('penaltyId') penaltyId: string,
    @Body() dto: CancelLateArrivalPenaltyDto,
  ): Promise<LateArrivalPenaltyActionResponse> {
    return this.penalties.cancelPenalty(user, teamId, penaltyId, dto);
  }

  @Post('teams/:teamId/late-arrival-penalties/:penaltyId/undesignate')
  undesignate(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Param('penaltyId') penaltyId: string,
  ): Promise<LateArrivalPenaltyActionResponse> {
    return this.penalties.undesignateFromServe(user, teamId, penaltyId);
  }

  @Get('players/me/late-arrival-penalty-status')
  myStatus(@CurrentUser() user: AuthUser): Promise<PlayerLateArrivalPenaltyStatus> {
    return this.penalties.getPlayerStatus(user.id);
  }
}
