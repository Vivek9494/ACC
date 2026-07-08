import { BallType, MatchSquadRole, RegistrationStatus } from '@acc/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { selectableUserWhere } from '../users/user-query';

/** Squad roles that count as "played" for the leather-history audience (option C: XI + subs). */
const LEATHER_PARTICIPATION_ROLES = [MatchSquadRole.PlayingXi, MatchSquadRole.Substitute];

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Single source of truth for "who receives this notification" (§17). Reused by
 * all triggers (Phases B/C): new-tournament, registration-open/closing, playing
 * XI posted, scorer assigned, etc. Every resolver returns selectable (active,
 * non-deleted) user ids ready to hand to {@link NotificationsService}.
 */
@Injectable()
export class NotificationAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Audience for a tournament, by type (§1.1):
   * - APL (Tennis + all centers) / CENTER (Tennis + subset): users of the
   *   tournament's SELECTED centers.
   * - ACC (Leather): users who have PLAYED a leather tournament before — i.e.
   *   appeared in a locked leather squad as PLAYING_XI or SUBSTITUTE (option C).
   */
  async resolveTournamentAudience(tournamentId: string): Promise<string[]> {
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, isDeleted: false },
      select: { id: true, ballType: true },
    });
    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.ballType === BallType.Leather) {
      return this.resolveLeatherPlayedAudience();
    }
    return this.resolveTournamentCenterAudience(tournamentId);
  }

  /** Users belonging to the centers linked to a tennis (APL/CENTER) tournament. */
  private async resolveTournamentCenterAudience(tournamentId: string): Promise<string[]> {
    const links = await this.prisma.tournamentCenter.findMany({
      where: { tournamentId },
      select: { centerId: true },
    });
    const centerIds = links.map((link) => link.centerId);
    if (centerIds.length === 0) {
      return [];
    }
    const users = await this.prisma.user.findMany({
      where: { ...selectableUserWhere, centerId: { in: centerIds } },
      select: { id: true },
    });
    return uniqueIds(users.map((user) => user.id));
  }

  /** Users who appeared in a locked leather squad (PLAYING_XI or SUBSTITUTE). */
  private async resolveLeatherPlayedAudience(): Promise<string[]> {
    const where: Prisma.MatchSquadPlayerWhereInput = {
      role: { in: LEATHER_PARTICIPATION_ROLES },
      user: { is: selectableUserWhere },
      squad: {
        match: {
          isDeleted: false,
          tournament: { ballType: BallType.Leather, isDeleted: false },
        },
      },
    };
    const rows = await this.prisma.matchSquadPlayer.findMany({
      where,
      select: { userId: true },
      distinct: ['userId'],
    });
    return uniqueIds(rows.map((row) => row.userId));
  }

  /** Every active (non-deleted) user — the global broadcast audience (§17). */
  async resolveAllActiveUsers(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: selectableUserWhere,
      select: { id: true },
    });
    return uniqueIds(users.map((user) => user.id));
  }

  /** All squad players of a team (its full tournament roster). */
  async resolveTeamSquad(teamId: string): Promise<string[]> {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId },
      select: { id: true, tournamentId: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        teamId,
        tournamentId: team.tournamentId,
        user: { is: selectableUserWhere },
      },
      select: { userId: true },
    });
    return uniqueIds(memberships.map((m) => m.userId));
  }

  /**
   * The confirmed Playing 11 plus substitutes for a team in a match. Impact
   * candidates are excluded (they are not part of the announced XI).
   */
  async resolveTeamPlaying11(matchId: string, teamId: string): Promise<string[]> {
    const squad = await this.prisma.matchSquad.findUnique({
      where: { matchId_teamId: { matchId, teamId } },
      select: {
        players: {
          where: {
            role: { in: [MatchSquadRole.PlayingXi, MatchSquadRole.Substitute] },
            user: { is: selectableUserWhere },
          },
          select: { userId: true },
        },
      },
    });
    if (!squad) {
      return [];
    }
    return uniqueIds(squad.players.map((player) => player.userId));
  }

  /**
   * Registered players of a tournament (§17 Phase C, video-upload triggers):
   * anyone with a CONFIRMED or IN_WAITLIST registration and a selectable
   * account. DECLINED registrations are excluded.
   */
  async resolveTournamentRegisteredPlayers(tournamentId: string): Promise<string[]> {
    const registrations = await this.prisma.registration.findMany({
      where: {
        tournamentId,
        status: { in: [RegistrationStatus.Confirmed, RegistrationStatus.InWaitlist] },
        user: { is: selectableUserWhere },
      },
      select: { userId: true },
    });
    return uniqueIds(registrations.map((row) => row.userId));
  }
}
