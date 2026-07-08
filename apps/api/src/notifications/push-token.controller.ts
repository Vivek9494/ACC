import type { AuthUser } from '@acc/types';
import { Body, Controller, Delete, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterPushTokenDto, UnregisterPushTokenDto } from './dto/register-push-token.dto';
import { PushTokenService } from './push-token.service';

/** Device-token registration for FCM push (§17). */
@Controller('notifications/device-tokens')
@UseGuards(JwtAuthGuard)
export class PushTokenController {
  constructor(private readonly tokens: PushTokenService) {}

  /** Register/refresh this device's push token for the logged-in user. */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<void> {
    await this.tokens.register(user.id, dto.token, dto.platform);
  }

  /** Unregister this device's push token (on logout). */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregister(@Body() dto: UnregisterPushTokenDto): Promise<void> {
    await this.tokens.unregister(dto.token);
  }
}
