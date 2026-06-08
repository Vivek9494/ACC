import { type AuthUser, Permission, type ScorecardResponse } from '@acc/types';
import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { EditDeliveryDto, RecordDeliveryDto } from './dto/record-delivery.dto';
import { SetDlsTargetDto, StartInningsDto, UpdateOversAllottedDto } from './dto/innings.dto';
import { ScoringService } from './scoring.service';

/** Scoring engine endpoints (spec §12, §14). All mutations carry an
 * `expectedVersion` for optimistic concurrency (§12.3). The scorecard read is
 * public so Guests can view the live score with no auth (spec §2). */
@Controller('matches/:matchId')
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  /** Public, guest-readable live scorecard snapshot (spec §2, §28). */
  @Get('scorecard')
  scorecard(@Param('matchId') matchId: string): Promise<ScorecardResponse> {
    return this.scoring.getScorecard(matchId);
  }

  @Post('innings')
  @RequirePermission(Permission.SCORE_BALL)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  startInnings(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: StartInningsDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.startInnings(user, matchId, dto);
  }

  @Post('innings/:inningsId/deliveries')
  @RequirePermission(Permission.SCORE_BALL)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  recordDelivery(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
    @Body() dto: RecordDeliveryDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.recordDelivery(user, matchId, inningsId, dto);
  }

  @Put('deliveries')
  @RequirePermission(Permission.EDIT_PREVIOUS_OVER)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  editDelivery(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: EditDeliveryDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.editDelivery(user, matchId, dto);
  }

  @Put('dls-target')
  @RequirePermission(Permission.ENTER_DLS_TARGET)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  setDlsTarget(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: SetDlsTargetDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.setDlsTarget(user, matchId, dto);
  }

  @Patch('overs-allotted')
  @RequirePermission(Permission.SCORE_BALL)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  setOversAllotted(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: UpdateOversAllottedDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.setOversAllotted(user, matchId, dto);
  }

  // --- §13.2 post-confirmation corrections (Admin / ACC Club Manager) -------

  @Post('post-confirm/innings/:inningsId/deliveries')
  @RequirePermission(Permission.EDIT_SCORECARD_POST_CONFIRM)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  recordPostConfirm(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
    @Body() dto: RecordDeliveryDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.recordDelivery(user, matchId, inningsId, dto, { postConfirm: true });
  }

  @Put('post-confirm/deliveries')
  @RequirePermission(Permission.EDIT_SCORECARD_POST_CONFIRM)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  editPostConfirm(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: EditDeliveryDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.editDelivery(user, matchId, dto, { postConfirm: true });
  }
}
