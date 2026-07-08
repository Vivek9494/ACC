import { type BirthdayUserSummary } from '@acc/types';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from '../admin/admin.service';

/** Birthday directory — any authenticated user (read-only). */
@Controller('birthdays')
@UseGuards(JwtAuthGuard)
export class BirthdaysController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  listDirectory(): Promise<BirthdayUserSummary[]> {
    return this.admin.listBirthdayDirectory();
  }
}
