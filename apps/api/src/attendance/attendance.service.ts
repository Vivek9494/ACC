import {
  AttendancePunchSource,
  AttendancePunchStatus,
  BallType,
  classifyAttendanceStatus,
  computeAttendanceCaptureWindow,
  formatPunchTimeLabel,
  formatVenueDateTime,
  GEOFENCE_MONITOR_RADIUS_METERS,
  GEOFENCE_RADIUS_METERS,
  isAttendanceMatchDay,
  isWithinAttendanceCaptureWindow,
  isWithinGeofence,
  LateArrivalPenaltyState,
  MatchSquadRole,
  MatchState,
  Permission,
  PUNCH_TIME_PAGE_MATCH_STATES,
  isPunchTimeReadOnly,
  serverVenueTimezone,
  UserRole,
  type AttendanceMonitoringTarget,
  type AttendanceMonitoringView,
  type AuthUser,
  type AutoAttendancePunchResponse,
  type CaptainPunchTimeCardView,
  type PunchTimeAttendanceView,
  type PunchTimePlayerRow,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Match } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionService } from '../authz/permission.service';
import { isCaptainOrViceCaptain } from '../authz/team-leader.util';
import { LateArrivalPenaltyService } from '../late-arrival-penalty/late-arrival-penalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentRelationWhere } from '../tournaments/tournament-query';

const ATTENDANCE_ELIGIBLE_ROLES: MatchSquadRole[] = [
  MatchSquadRole.PlayingXi,
  MatchSquadRole.Substitute,
];

const PUNCH_TIME_MATCH_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.Delayed,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
  MatchState.Live,
  MatchState.RainInterrupted,
];

type AttendanceMatchRow = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  tournament: { id: string; name: string; ballType: string; timezone: string | null; createdByUserId: string };
};

