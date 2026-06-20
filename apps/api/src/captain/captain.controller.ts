import type { CaptainDashboard } from '@acc/types';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { CaptainRoleGuard } from './captain-role.guard';
import { CaptainService } from './captain.service';

@Controller('captain')
@UseGuards(JwtAuthGuard, CaptainRoleGuard)
export class CaptainController {
  constructor(private readonly captain: CaptainService) {}

  @Get('dashboard')
  dashboard(@Req() req: AuthenticatedRequest): Promise<CaptainDashboard> {
    return this.captain.getDashboard(req.user);
  }
}
