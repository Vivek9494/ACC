import { type AuthUser, BallType, TournamentType, UserRole } from '@acc/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentWhere } from './tournament-query';

/** Tennis tournament types scoped by {@link TournamentCenter} participation. */
const PARTICIPATING_CENTER_TENNIS_TYPES: TournamentType[] = [
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
          type: { in: PARTICIPATING_CENTER_TENNIS_TYPES },
        },
      },
      select: { tournamentId: true },
    });
    return [...new Set(links.map((row) => row.tournamentId))];
  }

  /** Admin and Club Manager manage across centers — no participation filter. */
  bypassesCenterTournamentScope(viewer: AuthUser | null | undefined): boolean {
    return viewer?.role === UserRole.Admin || viewer?.role === UserRole.ClubManager;
  }

  /**
   * Centers that count for APL/CENTER visibility: home center plus any
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

  private requiresParticipatingCenter(type: string): boolean {
    return (
      type === TournamentType.APL || type === TournamentType.Center
    );
  }

  /**
   * Prisma `where` fragment for tournament lists: APL and CENTER only when
   * linked to one of the viewer's centers. ACC / Leather unchanged.
   * Returns `null` when the viewer bypasses the filter (Admin/CM).
   */
  centerTournamentListWhere(
    viewer: AuthUser | null | undefined,
  ): Prisma.TournamentWhereInput | null {
    if (this.bypassesCenterTournamentScope(viewer)) {
      return null;
    }
    if (!viewer) {
      return { type: { notIn: PARTICIPATING_CENTER_TENNIS_TYPES } };
    }
    const centerIds = this.viewerParticipatingCenterIds(viewer);
    if (centerIds.length === 0) {
      return { type: { notIn: PARTICIPATING_CENTER_TENNIS_TYPES } };
    }
    return {
      OR: [
        { type: { notIn: PARTICIPATING_CENTER_TENNIS_TYPES } },
        {
          type: { in: PARTICIPATING_CENTER_TENNIS_TYPES },
          centerLinks: { some: { centerId: { in: centerIds } } },
        },
      ],
    };
  }

  /**
   * APL and CENTER tennis tournaments are visible only when the viewer's center
   * participates (Admin/CM bypass).
   *
   * When `allowUnauthenticated` is true (e.g. public live match-by-id), guests
   * may proceed; authenticated non-participants are still denied.
   */
  async assertCanViewCenterLevelTournament(
    viewer: AuthUser | null | undefined,
    tournament: { id: string; type: string },
    options: { allowUnauthenticated?: boolean } = {},
  ): Promise<void> {
    if (!this.requiresParticipatingCenter(tournament.type)) {
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
   * Match-list / featured-match filter: hide APL/CENTER fixtures from
   * non-participating authenticated users. Guests and Admin/CM are unchanged
   * (guests keep all ids; callers that need guest hide use list where).
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
      if (!this.requiresParticipatingCenter(row.type)) {
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
