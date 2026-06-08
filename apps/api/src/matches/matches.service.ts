import {
  type AssignScorerRequest,
  type AuthUser,
  type HandoverScorerRequest,
  MATCH_END_STATES,
  MATCH_STATE_TRANSITIONS,
  MatchSquadRole,
  MatchState,
  type MatchDetail,
  type MatchSummary,
  Permission,
  type RecordTossRequest,
  type ScorerGrantView,
  type SquadCandidate,
  type SquadView,
  TournamentType,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { MatchScorerGrantService } from '../authz/match-scorer.service';
import { PermissionService } from '../authz/permission.service';
import {
  NotificationsService,
  NotificationTrigger,
} from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMatchDto } from './dto/create-match.dto';
import type { LockPlayingXiDto } from './dto/lock-playing-xi.dto';

/** Suspension statuses that count as "currently suspended" (§10.2–§10.5). */
const ACTIVE_SUSPENSION_STATUSES = ['PENDING', 'CARRIED_FORWARD'] as const;

/** States in which a team's Playing 11 may be locked / re-locked (§5.2). */
const XI_LOCKABLE_STATES: MatchState[] = [MatchState.Scheduled, MatchState.Delayed];

/** Maps a state-transition target to the permission that authorises it. */
const STATE_PERMISSION: Partial<Record<MatchState, Permission>> = {
  LIVE: Permission.START_MATCH,
  COMPLETED: Permission.COMPLETE_MATCH,
  NO_RESULT: Permission.COMPLETE_MATCH,
  RAIN_INTERRUPTED: Permission.UPDATE_MATCH_STATUS,
  DELAYED: Permission.UPDATE_MATCH_STATUS,
  CANCELLED: Permission.CANCEL_MATCH,
};

/** States that record the completion timestamp that starts the §13.1 window. */
const COMPLETION_STATES: MatchState[] = [MatchState.Completed, MatchState.NoResult];

type MatchRow = Prisma.MatchGetPayload<{
  include: {
    homeTeam: { select: { name: true } };
    awayTeam: { select: { name: true } };
    tournament: { select: { impactPlayerEnabled: true; type: true } };
    squads: {
      include: {
        team: { select: { name: true } };
        players: {
          include: { user: { select: { firstName: true; lastName: true } } };
        };
      };
    };
    scorerGrants: true;
  };
}>;

