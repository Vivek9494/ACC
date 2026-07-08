import type { AuthUser, OwnPlayerMomMatchesView, OwnPlayerStatsView, ProfileDetail, UploadProfilePhotoResponse } from '@acc/types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MediaUploadCompleteDto, MediaUploadSessionDto } from '../media/dto/media-upload.dto';
import { MediaUploadService } from '../media/media-upload.service';
import { RequestProfileMobileOtpDto } from './dto/request-profile-mobile-otp.dto';
import { GetOwnPlayerStatsDto } from './dto/get-own-player-stats.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly mediaUpload: MediaUploadService,
  ) {}

  @Get()
  getProfile(@CurrentUser() user: AuthUser): Promise<ProfileDetail> {
    return this.profile.getProfile(user.id);
  }

  /** Logged-in player's overall career stats (ball-type scoped). */
  @Get('stats')
  getOwnStats(
    @CurrentUser() user: AuthUser,
    @Query() query: GetOwnPlayerStatsDto,
  ): Promise<OwnPlayerStatsView> {
    return this.profile.getOwnStats(user.id, query.ballType);
  }

  /** Logged-in player's Man of the Match awards (ball-type scoped, newest first). */
  @Get('stats/man-of-the-match')
  getOwnMomMatches(
    @CurrentUser() user: AuthUser,
    @Query() query: GetOwnPlayerStatsDto,
  ): Promise<OwnPlayerMomMatchesView> {
    return this.profile.getOwnMomMatches(user.id, query.ballType);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDetail> {
    return this.profile.updateProfile(user.id, dto);
  }

  @Post('mobile/request-otp')
  @HttpCode(HttpStatus.NO_CONTENT)
  requestMobileOtp(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestProfileMobileOtpDto,
  ): Promise<void> {
    return this.profile.requestMobileChangeOtp(user.id, dto.newMobileNumber);
  }

  @Post('photo/upload-session')
  createPhotoUploadSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: MediaUploadSessionDto,
  ) {
    return this.mediaUpload.createProfilePhotoUploadSession(user.id, dto);
  }

  @Post('photo/complete')
  async completePhotoUpload(
    @CurrentUser() user: AuthUser,
    @Body() dto: MediaUploadCompleteDto,
  ): Promise<UploadProfilePhotoResponse> {
    const result = await this.mediaUpload.completeProfilePhotoUpload(user.id, dto);
    return {
      storageKey: result.storageKey,
      profilePhotoUrl: result.displayUrl,
    };
  }
}
