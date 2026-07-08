import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuspensionService } from './suspension.service';

@Controller('suspensions')
@UseGuards(JwtAuthGuard)
export class SuspensionController {
  constructor(private readonly suspensions: SuspensionService) {}

  @Post(':suspensionId/carry-forward')
  async carryForward(
    @Req() req: AuthenticatedRequest,
    @Param('suspensionId') suspensionId: string,
  ): Promise<{ ok: true }> {
    await this.suspensions.carryForward(req.user, suspensionId);
    return { ok: true };
  }

  @Post(':suspensionId/cancel')
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('suspensionId') suspensionId: string,
  ): Promise<{ ok: true }> {
    await this.suspensions.cancel(req.user, suspensionId);
    return { ok: true };
  }
}
