import {
  AttendancePunchStatus,
  BallType,
  MatchState,
  SuspensionReason,
  SuspensionStatus,
  SuspensionPollVoteSide,
  SuspensionXiBadge,
  UserRole,
  isPenaltyUnavailableToServe,
  type AuthUser,
  type PenaltyServingPlayerView,
  type PendingSuspensionRow,
  type PollSuspensionActionedRow,
  type PollSuspensionPlayerRow,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { isCaptainOrViceCaptain } from '../authz/team-leader.util';
import {
  NotificationTrigger,
  NotificationsService,
} from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { selectableUserWhere } from '../users/user-query';

const ACTIVE_MATCH_WHERE = { isDeleted: false } as const satisfies Prisma.MatchWhereInput;

const UPCOMING_MATCH_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.Delayed,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
];

const COMPLETION_STATES: MatchState[] = [MatchState.Completed, MatchState.NoResult];

/** Prior fixture whose late punches feed the next match's Penalty tab (DP1). */
const SOURCE_MATCH_STATES: MatchState[] = [
  MatchState.Live,
  MatchState.RainInterrupted,
  MatchState.Completed,
  MatchState.NoResult,
  MatchState.ScorecardLocked,
];

const PENALTY_TAB_STATUSES = [SuspensionStatus.Pending, SuspensionStatus.CarriedForward] as const;

const ACTIONABLE_PENALTY_STATUSES = [
  SuspensionStatus.Pending,
  SuspensionStatus.CarriedForward,
] as const;

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhotoUrl: true,
} as const;

type AttendancePunchRow = {
  userId: string;
  teamId: string;
  status: AttendancePunchStatus;
};

