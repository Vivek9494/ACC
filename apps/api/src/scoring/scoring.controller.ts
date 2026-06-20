import { type AuthUser, Permission, type ScorecardResponse, type BatsmanPickerResponse, type BowlerPickerResponse, type FielderPickerResponse, type ExternalPlayerView } from '@acc/types';
import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { EditDeliveryDto, RecordDeliveryDto } from './dto/record-delivery.dto';
import { BatsmanPickerQueryDto } from './dto/batsman-picker.dto';
import { FielderPickerQueryDto } from './dto/fielder-picker.dto';
import { AddExternalBatsmanDto } from './dto/add-external-batsman.dto';
import { AddExternalBowlerDto } from './dto/add-external-bowler.dto';
import { SetDlsTargetDto, SetInningsParticipantsDto, StartInningsDto, UpdateOversAllottedDto, EndInningsDto } from './dto/innings.dto';
import { UndoDeliveryDto } from './dto/undo-delivery.dto';
import { BatsmanPickerService } from './batsman-picker.service';
import { BowlerPickerService } from './bowler-picker.service';
import { FielderPickerService } from './fielder-picker.service';
import { ScoringService } from './scoring.service';

/** Scoring engine endpoints (spec §12, §14). All mutations carry an
 * `expectedVersion` for optimistic concurrency (§12.3). The scorecard read is
 * public so Guests can view the live score with no auth (spec §2). */
@Controller('matches/:matchId')
export class ScoringController {
  constructor(
    private readonly scoring: ScoringService,
    private readonly batsmanPicker: BatsmanPickerService,
    private readonly bowlerPicker: BowlerPickerService,
    private readonly fielderPicker: FielderPickerService,
  ) {}

  /** Public, guest-readable live scorecard snapshot (spec §2, §28). */
  @Get('scorecard')
  scorecard(@Param('matchId') matchId: string): Promise<ScorecardResponse> {
    return this.scoring.getScorecard(matchId);
  }

  /** State-aware Select Batsman picker rows (derived innings + squad profiles). */
  @Get('innings/:inningsId/batsman-picker')
  @RequirePermission(Permission.SCORE_BALL)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  getBatsmanPicker(
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
    @Query() query: BatsmanPickerQueryDto,
  ): Promise<BatsmanPickerResponse> {
    return this.batsmanPicker.getPicker(matchId, inningsId, query.role, {
      otherSlotUserId: query.otherSlotUserId ?? null,
    });
  }

  /** §9.5: add a name-only batter to the external opponent's match roster. */
  @Post('innings/:inningsId/external-batsmen')
  @RequirePermission(Permission.ENTER_EXTERNAL_PLAYERS)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  addExternalBatsman(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
    @Body() dto: AddExternalBatsmanDto,
  ): Promise<ExternalPlayerView> {
    return this.batsmanPicker.addExternalBatsman(user, matchId, inningsId, dto);
  }

  /** State-aware Select Bowler picker rows (derived innings + squad profiles). */
  @Get('innings/:inningsId/bowler-picker')
  @RequirePermission(Permission.SCORE_BALL)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  getBowlerPicker(
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
  ): Promise<BowlerPickerResponse> {
    return this.bowlerPicker.getPicker(matchId, inningsId);
  }

  /** §9.5: add a name-only bowler to the external opponent's match roster. */
  @Post('innings/:inningsId/external-bowlers')
  @RequirePermission(Permission.ENTER_EXTERNAL_PLAYERS)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  addExternalBowler(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
    @Body() dto: AddExternalBowlerDto,
  ): Promise<ExternalPlayerView> {
    return this.bowlerPicker.addExternalBowler(user, matchId, inningsId, dto);
  }

  /** Bowling squad list for caught / run-out / stumped fielder selection. */
  @Get('innings/:inningsId/fielder-picker')
  @RequirePermission(Permission.SCORE_BALL)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  getFielderPicker(
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
    @Query() query: FielderPickerQueryDto,
  ): Promise<FielderPickerResponse> {
    return this.fielderPicker.getPicker(matchId, inningsId, {
      excludeBowler: query.excludeBowler === true,
    });
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

  @Post('innings/:inningsId/deliveries/undo')
  @RequirePermission(Permission.SCORE_BALL)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  undoLastDelivery(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
    @Body() dto: UndoDeliveryDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.undoLastDelivery(user, matchId, inningsId, dto);
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

  @Post('innings/:inningsId/end')
  @RequirePermission(Permission.SCORE_BALL)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  endInnings(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
    @Body() dto: EndInningsDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.endInnings(user, matchId, inningsId, dto);
  }

  @Patch('innings/:inningsId/participants')
  @RequirePermission(Permission.SCORE_BALL)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  setInningsParticipants(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('inningsId') inningsId: string,
    @Body() dto: SetInningsParticipantsDto,
  ): Promise<ScorecardResponse> {
    return this.scoring.setInningsParticipants(user, matchId, inningsId, dto);
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
