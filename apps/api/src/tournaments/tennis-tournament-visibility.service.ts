import { BallType, TournamentType } from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentWhere } from './tournament-query';

/** Tennis tournament types surfaced on dashboards by center participation. */
const DASHBOARD_TENNIS_TYPES: TournamentType[] = [
  TournamentType.APL,
  TournamentType.Center,
];

@Injectable()
export class TennisTournamentVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active APL / Center-level tennis tournaments linked to a center via
   * {@link TournamentCenter} — used so involved-center users can discover and register.
   */
  async getCenterParticipatingTournamentIds(centerId: string): Promise<string[]> {
    const links = await this.prisma.tournamentCenter.findMany({
      where: {
        centerId,
        tournament: {
          ...activeTournamentWhere,
          ballType: BallType.Tennis,
          type: { in: DASHBOARD_TENNIS_TYPES },
        },
      },
      select: { tournamentId: true },
    });
    return [...new Set(links.map((row) => row.tournamentId))];
  }
}
