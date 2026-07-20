import { type AuthUser, BallType, TournamentType, UserRole } from '@acc/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

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

  /** Admin and Club Manager manage across centers — no CENTER participation filter. */
  bypassesCenterTournamentScope(viewer: AuthUser | null | undefined): boolean {
    return viewer?.role === UserRole.Admin || viewer?.role === UserRole.ClubManager;
  }

  /**
   * Centers that count for CENTER-tournament visibility: home center plus any
   * Center Sevak assignments.
   */
  viewerParticipatingCenterIds(viewer: AuthUser): string[] {
    const ids = new Set<string>();
    if (viewer.centerId) {
      ids.add(viewer.centerId);
    }
    for (const centerId of viewer.centerSevakCenterIds ?? []) {
      ids.add(centerId);
    }
    return [...ids];
  }

  /**
   * Prisma `where` fragment for tournament lists: APL/ACC/Leather unchanged;
   * CENTER rows only when linked to one of the viewer's centers.
   * Returns `null` when the viewer bypasses the filter (Admin/CM).
   */
  centerTournamentListWhere(
    viewer: AuthUser | null | undefined,
  ): Prisma.TournamentWhereInput | null {
    if (this.bypassesCenterTournamentScope(viewer)) {
      return null;
    }
    if (!viewer) {
      return { type: { not: TournamentType.Center } };
    }
    const centerIds = this.viewerParticipatingCenterIds(viewer);
    if (centerIds.length === 0) {
      return { type: { not: TournamentType.Center } };
    }
    return {
      OR: [
        { type: { not: TournamentType.Center } },
        {
          type: TournamentType.Center,
          centerLinks: { some: { centerId: { in: centerIds } } },
        },
      ],
    };
  }

  /**
   * CENTER-level tennis tournaments are visible only when the viewer's center
   * participates (Admin/CM bypass). APL and Leather are unaffected.
   *
   * When `allowUnauthenticated` is true (e.g. public live match-by-id), guests
   * may proceed; authenticated non-participants are still denied.
   */
  async assertCanViewCenterLevelTournament(
    viewer: AuthUser | null | undefined,
    tournament: { id: string; type: string },
    options: { allowUnauthenticated?: boolean } = {},
  ): Promise<void> {
    if (tournament.type !== TournamentType.Center) {
      return;
    }
    if (this.bypassesCenterTournamentScope(viewer)) {
      return;
    }
    if (!viewer) {
      if (options.allowUnauthenticated) {
        return;
      }
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
    const centerIds = this.viewerParticipatingCenterIds(viewer);
    if (centerIds.length === 0) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
    const link = await this.prisma.tournamentCenter.findFirst({
      where: {
        tournamentId: tournament.id,
        centerId: { in: centerIds },
      },
      select: { centerId: true },
    });
    if (!link) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
  }

  /**
   * Match-list / featured-match filter: hide CENTER tournament fixtures from
   * non-participating authenticated users. Guests and Admin/CM are unchanged.
   */
  async filterTournamentIdsVisibleToViewer(
    viewer: AuthUser | null | undefined,
    tournamentIds: string[],
  ): Promise<Set<string>> {
    const uniqueIds = [...new Set(tournamentIds)];
    if (uniqueIds.length === 0) {
      return new Set();
    }
    if (this.bypassesCenterTournamentScope(viewer) || !viewer) {
      return new Set(uniqueIds);
    }
    const centerIds = this.viewerParticipatingCenterIds(viewer);
    const rows = await this.prisma.tournament.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        type: true,
        centerLinks: { select: { centerId: true } },
      },
    });
    const visible = new Set<string>();
    for (const row of rows) {
      if (row.type !== TournamentType.Center) {
        visible.add(row.id);
        continue;
      }
      if (centerIds.length === 0) {
        continue;
      }
      if (row.centerLinks.some((link) => centerIds.includes(link.centerId))) {
        visible.add(row.id);
      }
    }
    return visible;
  }
}
