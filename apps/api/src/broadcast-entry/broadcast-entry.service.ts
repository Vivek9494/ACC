import {
  BroadcastEntryAccess,
  broadcastEntryMatchStatus,
  compareBroadcastEntryMatches,
  deriveTournamentDisplayStatus,
  LIVE_MATCH_STATES,
  PRE_LIVE_MATCH_STATES,
  ScoringMode,
  TournamentDisplayStatus,
  UserRole,
  type AuthUser,
  type BallType,
  type BroadcastEntryMatch,
  type BroadcastEntryTournament,
  type BroadcastEntryTournamentsResponse,
  type MatchState,
} from '@acc/types';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { activeMatchWhere } from '../matches/match-query';
import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentWhere } from '../tournaments/tournament-query';

/** Admin / Club Manager may broadcast any Live tournament. */
export function hasBroadcastAllAccess(user: Pick<AuthUser, 'role'>): boolean {
  return user.role === UserRole.Admin || user.role === UserRole.ClubManager;
}

/**
 * ASC Broadcast entry scoping. Admin / Club Manager: every date-Live tournament.
 * Everyone else: date-Live tournaments where they are in the tennis tournament
 * scorer pool or hold an active per-match Scorer grant (leather).
 */
@Injectable()
export class BroadcastEntryService {
  constructor(private readonly prisma: PrismaService) {}

  async listTournaments(
    actor: AuthUser,
    now: Date = new Date(),
  ): Promise<BroadcastEntryTournamentsResponse> {
    const all = hasBroadcastAllAccess(actor);
    const access = all ? BroadcastEntryAccess.All : BroadcastEntryAccess.Scorer;

    let where: Prisma.TournamentWhereInput = activeTournamentWhere;
    if (!all) {
      const assignedIds = await this.assignedTournamentIds(actor.id);
      if (assignedIds.length === 0) {
        return { access, tournaments: [] };
      }
      where = { ...activeTournamentWhere, id: { in: assignedIds } };
    }

    const rows = await this.prisma.tournament.findMany({
      where,
      select: { id: true, name: true, ballType: true, startAt: true, endAt: true, timezone: true },
      orderBy: { name: 'asc' },
    });

    const tournaments: BroadcastEntryTournament[] = rows
      .filter(
        (row) =>
          deriveTournamentDisplayStatus(
            {
              startAt: row.startAt.toISOString(),
              endAt: row.endAt.toISOString(),
              timezone: row.timezone,
            },
            now,
          ) === TournamentDisplayStatus.Live,
      )
      .map((row) => ({ id: row.id, name: row.name, ballType: row.ballType as BallType }));

    return { access, tournaments };
  }

  /** Live + upcoming live-scored matches, Live first then soonest. */
  async listMatches(
    actor: AuthUser,
    tournamentId: string,
    now: Date = new Date(),
  ): Promise<BroadcastEntryMatch[]> {
    const { tournaments } = await this.listTournaments(actor, now);
    if (!tournaments.some((t) => t.id === tournamentId)) {
      throw new ForbiddenException({
        message: 'You do not have access to broadcast this tournament',
        error: 'FORBIDDEN',
      });
    }

    const rows = await this.prisma.match.findMany({
      where: {
        ...activeMatchWhere,
        tournamentId,
        scoringMode: ScoringMode.Live,
        state: { in: [...LIVE_MATCH_STATES, ...PRE_LIVE_MATCH_STATES] },
      },
      select: {
        id: true,
        state: true,
        matchDate: true,
        startTime: true,
        externalOpponentName: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        tournament: { select: { timezone: true } },
      },
    });

    const matches: BroadcastEntryMatch[] = [];
    for (const row of rows) {
      const status = broadcastEntryMatchStatus(row.state as MatchState);
      if (!status) {
        continue;
      }
      matches.push({
        id: row.id,
        teamAName: row.homeTeam?.name ?? 'TBD',
        teamBName: row.awayTeam?.name ?? row.externalOpponentName ?? 'TBD',
        matchDate: row.matchDate?.toISOString() ?? null,
        startTime: row.startTime?.toISOString() ?? null,
        timezone: row.tournament.timezone,
        status,
      });
    }
    return matches.sort(compareBroadcastEntryMatches);
  }

  private async assignedTournamentIds(userId: string): Promise<string[]> {
    const [pool, grants] = await Promise.all([
      this.prisma.tournamentScorer.findMany({
        where: { userId },
        select: { tournamentId: true },
      }),
      this.prisma.matchScorerGrant.findMany({
        where: { userId, revokedAt: null, match: activeMatchWhere },
        select: { match: { select: { tournamentId: true } } },
      }),
    ]);
    return [
      ...new Set([
        ...pool.map((row) => row.tournamentId),
        ...grants.map((row) => row.match.tournamentId),
      ]),
    ];
  }
}
