import type { AuthUser, ProfileDetail, UploadProfilePhotoResponse } from '@acc/types';
import {
  Body,
  Controller,
  Get,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SIGNUP_PROFILE_PHOTO_MAX_BYTES } from '@acc/types';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestProfileMobileOtpDto } from './dto/request-profile-mobile-otp.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthUser): Promise<ProfileDetail> {
    return this.profile.getProfile(user.id);
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

  @Post('photo')
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: SIGNUP_PROFILE_PHOTO_MAX_BYTES } }),
  )
  async uploadPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<UploadProfilePhotoResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ message: 'Profile photo is required' });
    }
    const profilePhotoUrl = await this.profile.uploadProfilePhoto(user.id, file.buffer);
    return { profilePhotoUrl };
  }
}
