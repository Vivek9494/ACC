import {
  AttendancePunchStatus,
  BallType,
  LateArrivalPenaltyState,
  MatchState,
  SuspensionReason,
  SuspensionStatus,
  SuspensionPollVoteSide,
  SuspensionXiBadge,
  UserRole,
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
      suspensionStatus: row.status as
        | typeof SuspensionStatus.Pending
        | typeof SuspensionStatus.CarriedForward,
      isCarriedForward: row.status === SuspensionStatus.CarriedForward,
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
    await this.unassignParallelLateArrivalPenalty(row, currentServingMatchId);

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
    await this.cancelParallelLateArrivalPenalty(row, actor.id);

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

  /**
   * Captain's manual suspension decisions on Playing XI confirm.
   * Checked IN voters serve this match; every other active row is carried to
   * the next team fixture when one exists. With no future match, unchecked
   * rows stay PENDING with servingMatchId cleared so they attach when the
   * next fixture is scheduled. Voting IN only makes a row selectable — it
   * never auto-selects service.
   */
  async resolveManualSuspensionsOnPlayingXiConfirm(
    matchId: string,
    teamId: string,
    selectedServerUserIds: readonly string[],
    squadUserIds: readonly string[],
  ): Promise<void> {
    await this.syncPendingSuspensionsForServingMatch(matchId, teamId);

    const active = await this.prisma.suspension.findMany({
      where: {
        servingMatchId: matchId,
        teamId,
        status: { in: [...PENALTY_TAB_STATUSES] },
        reason: SuspensionReason.LateLastMatch,
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (active.length === 0) {
      if (selectedServerUserIds.length > 0) {
        throw new BadRequestException({
          message: 'Selected penalty servers are not eligible for this match',
          error: 'INVALID_PENALTY_SERVER',
        });
      }
      return;
    }

    const voteSideByUser = await this.loadPollVoteSideByUser(matchId, teamId);
    const selected = new Set(selectedServerUserIds);
    const activeByUser = new Map(active.map((row) => [row.userId, row]));
    const squad = new Set(squadUserIds);

    for (const userId of selected) {
      const row = activeByUser.get(userId);
      if (
        !row ||
        this.resolvePollVoteSide(voteSideByUser, userId) !== SuspensionPollVoteSide.In
      ) {
        throw new BadRequestException({
          message: `${this.formatSuspensionPlayerLabel(row)} is not eligible to serve this match (must be suspended and voted IN)`,
          error: 'INVALID_PENALTY_SERVER',
        });
      }
      if (squad.has(userId)) {
        throw new BadRequestException({
          message: `${this.formatSuspensionPlayerLabel(row)} cannot serve a suspension while also in the Playing 11 or substitutes`,
          error: 'PENALTY_SERVER_IN_SQUAD',
        });
      }
    }

    const unchecked = active.filter((row) => !selected.has(row.userId));
    const serveMatch = await this.requireServingMatch(matchId);
    const nextMatchId =
      unchecked.length > 0
        ? await this.findNextTeamMatch(
            teamId,
            active[0]!.tournamentId,
            serveMatch.startTime ?? serveMatch.matchDate ?? new Date(),
            matchId,
          )
        : null;

    for (const row of active) {
      const voteSide = this.resolvePollVoteSide(voteSideByUser, row.userId);
      if (selected.has(row.userId) && voteSide === SuspensionPollVoteSide.In) {
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
        await this.assignParallelLateArrivalPenalty(row, matchId);
      } else if (nextMatchId) {
        await this.prisma.suspension.update({
          where: { id: row.id },
          data: {
            status: SuspensionStatus.CarriedForward,
            servingMatchId: nextMatchId,
            actionedAtMatchId: matchId,
            carryForwardCount: { increment: 1 },
          },
        });
        await this.audit.record({
          action: 'SUSPENSION_AUTO_CARRIED_FORWARD',
          targetEntityType: 'suspension',
          targetEntityId: row.id,
          after: {
            userId: row.userId,
            fromMatchId: matchId,
            servingMatchId: nextMatchId,
            reason:
              voteSide === SuspensionPollVoteSide.In
                ? 'Captain left suspension unchecked'
                : 'Player unavailable to serve',
          },
        });
        await this.unassignParallelLateArrivalPenalty(row, matchId);
      } else {
        // No future fixture yet — keep PENDING; reattach when the next match syncs.
        await this.prisma.suspension.update({
          where: { id: row.id },
          data: {
            status: SuspensionStatus.Pending,
            servingMatchId: null,
            actionedAtMatchId: matchId,
          },
        });
        await this.audit.record({
          action: 'SUSPENSION_LEFT_PENDING_NO_NEXT_MATCH',
          targetEntityType: 'suspension',
          targetEntityId: row.id,
          after: {
            userId: row.userId,
            fromMatchId: matchId,
            reason:
              voteSide === SuspensionPollVoteSide.In
                ? 'Captain left suspension unchecked; no future match scheduled'
                : 'Player unavailable to serve; no future match scheduled',
          },
        });
        await this.unassignParallelLateArrivalPenalty(row, matchId);
      }
    }
  }

  /**
   * Preflight manual decisions before the squad lock is written.
   * Unchecked suspensions no longer block Confirm when there is no next match —
   * they remain pending and attach when a later fixture is scheduled.
   */
  async assertManualSuspensionSelection(
    matchId: string,
    teamId: string,
    selectedServerUserIds: readonly string[],
    squadUserIds: readonly string[],
  ): Promise<void> {
    await this.syncPendingSuspensionsForServingMatch(matchId, teamId);
    const active = await this.prisma.suspension.findMany({
      where: {
        servingMatchId: matchId,
        teamId,
        status: { in: [...PENALTY_TAB_STATUSES] },
        reason: SuspensionReason.LateLastMatch,
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const selected = new Set(selectedServerUserIds);
    const activeByUser = new Map(active.map((row) => [row.userId, row]));
    const squad = new Set(squadUserIds);
    const voteSideByUser = await this.loadPollVoteSideByUser(matchId, teamId);

    for (const userId of selected) {
      const row = activeByUser.get(userId);
      if (
        !row ||
        this.resolvePollVoteSide(voteSideByUser, userId) !== SuspensionPollVoteSide.In
      ) {
        throw new BadRequestException({
          message: `${this.formatSuspensionPlayerLabel(row)} is not eligible to serve this match (must be suspended and voted IN)`,
          error: 'INVALID_PENALTY_SERVER',
        });
      }
      if (squad.has(userId)) {
        throw new BadRequestException({
          message: `${this.formatSuspensionPlayerLabel(row)} cannot serve a suspension while also in the Playing 11 or substitutes`,
          error: 'PENALTY_SERVER_IN_SQUAD',
        });
      }
    }
  }

  private formatSuspensionPlayerLabel(
    row: { user?: { firstName: string; lastName: string } | null; userId: string } | undefined,
  ): string {
    if (!row) {
      return 'That player';
    }
    const first = row.user?.firstName?.trim() ?? '';
    const last = row.user?.lastName?.trim() ?? '';
    const name = `${first} ${last}`.trim();
    return name.length > 0 ? name : 'That player';
  }

  /** Non-poll squad confirmation has no manual server choices, so all obligations carry. */
  async markRemainingPendingAsServed(matchId: string, teamId: string): Promise<void> {
    await this.resolveManualSuspensionsOnPlayingXiConfirm(matchId, teamId, [], []);
  }

  async assertPlayingXiExcludesPendingSuspensions(
    matchId: string,
    teamId: string,
    playingXi: string[],
    selectedServerUserIds: readonly string[] = [],
  ): Promise<void> {
    await this.syncPendingSuspensionsForServingMatch(matchId, teamId);
    if (playingXi.length === 0 || selectedServerUserIds.length === 0) {
      return;
    }
    const selected = new Set(selectedServerUserIds);
    if (playingXi.some((userId) => selected.has(userId))) {
      throw new BadRequestException({
        message: 'Penalty servers cannot be in the Playing 11 or substitutes',
        error: 'PENALTY_SERVER_IN_SQUAD',
      });
    }
  }

  /**
   * Keep the attendance penalty record aligned while Suspension remains the
   * authoritative Playing XI decision model.
   */
  private async assignParallelLateArrivalPenalty(
    suspension: {
      userId: string;
      teamId: string | null;
      tournamentId: string;
      triggeredByMatchId: string | null;
    },
    serveMatchId: string,
  ): Promise<void> {
    if (!suspension.teamId || !suspension.triggeredByMatchId) {
      return;
    }
    const active = await this.prisma.lateArrivalPenalty.findFirst({
      where: {
        playerId: suspension.userId,
        state: { in: [LateArrivalPenaltyState.Owed, LateArrivalPenaltyState.Assigned] },
      },
    });
    if (
      active?.state === LateArrivalPenaltyState.Assigned &&
      active.assignedServeMatchId !== serveMatchId
    ) {
      throw new BadRequestException({
        message: 'Player is already designated to serve a penalty at another match',
        error: 'ASSIGNED_ELSEWHERE',
      });
    }
    if (active?.state === LateArrivalPenaltyState.Assigned) {
      return;
    }

    if (active) {
      await this.prisma.lateArrivalPenalty.update({
        where: { id: active.id },
        data: {
          state: LateArrivalPenaltyState.Assigned,
          assignedServeMatchId: serveMatchId,
        },
      });
      await this.prisma.lateArrivalPenaltyTransition.create({
        data: {
          penaltyId: active.id,
          fromState: LateArrivalPenaltyState.Owed,
          toState: LateArrivalPenaltyState.Assigned,
          actorUserId: null,
          contextMatchId: serveMatchId,
          reason: 'Captain selected suspension service on Playing 11 confirm',
        },
      });
      return;
    }

    const created = await this.prisma.lateArrivalPenalty.create({
      data: {
        playerId: suspension.userId,
        teamId: suspension.teamId,
        tournamentId: suspension.tournamentId,
        originMatchId: suspension.triggeredByMatchId,
        state: LateArrivalPenaltyState.Assigned,
        assignedServeMatchId: serveMatchId,
      },
    });
    await this.prisma.lateArrivalPenaltyTransition.create({
      data: {
        penaltyId: created.id,
        fromState: null,
        toState: LateArrivalPenaltyState.Assigned,
        actorUserId: null,
        contextMatchId: serveMatchId,
        reason: 'Captain selected suspension service on Playing 11 confirm',
      },
    });
  }

  private async unassignParallelLateArrivalPenalty(
    suspension: { userId: string },
    currentMatchId: string,
  ): Promise<void> {
    const active = await this.prisma.lateArrivalPenalty.findFirst({
      where: {
        playerId: suspension.userId,
        state: LateArrivalPenaltyState.Assigned,
        assignedServeMatchId: currentMatchId,
      },
    });
    if (!active) {
      return;
    }
    await this.prisma.lateArrivalPenalty.update({
      where: { id: active.id },
      data: {
        state: LateArrivalPenaltyState.Owed,
        assignedServeMatchId: null,
      },
    });
    await this.prisma.lateArrivalPenaltyTransition.create({
      data: {
        penaltyId: active.id,
        fromState: LateArrivalPenaltyState.Assigned,
        toState: LateArrivalPenaltyState.Owed,
        actorUserId: null,
        contextMatchId: currentMatchId,
        reason: 'Suspension carried forward from Playing 11 selection',
      },
    });
  }

  private async cancelParallelLateArrivalPenalty(
    suspension: { userId: string; triggeredByMatchId: string | null },
    actorUserId: string,
  ): Promise<void> {
    const active = await this.prisma.lateArrivalPenalty.findFirst({
      where: {
        playerId: suspension.userId,
        originMatchId: suspension.triggeredByMatchId ?? undefined,
        state: { in: [LateArrivalPenaltyState.Owed, LateArrivalPenaltyState.Assigned] },
      },
    });
    if (!active) {
      return;
    }
    await this.prisma.lateArrivalPenalty.update({
      where: { id: active.id },
      data: {
        state: LateArrivalPenaltyState.Cancelled,
        assignedServeMatchId: null,
        cancelledByUserId: actorUserId,
        cancelledAt: new Date(),
      },
    });
    await this.prisma.lateArrivalPenaltyTransition.create({
      data: {
        penaltyId: active.id,
        fromState: active.state,
        toState: LateArrivalPenaltyState.Cancelled,
        actorUserId,
        contextMatchId: suspension.triggeredByMatchId,
        reason: 'Captain cancelled suspension from Playing 11 selection',
      },
    });
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

    // Reattach suspensions left pending when Confirm ran with no next fixture.
    await this.prisma.suspension.updateMany({
      where: {
        teamId,
        tournamentId: servingMatch.tournamentId,
        status: { in: [...PENALTY_TAB_STATUSES] },
        reason: SuspensionReason.LateLastMatch,
        servingMatchId: null,
      },
      data: { servingMatchId },
    });

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
