import type { GuestDashboard } from '@acc/types';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { GuestService } from './guest.service';

@Controller('guest')
@UseGuards(JwtAuthGuard)
export class GuestController {
  constructor(private readonly guest: GuestService) {}

  /** Public read-only guest home payload (spec §2). */
  @Get('dashboard')
  @Public()
  dashboard(): Promise<GuestDashboard> {
    return this.guest.getDashboard();
  }
}