const ATTENDANCE_MATCH_INCLUDE = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
  tournament: { select: { id: true, name: true, ballType: true, timezone: true, createdByUserId: true } },
} as const satisfies Prisma.MatchInclude;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly audit: AuditService,
    private readonly penalties: LateArrivalPenaltyService,
  ) {}

  async getMonitoringTargets(actor: AuthUser): Promise<AttendanceMonitoringView> {
    const now = new Date();
    const squadRows = await this.prisma.matchSquadPlayer.findMany({
      where: {
        userId: actor.id,
        role: { in: [MatchSquadRole.PlayingXi, MatchSquadRole.Substitute] },
        squad: {
          match: {
            isDeleted: false,
            reportingTime: { not: null },
            geofenceLat: { not: null },
            geofenceLng: { not: null },
            state: { in: PUNCH_TIME_MATCH_STATES },
            tournament: { ...activeTournamentRelationWhere.tournament, ballType: BallType.Leather },
          },
        },
      },
      select: {
        squad: {
          select: {
            teamId: true,
            match: { include: ATTENDANCE_MATCH_INCLUDE },
          },
        },
      },
    });

    const targets: AttendanceMonitoringTarget[] = [];
    const seen = new Set<string>();

    for (const row of squadRows) {
      const match = row.squad.match as AttendanceMatchRow;
      if (seen.has(match.id)) {
        continue;
      }
      seen.add(match.id);

      const scheduleZone = serverVenueTimezone(match.tournament.timezone);
      if (!isAttendanceMatchDay(match, scheduleZone, now)) {
        continue;
      }
      if (!isWithinAttendanceCaptureWindow(match, now)) {
        continue;
      }
      const window = computeAttendanceCaptureWindow(match);
      if (!window || match.geofenceLat == null || match.geofenceLng == null) {
        continue;
      }

      const existing = await this.prisma.matchAttendancePunch.findUnique({
        where: { matchId_userId: { matchId: match.id, userId: actor.id } },
        select: { id: true },
      });

      targets.push({
        matchId: match.id,
        teamId: row.squad.teamId,
        geofenceLat: match.geofenceLat,
        geofenceLng: match.geofenceLng,
        radiusMeters: GEOFENCE_MONITOR_RADIUS_METERS,
        punchRadiusMeters: GEOFENCE_RADIUS_METERS,
        windowOpensAt: window.opensAt.toISOString(),
        windowClosesAt: window.closesAt.toISOString(),
        hasPunched: existing != null,
      });
    }

    const serveAssignments = await this.penalties.loadServeMonitoringMatchIds(actor.id);
    for (const assignment of serveAssignments) {
      if (seen.has(assignment.matchId)) {
        continue;
      }

      const match = await this.prisma.match.findFirst({
        where: { id: assignment.matchId, isDeleted: false },
        include: ATTENDANCE_MATCH_INCLUDE,
      });
      if (!match) {
        continue;
      }

      const attendanceMatch = match as AttendanceMatchRow;
      const scheduleZone = serverVenueTimezone(attendanceMatch.tournament.timezone);
      if (!isAttendanceMatchDay(attendanceMatch, scheduleZone, now)) {
        continue;
      }
      if (!isWithinAttendanceCaptureWindow(attendanceMatch, now)) {
        continue;
      }
      const window = computeAttendanceCaptureWindow(attendanceMatch);
      if (!window || match.geofenceLat == null || match.geofenceLng == null) {
        continue;
      }
      if (match.tournament.ballType !== BallType.Leather) {
        continue;
      }

      seen.add(assignment.matchId);
      const existing = await this.prisma.matchAttendancePunch.findUnique({
        where: { matchId_userId: { matchId: assignment.matchId, userId: actor.id } },
        select: { id: true },
      });

      targets.push({
        matchId: assignment.matchId,
        teamId: assignment.teamId,
        geofenceLat: match.geofenceLat,
        geofenceLng: match.geofenceLng,
        radiusMeters: GEOFENCE_MONITOR_RADIUS_METERS,
        punchRadiusMeters: GEOFENCE_RADIUS_METERS,
        windowOpensAt: window.opensAt.toISOString(),
        windowClosesAt: window.closesAt.toISOString(),
        hasPunched: existing != null,
      });
    }

    return { targets };
  }

  async autoPunch(
    actor: AuthUser,
    matchId: string,
    latitude: number,
    longitude: number,
    capturedAt?: string,
    geofenceEnter?: boolean,
  ): Promise<AutoAttendancePunchResponse> {
    const match = await this.requireAttendanceMatch(matchId);
    const now = capturedAt ? new Date(capturedAt) : new Date();
    await this.assertPlayerCanAutoPunch(actor.id, match, now);

    if (match.geofenceLat == null || match.geofenceLng == null) {
      throw new BadRequestException({
        message: 'This match has no geofence configured',
        error: 'GEOFENCE_NOT_CONFIGURED',
      });
    }

    const verifyRadius = geofenceEnter
      ? GEOFENCE_MONITOR_RADIUS_METERS
      : GEOFENCE_RADIUS_METERS;
    if (
      !isWithinGeofence(
        latitude,
        longitude,
        match.geofenceLat,
        match.geofenceLng,
        verifyRadius,
      )
    ) {
      throw new BadRequestException({
        message: 'You are not within the match ground geofence',
        error: 'OUTSIDE_GEOFENCE',
      });
    }

    const existing = await this.prisma.matchAttendancePunch.findUnique({
      where: { matchId_userId: { matchId, userId: actor.id } },
    });
    if (existing) {
      return {
        matchId,
        punchTimeUtc: existing.punchTimeUtc.toISOString(),
        status: existing.status as AttendancePunchStatus,
        alreadyRecorded: true,
      };
    }

    const eligibility = await this.resolveAttendanceEligibility(actor.id, match);
    const reportingTime = match.reportingTime!;
    const status = classifyAttendanceStatus(now, reportingTime);

    try {
      await this.prisma.matchAttendancePunch.create({
        data: {
          matchId,
          userId: actor.id,
          teamId: eligibility.teamId,
          punchTimeUtc: now,
          source: AttendancePunchSource.Auto,
          status,
          verifiedLate: false,
          setByUserId: null,
          editedFlag: false,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const raced = await this.prisma.matchAttendancePunch.findUnique({
          where: { matchId_userId: { matchId, userId: actor.id } },
        });
        if (raced) {
          return {
            matchId,
            punchTimeUtc: raced.punchTimeUtc.toISOString(),
            status: raced.status as AttendancePunchStatus,
            alreadyRecorded: true,
          };
        }
      }
      throw err;
    }

    await this.audit.record({
      action: 'ATTENDANCE_PUNCH_AUTO',
      actorUserId: actor.id,
      targetUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: { punchTimeUtc: now.toISOString(), status },
    });

    return {
      matchId,
      punchTimeUtc: now.toISOString(),
      status,
      alreadyRecorded: false,
    };
  }

  async getPunchTimeView(
    actor: AuthUser,
    matchId: string,
    teamId: string,
  ): Promise<PunchTimeAttendanceView> {
    const match = await this.requireAttendanceMatch(matchId);
    this.assertPunchTimeViewMatchState(match);
    await this.assertPunchTimeViewAccess(actor, match, teamId);

    await this.penalties.evaluateNoShowServes(matchId, teamId);

    const scheduleZone = serverVenueTimezone(match.tournament.timezone);
    const designatedServers = await this.penalties.loadDesignatedServers(matchId, teamId);
    let squadPlayers: {
      userId: string;
      firstName: string;
      lastName: string;
      profilePhotoUrl: string | null;
    }[] = [];
    try {
      squadPlayers = await this.loadSquadPlayers(matchId, teamId);
    } catch (error) {
      if (designatedServers.length === 0) {
        throw error;
      }
    }

    const allPlayers = [
      ...squadPlayers.map((player) => ({ ...player, isDesignatedServer: false })),
      ...designatedServers
        .filter((player) => !squadPlayers.some((squad) => squad.userId === player.userId))
        .map((player) => ({ ...player, isDesignatedServer: true })),
    ];

    const punches = await this.prisma.matchAttendancePunch.findMany({
      where: { matchId, teamId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
      },
    });
    const punchByUser = new Map(punches.map((row) => [row.userId, row]));

    const onTime: PunchTimePlayerRow[] = [];
    const notArrived: PunchTimePlayerRow[] = [];
    const late: PunchTimePlayerRow[] = [];

    for (const player of allPlayers) {
      const punch = punchByUser.get(player.userId);
      const row = this.toPlayerRow(player, punch, scheduleZone, player.isDesignatedServer);
      if (!punch) {
        notArrived.push(row);
      } else if (punch.status === AttendancePunchStatus.OnTime) {
        onTime.push(row);
      } else {
        late.push(row);
      }
    }

    const homeName = match.homeTeam?.name ?? 'TBD';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';
    const punchedCount = onTime.length + late.length;
    const reportingTime = match.reportingTime!;

    return {
      matchId,
      teamId,
      tournamentName: match.tournament.name,
      timezone: match.tournament.timezone,
      timezoneFallback: match.tournament.timezone == null,
      matchTitle: `${homeName} vs ${awayName}`,
      homeTeamName: homeName,
      awayTeamName: awayName,
      reportingTime: reportingTime.toISOString(),
      reportingTimeLabel: formatVenueDateTime(reportingTime, scheduleZone, {
        includeTime: true,
        includeZoneAbbrev: true,
      }),
      playersPresentCount: punchedCount,
      aggregateStatusLabel: this.aggregateStatusLabel(onTime.length, late.length, notArrived.length),
      onTime,
      notArrived,
      late,
    };
  }

  async loadCaptainPunchTimeCard(
    actor: AuthUser,
    captainTeamIds: string[],
  ): Promise<CaptainPunchTimeCardView | null> {
    if (captainTeamIds.length === 0) {
      return null;
    }

    const now = new Date();
    const matches = await this.prisma.match.findMany({
      where: {
        isDeleted: false,
        reportingTime: { not: null },
        geofenceLat: { not: null },
        geofenceLng: { not: null },
        state: { in: PUNCH_TIME_MATCH_STATES },
        tournament: { ...activeTournamentRelationWhere.tournament, ballType: BallType.Leather },
        OR: [{ homeTeamId: { in: captainTeamIds } }, { awayTeamId: { in: captainTeamIds } }],
        squads: { some: { teamId: { in: captainTeamIds } } },
      },
      include: ATTENDANCE_MATCH_INCLUDE,
      orderBy: [{ matchDate: 'asc' }, { startTime: 'asc' }],
    });

    for (const match of matches) {
      const teamId =
        match.homeTeamId && captainTeamIds.includes(match.homeTeamId)
          ? match.homeTeamId
          : match.awayTeamId && captainTeamIds.includes(match.awayTeamId)
            ? match.awayTeamId
            : null;
      if (!teamId) {
        continue;
      }

      const scheduleZone = serverVenueTimezone(match.tournament.timezone);
      if (!isAttendanceMatchDay(match, scheduleZone, now)) {
        continue;
      }
      if (!isWithinAttendanceCaptureWindow(match, now)) {
        continue;
      }

      const view = await this.getPunchTimeView(actor, match.id, teamId);

      return {
        matchId: match.id,
        teamId,
        matchTitle: view.matchTitle,
        tournamentName: view.tournamentName,
        playersPresentCount: view.playersPresentCount,
        aggregateStatusLabel: view.aggregateStatusLabel,
      };
    }

    return null;
  }

  async setPunchTime(
    actor: AuthUser,
    matchId: string,
    teamId: string,
    userId: string,
    punchTimeUtc: string,
  ): Promise<PunchTimeAttendanceView> {
    const match = await this.requireAttendanceMatch(matchId);
    await this.assertPunchTimeOverrideAccess(actor, match, teamId);
    await this.requireAttendanceTargetOnTeam(userId, matchId, teamId);

    const punchInstant = new Date(punchTimeUtc);
    if (Number.isNaN(punchInstant.getTime())) {
      throw new BadRequestException({ message: 'Invalid punch time', error: 'INVALID_PUNCH_TIME' });
    }

    const reportingTime = match.reportingTime!;
    const status = classifyAttendanceStatus(punchInstant, reportingTime);
    const existing = await this.prisma.matchAttendancePunch.findUnique({
      where: { matchId_userId: { matchId, userId } },
    });

    if (existing) {
      await this.prisma.matchAttendancePunch.update({
        where: { id: existing.id },
        data: {
          punchTimeUtc: punchInstant,
          status,
          source: AttendancePunchSource.Manual,
          setByUserId: actor.id,
          editedFlag: true,
          verifiedLate: status === AttendancePunchStatus.Late ? existing.verifiedLate : false,
          verifiedServeCompletion:
            status === AttendancePunchStatus.OnTime ? existing.verifiedServeCompletion : false,
        },
      });
      await this.audit.record({
        action: 'ATTENDANCE_PUNCH_EDIT',
        actorUserId: actor.id,
        targetUserId: userId,
        targetEntityType: 'match',
        targetEntityId: matchId,
        before: { punchTimeUtc: existing.punchTimeUtc.toISOString(), status: existing.status },
        after: { punchTimeUtc: punchInstant.toISOString(), status },
      });
    } else {
      await this.prisma.matchAttendancePunch.create({
        data: {
          matchId,
          userId,
          teamId,
          punchTimeUtc: punchInstant,
          source: AttendancePunchSource.Manual,
          status,
          verifiedLate: false,
          verifiedServeCompletion: false,
          setByUserId: actor.id,
          editedFlag: true,
        },
      });
      await this.audit.record({
        action: 'ATTENDANCE_PUNCH_MANUAL',
        actorUserId: actor.id,
        targetUserId: userId,
        targetEntityType: 'match',
        targetEntityId: matchId,
        after: { punchTimeUtc: punchInstant.toISOString(), status },
      });
    }

    return this.getPunchTimeView(actor, matchId, teamId);
  }

  async revokePunch(
    actor: AuthUser,
    matchId: string,
    teamId: string,
    userId: string,
  ): Promise<PunchTimeAttendanceView> {
    const match = await this.requireAttendanceMatch(matchId);
    await this.assertPunchTimeOverrideAccess(actor, match, teamId);

    const existing = await this.prisma.matchAttendancePunch.findUnique({
      where: { matchId_userId: { matchId, userId } },
    });
    if (!existing || existing.teamId !== teamId) {
      throw new NotFoundException({ message: 'Punch not found', error: 'NOT_FOUND' });
    }

    await this.prisma.matchAttendancePunch.delete({ where: { id: existing.id } });
    await this.audit.record({
      action: 'ATTENDANCE_PUNCH_REVOKE',
      actorUserId: actor.id,
      targetUserId: userId,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: { punchTimeUtc: existing.punchTimeUtc.toISOString(), status: existing.status },
    });

    return this.getPunchTimeView(actor, matchId, teamId);
  }

  async verifyLatePunch(
    actor: AuthUser,
    matchId: string,
    teamId: string,
    userId: string,
  ): Promise<PunchTimeAttendanceView> {
    const match = await this.requireAttendanceMatch(matchId);
    await this.assertPunchTimeOverrideAccess(actor, match, teamId);

    const existing = await this.prisma.matchAttendancePunch.findUnique({
      where: { matchId_userId: { matchId, userId } },
    });
    if (!existing || existing.teamId !== teamId) {
      throw new NotFoundException({ message: 'Punch not found', error: 'NOT_FOUND' });
    }

    if (existing.status === AttendancePunchStatus.OnTime) {
      if (existing.verifiedServeCompletion) {
        return this.getPunchTimeView(actor, matchId, teamId);
      }

      await this.penalties.onCaptainVerifyServeCompletion(actor, matchId, teamId, userId);

      await this.prisma.matchAttendancePunch.update({
        where: { id: existing.id },
        data: { verifiedServeCompletion: true },
      });

      await this.audit.record({
        action: 'ATTENDANCE_SERVE_COMPLETION_VERIFIED',
        actorUserId: actor.id,
        targetUserId: userId,
        targetEntityType: 'match',
        targetEntityId: matchId,
        after: { verifiedServeCompletion: true },
      });

      return this.getPunchTimeView(actor, matchId, teamId);
    }

    if (existing.status !== AttendancePunchStatus.Late) {
      throw new BadRequestException({
        message: 'Only late arrivals or on-time penalty servers can be verified',
        error: 'NOT_VERIFIABLE',
      });
    }

    if (existing.verifiedLate) {
      return this.getPunchTimeView(actor, matchId, teamId);
    }

    await this.prisma.matchAttendancePunch.update({
      where: { id: existing.id },
      data: { verifiedLate: true },
    });

    await this.penalties.onCaptainVerifyLate(actor, matchId, teamId, userId);

    await this.audit.record({
      action: 'ATTENDANCE_LATE_VERIFIED',
      actorUserId: actor.id,
      targetUserId: userId,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: { verifiedLate: true },
    });

    return this.getPunchTimeView(actor, matchId, teamId);
  }

  private aggregateStatusLabel(onTime: number, late: number, notArrived: number): string {
    if (notArrived > 0 && onTime + late === 0) {
      return 'Awaiting Arrivals';
    }
    if (late > 0) {
      return `${late} Late`;
    }
    if (onTime > 0) {
      return 'On Time';
    }
    return 'Awaiting Arrivals';
  }

  private toPlayerRow(
    player: {
      userId: string;
      firstName: string;
      lastName: string;
      profilePhotoUrl: string | null;
    },
    punch: {
      punchTimeUtc: Date;
      source: string;
      status: string;
      verifiedLate: boolean;
      verifiedServeCompletion: boolean;
      editedFlag: boolean;
    } | undefined,
    scheduleZone: string,
    isDesignatedServer = false,
  ): PunchTimePlayerRow {
    return {
      userId: player.userId,
      firstName: player.firstName,
      lastName: player.lastName,
      profilePhotoUrl: player.profilePhotoUrl,
      arrivedAtLabel: punch
        ? formatPunchTimeLabel(punch.punchTimeUtc, scheduleZone)
        : null,
      punchTimeUtc: punch?.punchTimeUtc.toISOString() ?? null,
      source: punch ? (punch.source as AttendancePunchSource) : null,
      status: punch ? (punch.status as AttendancePunchStatus) : null,
      verifiedLate: punch?.verifiedLate ?? false,
      verifiedServeCompletion: punch?.verifiedServeCompletion ?? false,
      editedFlag: punch?.editedFlag ?? false,
      isDesignatedServer,
    };
  }

  private async loadSquadPlayers(
    matchId: string,
    teamId: string,
  ): Promise<
    { userId: string; firstName: string; lastName: string; profilePhotoUrl: string | null }[]
  > {
    const squad = await this.prisma.matchSquad.findUnique({
      where: { matchId_teamId: { matchId, teamId } },
      include: {
        players: {
          where: { role: { in: ATTENDANCE_ELIGIBLE_ROLES } },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
            },
          },
          orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
        },
      },
    });
    if (!squad) {
      throw new BadRequestException({
        message: 'Playing 11 has not been confirmed for this team',
        error: 'SQUAD_NOT_LOCKED',
      });
    }
    return squad.players.map((row) => ({
      userId: row.user.id,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      profilePhotoUrl: row.user.profilePhotoUrl,
    }));
  }

  private async requireAttendanceMatch(matchId: string): Promise<AttendanceMatchRow> {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, isDeleted: false },
      include: ATTENDANCE_MATCH_INCLUDE,
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'NOT_FOUND' });
    }
    if (match.tournament.ballType !== BallType.Leather) {
      throw new BadRequestException({
        message: 'Attendance tracking is only available for leather-ball matches',
        error: 'INVALID_BALL_TYPE',
      });
    }
    if (!match.reportingTime) {
      throw new BadRequestException({
        message: 'This match has no reporting time configured',
        error: 'REPORTING_TIME_REQUIRED',
      });
    }
    return match as AttendanceMatchRow;
  }

  private async assertPlayerCanAutoPunch(
    userId: string,
    match: AttendanceMatchRow,
    now: Date,
  ): Promise<void> {
    const scheduleZone = serverVenueTimezone(match.tournament.timezone);
    if (!isAttendanceMatchDay(match, scheduleZone, now)) {
      throw new BadRequestException({
        message: 'Attendance can only be recorded on match day',
        error: 'NOT_MATCH_DAY',
      });
    }
    if (!isWithinAttendanceCaptureWindow(match, now)) {
      throw new BadRequestException({
        message: 'Outside the attendance capture window',
        error: 'OUTSIDE_WINDOW',
      });
    }
    if (!PUNCH_TIME_MATCH_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Attendance is not open for this match',
        error: 'INVALID_MATCH_STATE',
      });
    }
    await this.requireAttendanceEligibility(userId, match);
  }

  private async resolveAttendanceEligibility(
    userId: string,
    match: AttendanceMatchRow,
  ): Promise<{ teamId: string }> {
    const squadMember = await this.prisma.matchSquadPlayer.findFirst({
      where: {
        userId,
        role: { in: ATTENDANCE_ELIGIBLE_ROLES },
        squad: {
          matchId: match.id,
          teamId: { in: [match.homeTeamId, match.awayTeamId].filter((id): id is string => id != null) },
        },
      },
      select: { squad: { select: { teamId: true } } },
    });
    if (squadMember) {
      return { teamId: squadMember.squad.teamId };
    }

    const designated = await this.prisma.lateArrivalPenalty.findFirst({
      where: {
        playerId: userId,
        state: LateArrivalPenaltyState.Assigned,
        assignedServeMatchId: match.id,
      },
      select: { teamId: true },
    });
    if (designated) {
      return { teamId: designated.teamId };
    }

    throw new ForbiddenException({
      message: 'Only Playing 11, substitutes, and designated penalty servers may record attendance',
      error: 'FORBIDDEN',
    });
  }

  private async requireAttendanceEligibility(
    userId: string,
    match: AttendanceMatchRow,
  ): Promise<{ teamId: string }> {
    return this.resolveAttendanceEligibility(userId, match);
  }

  /** @deprecated Use resolveAttendanceEligibility — kept for internal call sites. */
  private async requireSquadMember(
    userId: string,
    match: AttendanceMatchRow,
  ): Promise<{ teamId: string }> {
    return this.resolveAttendanceEligibility(userId, match);
  }

  private async requireAttendanceTargetOnTeam(
    userId: string,
    matchId: string,
    teamId: string,
  ): Promise<void> {
    const squadRow = await this.prisma.matchSquadPlayer.findFirst({
      where: {
        userId,
        role: { in: ATTENDANCE_ELIGIBLE_ROLES },
        squad: { matchId, teamId },
      },
      select: { id: true },
    });
    if (squadRow) {
      return;
    }

    const designated = await this.prisma.lateArrivalPenalty.findFirst({
      where: {
        playerId: userId,
        teamId,
        state: LateArrivalPenaltyState.Assigned,
        assignedServeMatchId: matchId,
      },
      select: { id: true },
    });
    if (!designated) {
      throw new BadRequestException({
        message: 'Player is not in this team squad or designated to serve a penalty at this match',
        error: 'PLAYER_NOT_ELIGIBLE',
      });
    }
  }

  private async requireSquadPlayerOnTeam(
    userId: string,
    matchId: string,
    teamId: string,
  ): Promise<void> {
    const row = await this.prisma.matchSquadPlayer.findFirst({
      where: {
        userId,
        role: { in: ATTENDANCE_ELIGIBLE_ROLES },
        squad: { matchId, teamId },
      },
      select: { id: true },
    });
    if (!row) {
      throw new BadRequestException({
        message: 'Player is not in this team squad for the match',
        error: 'PLAYER_NOT_IN_SQUAD',
      });
    }
  }

  private assertPunchTimeViewMatchState(match: AttendanceMatchRow): void {
    if (!PUNCH_TIME_PAGE_MATCH_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Punch time is not available for this match state',
        error: 'INVALID_MATCH_STATE',
      });
    }
  }

  private async assertPunchTimeViewAccess(
    actor: AuthUser,
    match: AttendanceMatchRow,
    teamId: string,
  ): Promise<void> {
    const participatingTeamIds = [match.homeTeamId, match.awayTeamId].filter(
      (id): id is string => id != null,
    );
    if (!participatingTeamIds.includes(teamId)) {
      throw new ForbiddenException({
        message: 'Team is not part of this match',
        error: 'FORBIDDEN',
      });
    }

    if (actor.role === UserRole.Admin) {
      return;
    }

    if (actor.role === UserRole.ClubManager) {
      if (match.tournament.createdByUserId === actor.id) {
        return;
      }
      throw new ForbiddenException({
        message: 'You do not have access to punch time for this match',
        error: 'FORBIDDEN',
      });
    }

    const isLeader = await isCaptainOrViceCaptain(
      this.prisma,
      actor.id,
      match.tournamentId,
      teamId,
    );
    if (!isLeader) {
      throw new ForbiddenException({
        message: 'You may only view punch time for your own team',
        error: 'FORBIDDEN',
      });
    }
  }

  private async assertPunchTimeOverrideAccess(
    actor: AuthUser,
    match: AttendanceMatchRow,
    teamId: string,
  ): Promise<void> {
    await this.assertPunchTimeViewAccess(actor, match, teamId);
    if (isPunchTimeReadOnly(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Punch time cannot be edited after the match is finished',
        error: 'PUNCH_TIME_READ_ONLY',
      });
    }
    const allowed = await this.permissions.check(Permission.OVERRIDE_ARRIVAL_TIME, actor, {
      matchId: match.id,
      teamId,
      tournamentId: match.tournamentId,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'Cannot override arrival time for this match',
        error: 'FORBIDDEN',
      });
    }
  }
}
