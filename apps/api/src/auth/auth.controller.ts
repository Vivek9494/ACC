import type { AuthResponse, AuthTokens, AuthUser, ChangePasswordResponse, CompleteForcedPasswordChangeResponse } from '@acc/types';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { AllowMustChangePassword } from './allow-must-change-password.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompleteForcedPasswordChangeDto } from './dto/complete-forced-password-change.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto): Promise<AuthResponse> {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @AllowMustChangePassword()
  logout(@CurrentUser() user: AuthUser): Promise<void> {
    return this.authService.logout(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowMustChangePassword()
  me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.authService.getMe(user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword).then(() => ({
      success: true as const,
    }));
  }

  @Post('complete-forced-password-change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @AllowMustChangePassword()
  completeForcedPasswordChange(
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteForcedPasswordChangeDto,
  ): Promise<CompleteForcedPasswordChangeResponse> {
    return this.authService
      .completeForcedPasswordChange(user.id, dto.newPassword)
      .then(() => ({ success: true as const }));
  }
}
