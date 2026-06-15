import {
  type AuthUser,
  Permission,
  type TournamentFeeEntry,
  type TournamentFeesTracker,
} from '@acc/types';
import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { FeesService } from './fees.service';

/** Manual tournament fee tracking (§20). No payment gateway. */
@Controller('tournaments/:tournamentId/fees')
@UseGuards(JwtAuthGuard)
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  /** Role- and ball-type-scoped paid / unpaid lists. */
  @Get('tracker')
  @RequirePermission(Permission.VIEW_TOURNAMENT_FEES)
  @UseGuards(PermissionGuard)
  tracker(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<TournamentFeesTracker> {
    return this.fees.getTracker(user, tournamentId);
  }

  /** Record offline payment (manual status flip). Scope enforced in service. */
  @Post(':feeId/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.RECORD_TOURNAMENT_FEE_PAYMENT)
  @UseGuards(PermissionGuard)
  markPaid(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('feeId') feeId: string,
  ): Promise<TournamentFeeEntry> {
    return this.fees.markPaid(user, tournamentId, feeId);
  }
}
