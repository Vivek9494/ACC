import type {
  ParticipationPollCardView,
  ParticipationPollTallyView,
  PlayingXiConfirmFromPollView,
  PollPlayingXiSelectionView,
} from '@acc/types';
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ConfirmPollPlayingXiDto } from './dto/confirm-poll-playing-xi.dto';
import { PlayingXiNoShowRecoveryDto } from './dto/playing-xi-no-show-recovery.dto';
import { PlayingXiSwitchDto } from './dto/playing-xi-switch.dto';
import { SubmitParticipationPollVoteDto } from './dto/submit-participation-poll-vote.dto';
import { ParticipationPollService } from './participation-poll.service';

@Controller('participation-polls')
@UseGuards(JwtAuthGuard)
export class ParticipationPollController {
  constructor(private readonly polls: ParticipationPollService) {}

  @Post(':pollId/vote')
  vote(
    @Req() req: AuthenticatedRequest,
    @Param('pollId') pollId: string,
    @Body() dto: SubmitParticipationPollVoteDto,
  ): Promise<ParticipationPollCardView> {
    return this.polls.submitVote(req.user, pollId, dto.choice);
  }

  @Get('playing-xi-confirm')
  playingXiConfirmFromPoll(
    @Req() req: AuthenticatedRequest,
    @Query('matchId') matchId: string,
    @Query('teamId') teamId: string,
  ): Promise<PlayingXiConfirmFromPollView> {
    return this.polls.getPlayingXiConfirmFromPoll(req.user, matchId, teamId);
  }

  @Get(':pollId/tally')
  tally(
    @Req() req: AuthenticatedRequest,
    @Param('pollId') pollId: string,
  ): Promise<ParticipationPollTallyView> {
    return this.polls.getTally(req.user, pollId);
  }

  @Get(':pollId/playing-xi')
  playingXiSelection(
    @Req() req: AuthenticatedRequest,
    @Param('pollId') pollId: string,
  ): Promise<PollPlayingXiSelectionView> {
    return this.polls.getPlayingXiSelection(req.user, pollId);
  }

  @Post(':pollId/playing-xi')
  confirmPlayingXi(
    @Req() req: AuthenticatedRequest,
    @Param('pollId') pollId: string,
    @Body() dto: ConfirmPollPlayingXiDto,
  ): Promise<PollPlayingXiSelectionView> {
    return this.polls.confirmPlayingXi(req.user, pollId, dto);
  }

  @Post(':pollId/playing-xi/no-show-recovery')
  noShowRecovery(
    @Req() req: AuthenticatedRequest,
    @Param('pollId') pollId: string,
    @Body() dto: PlayingXiNoShowRecoveryDto,
  ): Promise<PollPlayingXiSelectionView> {
    return this.polls.applyNoShowRecovery(req.user, pollId, dto);
  }

  @Post(':pollId/playing-xi/switch')
  switchPlayer(
    @Req() req: AuthenticatedRequest,
    @Param('pollId') pollId: string,
    @Body() dto: PlayingXiSwitchDto,
  ): Promise<PollPlayingXiSelectionView> {
    return this.polls.applyPlayingXiSwitch(req.user, pollId, dto);
  }
}
