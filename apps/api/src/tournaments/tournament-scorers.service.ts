import {
  BallType,
  type AuthUser,
  canManageTournamentScorers,
  canMidMatchSwapMatchScorer,
  LIVE_MATCH_STATES,
  type MatchTennisScorerView,
  PRE_LIVE_MATCH_STATES,
  resolveMatchScorerEditLock,
  type RemovedScorerMatchResetView,
  RegistrationStatus,
  SCORERS_LOCKED_LIVE_MATCH_ERROR,
  SCORERS_LOCKED_LIVE_MATCH_MESSAGE,
  type SetTournamentScorersResponse,
  TOURNAMENT_SCORER_COUNT,
  type MatchState,
  type TournamentScorerManagementContext,
  type TournamentScorerPoolRow,
  type TournamentScorerRow,
  type TournamentScorersSelectionView,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { MediaUrlResolver } from '../storage/media-url.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentWhere } from './tournament-query';
import { buildTournamentScopeDisplay } from './tournament-scope-display';
import type { SetTournamentScorersDto } from './dto/set-tournament-scorers.dto';

const REGISTRATION_POOL_INCLUDE = {
  user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
  center: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TournamentScorersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrls: MediaUrlResolver,
  ) {}

  async getSelectionView(
    actor: AuthUser,
    tournamentId: string,
  ): Promise<TournamentScorersSelectionView> {
    const context = await this.loadManagementContext(tournamentId);
    this.assertTennisTournament(context.ballType);
    const canManage = canManageTournamentScorers(actor, context);
    if (!canManage) {
      throw new ForbiddenException({
        message: 'You do not have permission to manage tournament scorers',
        error: 'FORBIDDEN',
      });
    }

    const [scorers, pool, scorersEditLocked] = await Promise.all([
      this.loadScorerRows(tournamentId),
      this.loadPoolRows(tournamentId),
      this.hasLiveMatch(tournamentId),
    ]);

    return {
      scorers,
      pool,
      canManage: true,
      scorersEditLocked,
      scorersEditLockedMessage: scorersEditLocked ? SCORERS_LOCKED_LIVE_MATCH_MESSAGE : null,
    };
  }

  async setScorers(
    actor: AuthUser,
    tournamentId: string,
    dto: SetTournamentScorersDto,
  ): Promise<SetTournamentScorersResponse> {
    const context = await this.loadManagementContext(tournamentId);
    this.assertTennisTournament(context.ballType);
    if (!canManageTournamentScorers(actor, context)) {
      throw new ForbiddenException({
        message: 'You do not have permission to manage tournament scorers',
        error: 'FORBIDDEN',
      });
    }

    await this.assertScorersEditable(tournamentId);

    const userIds = dto.userIds;
    if (userIds.length !== TOURNAMENT_SCORER_COUNT) {
      throw new BadRequestException({
        message: `Exactly ${TOURNAMENT_SCORER_COUNT} scorers are required`,
        error: 'INVALID_SCORER_COUNT',
      });
    }
    if (new Set(userIds).size !== userIds.length) {
      throw new BadRequestException({
        message: 'Duplicate scorers are not allowed',
        error: 'DUPLICATE_SCORERS',
      });
    }

    const registeredCount = await this.prisma.registration.count({
      where: {
        tournamentId,
        userId: { in: userIds },
        status: RegistrationStatus.Confirmed,
      },
    });
    if (registeredCount !== userIds.length) {
      throw new BadRequestException({
        message: 'Every scorer must be a confirmed registrant in this tournament',
        error: 'SCORER_NOT_REGISTERED',
      });
    }

    const previousRows = await this.prisma.tournamentScorer.findMany({
      where: { tournamentId },
      select: { userId: true },
    });
    const previousUserIds = new Set(previousRows.map((row) => row.userId));
    const nextUserIds = new Set(userIds);
    const removedUserIds = [...previousUserIds].filter((id) => !nextUserIds.has(id));

    const removedNames = await this.loadRemovedScorerNames(removedUserIds);

    const removedScorerResets = await this.prisma.$transaction(async (tx) => {
      await tx.tournamentScorer.deleteMany({ where: { tournamentId } });
      await tx.tournamentScorer.createMany({
        data: userIds.map((userId) => ({
          tournamentId,
          userId,
          assignedById: actor.id,
        })),
      });

      const resets: RemovedScorerMatchResetView[] = [];
      for (const userId of removedUserIds) {
        const resetMatches = await this.revokeEligibleMatchScorerGrants(tx, tournamentId, userId);
        if (resetMatches.length === 0) {
          continue;
        }
        const name = removedNames.get(userId);
        resets.push({
          userId,
          firstName: name?.firstName ?? '',
          lastName: name?.lastName ?? '',
          resetMatches,
        });
      }
      return resets;
    });

    const scorers = await this.loadScorerRows(tournamentId);
    return { scorers, removedScorerResets };
  }

  async countScorers(tournamentId: string): Promise<number> {
    return this.prisma.tournamentScorer.count({ where: { tournamentId } });
  }

  async buildViewerFlags(
    viewer: AuthUser | null | undefined,
    tournamentId: string,
    ballType: BallType,
    scopeDisplay: Awaited<ReturnType<typeof buildTournamentScopeDisplay>>,
    participatingCenterIds: string[],
  ): Promise<{ canManageTournamentScorers: boolean; tournamentScorerCount: number }> {
    if (ballType !== BallType.Tennis) {
      return { canManageTournamentScorers: false, tournamentScorerCount: 0 };
    }

    const tournamentScorerCount = await this.countScorers(tournamentId);
    const canManage = canManageTournamentScorers(viewer, {
      ballType: BallType.Tennis,
      scopeDisplay,
      participatingCenterIds,
    });

    return { canManageTournamentScorers: canManage, tournamentScorerCount };
  }

  async loadParticipatingCenterIds(tournamentId: string): Promise<string[]> {
    const links = await this.prisma.tournamentCenter.findMany({
      where: { tournamentId },
      select: { centerId: true },
    });
    return links.map((link) => link.centerId);
  }

  async assertCanManage(actor: AuthUser, tournamentId: string): Promise<void> {
    const context = await this.loadManagementContext(tournamentId);
    this.assertTennisTournament(context.ballType);
    if (!canManageTournamentScorers(actor, context)) {
      throw new ForbiddenException({
        message: 'You do not have permission to manage tournament scorers',
        error: 'FORBIDDEN',
      });
    }
  }

  async assertUserInCurrentScorerSet(tournamentId: string, userId: string): Promise<void> {
    const row = await this.prisma.tournamentScorer.findFirst({
      where: { tournamentId, userId },
      select: { id: true },
    });
    if (!row) {
      throw new BadRequestException({
        message: 'Selected player is not in the tournament scorer pool',
        error: 'NOT_TOURNAMENT_SCORER',
      });
    }
  }

  /** Tennis Phase 2: block per-match scorer changes while live or after completion. */
  assertMatchScorerAssignable(matchState: MatchState): void {
    const lock = resolveMatchScorerEditLock(matchState);
    if (lock.locked) {
      throw new ForbiddenException({
        message: lock.message ?? 'Match scorer cannot be changed',
        error: lock.error ?? 'FORBIDDEN',
      });
    }
  }

  async loadScorerUserIdSet(tournamentId: string): Promise<Set<string>> {
    const rows = await this.prisma.tournamentScorer.findMany({
      where: { tournamentId },
      select: { userId: true },
    });
    return new Set(rows.map((row) => row.userId));
  }

  /** Whether the viewer may manage the tournament scorer pool (Admin / organizer roles). */
  async viewerCanManageScorers(
    viewer: AuthUser | null | undefined,
    tournamentId: string,
  ): Promise<boolean> {
    const context = await this.loadManagementContext(tournamentId);
    return canManageTournamentScorers(viewer, context);
  }

  async buildMatchTennisScorerView(
    viewer: AuthUser | null | undefined,
    tournamentId: string,
    matchState: MatchState,
    activeScorers: {
      userId: string;
      firstName: string;
      lastName: string;
      grantedByUserId: string | null;
      grantedAt: string;
    }[],
  ): Promise<MatchTennisScorerView> {
    const context = await this.loadManagementContext(tournamentId);
    const [pickableScorers, scorerUserIds, scorersEditLocked] = await Promise.all([
      this.loadScorerRows(tournamentId),
      this.loadScorerUserIdSet(tournamentId),
      this.hasLiveMatch(tournamentId),
    ]);
    const canManage = canManageTournamentScorers(viewer, context);
    const matchScorerLock = resolveMatchScorerEditLock(matchState);
    const canMidMatchSwapScorer =
      canMidMatchSwapMatchScorer(viewer?.role) && LIVE_MATCH_STATES.includes(matchState);
    const assigned = activeScorers[0] ?? null;
    return {
      tournamentScorerCount: scorerUserIds.size,
      canManageMatchScorer: canManage,
      canManageTournamentScorers: canManage,
      scorersEditLocked,
      scorersEditLockedMessage: scorersEditLocked ? SCORERS_LOCKED_LIVE_MATCH_MESSAGE : null,
      matchScorerEditLocked: matchScorerLock.locked,
      matchScorerEditLockedMessage: matchScorerLock.message,
      canMidMatchSwapScorer,
      pickableScorers,
      assignedScorer: assigned
        ? {
            ...assigned,
            isStale: !scorerUserIds.has(assigned.userId),
          }
        : null,
    };
  }

  private async loadManagementContext(
    tournamentId: string,
  ): Promise<TournamentScorerManagementContext & { ballType: BallType }> {
    const tournament = await this.prisma.tournament.findFirst({
      where: { id: tournamentId, ...activeTournamentWhere },
      select: {
        id: true,
        ballType: true,
        type: true,
        provinceId: true,
      },
    });
    if (!tournament) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }

    const [scopeDisplay, participatingCenterIds] = await Promise.all([
      buildTournamentScopeDisplay(
        this.prisma,
        tournament.id,
        tournament.type,
        tournament.ballType,
        tournament.provinceId,
      ),
      this.loadParticipatingCenterIds(tournamentId),
    ]);

    return {
      ballType: tournament.ballType as BallType,
      scopeDisplay,
      participatingCenterIds,
    };
  }

  private assertTennisTournament(ballType: BallType): void {
    if (ballType !== BallType.Tennis) {
      throw new BadRequestException({
        message: 'Tournament scorers are only available for tennis tournaments',
        error: 'NOT_TENNIS_TOURNAMENT',
      });
    }
  }

  /** True when any non-deleted fixture is in a live-scoring state (LIVE / RAIN_INTERRUPTED). */
  private async hasLiveMatch(tournamentId: string): Promise<boolean> {
    const liveMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        isDeleted: false,
        state: { in: [...LIVE_MATCH_STATES] },
      },
      select: { id: true },
    });
    return liveMatch !== null;
  }

  private async assertScorersEditable(tournamentId: string): Promise<void> {
    if (await this.hasLiveMatch(tournamentId)) {
      throw new BadRequestException({
        message: SCORERS_LOCKED_LIVE_MATCH_MESSAGE,
        error: SCORERS_LOCKED_LIVE_MATCH_ERROR,
      });
    }
  }

  private async loadRemovedScorerNames(
    userIds: string[],
  ): Promise<Map<string, { firstName: string; lastName: string }>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(users.map((user) => [user.id, user]));
  }

  private async revokeEligibleMatchScorerGrants(
    tx: Prisma.TransactionClient,
    tournamentId: string,
    userId: string,
  ): Promise<RemovedScorerMatchResetView['resetMatches']> {
    const now = new Date();
    const grants = await tx.matchScorerGrant.findMany({
      where: {
        userId,
        revokedAt: null,
        match: {
          tournamentId,
          isDeleted: false,
          state: { in: [...PRE_LIVE_MATCH_STATES] },
        },
      },
      select: {
        id: true,
        match: {
          select: {
            id: true,
            matchCode: true,
            matchDate: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
            externalOpponentName: true,
          },
        },
      },
    });

    if (grants.length === 0) {
      return [];
    }

    await tx.matchScorerGrant.updateMany({
      where: { id: { in: grants.map((grant) => grant.id) } },
      data: { revokedAt: now },
    });

    return grants.map((grant) => ({
      matchId: grant.match.id,
      label: this.formatResetMatchLabel(grant.match),
      matchCode: grant.match.matchCode,
      matchDate: grant.match.matchDate?.toISOString() ?? null,
    }));
  }

  private formatResetMatchLabel(match: {
    matchCode: string | null;
    matchDate: Date | null;
    homeTeam: { name: string } | null;
    awayTeam: { name: string } | null;
    externalOpponentName: string | null;
  }): string {
    const home = match.homeTeam?.name ?? 'Home';
    const away = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';
    const teams = `${home} vs ${away}`;
    const date = match.matchDate ? match.matchDate.toISOString().slice(0, 10) : null;
    const code = match.matchCode?.trim();
    if (code && date) {
      return `${teams} · ${code} · ${date}`;
    }
    if (date) {
      return `${teams} · ${date}`;
    }
    if (code) {
      return `${teams} · ${code}`;
    }
    return teams;
  }

  private async loadScorerRows(tournamentId: string): Promise<TournamentScorerRow[]> {
    const rows = await this.prisma.tournamentScorer.findMany({
      where: { tournamentId },
      orderBy: { assignedAt: 'asc' },
      include: {
        user: { select: { firstName: true, lastName: true, profilePhotoUrl: true } },
      },
    });

    const registrationByUserId = await this.loadRegistrationByUserId(
      tournamentId,
      rows.map((row) => row.userId),
    );

    const mapped: TournamentScorerRow[] = rows.map((row) => {
      const registration = registrationByUserId.get(row.userId);
      return {
        userId: row.userId,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        centerId: registration?.centerId ?? '',
        centerName: registration?.center.name ?? 'Unknown center',
        playerRole: registration?.playerRole ?? null,
        profilePhotoUrl: row.user.profilePhotoUrl,
      };
    });

    return this.mediaUrls.resolveProfilePhotoUrls(mapped);
  }

  private async loadPoolRows(tournamentId: string): Promise<TournamentScorerPoolRow[]> {
    const rows = await this.prisma.registration.findMany({
      where: { tournamentId, status: RegistrationStatus.Confirmed },
      include: REGISTRATION_POOL_INCLUDE,
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    const mapped: TournamentScorerPoolRow[] = rows.map((row) => ({
      userId: row.userId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      centerId: row.centerId,
      centerName: row.center.name,
      playerRole: row.playerRole,
      profilePhotoUrl: row.user.profilePhotoUrl,
    }));

    return this.mediaUrls.resolveProfilePhotoUrls(mapped);
  }

  private async loadRegistrationByUserId(
    tournamentId: string,
    userIds: string[],
  ): Promise<
    Map<
      string,
      {
        centerId: string;
        playerRole: TournamentScorerRow['playerRole'];
        center: { name: string };
      }
    >
  > {
    if (userIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.registration.findMany({
      where: { tournamentId, userId: { in: userIds } },
      select: {
        userId: true,
        centerId: true,
        playerRole: true,
        center: { select: { name: true } },
      },
    });
    return new Map(rows.map((row) => [row.userId, row]));
  }
}
