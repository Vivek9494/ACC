import {
  type AuthUser,
  type ExternalPlayerView,
  type MatchDetail,
  type MatchListItem,
  type MatchSummary,
  Permission,
  type RoundRobinMatchSetupContext,
  type SquadCandidate,
} from '@acc/types';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../auth/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { AddOpponentPlayerDto } from './dto/add-opponent-player.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { FinalizeBothPlayingXiDto } from './dto/finalize-both-playing-xi.dto';
import { LockPlayingXiDto } from './dto/lock-playing-xi.dto';
import { RecordTossDto } from './dto/record-toss.dto';
import { AssignScorerDto, HandoverScorerDto, SwapMatchScorerDto } from './dto/scorer.dto';
import { StartMatchSetupDto } from './dto/start-match-setup.dto';
import { TransitionMatchStateDto } from './dto/transition-match-state.dto';
import { DelayMatchDto } from './dto/delay-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchesService } from './matches.service';

/** Match setup endpoints (spec §5.2, §11). */
@Controller()
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly auth: AuthService,
  ) {}

  @Post('tournaments/:tournamentId/matches')
  create(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateMatchDto,
  ): Promise<MatchDetail> {
    return this.matches.create(user, tournamentId, dto);
  }

  @Get('tournaments/:tournamentId/matches/round-robin-setup')
  roundRobinSetup(
    @Param('tournamentId') tournamentId: string,
  ): Promise<RoundRobinMatchSetupContext> {
    return this.matches.getRoundRobinSetupContext(tournamentId);
  }

  @Get('tournaments/:tournamentId/matches')
  async list(
    @Param('tournamentId') tournamentId: string,
    @Query('teamId') teamId: string | undefined,
    @Req() req: Request,
  ): Promise<MatchListItem[]> {
    const viewer = await this.auth.resolveOptionalUser(req);
    return this.matches.list(tournamentId, teamId?.trim() || undefined, viewer);
  }

  @Patch('matches/:matchId')
  @RequirePermission(Permission.EDIT_MATCH)
  @UseGuards(PermissionGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: UpdateMatchDto,
  ): Promise<MatchDetail> {
    return this.matches.update(user, matchId, dto);
  }

  @Delete('matches/:matchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(Permission.DELETE_MATCH)
  @UseGuards(PermissionGuard)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
  ): Promise<void> {
    await this.matches.remove(user, matchId);
  }

  @Get('matches/:matchId')
  @Public()
  async detail(@Param('matchId') matchId: string, @Req() req: Request): Promise<MatchDetail> {
    const viewer = await this.auth.resolveOptionalUser(req);
    return this.matches.getDetail(matchId, viewer);
  }

  @Get('matches/:matchId/squad-candidates')
  candidates(
    @Param('matchId') matchId: string,
    @Query('teamId') teamId: string,
  ): Promise<SquadCandidate[]> {
    if (!teamId) {
      throw new BadRequestException({ message: 'teamId is required', error: 'TEAM_ID_REQUIRED' });
    }
    return this.matches.squadCandidates(matchId, teamId);
  }

  @Post('matches/:matchId/playing-xi')
  @RequirePermission(Permission.SELECT_PLAYING_11)
  @UseGuards(PermissionGuard)
  lockPlayingXi(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: LockPlayingXiDto,
  ): Promise<MatchDetail> {
    return this.matches.lockPlayingXi(user, matchId, dto);
  }

  @Post('matches/:matchId/playing-xi/finalize-both')
  finalizeBothPlayingXi(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: FinalizeBothPlayingXiDto,
  ): Promise<MatchDetail> {
    return this.matches.finalizeBothPlayingXi(user, matchId, dto);
  }

  @Post('matches/:matchId/opponent-players')
  addOpponentPlayer(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: AddOpponentPlayerDto,
  ): Promise<ExternalPlayerView> {
    return this.matches.addOpponentPlayer(user, matchId, dto.name);
  }

  @Delete('matches/:matchId/opponent-players/:playerId')
  removeOpponentPlayer(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('playerId') playerId: string,
  ): Promise<MatchDetail> {
    return this.matches.removeOpponentPlayer(user, matchId, playerId);
  }

  @Post('matches/:matchId/toss')
  recordToss(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: RecordTossDto,
  ): Promise<MatchDetail> {
    return this.matches.recordToss(user, matchId, dto);
  }

  @Post('matches/:matchId/start-scoring')
  @RequirePermission(Permission.START_MATCH)
  @UseGuards(PermissionGuard)
  startScoring(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: RecordTossDto,
  ): Promise<MatchDetail> {
    return this.matches.startScoring(user, matchId, dto);
  }

  @Post('matches/:matchId/start-setup')
  @RequirePermission(Permission.START_MATCH)
  @UseGuards(PermissionGuard)
  startMatchSetup(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: StartMatchSetupDto,
  ): Promise<MatchDetail> {
    return this.matches.startMatchSetup(user, matchId, dto);
  }

  @Post('matches/:matchId/status')
  transition(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: TransitionMatchStateDto,
  ): Promise<MatchDetail> {
    return this.matches.transition(user, matchId, dto.state);
  }

  @Post('matches/:matchId/delay')
  delayMatch(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: DelayMatchDto,
  ): Promise<MatchDetail> {
    return this.matches.applyDelay(user, matchId, dto.delayMinutes);
  }

  @Post('matches/:matchId/scorer')
  assignScorer(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: AssignScorerDto,
  ): Promise<MatchDetail> {
    return this.matches.assignScorer(user, matchId, dto);
  }

  @Post('matches/:matchId/scorer/swap')
  swapMatchScorer(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: SwapMatchScorerDto,
  ): Promise<MatchDetail> {
    return this.matches.swapMatchScorer(user, matchId, dto);
  }

  @Post('matches/:matchId/scorer/handover')
  @RequirePermission(Permission.REVOKE_SCORER)
  @UseGuards(PermissionGuard)
  handoverScorer(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: HandoverScorerDto,
  ): Promise<MatchDetail> {
    return this.matches.handoverScorer(user, matchId, dto);
  }

  @Delete('matches/:matchId/scorer/:userId')
  @RequirePermission(Permission.REVOKE_SCORER)
  @UseGuards(PermissionGuard)
  revokeScorer(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Param('userId') userId: string,
  ): Promise<MatchDetail> {
    return this.matches.revokeScorer(user, matchId, userId);
  }
}
