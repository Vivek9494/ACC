import { type AuthUser, BallType, TournamentType, UserRole } from '@acc/types';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentWhere } from './tournament-query';

/** Tennis tournament types that use {@link TournamentCenter} participation for actions. */
const PARTICIPATING_CENTER_TENNIS_TYPES: TournamentType[] = [
  TournamentType.APL,
  TournamentType.Center,
];

@Injectable()
export class TennisTournamentVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active APL / Center-level tennis tournaments linked to a center via
   * {@link TournamentCenter} — used for registration / action eligibility.
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

  /** Admin and Club Manager act across all centers. */
  bypassesCenterTournamentScope(viewer: AuthUser | null | undefined): boolean {
    return viewer?.role === UserRole.Admin || viewer?.role === UserRole.ClubManager;
  }

  /**
   * Centers that count for APL/CENTER participation: home center plus any
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

  requiresParticipatingCenter(type: string): boolean {
    return type === TournamentType.APL || type === TournamentType.Center;
  }

  /**
   * Tennis tournaments are visible to everyone (read-only for non-participants).
   * Always returns `null` — no list filter. Leather visibility is separate.
   */
  centerTournamentListWhere(
    _viewer: AuthUser | null | undefined,
  ): Prisma.TournamentWhereInput | null {
    return null;
  }

  /**
   * Tennis APL/CENTER detail and related reads are public to authenticated and
   * guest viewers. Participation gates **actions** (register), not view.
   */
  async assertCanViewCenterLevelTournament(
    _viewer: AuthUser | null | undefined,
    _tournament: { id: string; type: string },
    _options: { allowUnauthenticated?: boolean } = {},
  ): Promise<void> {
    // View-only for all; no participation hide.
  }

  /**
   * Featured / match lists: Tennis tournaments are visible to all viewers.
   * (Leather cards/matches use separate leather gating where applicable.)
   */
  async filterTournamentIdsVisibleToViewer(
    _viewer: AuthUser | null | undefined,
    tournamentIds: string[],
  ): Promise<Set<string>> {
    return new Set(tournamentIds);
  }

  /** True when the viewer's center(s) are linked on the tournament. */
  async viewerCenterParticipates(
    viewer: AuthUser,
    tournamentId: string,
  ): Promise<boolean> {
    if (this.bypassesCenterTournamentScope(viewer)) {
      return true;
    }
    const centerIds = this.viewerParticipatingCenterIds(viewer);
    if (centerIds.length === 0) {
      return false;
    }
    const link = await this.prisma.tournamentCenter.findFirst({
      where: {
        tournamentId,
        centerId: { in: centerIds },
      },
      select: { centerId: true },
    });
    return link != null;
  }

  /**
   * Self-register / participate: Admin/CM always; otherwise home/sevak center
   * must be a {@link TournamentCenter} for APL/CENTER tennis.
   */
  async canRegisterForTennisTournament(
    viewer: AuthUser,
    tournament: { id: string; type: string; ballType: string },
  ): Promise<boolean> {
    if (tournament.ballType !== BallType.Tennis) {
      return true;
    }
    if (!this.requiresParticipatingCenter(tournament.type)) {
      return true;
    }
    return this.viewerCenterParticipates(viewer, tournament.id);
  }

  async assertCanRegisterForTennisTournament(
    viewer: AuthUser,
    tournament: { id: string; type: string; ballType: string },
  ): Promise<void> {
    const allowed = await this.canRegisterForTennisTournament(viewer, tournament);
    if (!allowed) {
      throw new ForbiddenException({
        message: 'Your center is not part of this tournament',
        error: 'TENNIS_CENTER_NOT_PARTICIPATING',
      });
    }
  }
}
