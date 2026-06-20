import type { MyMatchesResponse } from '@acc/types';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { MyMatchesService } from './my-matches.service';

@Controller('my-matches')
@UseGuards(JwtAuthGuard)
export class MyMatchesController {
  constructor(private readonly myMatches: MyMatchesService) {}

  /** Matches where the user is in the locked Playing XI (or rostered pre-lock). */
  @Get()
  list(@Req() req: AuthenticatedRequest): Promise<MyMatchesResponse> {
    return this.myMatches.listForUser(req.user.id);
  }
}
