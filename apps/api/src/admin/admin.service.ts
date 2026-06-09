import type { AdminOverview } from '@acc/types';
import { RegistrationStatus, TournamentState } from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AdminOverview> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const [
      provinceCount,
      centerCount,
      activeTournamentCount,
      totalUserCount,
      tournamentCount,
      matchesTodayCount,
      pendingApprovalsCount,
    ] = await Promise.all([
      this.prisma.province.count({ where: { isActive: true } }),
      this.prisma.center.count({ where: { isActive: true } }),
      this.prisma.tournament.count({
        where: { state: { not: TournamentState.Completed } },
      }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.tournament.count(),
      this.prisma.match.count({
        where: {
          matchDate: { gte: todayStart, lt: todayEnd },
        },
      }),
      this.prisma.registration.count({
        where: { status: RegistrationStatus.InWaitlist },
      }),
    ]);

    return {
      provinceCount,
      centerCount,
      activeTournamentCount,
      totalUserCount,
      tournamentCount,
      matchesTodayCount,
      pendingApprovalsCount,
    };
  }
}
