import {
  AttendancePunchStatus,
  BallType,
  LateArrivalPenaltyState,
  LateArrivalFailedServeReason,
  ACTIVE_LATE_ARRIVAL_PENALTY_STATES,
  MatchSquadRole,
  MatchState,
  Permission,
  UserRole,
  computeAttendanceCaptureWindow,
  type AuthUser,
  type CancelLateArrivalPenaltyRequest,
  type DesignatePenaltyServeRequest,
  type LateArrivalPenaltyActionResponse,
  type PlayerLateArrivalPenaltyStatus,
  type TeamOutstandingPenaltiesView,
} from '@acc/types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LateArrivalPenalty, Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionService } from '../authz/permission.service';
import { isCaptainOrViceCaptain } from '../authz/team-leader.util';
import { PrismaService } from '../prisma/prisma.service';

const PENALTY_INCLUDE = {
  player: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
} as const satisfies Prisma.LateArrivalPenaltyInclude;

type PenaltyRow = Prisma.LateArrivalPenaltyGetPayload<{ include: typeof PENALTY_INCLUDE }>;

@Injectable()
export class LateArrivalPenaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly audit: AuditService,
  ) {}

  /** Captain verified a late punch — create OWED or evaluate serve carry-forward. */
  async onCaptainVerifyLate(
    actor: AuthUser,
    matchId: string,
    teamId: string,
    playerId: string,
  ): Promise<void> {
    const match = await this.requireLeatherMatch(matchId);
    await this.assertTeamLeader(actor, match.tournamentId, teamId);

    const active = await this.findActivePenalty(playerId);
    if (active?.state === LateArrivalPenaltyState.Assigned && active.assignedServeMatchId === matchId) {
      await this.carryForwardFailedServe(
        active,
        actor.id,
        matchId,
        LateArrivalFailedServeReason.Late,
      );
      return;
    }

    if (active != null) {
      return;
    }

    await this.createOwed(actor.id, playerId, teamId, match.tournamentId, matchId);
  }

  /** Captain verified an on-time punch — discharge penalty at the serving match. */
  async onCaptainVerifyServeCompletion(
    actor: AuthUser,
    matchId: string,
    teamId: string,
    playerId: string,
  ): Promise<void> {
    const match = await this.requireLeatherMatch(matchId);
    await this.assertTeamLeader(actor, match.tournamentId, teamId);

    const active = await this.findActivePenalty(playerId);
    if (
      active?.state !== LateArrivalPenaltyState.Assigned ||
      active.assignedServeMatchId !== matchId ||
      active.teamId !== teamId
    ) {
      throw new BadRequestException({
        message: 'Player is not designated to serve a penalty at this match',
        error: 'NOT_DESIGNATED_SERVER',
      });
    }

    const punch = await this.prisma.matchAttendancePunch.findUnique({
      where: { matchId_userId: { matchId, userId: playerId } },
      select: { status: true, teamId: true },
    });
    if (!punch || punch.teamId !== teamId) {
      throw new BadRequestException({
        message: 'An on-time punch is required before serve completion can be verified',
        error: 'PUNCH_REQUIRED',
      });
    }
    if (punch.status !== AttendancePunchStatus.OnTime) {
      throw new BadRequestException({
        message: 'Only an on-time arrival clears a penalty serve',
        error: 'NOT_ON_TIME',
      });
    }

    await this.discharge(
      active,
      actor.id,
      matchId,
      'Captain verified on-time penalty serve completion',
    );
  }

  /** Evaluate designated servers who never punched after the capture window closes. */
  async evaluateNoShowServes(matchId: string, teamId: string, now: Date = new Date()): Promise<void> {
    const match = await this.requireLeatherMatch(matchId);
    const window = computeAttendanceCaptureWindow(match);
    if (!window || now <= window.closesAt) {
      return;
    }

    const assigned = await this.prisma.lateArrivalPenalty.findMany({
      where: {
        teamId,
        state: LateArrivalPenaltyState.Assigned,
        assignedServeMatchId: matchId,
      },
    });

    for (const penalty of assigned) {
      const punch = await this.prisma.matchAttendancePunch.findUnique({
        where: { matchId_userId: { matchId, userId: penalty.playerId } },
        select: { id: true },
      });
      if (punch == null) {
        await this.carryForwardFailedServe(
          penalty,
          null,
          matchId,
          LateArrivalFailedServeReason.NoShow,
        );
      }
    }
  }

  async listOutstandingForTeam(
    actor: AuthUser,
    teamId: string,
  ): Promise<TeamOutstandingPenaltiesView> {
    const team = await this.requireTeam(teamId);
    await this.assertTeamLeader(actor, team.tournamentId, teamId);

    const penalties = await this.prisma.lateArrivalPenalty.findMany({
      where: {
        teamId,
        state: { in: [...ACTIVE_LATE_ARRIVAL_PENALTY_STATES] },
      },
      include: PENALTY_INCLUDE,
      orderBy: [{ state: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      teamId,
      penalties: penalties.map((row) => this.toPlayerRow(row)),
    };
  }

  async getPlayerStatus(playerId: string): Promise<PlayerLateArrivalPenaltyStatus> {
    const active = await this.findActivePenalty(playerId);
    if (active == null) {
      return { status: 'NONE' };
    }
    if (active.state === LateArrivalPenaltyState.Owed) {
      return {
        status: 'OWED',
        penaltyId: active.id,
        teamId: active.teamId,
        originMatchId: active.originMatchId,
      };
    }
    if (active.state === LateArrivalPenaltyState.Assigned && active.assignedServeMatchId != null) {
      return {
        status: 'ASSIGNED',
        penaltyId: active.id,
        teamId: active.teamId,
        originMatchId: active.originMatchId,
        serveMatchId: active.assignedServeMatchId,
      };
    }
    return { status: 'NONE' };
  }

  async designateToServe(
    actor: AuthUser,
    teamId: string,
    penaltyId: string,
    body: DesignatePenaltyServeRequest,
  ): Promise<LateArrivalPenaltyActionResponse> {
    const team = await this.requireTeam(teamId);
    await this.assertTeamLeader(actor, team.tournamentId, teamId);
    await this.assertPermission(actor, Permission.SELECT_PLAYING_11, {
      teamId,
      tournamentId: team.tournamentId,
      matchId: body.serveMatchId,
    });

    const penalty = await this.requireTeamPenalty(penaltyId, teamId);
    if (penalty.state !== LateArrivalPenaltyState.Owed) {
      throw new BadRequestException({
        message: 'Only an owed penalty may be designated to serve',
        error: 'INVALID_PENALTY_STATE',
      });
    }

    const serveMatch = await this.requireLeatherMatch(body.serveMatchId);
    if (serveMatch.tournamentId !== team.tournamentId) {
      throw new BadRequestException({
        message: 'Serve match must belong to the same tournament',
        error: 'INVALID_SERVE_MATCH',
      });
    }

    const isParticipant =
      serveMatch.homeTeamId === teamId || serveMatch.awayTeamId === teamId;
    if (!isParticipant) {
      throw new BadRequestException({
        message: 'Team is not participating in the serve match',
        error: 'INVALID_SERVE_MATCH',
      });
    }

    await this.assertPlayerNotInSquad(penalty.playerId, body.serveMatchId, teamId);

    const updated = await this.transition(
      penalty,
      LateArrivalPenaltyState.Assigned,
      actor.id,
      {
        assignedServeMatch: { connect: { id: body.serveMatchId } },
      },
      'LATE_ARRIVAL_PENALTY_DESIGNATED',
      body.serveMatchId,
    );

    return this.toActionResponse(updated);
  }

  async cancelPenalty(
    actor: AuthUser,
    teamId: string,
    penaltyId: string,
    body: CancelLateArrivalPenaltyRequest,
  ): Promise<LateArrivalPenaltyActionResponse> {
    const team = await this.requireTeam(teamId);
    await this.assertTeamLeader(actor, team.tournamentId, teamId);
    await this.assertPermission(actor, Permission.CANCEL_SUSPENSION, {
      teamId,
      tournamentId: team.tournamentId,
    });

    const penalty = await this.requireTeamPenalty(penaltyId, teamId);
    if (!ACTIVE_LATE_ARRIVAL_PENALTY_STATES.includes(penalty.state as LateArrivalPenaltyState)) {
      throw new BadRequestException({
        message: 'Only an active penalty may be cancelled',
        error: 'INVALID_PENALTY_STATE',
      });
    }

    const now = new Date();
    const updated = await this.transition(
      penalty,
      LateArrivalPenaltyState.Cancelled,
      actor.id,
      {
        assignedServeMatch: { disconnect: true },
        cancelledBy: { connect: { id: actor.id } },
        cancelledAt: now,
      },
      'LATE_ARRIVAL_PENALTY_CANCELLED',
      penalty.assignedServeMatchId ?? penalty.originMatchId,
      body.reason,
    );

    return this.toActionResponse(updated);
  }

  /** Captain reverses a serve designation before the serve is evaluated. */
  async undesignateFromServe(
    actor: AuthUser,
    teamId: string,
    penaltyId: string,
  ): Promise<LateArrivalPenaltyActionResponse> {
    const team = await this.requireTeam(teamId);
    await this.assertTeamLeader(actor, team.tournamentId, teamId);

    const penalty = await this.requireTeamPenalty(penaltyId, teamId);
    if (penalty.state !== LateArrivalPenaltyState.Assigned || penalty.assignedServeMatchId == null) {
      throw new BadRequestException({
        message: 'Only a penalty designated for a serve match may be undesignated',
        error: 'INVALID_PENALTY_STATE',
      });
    }

    await this.requireLeatherMatch(penalty.assignedServeMatchId);
    await this.assertServeMatchEditable(penalty.assignedServeMatchId);

    const updated = await this.transition(
      penalty,
      LateArrivalPenaltyState.Owed,
      actor.id,
      { assignedServeMatch: { disconnect: true } },
      'LATE_ARRIVAL_PENALTY_UNDESIGNATED',
      penalty.assignedServeMatchId,
      'Captain removed serve designation before match',
    );

    return this.toActionResponse(updated);
  }

  /** Ensure penalty-server designations match the captain's selection for a match. */
  async syncServeDesignations(
    actor: AuthUser,
    teamId: string,
    serveMatchId: string,
    penaltyServerUserIds: readonly string[],
  ): Promise<void> {
    const team = await this.requireTeam(teamId);
    await this.assertTeamLeader(actor, team.tournamentId, teamId);
    await this.requireLeatherMatch(serveMatchId);
    await this.assertServeMatchEditable(serveMatchId);

    const uniqueIds = [...new Set(penaltyServerUserIds)];
    const roster = await this.prisma.teamMembership.findMany({
      where: { teamId, tournamentId: team.tournamentId },
      select: { userId: true },
    });
    const rosterIds = new Set(roster.map((row) => row.userId));
    for (const userId of uniqueIds) {
      if (!rosterIds.has(userId)) {
        throw new BadRequestException({
          message: 'Penalty servers must be on the team roster',
          error: 'PLAYER_NOT_ON_ROSTER',
        });
      }
    }

    const activePenalties = await this.prisma.lateArrivalPenalty.findMany({
      where: {
        teamId,
        playerId: { in: [...rosterIds] },
        state: { in: [...ACTIVE_LATE_ARRIVAL_PENALTY_STATES] },
      },
    });

    const penaltyByPlayer = new Map(activePenalties.map((row) => [row.playerId, row]));
    for (const userId of uniqueIds) {
      const penalty = penaltyByPlayer.get(userId);
      if (!penalty) {
        throw new BadRequestException({
          message: 'Selected player does not owe a late-arrival penalty',
          error: 'NO_OUTSTANDING_PENALTY',
        });
      }
      if (
        penalty.state === LateArrivalPenaltyState.Assigned &&
        penalty.assignedServeMatchId != null &&
        penalty.assignedServeMatchId !== serveMatchId
      ) {
        throw new BadRequestException({
          message: 'Player is already designated to serve at another match',
          error: 'ASSIGNED_ELSEWHERE',
        });
      }
    }

    const desired = new Set(uniqueIds);
    for (const userId of desired) {
      const penalty = penaltyByPlayer.get(userId)!;
      if (penalty.state === LateArrivalPenaltyState.Owed) {
        await this.designateToServe(actor, teamId, penalty.id, { serveMatchId });
      }
    }

    for (const penalty of activePenalties) {
      if (
        penalty.state === LateArrivalPenaltyState.Assigned &&
        penalty.assignedServeMatchId === serveMatchId &&
        !desired.has(penalty.playerId)
      ) {
        await this.undesignateFromServe(actor, teamId, penalty.id);
      }
    }
  }

  /** Designated penalty servers for a match (attendance monitoring + punch-time view). */
  async loadDesignatedServers(
    matchId: string,
    teamId: string,
  ): Promise<
    { userId: string; firstName: string; lastName: string; profilePhotoUrl: string | null }[]
  > {
    const penalties = await this.prisma.lateArrivalPenalty.findMany({
      where: {
        teamId,
        state: LateArrivalPenaltyState.Assigned,
        assignedServeMatchId: matchId,
      },
      include: {
        player: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
      orderBy: [{ player: { firstName: 'asc' } }, { player: { lastName: 'asc' } }],
    });

    return penalties.map((row) => ({
      userId: row.player.id,
      firstName: row.player.firstName,
      lastName: row.player.lastName,
      profilePhotoUrl: row.player.profilePhotoUrl,
    }));
  }

  /** Match IDs where the player is designated to serve (for geofence monitoring). */
  async loadServeMonitoringMatchIds(playerId: string): Promise<
    { matchId: string; teamId: string }[]
  > {
    const rows = await this.prisma.lateArrivalPenalty.findMany({
      where: {
        playerId,
        state: LateArrivalPenaltyState.Assigned,
        assignedServeMatchId: { not: null },
      },
      select: { assignedServeMatchId: true, teamId: true },
    });
    return rows
      .filter((row): row is { assignedServeMatchId: string; teamId: string } =>
        row.assignedServeMatchId != null,
      )
      .map((row) => ({ matchId: row.assignedServeMatchId, teamId: row.teamId }));
  }

  private async createOwed(
    actorUserId: string,
    playerId: string,
    teamId: string,
    tournamentId: string,
    originMatchId: string,
  ): Promise<LateArrivalPenalty> {
    try {
      const penalty = await this.prisma.lateArrivalPenalty.create({
        data: {
          playerId,
          teamId,
          tournamentId,
          originMatchId,
          state: LateArrivalPenaltyState.Owed,
        },
      });

      await this.recordTransition(
        penalty.id,
        null,
        LateArrivalPenaltyState.Owed,
        actorUserId,
        originMatchId,
        'Captain verified late arrival',
      );

      await this.audit.record({
        action: 'LATE_ARRIVAL_PENALTY_CREATED',
        actorUserId,
        targetUserId: playerId,
        targetEntityType: 'late_arrival_penalty',
        targetEntityId: penalty.id,
        after: {
          state: LateArrivalPenaltyState.Owed,
          originMatchId,
          teamId,
        },
      });

      return penalty;
    } catch (error) {
      if (
        error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'Player already has an outstanding late-arrival penalty',
          error: 'PENALTY_ALREADY_ACTIVE',
        });
      }
      throw error;
    }
  }

  private async carryForwardFailedServe(
    penalty: LateArrivalPenalty,
    actorUserId: string | null,
    contextMatchId: string,
    failureKind: LateArrivalFailedServeReason,
  ): Promise<void> {
    const reason =
      failureKind === LateArrivalFailedServeReason.Late
        ? 'Failed serve: late arrival at serving match'
        : 'Failed serve: no-show at serving match';

    await this.transition(
      penalty,
      LateArrivalPenaltyState.Owed,
      actorUserId,
      { assignedServeMatch: { disconnect: true } },
      'LATE_ARRIVAL_PENALTY_CARRIED_FORWARD',
      contextMatchId,
      reason,
      { failureKind },
    );
  }

  private async discharge(
    penalty: LateArrivalPenalty,
    actorUserId: string | null,
    contextMatchId: string,
    reason: string,
  ): Promise<void> {
    await this.transition(
      penalty,
      LateArrivalPenaltyState.Discharged,
      actorUserId,
      {
        assignedServeMatch: { disconnect: true },
        dischargedAt: new Date(),
      },
      'LATE_ARRIVAL_PENALTY_DISCHARGED',
      contextMatchId,
      reason,
    );
  }

  private async transition(
    penalty: LateArrivalPenalty,
    toState: LateArrivalPenaltyState,
    actorUserId: string | null,
    data: Prisma.LateArrivalPenaltyUpdateInput,
    auditAction: string,
    contextMatchId: string,
    reason?: string,
    auditDetails?: Record<string, string>,
  ): Promise<LateArrivalPenalty> {
    const fromState = penalty.state as LateArrivalPenaltyState;
    const updated = await this.prisma.lateArrivalPenalty.update({
      where: { id: penalty.id },
      data: { ...data, state: toState },
    });

    await this.recordTransition(
      penalty.id,
      fromState,
      toState,
      actorUserId,
      contextMatchId,
      reason,
    );

    await this.audit.record({
      action: auditAction,
      actorUserId: actorUserId ?? undefined,
      actorLabel: actorUserId == null ? 'System' : undefined,
      targetUserId: penalty.playerId,
      targetEntityType: 'late_arrival_penalty',
      targetEntityId: penalty.id,
      before: { state: fromState, assignedServeMatchId: penalty.assignedServeMatchId },
      after: {
        state: toState,
        assignedServeMatchId: updated.assignedServeMatchId,
      },
      details: {
        contextMatchId,
        ...(reason ? { reason } : {}),
        ...auditDetails,
      },
    });

    return updated;
  }

  private async recordTransition(
    penaltyId: string,
    fromState: LateArrivalPenaltyState | null,
    toState: LateArrivalPenaltyState,
    actorUserId: string | null,
    contextMatchId: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.lateArrivalPenaltyTransition.create({
      data: {
        penaltyId,
        fromState,
        toState,
        actorUserId,
        contextMatchId,
        reason: reason ?? null,
      },
    });
  }

  private async findActivePenalty(playerId: string): Promise<LateArrivalPenalty | null> {
    return this.prisma.lateArrivalPenalty.findFirst({
      where: {
        playerId,
        state: { in: [...ACTIVE_LATE_ARRIVAL_PENALTY_STATES] },
      },
    });
  }

  private async requireTeamPenalty(penaltyId: string, teamId: string): Promise<LateArrivalPenalty> {
    const penalty = await this.prisma.lateArrivalPenalty.findFirst({
      where: { id: penaltyId, teamId },
    });
    if (!penalty) {
      throw new NotFoundException({ message: 'Penalty not found', error: 'NOT_FOUND' });
    }
    return penalty;
  }

  private async requireTeam(teamId: string): Promise<{ id: string; tournamentId: string }> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, tournamentId: true },
    });
    if (!team) {
      throw new NotFoundException({ message: 'Team not found', error: 'NOT_FOUND' });
    }
    return team;
  }

  private async requireLeatherMatch(matchId: string): Promise<{
    id: string;
    tournamentId: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    matchDate: Date | null;
    startTime: Date | null;
    reportingTime: Date | null;
  }> {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, isDeleted: false },
      select: {
        id: true,
        tournamentId: true,
        homeTeamId: true,
        awayTeamId: true,
        matchDate: true,
        startTime: true,
        reportingTime: true,
        tournament: { select: { ballType: true } },
      },
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'NOT_FOUND' });
    }
    if (match.tournament.ballType !== BallType.Leather) {
      throw new BadRequestException({
        message: 'Late-arrival penalties apply only to leather-ball matches',
        error: 'INVALID_BALL_TYPE',
      });
    }
    return match;
  }

  private async assertServeMatchEditable(matchId: string): Promise<void> {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, isDeleted: false },
      select: { state: true },
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'NOT_FOUND' });
    }
    const editableStates: MatchState[] = [
      MatchState.Scheduled,
      MatchState.Delayed,
      MatchState.PlayingXiLocked,
      MatchState.TossCompleted,
    ];
    if (!editableStates.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Penalty serve designations cannot be changed after the match goes live',
        error: 'INVALID_MATCH_STATE',
      });
    }
  }

  private async assertPlayerNotInSquad(
    playerId: string,
    matchId: string,
    teamId: string,
  ): Promise<void> {
    const squadPlayer = await this.prisma.matchSquadPlayer.findFirst({
      where: {
        userId: playerId,
        role: { in: [MatchSquadRole.PlayingXi, MatchSquadRole.Substitute] },
        squad: { matchId, teamId },
      },
      select: { id: true },
    });
    if (squadPlayer) {
      throw new BadRequestException({
        message: 'A penalty server must not be in the Playing 11 or substitutes for the serve match',
        error: 'PLAYER_IN_SQUAD',
      });
    }
  }

  private async assertTeamLeader(
    actor: AuthUser,
    tournamentId: string,
    teamId: string,
  ): Promise<void> {
    const isLeader = await isCaptainOrViceCaptain(this.prisma, actor.id, tournamentId, teamId);
    if (!isLeader) {
      throw new ForbiddenException({
        message: 'Only the team Captain or Vice-Captain may manage late-arrival penalties',
        error: 'FORBIDDEN',
      });
    }
  }

  private async assertPermission(
    actor: AuthUser,
    permission: Permission,
    context: { teamId: string; tournamentId: string; matchId?: string },
  ): Promise<void> {
    const allowed = await this.permissions.check(permission, actor, context);
    if (!allowed) {
      throw new ForbiddenException({
        message: 'Insufficient permissions for this action',
        error: 'FORBIDDEN',
      });
    }
  }

  private toPlayerRow(row: PenaltyRow) {
    return {
      penaltyId: row.id,
      userId: row.player.id,
      firstName: row.player.firstName,
      lastName: row.player.lastName,
      profilePhotoUrl: row.player.profilePhotoUrl,
      state: row.state as LateArrivalPenaltyState,
      originMatchId: row.originMatchId,
      assignedServeMatchId: row.assignedServeMatchId,
    };
  }

  private toActionResponse(row: LateArrivalPenalty): LateArrivalPenaltyActionResponse {
    return {
      penaltyId: row.id,
      state: row.state as LateArrivalPenaltyState,
      playerId: row.playerId,
      teamId: row.teamId,
      originMatchId: row.originMatchId,
      assignedServeMatchId: row.assignedServeMatchId,
      dischargedAt: row.dischargedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    };
  }
}
