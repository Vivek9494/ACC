import {
  type PlayerSkillVideoPlaybackView,
  type PlayerSkillVideoSummary,
  type PlayerSkillVideoUploadSessionResponse,
} from '@acc/types';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@acc/types';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  PlayerSkillVideoCompleteUploadDto,
  PlayerSkillVideoUploadSessionDto,
} from './dto/player-skill-video.dto';
import { PlayerSkillVideosService } from './player-skill-videos.service';

@Controller('tournaments/:tournamentId/skill-videos')
@UseGuards(JwtAuthGuard)
export class PlayerSkillVideosController {
  constructor(private readonly videos: PlayerSkillVideosService) {}

  @Get('me')
  getMyVideo(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
  ): Promise<PlayerSkillVideoSummary | null> {
    return this.videos.getMyVideo(user, tournamentId);
  }

  @Get(':userId/playback')
  getScoutingPlayback(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Param('userId') userId: string,
  ): Promise<PlayerSkillVideoPlaybackView> {
    return this.videos.getScoutingPlayback(user, tournamentId, userId);
  }

  @Post('upload-session')
  createUploadSession(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: PlayerSkillVideoUploadSessionDto,
  ): Promise<PlayerSkillVideoUploadSessionResponse> {
    return this.videos.createUploadSession(user, tournamentId, dto);
  }

  @Post('complete')
  completeUpload(
    @CurrentUser() user: AuthUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: PlayerSkillVideoCompleteUploadDto,
  ): Promise<PlayerSkillVideoSummary> {
    return this.videos.completeUpload(user, tournamentId, dto);
  }
}
