import { type AuthUser, type VerifyResetOtpResponse, UserRole } from '@acc/types';
import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from './current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UnlockAccountDto } from './dto/unlock-account.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordResetService } from './password-reset.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  }
  return req.ip ?? 'unknown';
}

@Controller('auth')
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  /** Request an OTP. Always 200 so callers can't probe which numbers exist. */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    await this.passwordReset.requestOtp(dto.mobileNumber, clientIp(req));
    return { success: true };
  }

  /** Verify the OTP and issue a short-lived reset token. */
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  async verifyResetOtp(
    @Body() dto: VerifyResetOtpDto,
    @Req() req: Request,
  ): Promise<VerifyResetOtpResponse> {
    return this.passwordReset.verifyOtp(dto.mobileNumber, dto.otp, clientIp(req));
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
    await this.passwordReset.resetPassword(dto);
    return { success: true };
  }

  /** Admin/Captain/Club Manager: clear a reset lock and reset OTP counters. */
  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.Captain, UserRole.ClubManager)
  async unlock(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UnlockAccountDto,
  ): Promise<{ success: true }> {
    await this.passwordReset.unlock(actor, dto.userId);
    return { success: true };
  }
}
