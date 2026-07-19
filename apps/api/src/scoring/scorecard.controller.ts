import {
  type AuthUser,
  Permission,
  type ManOfMatchEligibilityView,
  type ScorecardConfirmEligibilityView,
  type ScorecardConfirmationView,
} from '@acc/types';
import {
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Body } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { ConfirmScorecardDto, SelectManOfMatchDto } from './dto/scorecard.dto';
import { ScorecardConfirmationService } from './scorecard-confirmation.service';
import { ScorecardPdfService } from './scorecard-pdf.service';

/**
 * Scorecard confirmation & post-match endpoints (spec §13, §16). The PDF export
 * is public (guest-accessible — §16); confirmation and Man of the Match are
 * RBAC-gated by the existing permission guard.
 */
@Controller('matches/:matchId')
export class ScorecardController {
  constructor(
    private readonly confirmation: ScorecardConfirmationService,
    private readonly pdf: ScorecardPdfService,
  ) {}

  /** Public confirmation status (drives the lazy auto-confirm safety-net). */
  @Get('confirmation')
  @Public()
  status(@Param('matchId') matchId: string): Promise<ScorecardConfirmationView> {
    return this.confirmation.status(matchId);
  }

  /** §13.1: Captain / VC confirms the scorecard, locking the match. */
  @Post('confirm-scorecard')
  @RequirePermission(Permission.CONFIRM_SCORECARD)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: ConfirmScorecardDto,
  ): Promise<ScorecardConfirmationView> {
    return this.confirmation.confirm(user, matchId, dto.expectedVersion);
  }

  /** Whether the authenticated user may confirm this scorecard (§13.1). */
  @Get('confirm-scorecard/eligibility')
  @UseGuards(JwtAuthGuard)
  confirmEligibility(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
  ): Promise<ScorecardConfirmEligibilityView> {
    return this.confirmation.confirmEligibility(user, matchId);
  }

  /** §13.3: Captain selects the Man of the Match after the game. */
  @Put('man-of-the-match')
  @RequirePermission(Permission.SELECT_MAN_OF_MATCH)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  manOfTheMatch(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: SelectManOfMatchDto,
  ): Promise<ScorecardConfirmationView> {
    return this.confirmation.selectManOfMatch(user, matchId, dto.userId);
  }

  /** Whether the authenticated user may award Man of the Match on this match (§13.3). */
  @Get('man-of-the-match/eligibility')
  @RequirePermission(Permission.SELECT_MAN_OF_MATCH)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  manOfMatchEligibility(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
  ): Promise<ManOfMatchEligibilityView> {
    return this.confirmation.manOfMatchEligibility(user, matchId);
  }

  /** §16: public, guest-accessible scorecard export for a completed match. */
  @Get('scorecard.pdf')
  @Public()
  @Header('Cache-Control', 'no-store')
  async exportPdf(
    @Param('matchId') matchId: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.pdf.export(matchId, format === 'html');
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename.replace(/"/g, '')}"`);
    res.send(doc.body);
  }
}