@Injectable()
export class SuspensionService {
  private readonly logger = new Logger(SuspensionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * On leather match completion: resolve served suspensions (discharge or auto carry-forward),
   * then create first-offense suspensions for other late arrivals (§10).
   */
  async generateForCompletedMatch(matchId: string): Promise<void> {
    const match = await this.loadCompletedLeatherMatch(matchId);
    if (!match) {
      return;
    }

    const anchorTime = match.startTime ?? match.completedAt ?? match.matchDate;
    if (!anchorTime) {
      return;
    }

    await this.resolveServingSuspensionsOnMatchComplete(match, anchorTime);

    const teamIds = [match.homeTeamId, match.awayTeamId].filter(
      (id): id is string => id != null,
    );

    for (const teamId of teamIds) {
      const latePlayerIds = match.attendancePunches
        .filter(
          (punch) => punch.teamId === teamId && punch.status === AttendancePunchStatus.Late,
        )
        .map((punch) => punch.userId);

      for (const userId of latePlayerIds) {
        const wasServingThisMatch = await this.prisma.suspension.findFirst({
          where: {
            userId,
            teamId,
            servingMatchId: matchId,
            status: SuspensionStatus.Served,
            reason: SuspensionReason.LateLastMatch,
          },
          select: { id: true },
        });
        if (wasServingThisMatch) {
          continue;
        }

        const existingForThisTrigger = await this.prisma.suspension.findFirst({
          where: {
            userId,
            teamId,
            triggeredByMatchId: matchId,
            reason: SuspensionReason.LateLastMatch,
          },
          select: { id: true },
        });
        if (existingForThisTrigger) {
          continue;
        }

        const nextMatchId = await this.findNextTeamMatch(
          teamId,
          match.tournamentId,
          anchorTime,
          matchId,
        );
        if (!nextMatchId) {
          continue;
        }

        await this.createPendingIfAbsent({
          userId,
          teamId,
          tournamentId: match.tournamentId,
          triggeredByMatchId: matchId,
          servingMatchId: nextMatchId,
        });
      }
    }
  }

  /** Serving players who sat out: on-time punch discharges; late/no punch moves the same record forward. */
  private async resolveServingSuspensionsOnMatchComplete(
    match: {
      id: string;
      tournamentId: string;
      attendancePunches: AttendancePunchRow[];
    },
    anchorTime: Date,
  ): Promise<void> {
    const servedRows = await this.prisma.suspension.findMany({
      where: {
        servingMatchId: match.id,
        status: SuspensionStatus.Served,
        reason: SuspensionReason.LateLastMatch,
      },
    });

    const punchStatusByKey = new Map(
      match.attendancePunches.map(
        (punch) => [`${punch.userId}:${punch.teamId}`, punch.status] as const,
      ),
    );

    for (const row of servedRows) {
      if (!row.teamId) {
        continue;
      }

      const punchStatus = punchStatusByKey.get(`${row.userId}:${row.teamId}`);
      if (punchStatus === AttendancePunchStatus.OnTime) {
        await this.audit.record({
          action: 'SUSPENSION_DISCHARGED',
          targetEntityType: 'suspension',
          targetEntityId: row.id,
          after: { userId: row.userId, servingMatchId: match.id },
        });
        continue;
      }

      const nextMatchId = await this.findNextTeamMatch(
        row.teamId,
        row.tournamentId,
        anchorTime,
        match.id,
      );
      if (!nextMatchId) {
        continue;
      }

      await this.prisma.suspension.update({
        where: { id: row.id },
        data: {
          status: SuspensionStatus.Pending,
          servingMatchId: nextMatchId,
          carryForwardCount: { increment: 1 },
        },
      });

      await this.audit.record({
        action: 'SUSPENSION_AUTO_CARRIED_FORWARD',
        targetEntityType: 'suspension',
        targetEntityId: row.id,
        after: {
          userId: row.userId,
          fromMatchId: match.id,
          servingMatchId: nextMatchId,
          carryForwardCount: row.carryForwardCount + 1,
        },
      });
    }
  }

  async listPendingForMatchTeam(
    matchId: string,
    teamId: string,
  ): Promise<PendingSuspensionRow[]> {
    await this.syncPendingSuspensionsForServingMatch(matchId, teamId);

    const rows = await this.prisma.suspension.findMany({
      where: {
        servingMatchId: matchId,
        teamId,
        status: { in: [...PENALTY_TAB_STATUSES] },
        reason: SuspensionReason.LateLastMatch,
      },
      include: { user: { select: USER_SELECT } },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    return rows.map((row) => ({
      suspensionId: row.id,
      userId: row.userId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      profilePhotoUrl: row.user.profilePhotoUrl,
      triggeredByMatchId: row.triggeredByMatchId ?? '',
    }));
  }

  async listActionedForMatchTeam(
    matchId: string,
    teamId: string,
  ): Promise<PollSuspensionActionedRow[]> {
    const rows = await this.prisma.suspension.findMany({
      where: {
        actionedAtMatchId: matchId,
        teamId,
        status: { in: [SuspensionStatus.CarriedForward, SuspensionStatus.Cancelled] },
        reason: SuspensionReason.LateLastMatch,
      },
      include: { user: { select: USER_SELECT } },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return rows.map((row) => ({
      userId: row.userId,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      profilePhotoUrl: row.user.profilePhotoUrl,
      badge:
        row.status === SuspensionStatus.CarriedForward
          ? SuspensionXiBadge.CarryForward
          : SuspensionXiBadge.Cancelled,
    }));
  }

  async listPenaltyServingForSquads(
    matchId: string,
    teamIds: string[],
  ): Promise<Map<string, PenaltyServingPlayerView[]>> {
    if (teamIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.suspension.findMany({
      where: {
        servingMatchId: matchId,
        teamId: { in: teamIds },
        status: SuspensionStatus.Served,
        reason: SuspensionReason.LateLastMatch,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    const byTeam = new Map<string, PenaltyServingPlayerView[]>();
    for (const row of rows) {
      if (!row.teamId) {
        continue;
      }
      const list = byTeam.get(row.teamId) ?? [];
      list.push({
        userId: row.user.id,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
      });
      byTeam.set(row.teamId, list);
    }
    return byTeam;
  }

  /** Captain carry-forward: player plays this match; the same offense record moves to the next fixture. */
  async carryForward(actor: AuthUser, suspensionId: string): Promise<void> {
    const row = await this.requireActionableSuspension(suspensionId);
    await this.assertCaptainForTeam(actor, row.teamId!, row.tournamentId);
    await this.assertSuspensionActionsAllowed(row);

    const currentServingMatchId = row.servingMatchId!;
    const serveMatch = await this.requireServingMatch(currentServingMatchId);
    const nextMatchId = await this.findNextTeamMatch(
      row.teamId!,
      row.tournamentId,
      serveMatch.startTime ?? serveMatch.matchDate ?? new Date(),
      serveMatch.id,
    );

    await this.prisma.suspension.update({
      where: { id: row.id },
      data: {
        status: SuspensionStatus.CarriedForward,
        servingMatchId: nextMatchId,
        actionedAtMatchId: currentServingMatchId,
        carryForwardCount: { increment: 1 },
      },
    });

    await this.audit.record({
      action: 'SUSPENSION_CARRIED_FORWARD',
      actorUserId: actor.id,
      targetEntityType: 'suspension',
      targetEntityId: row.id,
      after: {
        userId: row.userId,
        actionedAtMatchId: currentServingMatchId,
        servingMatchId: nextMatchId,
        kind: 'captain',
      },
    });

    await this.notifyClubManagersOfCaptainAction(
      NotificationTrigger.SuspensionCarriedForward,
      row,
      'Suspension carried forward',
      'A captain carried a late-arrival suspension forward to the next match.',
    );
  }

  async cancel(actor: AuthUser, suspensionId: string): Promise<void> {
    const row = await this.requireActionableSuspension(suspensionId);
    await this.assertCaptainForTeam(actor, row.teamId!, row.tournamentId);
    await this.assertSuspensionActionsAllowed(row);

    await this.prisma.suspension.update({
      where: { id: row.id },
      data: {
        status: SuspensionStatus.Cancelled,
        actionedAtMatchId: row.servingMatchId,
        cancelledByUserId: actor.id,
        cancelledAt: new Date(),
      },
    });

    await this.audit.record({
      action: 'SUSPENSION_CANCELLED',
      actorUserId: actor.id,
      targetEntityType: 'suspension',
      targetEntityId: row.id,
      after: { userId: row.userId, servingMatchId: row.servingMatchId },
    });

    await this.notifyClubManagersOfCaptainAction(
      NotificationTrigger.SuspensionCancelled,
      row,
      'Suspension cancelled',
      'A captain cancelled a late-arrival suspension.',
    );
  }

  /** §17: captain penalty actions notify Club Managers. Best-effort. */
  private async notifyClubManagersOfCaptainAction(
    triggerKey:
      | typeof NotificationTrigger.SuspensionCarriedForward
      | typeof NotificationTrigger.SuspensionCancelled,
    suspension: { id: string; userId: string; tournamentId: string },
    title: string,
    body: string,
  ): Promise<void> {
    try {
      const clubManagers = await this.prisma.user.findMany({
        where: { ...selectableUserWhere, role: UserRole.ClubManager },
        select: { id: true },
      });
      const userIds = clubManagers.map((user) => user.id);
      if (userIds.length === 0) {
        return;
      }

      const player = await this.prisma.user.findUnique({
        where: { id: suspension.userId },
        select: { firstName: true, lastName: true },
      });
      const playerName = player
        ? `${player.firstName} ${player.lastName}`.trim()
        : 'A player';

      await this.notifications.sendToAudience(userIds, {
        triggerKey,
        dedupeKey: `${triggerKey}:${suspension.id}`,
        title,
        body: `${body} Player: ${playerName}.`,
        data: {
          tournamentId: suspension.tournamentId,
          suspensionId: suspension.id,
          screen: 'tournament',
        },
        audienceSummary: `Club Managers — suspension ${suspension.id}`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to notify Club Managers for ${triggerKey} on suspension ${suspension.id}`,
        err as Error,
      );
    }
  }

  /** On Playing XI confirm: explicit IN vote → served; OUT or no vote → auto-carry (DP2). */
  async resolvePendingSuspensionsOnPlayingXiConfirm(
    matchId: string,
    teamId: string,
  ): Promise<void> {
    await this.syncPendingSuspensionsForServingMatch(matchId, teamId);

    const pending = await this.prisma.suspension.findMany({
      where: {
        servingMatchId: matchId,
        teamId,
        status: SuspensionStatus.Pending,
        reason: SuspensionReason.LateLastMatch,
      },
    });

    if (pending.length === 0) {
      return;
    }

    const voteSideByUser = await this.loadPollVoteSideByUser(matchId, teamId);

    for (const row of pending) {
      const voteSide = this.resolvePollVoteSide(voteSideByUser, row.userId);
      if (voteSide === SuspensionPollVoteSide.In) {
        await this.prisma.suspension.update({
          where: { id: row.id },
          data: { status: SuspensionStatus.Served },
        });
        await this.audit.record({
          action: 'SUSPENSION_MARKED_SERVED',
          targetEntityType: 'suspension',
          targetEntityId: row.id,
          after: { userId: row.userId, servingMatchId: matchId },
        });
      } else if (isPenaltyUnavailableToServe(voteSide)) {
        await this.autoCarryForwardOutVote(row);
      }
    }
  }

  /** Remaining pending suspensions for this match → served (sit out) or auto-carried by vote. */
  async markRemainingPendingAsServed(matchId: string, teamId: string): Promise<void> {
    await this.resolvePendingSuspensionsOnPlayingXiConfirm(matchId, teamId);
  }

  async assertPlayingXiExcludesPendingSuspensions(
    matchId: string,
    teamId: string,
    playingXi: string[],
  ): Promise<void> {
    await this.syncPendingSuspensionsForServingMatch(matchId, teamId);
    if (playingXi.length === 0) {
      return;
    }
    const voteSideByUser = await this.loadPollVoteSideByUser(matchId, teamId);
    const pending = await this.prisma.suspension.findMany({
      where: {
        servingMatchId: matchId,
        teamId,
        status: SuspensionStatus.Pending,
        userId: { in: playingXi },
      },
      select: { userId: true },
    });
    const servingInXi = pending.filter(
      (row) =>
        this.resolvePollVoteSide(voteSideByUser, row.userId) === SuspensionPollVoteSide.In,
    );
    if (servingInXi.length > 0) {
      throw new BadRequestException({
        message: 'A suspended player must sit out this match or be actioned from the Penalty tab',
        error: 'SUSPENDED_MUST_SIT_OUT',
      });
    }
  }

  /**
   * Ensure pending suspension rows exist for late arrivals from the team's most recent
   * live-or-completed source match before this serving match (DP1 / DP2).
   * Uses the same Suspension records as completion-time generation so carry-forward /
   * cancel / serve lifecycle stays consistent (DP3 dedup via createPendingIfAbsent).
   */
  async syncPendingSuspensionsForServingMatch(
    servingMatchId: string,
    teamId: string,
  ): Promise<void> {
    const servingMatch = await this.prisma.match.findUnique({
      where: { id: servingMatchId },
      select: {
        id: true,
        tournamentId: true,
        startTime: true,
        matchDate: true,
        tournament: { select: { ballType: true } },
      },
    });
    if (!servingMatch || servingMatch.tournament.ballType !== BallType.Leather) {
      return;
    }

    const source = await this.findPriorLiveOrCompletedSourceMatch(
      teamId,
      servingMatch.tournamentId,
      servingMatch,
    );
    if (!source) {
      return;
    }

    const latePlayerIds = (source.attendancePunches ?? [])
      .filter((punch) => punch.status === AttendancePunchStatus.Late)
      .map((punch) => punch.userId);

    await this.prisma.suspension.deleteMany({
      where: {
        servingMatchId,
        teamId,
        triggeredByMatchId: source.id,
        status: SuspensionStatus.Pending,
        reason: SuspensionReason.LateLastMatch,
        ...(latePlayerIds.length > 0 ? { userId: { notIn: latePlayerIds } } : {}),
      },
    });

    if (latePlayerIds.length === 0) {
      return;
    }

    for (const userId of latePlayerIds) {
      const wasServingSourceMatch = await this.prisma.suspension.findFirst({
        where: {
          userId,
          teamId,
          servingMatchId: source.id,
          status: SuspensionStatus.Served,
          reason: SuspensionReason.LateLastMatch,
        },
        select: { id: true },
      });
      if (wasServingSourceMatch) {
        continue;
      }

      const alreadyResolvedOnServingMatch = await this.prisma.suspension.findFirst({
        where: {
          userId,
          teamId,
          triggeredByMatchId: source.id,
          reason: SuspensionReason.LateLastMatch,
          OR: [
            { actionedAtMatchId: servingMatchId },
            { servingMatchId, status: SuspensionStatus.Served },
          ],
        },
        select: { id: true },
      });
      if (alreadyResolvedOnServingMatch) {
        continue;
      }

      await this.createPendingIfAbsent({
        userId,
        teamId,
        tournamentId: servingMatch.tournamentId,
        triggeredByMatchId: source.id,
        servingMatchId,
      });
    }
  }

  private matchScheduleAnchor(match: {
    startTime: Date | null;
    matchDate: Date | null;
  }): Date | null {
    return match.startTime ?? match.matchDate;
  }

  /** DP1 — most recent live/completed team match strictly before the serving match. */
  private async findPriorLiveOrCompletedSourceMatch(
    teamId: string,
    tournamentId: string,
    servingMatch: { id: string; startTime: Date | null; matchDate: Date | null },
  ): Promise<{ id: string; attendancePunches: AttendancePunchRow[] } | null> {
    const beforeTime = this.matchScheduleAnchor(servingMatch);
    if (!beforeTime) {
      return null;
    }

    return this.prisma.match.findFirst({
      where: {
        ...ACTIVE_MATCH_WHERE,
        tournamentId,
        id: { not: servingMatch.id },
        state: { in: SOURCE_MATCH_STATES },
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        startTime: { lt: beforeTime },
      },
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        attendancePunches: {
          where: { teamId },
          select: { userId: true, teamId: true, status: true },
        },
      },
    });
  }

  private async assertSuspensionActionsAllowed(row: {
    userId: string;
    teamId: string | null;
    servingMatchId: string | null;
  }): Promise<void> {
    if (!row.teamId || !row.servingMatchId) {
      throw new BadRequestException({
        message: 'Suspension is missing team or serve match context',
        error: 'INVALID_SUSPENSION',
      });
    }
    const voteSideByUser = await this.loadPollVoteSideByUser(row.servingMatchId, row.teamId);
    if (this.resolvePollVoteSide(voteSideByUser, row.userId) !== SuspensionPollVoteSide.In) {
      throw new BadRequestException({
        message: 'Only penalty players who voted IN may be carried forward or cancelled',
        error: 'PENALTY_NOT_VOTED_IN',
      });
    }
  }

  private async loadPollVoteSideByUser(
    matchId: string,
    teamId: string,
  ): Promise<Map<string, 'in' | 'out'>> {
    const poll = await this.prisma.availabilityPoll.findUnique({
      where: { matchId_teamId: { matchId, teamId } },
      include: { votes: { select: { userId: true, isAvailable: true } } },
    });
    const map = new Map<string, 'in' | 'out'>();
    if (!poll) {
      return map;
    }
    for (const vote of poll.votes) {
      map.set(vote.userId, vote.isAvailable ? 'in' : 'out');
    }
    return map;
  }

  private resolvePollVoteSide(
    voteSideByUser: Map<string, 'in' | 'out'>,
    userId: string,
  ): SuspensionPollVoteSide {
    const side = voteSideByUser.get(userId);
    if (side === undefined) {
      return SuspensionPollVoteSide.Pending;
    }
    return side === 'in' ? SuspensionPollVoteSide.In : SuspensionPollVoteSide.Out;
  }

  /** Voted-OUT / no vote — move the same pending record to the next fixture (no captain action). */
  private async autoCarryForwardOutVote(row: {
    id: string;
    userId: string;
    teamId: string | null;
    tournamentId: string;
    servingMatchId: string | null;
    carryForwardCount: number;
  }): Promise<void> {
    if (!row.teamId || !row.servingMatchId) {
      return;
    }

    const serveMatch = await this.requireServingMatch(row.servingMatchId);
    const nextMatchId = await this.findNextTeamMatch(
      row.teamId,
      row.tournamentId,
      serveMatch.startTime ?? serveMatch.matchDate ?? new Date(),
      serveMatch.id,
    );

    await this.prisma.suspension.update({
      where: { id: row.id },
      data: {
        status: SuspensionStatus.Pending,
        servingMatchId: nextMatchId,
        carryForwardCount: { increment: 1 },
      },
    });

    await this.audit.record({
      action: 'SUSPENSION_AUTO_CARRIED_FORWARD_OUT_VOTE',
      targetEntityType: 'suspension',
      targetEntityId: row.id,
      after: {
        userId: row.userId,
        fromMatchId: row.servingMatchId,
        servingMatchId: nextMatchId,
        carryForwardCount: row.carryForwardCount + 1,
      },
    });
  }

  private async loadCompletedLeatherMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { select: { id: true, ballType: true } },
        attendancePunches: {
          select: { userId: true, teamId: true, status: true },
        },
      },
    });
    if (!match || match.tournament.ballType !== BallType.Leather) {
      return null;
    }
    if (!COMPLETION_STATES.includes(match.state as MatchState)) {
      return null;
    }
    return match;
  }

  private async findActiveOffense(
    userId: string,
    teamId: string,
    tournamentId: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.suspension.findFirst({
      where: {
        userId,
        teamId,
        tournamentId,
        status: { in: [...PENALTY_TAB_STATUSES] },
        reason: SuspensionReason.LateLastMatch,
      },
      select: { id: true },
    });
  }

  private async createPendingIfAbsent(input: {
    userId: string;
    teamId: string;
    tournamentId: string;
    triggeredByMatchId: string;
    servingMatchId: string;
  }): Promise<void> {
    const existing = await this.findActiveOffense(
      input.userId,
      input.teamId,
      input.tournamentId,
    );
    if (existing) {
      return;
    }

    await this.prisma.suspension.create({
      data: {
        userId: input.userId,
        teamId: input.teamId,
        tournamentId: input.tournamentId,
        triggeredByMatchId: input.triggeredByMatchId,
        servingMatchId: input.servingMatchId,
        status: SuspensionStatus.Pending,
        reason: SuspensionReason.LateLastMatch,
      },
    });
  }

  private async findNextTeamMatch(
    teamId: string,
    tournamentId: string,
    afterTime: Date,
    excludeMatchId?: string,
  ): Promise<string | null> {
    const next = await this.prisma.match.findFirst({
      where: {
        ...ACTIVE_MATCH_WHERE,
        tournamentId,
        id: excludeMatchId ? { not: excludeMatchId } : undefined,
        state: { in: UPCOMING_MATCH_STATES },
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        startTime: { gt: afterTime },
      },
      orderBy: { startTime: 'asc' },
      select: { id: true },
    });
    return next?.id ?? null;
  }

  private async requireActionableSuspension(suspensionId: string) {
    const row = await this.prisma.suspension.findUnique({ where: { id: suspensionId } });
    if (!row) {
      throw new NotFoundException({ message: 'Suspension not found', error: 'NOT_FOUND' });
    }
    if (
      !(ACTIONABLE_PENALTY_STATUSES as readonly string[]).includes(row.status) ||
      row.reason !== SuspensionReason.LateLastMatch
    ) {
      throw new BadRequestException({
        message: 'Only a pending suspension may be actioned',
        error: 'INVALID_SUSPENSION_STATE',
      });
    }
    if (!row.teamId || !row.servingMatchId) {
      throw new BadRequestException({
        message: 'Suspension is missing team or serve match context',
        error: 'INVALID_SUSPENSION',
      });
    }
    return row;
  }

  private async requireServingMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, startTime: true, matchDate: true, tournamentId: true },
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    return match;
  }

  private async assertCaptainForTeam(
    actor: AuthUser,
    teamId: string,
    tournamentId: string,
  ): Promise<void> {
    const allowed = await isCaptainOrViceCaptain(this.prisma, actor.id, tournamentId, teamId);
    if (!allowed) {
      throw new ForbiddenException({
        message: 'Only the captain or vice captain may action suspensions',
        error: 'FORBIDDEN',
      });
    }
  }
}