// `MatchScorerGrant.userId` is intentionally not a hard FK (§2), so scorer
// names are resolved in a separate lookup rather than via an include.
const MATCH_INCLUDE = {
  homeTeam: { select: { name: true } },
  awayTeam: { select: { name: true } },
  tournament: { select: { impactPlayerEnabled: true, type: true } },
  squads: {
    include: {
      team: { select: { name: true } },
      players: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  },
  scorerGrants: true,
} as const;

type NameMap = Map<string, { firstName: string; lastName: string }>;

/**
 * Match setup & lifecycle (spec §5.2, §11): creation, the state machine,
 * Playing-11 lock (§9.7, §8), toss capture (§11.2) and the per-match Scorer
 * grant including mid-match handover (§11.1).
 */
@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly scorerGrants: MatchScorerGrantService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // --- Creation & reads ----------------------------------------------------

  async create(actor: AuthUser, tournamentId: string, dto: CreateMatchDto): Promise<MatchDetail> {
    await this.requireTournament(tournamentId);
    const allowed = await this.permissions.check(Permission.CREATE_MATCH, actor, { tournamentId });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to create matches',
        error: 'FORBIDDEN',
      });
    }
    if (!dto.homeTeamId) {
      throw new BadRequestException({ message: 'A home team is required', error: 'HOME_TEAM_REQUIRED' });
    }
    if (!dto.awayTeamId && !dto.externalOpponentName) {
      throw new BadRequestException({
        message: 'Provide an away team or an external opponent name',
        error: 'OPPONENT_REQUIRED',
      });
    }
    if (dto.awayTeamId && dto.externalOpponentName) {
      throw new BadRequestException({
        message: 'A match has either a system away team or an external opponent, not both',
        error: 'AMBIGUOUS_OPPONENT',
      });
    }
    await this.assertTeamsInTournament(tournamentId, [dto.homeTeamId, dto.awayTeamId]);

    const match = await this.prisma.match.create({
      data: {
        tournamentId,
        matchCode: dto.matchCode ?? null,
        state: MatchState.Scheduled,
        homeTeamId: dto.homeTeamId,
        awayTeamId: dto.awayTeamId ?? null,
        externalOpponentName: dto.externalOpponentName ?? null,
        matchDate: dto.matchDate ? new Date(dto.matchDate) : null,
        startTime: dto.startTime ? new Date(dto.startTime) : null,
        reportingTime: dto.reportingTime ? new Date(dto.reportingTime) : null,
        groundLocation: dto.groundLocation ?? null,
        youtubeUrl: dto.youtubeUrl ?? null,
      },
    });
    return this.getDetail(match.id);
  }

  async list(tournamentId: string): Promise<MatchSummary[]> {
    const rows = await this.prisma.match.findMany({
      where: { tournamentId },
      include: MATCH_INCLUDE,
      orderBy: [{ matchDate: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toSummary(row));
  }

  async getDetail(matchId: string): Promise<MatchDetail> {
    const row = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: MATCH_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({ message: 'Match not found', error: 'NOT_FOUND' });
    }
    const scorerIds = row.scorerGrants.filter((g) => g.revokedAt === null).map((g) => g.userId);
    const names = await this.namesFor(scorerIds);
    return this.toDetail(row, names);
  }

  private async namesFor(userIds: string[]): Promise<NameMap> {
    if (userIds.length === 0) {
      return new Map();
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(users.map((u) => [u.id, { firstName: u.firstName, lastName: u.lastName }]));
  }

  /** Selectable players for a team's Playing-11 screen, with suspended badge (§9.7). */
  async squadCandidates(matchId: string, teamId: string): Promise<SquadCandidate[]> {
    const match = await this.requireMatch(matchId);
    this.assertTeamInMatch(match, teamId);

    const members = await this.prisma.teamMembership.findMany({
      where: { tournamentId: match.tournamentId, teamId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const userIds = members.map((m) => m.userId);
    const [registrations, suspendedIds] = await Promise.all([
      this.prisma.registration.findMany({
        where: { tournamentId: match.tournamentId, userId: { in: userIds } },
        select: { userId: true, battingStyle: true, bowlingStyle: true },
      }),
      this.suspendedUserIds(match.tournamentId, userIds, matchId),
    ]);
    const regByUser = new Map(registrations.map((r) => [r.userId, r]));

    return members.map((m) => {
      const reg = regByUser.get(m.userId);
      return {
        userId: m.userId,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        battingStyle: reg?.battingStyle ?? null,
        bowlingStyle: reg?.bowlingStyle ?? null,
        isSuspended: suspendedIds.has(m.userId),
      };
    });
  }

  // --- Playing 11 lock (§9.7, §8) ------------------------------------------

  async lockPlayingXi(
    actor: AuthUser,
    matchId: string,
    dto: LockPlayingXiDto,
  ): Promise<MatchDetail> {
    const match = await this.requireMatch(matchId);
    if (!XI_LOCKABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: `Playing 11 cannot be locked while the match is ${match.state}`,
        error: 'INVALID_MATCH_STATE',
      });
    }
    this.assertTeamInMatch(match, dto.teamId);
    await this.validateSquad(match, dto);

    const players: { userId: string; role: MatchSquadRole; isActiveImpact: boolean }[] = [
      ...dto.playingXi.map((userId) => ({
        userId,
        role: MatchSquadRole.PlayingXi,
        isActiveImpact: false,
      })),
      ...dto.substitutes.map((userId) => ({
        userId,
        role: MatchSquadRole.Substitute,
        isActiveImpact: false,
      })),
      ...(dto.impactCandidates ?? []).map((userId) => ({
        userId,
        role: MatchSquadRole.ImpactCandidate,
        isActiveImpact: userId === dto.activeImpactUserId,
      })),
    ];

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.matchSquad.findUnique({
        where: { matchId_teamId: { matchId, teamId: dto.teamId } },
        select: { id: true },
      });
      if (existing) {
        await tx.matchSquadPlayer.deleteMany({ where: { squadId: existing.id } });
        await tx.matchSquad.update({
          where: { id: existing.id },
          data: { lockedByUserId: actor.id, lockedAt: new Date() },
        });
        await tx.matchSquadPlayer.createMany({
          data: players.map((p) => ({ squadId: existing.id, ...p })),
        });
      } else {
        await tx.matchSquad.create({
          data: {
            matchId,
            teamId: dto.teamId,
            lockedByUserId: actor.id,
            players: { create: players },
          },
        });
      }

      // §5.2: the match becomes "Playing 11 Locked" once every participating
      // system team has locked its squad.
      const participating = [match.homeTeamId, match.awayTeamId].filter(
        (id): id is string => id !== null,
      );
      const squadCount = await tx.matchSquad.count({ where: { matchId } });
      if (squadCount >= participating.length && XI_LOCKABLE_STATES.includes(match.state as MatchState)) {
        await tx.match.update({
          where: { id: matchId },
          data: { state: MatchState.PlayingXiLocked },
        });
      }
    });

    await this.audit.record({
      action: 'MATCH_XI_LOCKED',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: { teamId: dto.teamId, playingXi: dto.playingXi, substitutes: dto.substitutes },
    });
    await this.notifications.notify(NotificationTrigger.PlayingXiPosted, {
      recipientUserIds: [...dto.playingXi, ...dto.substitutes],
      data: { matchId, teamId: dto.teamId },
    });

    return this.getDetail(matchId);
  }

  // --- Toss (§11.2) --------------------------------------------------------

  async recordToss(matchId: string, dto: RecordTossRequest): Promise<MatchDetail> {
    const match = await this.requireMatch(matchId);
    if (
      match.state !== MatchState.PlayingXiLocked &&
      match.state !== MatchState.Delayed
    ) {
      throw new BadRequestException({
        message: 'Record the toss only after Playing 11 is locked',
        error: 'INVALID_MATCH_STATE',
      });
    }
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        tossWinner: dto.tossWinner,
        tossDecision: dto.decision,
        state: MatchState.TossCompleted,
      },
    });
    return this.getDetail(matchId);
  }

  // --- State machine -------------------------------------------------------

  async transition(actor: AuthUser, matchId: string, next: MatchState): Promise<MatchDetail> {
    const match = await this.requireMatch(matchId);
    const current = match.state as MatchState;

    // Playing-11 lock, toss and scorecard confirmation carry payloads / extra
    // rules — they each have a dedicated endpoint (§11.2, §13.1).
    if (
      next === MatchState.PlayingXiLocked ||
      next === MatchState.TossCompleted ||
      next === MatchState.ScorecardLocked
    ) {
      throw new BadRequestException({
        message: `Use the dedicated endpoint to reach ${next}`,
        error: 'USE_DEDICATED_ENDPOINT',
      });
    }
    if (!MATCH_STATE_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException({
        message: `Cannot transition from ${current} to ${next}`,
        error: 'INVALID_STATE_TRANSITION',
      });
    }
    const permission = STATE_PERMISSION[next];
    if (!permission) {
      throw new BadRequestException({ message: `Unsupported target state ${next}`, error: 'UNSUPPORTED_STATE' });
    }
    const allowed = await this.permissions.check(permission, actor, { matchId });
    if (!allowed) {
      throw new ForbiddenException({
        message: `You do not have permission to set the match to ${next}`,
        error: 'FORBIDDEN',
      });
    }

    // §13.1: completion stamps the moment the 5-hour confirm window starts (UTC).
    const completedAt =
      COMPLETION_STATES.includes(next) && !match.completedAt ? new Date() : undefined;
    await this.prisma.match.update({
      where: { id: matchId },
      data: { state: next, ...(completedAt ? { completedAt } : {}) },
    });

    // §11.1: per-match Scorer grants are auto-revoked at match end.
    if (MATCH_END_STATES.includes(next)) {
      await this.scorerGrants.revokeAllForMatch(matchId);
    }
    await this.audit.record({
      action: 'MATCH_STATE_CHANGE',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: { state: current },
      after: { state: next },
    });
    return this.getDetail(matchId);
  }

  // --- Scorer assignment & handover (§11.1) --------------------------------

  /**
   * Assigns a per-match Scorer. ACC: the Captain grants it (ASSIGN_MATCH_SCORER);
   * APL/Center: the tournament organizer assigns (ASSIGN_TOURNAMENT_SCORER).
   */
  async assignScorer(
    actor: AuthUser,
    matchId: string,
    dto: AssignScorerRequest,
  ): Promise<MatchDetail> {
    const match = await this.requireMatch(matchId);
    const permission =
      match.tournament.type === TournamentType.ACC
        ? Permission.ASSIGN_MATCH_SCORER
        : Permission.ASSIGN_TOURNAMENT_SCORER;
    const allowed = await this.permissions.check(permission, actor, { matchId });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to assign a scorer',
        error: 'FORBIDDEN',
      });
    }
    await this.scorerGrants.grant(matchId, dto.userId, actor.id);
    await this.audit.record({
      action: 'MATCH_SCORER_ASSIGNED',
      actorUserId: actor.id,
      targetUserId: dto.userId,
      targetEntityType: 'match',
      targetEntityId: matchId,
    });
    await this.notifications.notify(NotificationTrigger.ScorerAssigned, {
      recipientUserIds: [dto.userId],
      data: { matchId },
    });
    return this.getDetail(matchId);
  }

  /**
   * Mid-match handover (§11.1): revoke the outgoing scorer (or all active
   * grants) and grant the incoming one. The new scorer resumes from the
   * server's last confirmed state — scoring state lives in the append-only
   * delivery stream, so no replay is needed here.
   */
  async handoverScorer(
    actor: AuthUser,
    matchId: string,
    dto: HandoverScorerRequest,
  ): Promise<MatchDetail> {
    await this.requireMatch(matchId);
    if (dto.fromUserId) {
      await this.scorerGrants.revoke(matchId, dto.fromUserId);
    } else {
      await this.scorerGrants.revokeAllForMatch(matchId);
    }
    await this.scorerGrants.grant(matchId, dto.toUserId, actor.id);
    await this.audit.record({
      action: 'MATCH_SCORER_HANDOVER',
      actorUserId: actor.id,
      targetUserId: dto.toUserId,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: dto.fromUserId ? { fromUserId: dto.fromUserId } : undefined,
      after: { toUserId: dto.toUserId },
    });
    await this.notifications.notify(NotificationTrigger.ScorerAssigned, {
      recipientUserIds: [dto.toUserId],
      data: { matchId },
    });
    return this.getDetail(matchId);
  }

  async revokeScorer(actor: AuthUser, matchId: string, userId: string): Promise<MatchDetail> {
    await this.requireMatch(matchId);
    await this.scorerGrants.revoke(matchId, userId);
    await this.audit.record({
      action: 'MATCH_SCORER_REVOKED',
      actorUserId: actor.id,
      targetUserId: userId,
      targetEntityType: 'match',
      targetEntityId: matchId,
    });
    return this.getDetail(matchId);
  }

  // --- helpers -------------------------------------------------------------

  private async requireTournament(tournamentId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });
    if (!tournament) {
      throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
    }
  }

  private async requireMatch(matchId: string): Promise<{
    id: string;
    state: string;
    tournamentId: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    completedAt: Date | null;
    tournament: { impactPlayerEnabled: boolean; type: string };
  }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        state: true,
        tournamentId: true,
        homeTeamId: true,
        awayTeamId: true,
        completedAt: true,
        tournament: { select: { impactPlayerEnabled: true, type: true } },
      },
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'NOT_FOUND' });
    }
    return match;
  }

  private assertTeamInMatch(
    match: { homeTeamId: string | null; awayTeamId: string | null },
    teamId: string,
  ): void {
    if (teamId !== match.homeTeamId && teamId !== match.awayTeamId) {
      throw new BadRequestException({
        message: 'Team is not part of this match',
        error: 'TEAM_NOT_IN_MATCH',
      });
    }
  }

  private async assertTeamsInTournament(
    tournamentId: string,
    teamIds: (string | null | undefined)[],
  ): Promise<void> {
    const ids = teamIds.filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      return;
    }
    const found = await this.prisma.team.count({
      where: { id: { in: ids }, tournamentId },
    });
    if (found !== ids.length) {
      throw new BadRequestException({
        message: 'A team does not belong to this tournament',
        error: 'TEAM_NOT_IN_TOURNAMENT',
      });
    }
  }

  /** Validates the §9.7/§8 squad composition rules. */
  private async validateSquad(
    match: {
      tournamentId: string;
      tournament: { impactPlayerEnabled: boolean };
    },
    dto: LockPlayingXiDto,
  ): Promise<void> {
    const impactCandidates = dto.impactCandidates ?? [];
    const all = [...dto.playingXi, ...dto.substitutes, ...impactCandidates];
    if (new Set(all).size !== all.length) {
      throw new BadRequestException({
        message: 'A player may appear only once across the 11, substitutes and impact list',
        error: 'DUPLICATE_SQUAD_PLAYER',
      });
    }
    if (impactCandidates.length > 0 && !match.tournament.impactPlayerEnabled) {
      throw new BadRequestException({
        message: 'Impact Player is not enabled for this tournament',
        error: 'IMPACT_NOT_ENABLED',
      });
    }
    if (dto.activeImpactUserId && !impactCandidates.includes(dto.activeImpactUserId)) {
      throw new BadRequestException({
        message: 'The active Impact Player must be one of the impact candidates',
        error: 'INVALID_ACTIVE_IMPACT',
      });
    }

    // Every selected player must be a member of the team.
    const members = await this.prisma.teamMembership.findMany({
      where: { tournamentId: match.tournamentId, teamId: dto.teamId, userId: { in: all } },
      select: { userId: true },
    });
    const memberSet = new Set(members.map((m) => m.userId));
    const notMembers = all.filter((id) => !memberSet.has(id));
    if (notMembers.length > 0) {
      throw new BadRequestException({
        message: 'All selected players must belong to the team',
        error: 'PLAYER_NOT_IN_TEAM',
      });
    }

    // §9.7: suspended players may be in the 11 but never as substitutes.
    const suspended = await this.suspendedUserIds(match.tournamentId, dto.substitutes);
    if (dto.substitutes.some((id) => suspended.has(id))) {
      throw new BadRequestException({
        message: 'A suspended player cannot be named as a substitute',
        error: 'SUSPENDED_SUBSTITUTE',
      });
    }
  }

  /** Set of user ids currently suspended in the tournament (optionally for a match). */
  private async suspendedUserIds(
    tournamentId: string,
    userIds: string[],
    matchId?: string,
  ): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.suspension.findMany({
      where: {
        tournamentId,
        userId: { in: userIds },
        status: { in: [...ACTIVE_SUSPENSION_STATUSES] },
        ...(matchId ? { OR: [{ servingMatchId: matchId }, { servingMatchId: null }] } : {}),
      },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  }

  private toSummary(row: MatchRow): MatchSummary {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      matchCode: row.matchCode,
      state: row.state as MatchState,
      homeTeamId: row.homeTeamId,
      homeTeamName: row.homeTeam?.name ?? null,
      awayTeamId: row.awayTeamId,
      awayTeamName: row.awayTeam?.name ?? null,
      externalOpponentName: row.externalOpponentName,
      matchDate: row.matchDate?.toISOString() ?? null,
      startTime: row.startTime?.toISOString() ?? null,
    };
  }

  private toDetail(row: MatchRow, scorerNames: NameMap): MatchDetail {
    const squads: SquadView[] = row.squads.map((squad) => ({
      teamId: squad.teamId,
      teamName: squad.team.name,
      lockedByUserId: squad.lockedByUserId,
      lockedAt: squad.lockedAt.toISOString(),
      players: squad.players.map((p) => ({
        userId: p.userId,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        role: p.role as MatchSquadRole,
        isActiveImpact: p.isActiveImpact,
        battingOrder: p.battingOrder,
      })),
    }));
    const activeScorers: ScorerGrantView[] = row.scorerGrants
      .filter((g) => g.revokedAt === null)
      .map((g) => {
        const name = scorerNames.get(g.userId);
        return {
          userId: g.userId,
          firstName: name?.firstName ?? '',
          lastName: name?.lastName ?? '',
          grantedByUserId: g.grantedByUserId,
          grantedAt: g.grantedAt.toISOString(),
        };
      });
    return {
      ...this.toSummary(row),
      reportingTime: row.reportingTime?.toISOString() ?? null,
      groundLocation: row.groundLocation,
      youtubeUrl: row.youtubeUrl,
      tossWinner: row.tossWinner,
      tossDecision: row.tossDecision,
      impactPlayerEnabled: row.tournament.impactPlayerEnabled,
      squads,
      activeScorers,
      completedAt: row.completedAt?.toISOString() ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      confirmedByUserId: row.confirmedByUserId,
      autoConfirmed: row.autoConfirmed,
      manOfTheMatchUserId: row.manOfTheMatchUserId,
      winningTeamId: row.winningTeamId,
      isNoResult: row.isNoResult,
    };
  }
}
