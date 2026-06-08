import {
  type AuthUser,
  type MatchDetail,
  type MatchSummary,
  Permission,
  type SquadCandidate,
} from '@acc/types';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../authz/permission.guard';
import { RequirePermission } from '../authz/require-permission.decorator';
import { CreateMatchDto } from './dto/create-match.dto';
import { LockPlayingXiDto } from './dto/lock-playing-xi.dto';
import { RecordTossDto } from './dto/record-toss.dto';
import { AssignScorerDto, HandoverScorerDto } from './dto/scorer.dto';
import { TransitionMatchStateDto } from './dto/transition-match-state.dto';
import { MatchesService } from './matches.service';

/** Match setup endpoints (spec §5.2, §11). */
@Controller()
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Post('tournaments/:tournamentId/matches')
  create(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateMatchDto,
  ): Promise<MatchDetail> {
    return this.matches.create(user, tournamentId, dto);
  }

  @Get('tournaments/:tournamentId/matches')
  list(@Param('tournamentId') tournamentId: string): Promise<MatchSummary[]> {
    return this.matches.list(tournamentId);
  }

  @Get('matches/:matchId')
  detail(@Param('matchId') matchId: string): Promise<MatchDetail> {
    return this.matches.getDetail(matchId);
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

  @Post('matches/:matchId/toss')
  @RequirePermission(Permission.RECORD_TOSS)
  @UseGuards(PermissionGuard)
  recordToss(
    @Param('matchId') matchId: string,
    @Body() dto: RecordTossDto,
  ): Promise<MatchDetail> {
    return this.matches.recordToss(matchId, dto);
  }

  @Post('matches/:matchId/status')
  transition(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: TransitionMatchStateDto,
  ): Promise<MatchDetail> {
    return this.matches.transition(user, matchId, dto.state);
  }

  @Post('matches/:matchId/scorer')
  assignScorer(
    @CurrentUser() user: AuthUser,
    @Param('matchId') matchId: string,
    @Body() dto: AssignScorerDto,
  ): Promise<MatchDetail> {
    return this.matches.assignScorer(user, matchId, dto);
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
