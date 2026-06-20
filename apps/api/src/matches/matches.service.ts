import {
  type AssignScorerRequest,
  type AuthUser,
  type HandoverScorerRequest,
  MATCH_END_STATES,
  MATCH_STATE_TRANSITIONS,
  MatchSchedulingFormat,
  MatchSquadRole,
  MatchState,
  MatchType,
  type MatchDetail,
  type MatchListItem,
  type MatchSummary,
  Permission,
  prepareMatchListForDisplay,
  type RecordTossRequest,
  type ScorerGrantView,
  type SquadCandidate,
  type SquadView,
  MatchSide,
  TossDecision,
  type StartMatchSetupRequest,
  TournamentType,
  BallType,
  formatUtcIsoDate,
  isIsoDateOnly,
  validateBattingPowerplayOvers,
  validateMaxOversPerBowler,
  validatePowerplayOvers,
  normalizeTeamPairKey,
  PLAYING_XI_SIZE,
  type RoundRobinMatchSetupContext,
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
import { StandingsService } from '../standings/standings.service';
import { ScoringService } from '../scoring/scoring.service';
import { assertTournamentActive } from '../tournaments/tournament-query';
import {
  deriveInningsTeamsFromToss,
} from './match-start.utils';
import type { CreateMatchDto } from './dto/create-match.dto';
import type { LockPlayingXiDto } from './dto/lock-playing-xi.dto';

/** Suspension statuses that count as "currently suspended" (§10.2–§10.5). */
const ACTIVE_SUSPENSION_STATUSES = ['PENDING', 'CARRIED_FORWARD'] as const;

/** States in which a team's Playing 11 may be locked / re-locked (§5.2). */
const XI_LOCKABLE_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.Delayed,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
];

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

/** Excludes soft-deleted rows from schedules and round-robin pair guards. */
const ACTIVE_MATCH_WHERE = { isDeleted: false } as const satisfies Prisma.MatchWhereInput;

type MatchRow = Prisma.MatchGetPayload<{
  include: {
    homeTeam: { select: { name: true } };
    awayTeam: { select: { name: true } };
    tournament: { select: { impactPlayerEnabled: true; type: true; timezone: true } };
    squads: {
      include: {
        team: { select: { name: true } };
        players: {
          include: { user: { select: { firstName: true; lastName: true } } };
        };
      };
    };
    externalPlayers: {
      select: { id: true; matchId: true; slot: true; name: true; battingStyle: true; bowlingType: true };
    };
    scorerGrants: true;
  };
}>;

// `MatchScorerGrant.userId` is intentionally not a hard FK (§2), so scorer
// names are resolved in a separate lookup rather than via an include.
const MATCH_INCLUDE = {
  homeTeam: { select: { name: true } },
  awayTeam: { select: { name: true } },
  tournament: { select: { impactPlayerEnabled: true, type: true, timezone: true } },
  squads: {
    include: {
      team: { select: { name: true } },
      players: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  },
  externalPlayers: {
    select: { id: true, matchId: true, slot: true, name: true, battingStyle: true, bowlingType: true },
    orderBy: { slot: 'asc' as const },
  },
  scorerGrants: true,
} as const;

const MATCH_LIST_INCLUDE = {
  homeTeam: { select: { name: true, logoUrl: true } },
  awayTeam: { select: { name: true, logoUrl: true } },
} as const;

type MatchListRow = Prisma.MatchGetPayload<{
  include: typeof MATCH_LIST_INCLUDE;
}>;

const LIST_COMPLETED_STATES: MatchState[] = [
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

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
    private readonly standings: StandingsService,
    private readonly scoring: ScoringService,
  ) {}

  // --- Creation & reads ----------------------------------------------------

  async create(actor: AuthUser, tournamentId: string, dto: CreateMatchDto): Promise<MatchDetail> {
    const tournament = await this.requireTournamentRecord(tournamentId);
    const allowed = await this.permissions.check(Permission.CREATE_MATCH, actor, { tournamentId });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to create matches',
        error: 'FORBIDDEN',
      });
    }

    if (!dto.homeTeamId) {
      throw new BadRequestException({ message: 'Team A is required', error: 'HOME_TEAM_REQUIRED' });
    }
    if (!dto.awayTeamId && !dto.externalOpponentName) {
      throw new BadRequestException({
        message: 'Team B or an external opponent is required',
        error: 'OPPONENT_REQUIRED',
      });
    }
    if (dto.awayTeamId && dto.externalOpponentName) {
      throw new BadRequestException({
        message: 'A match has either a system away team or an external opponent, not both',
        error: 'AMBIGUOUS_OPPONENT',
      });
    }
    if (dto.awayTeamId && dto.homeTeamId === dto.awayTeamId) {
      throw new BadRequestException({
        message: 'Team A and Team B must be different teams',
        error: 'DUPLICATE_TEAMS',
        fields: { teamBId: 'Team A and Team B must be different teams' },
      });
    }

    const isLeatherBall = tournament.ballType === BallType.Leather;
    const isTennisBall = tournament.ballType === BallType.Tennis;
    const isRoundRobin =
      tournament.matchSchedulingFormat === MatchSchedulingFormat.RoundRobin;

    if (isRoundRobin) {
      if (dto.groupId) {
        throw new BadRequestException({
          message: 'Group is not used for round-robin fixtures',
          error: 'GROUP_NOT_ALLOWED',
          fields: { groupId: 'Round robin matches are not assigned to a group' },
        });
      }
      if (dto.externalOpponentName) {
        throw new BadRequestException({
          message: 'Round robin requires two registered teams',
          error: 'EXTERNAL_OPPONENT_NOT_ALLOWED',
          fields: { teamBId: 'Select a registered team for Team B' },
        });
      }
      if (!dto.awayTeamId) {
        throw new BadRequestException({
          message: 'Team B is required',
          error: 'AWAY_TEAM_REQUIRED',
          fields: { teamBId: 'Team B is required' },
        });
      }
      await this.assertRoundRobinPairNotDuplicate(
        tournamentId,
        dto.homeTeamId,
        dto.awayTeamId,
      );
    }

    if (isLeatherBall && !isRoundRobin) {
      if (dto.externalOpponentName && !dto.externalOpponentName.trim()) {
        throw new BadRequestException({
          message: 'External opponent name cannot be blank',
          error: 'EXTERNAL_OPPONENT_BLANK',
          fields: { externalOpponentName: 'Enter Team B name' },
        });
      }
    }
    if (isTennisBall && !isRoundRobin) {
      if (!dto.awayTeamId) {
        throw new BadRequestException({
          message: 'Team B is required',
          error: 'AWAY_TEAM_REQUIRED',
          fields: { teamBId: 'Team B is required' },
        });
      }
      if (dto.externalOpponentName) {
        throw new BadRequestException({
          message: 'Tennis-ball fixtures require a registered Team B',
          error: 'EXTERNAL_OPPONENT_NOT_ALLOWED',
          fields: { externalOpponentName: 'Select a registered team for Team B' },
        });
      }
    }

    await this.assertTeamsInTournament(tournamentId, [dto.homeTeamId, dto.awayTeamId]);

    const isGroupStage =
      tournament.matchSchedulingFormat === MatchSchedulingFormat.GroupStageKnockout;
    if (isGroupStage) {
      if (!dto.groupId) {
        throw new BadRequestException({
          message: 'Group is required for group-stage fixtures',
          error: 'GROUP_REQUIRED',
          fields: { groupId: 'Group is required' },
        });
      }
      await this.assertTeamsInGroup(tournamentId, dto.groupId, [dto.homeTeamId, dto.awayTeamId]);
    } else if (dto.groupId) {
      throw new BadRequestException({
        message: 'Group is only allowed for group-stage tournaments',
        error: 'GROUP_NOT_ALLOWED',
      });
    }

    if (!dto.groundLocation?.trim()) {
      throw new BadRequestException({
        message: 'Ground location is required',
        error: 'GROUND_REQUIRED',
        fields: { groundLocation: 'Ground location is required' },
      });
    }
    if (dto.geofenceLat == null || dto.geofenceLng == null) {
      throw new BadRequestException({
        message: 'Ground coordinates are required for geofencing',
        error: 'GEOFENCE_REQUIRED',
        fields: { groundLocation: 'Select a location from search or the map' },
      });
    }

    if (dto.oversPerInnings == null) {
      throw new BadRequestException({
        message: 'Overs per innings is required',
        error: 'OVERS_REQUIRED',
        fields: { oversPerInnings: 'Overs is required' },
      });
    }
    if (dto.maxOversPerBowler == null) {
      throw new BadRequestException({
        message: 'Overs per bowler is required',
        error: 'OVERS_PER_BOWLER_REQUIRED',
        fields: { maxOversPerBowler: 'Overs per bowler is required' },
      });
    }
    const oversPerBowlerError = validateMaxOversPerBowler(
      dto.oversPerInnings,
      dto.maxOversPerBowler,
    );
    if (oversPerBowlerError) {
      throw new BadRequestException({
        message: oversPerBowlerError,
        error: 'INVALID_OVERS_PER_BOWLER',
        fields: { maxOversPerBowler: oversPerBowlerError },
      });
    }

    if (dto.powerplayOvers != null) {
      const powerplayError = validatePowerplayOvers(dto.oversPerInnings, dto.powerplayOvers);
      if (powerplayError) {
        throw new BadRequestException({
          message: powerplayError,
          error: 'INVALID_POWERPLAY_OVERS',
          fields: { powerplayOvers: powerplayError },
        });
      }
    }

    if (isTennisBall && dto.battingPowerplayOvers != null) {
      const battingPowerplayError = validateBattingPowerplayOvers(
        dto.oversPerInnings,
        dto.battingPowerplayOvers,
      );
      if (battingPowerplayError) {
        throw new BadRequestException({
          message: battingPowerplayError,
          error: 'INVALID_BATTING_POWERPLAY_OVERS',
          fields: { battingPowerplayOvers: battingPowerplayError },
        });
      }
    }

    if (!dto.matchDate || !isIsoDateOnly(dto.matchDate)) {
      throw new BadRequestException({
        message: 'Match date is required',
        error: 'MATCH_DATE_REQUIRED',
        fields: { matchDate: 'Match date is required' },
      });
    }
    await this.assertMatchDateAllowed(tournamentId, dto.matchDate);

    if (!dto.startTime) {
      throw new BadRequestException({
        message: 'Match time is required',
        error: 'START_TIME_REQUIRED',
        fields: { matchTime: 'Match time is required' },
      });
    }

    if (!dto.matchType) {
      throw new BadRequestException({
        message: 'Match type is required',
        error: 'MATCH_TYPE_REQUIRED',
        fields: { matchType: 'Match type is required' },
      });
    }
    if (!Object.values(MatchType).includes(dto.matchType)) {
      throw new BadRequestException({
        message: 'Invalid match type',
        error: 'INVALID_MATCH_TYPE',
        fields: { matchType: 'Select a valid match type' },
      });
    }
    const matchType = dto.matchType;

    const roundRobinPairKey =
      isRoundRobin && dto.homeTeamId && dto.awayTeamId
        ? normalizeTeamPairKey(dto.homeTeamId, dto.awayTeamId)
        : null;

    let match;
    try {
      match = await this.prisma.match.create({
        data: {
          tournamentId,
          groupId: dto.groupId ?? null,
          matchCode: dto.matchCode ?? null,
          matchType,
          state: MatchState.Scheduled,
          homeTeamId: dto.homeTeamId,
          awayTeamId: dto.awayTeamId ?? null,
          externalOpponentName: dto.externalOpponentName?.trim() || null,
          roundRobinPairKey,
          matchDate: new Date(`${dto.matchDate}T00:00:00.000Z`),
          startTime: new Date(dto.startTime),
          reportingTime:
            !isRoundRobin && dto.reportingTime ? new Date(dto.reportingTime) : null,
          groundLocation: dto.groundLocation.trim(),
          geofenceLat: dto.geofenceLat,
          geofenceLng: dto.geofenceLng,
          oversPerInnings: dto.oversPerInnings,
          maxOversPerBowler: dto.maxOversPerBowler,
          powerplayOvers: dto.powerplayOvers ?? null,
          battingPowerplayOvers: isTennisBall ? (dto.battingPowerplayOvers ?? null) : null,
          youtubeUrl: dto.youtubeUrl ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        roundRobinPairKey
      ) {
        throw new BadRequestException({
          message: 'These teams are already scheduled to play in this round robin',
          error: 'DUPLICATE_ROUND_ROBIN_PAIRING',
          fields: {
            teamBId: 'These teams are already scheduled to play in this round robin.',
          },
        });
      }
      throw error;
    }

    return this.getDetail(match.id);
  }

  async list(tournamentId: string): Promise<MatchListItem[]> {
    const rows = await this.prisma.match.findMany({
      where: {
        tournamentId,
        ...ACTIVE_MATCH_WHERE,
        state: { not: MatchState.Cancelled },
      },
      include: MATCH_LIST_INCLUDE,
      orderBy: [{ matchDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    });
    return prepareMatchListForDisplay(rows.map((row) => this.toListItem(row)));
  }

  /** Round-robin Match Setup info card: fixture count, standings preview, existing pairings. */
  async getRoundRobinSetupContext(tournamentId: string): Promise<RoundRobinMatchSetupContext> {
    const tournament = await this.requireTournamentRecord(tournamentId);
    if (tournament.matchSchedulingFormat !== MatchSchedulingFormat.RoundRobin) {
      throw new BadRequestException({
        message: 'This tournament is not configured for round robin scheduling',
        error: 'NOT_ROUND_ROBIN',
      });
    }

    const scheduledMatchCount = await this.prisma.match.count({
      where: { tournamentId, ...ACTIVE_MATCH_WHERE, state: { not: MatchState.Cancelled } },
    });

    const pairRows = await this.prisma.match.findMany({
      where: {
        tournamentId,
        ...ACTIVE_MATCH_WHERE,
        homeTeamId: { not: null },
        awayTeamId: { not: null },
        state: { not: MatchState.Cancelled },
      },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const existingPairKeys = pairRows.map((row) =>
      normalizeTeamPairKey(row.homeTeamId!, row.awayTeamId!),
    );

    const standingsResult = await this.standings.getStandings(tournamentId);
    const table = standingsResult.tables[0];
    const standings = (table?.teams ?? []).map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      points: row.points,
    }));

    return {
      scheduledMatchCount,
      nextMatchNumber: scheduledMatchCount + 1,
      standings,
      existingPairKeys,
    };
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

  /** Replace one Playing XI player before the match goes live (no-show recovery). */
  async replacePlayingXiPlayer(
    actor: AuthUser,
    matchId: string,
    teamId: string,
    absentUserId: string,
    replacementUserId: string,
  ): Promise<void> {
    if (absentUserId === replacementUserId) {
      throw new BadRequestException({
        message: 'Replacement must be a different player',
        error: 'INVALID_REPLACEMENT',
      });
    }

    const match = await this.requireMatch(matchId);
    if (!XI_LOCKABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Playing 11 cannot be updated after the match goes live',
        error: 'INVALID_MATCH_STATE',
      });
    }
    this.assertTeamInMatch(match, teamId);

    const membership = await this.prisma.teamMembership.findFirst({
      where: { teamId, tournamentId: match.tournamentId, userId: replacementUserId },
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException({
        message: 'Replacement must be on the team roster',
        error: 'PLAYER_NOT_ON_ROSTER',
      });
    }

    const squad = await this.prisma.matchSquad.findUnique({
      where: { matchId_teamId: { matchId, teamId } },
      include: { players: true },
    });
    if (!squad) {
      throw new BadRequestException({
        message: 'Playing 11 has not been confirmed for this team',
        error: 'SQUAD_NOT_LOCKED',
      });
    }

    const absentRow = squad.players.find(
      (row) => row.userId === absentUserId && row.role === MatchSquadRole.PlayingXi,
    );
    if (!absentRow) {
      throw new BadRequestException({
        message: 'Absent player is not in the Playing 11',
        error: 'PLAYER_NOT_IN_PLAYING_XI',
      });
    }

    const inRow = squad.players.find((row) => row.userId === replacementUserId);

    await this.prisma.$transaction(async (tx) => {
      if (inRow?.role === MatchSquadRole.Substitute) {
        await tx.matchSquadPlayer.update({
          where: { squadId_userId: { squadId: squad.id, userId: absentUserId } },
          data: { role: MatchSquadRole.Substitute },
        });
        await tx.matchSquadPlayer.update({
          where: { squadId_userId: { squadId: squad.id, userId: replacementUserId } },
          data: { role: MatchSquadRole.PlayingXi },
        });
      } else if (!inRow) {
        await tx.matchSquadPlayer.update({
          where: { squadId_userId: { squadId: squad.id, userId: absentUserId } },
          data: { role: MatchSquadRole.Substitute },
        });
        await tx.matchSquadPlayer.create({
          data: {
            squadId: squad.id,
            userId: replacementUserId,
            role: MatchSquadRole.PlayingXi,
            isActiveImpact: false,
          },
        });
      } else {
        throw new BadRequestException({
          message: 'Replacement is already in the match squad',
          error: 'REPLACEMENT_ALREADY_IN_SQUAD',
        });
      }

      await tx.matchSquad.update({
        where: { id: squad.id },
        data: { lockedByUserId: actor.id, lockedAt: new Date() },
      });
    });
  }

  /** Swap one Playing XI player for a sub, unselected squad member, or promoted penalty server. */
  async switchPlayingXiPlayer(
    actor: AuthUser,
    matchId: string,
    teamId: string,
    outUserId: string,
    inUserId: string,
  ): Promise<void> {
    await this.replacePlayingXiPlayer(actor, matchId, teamId, outUserId, inUserId);
  }

  /** Poll-based Playing XI confirm — IN voters only, unlimited substitutes (§9.7). */
  async lockPlayingXiFromPoll(
    actor: AuthUser,
    matchId: string,
    teamId: string,
    playingXi: string[],
    substitutes: string[],
    inVoterIds: ReadonlySet<string>,
  ): Promise<void> {
    if (playingXi.length !== PLAYING_XI_SIZE) {
      throw new BadRequestException({
        message: `Select exactly ${PLAYING_XI_SIZE} players for the Playing 11`,
        error: 'INVALID_PLAYING_XI_SIZE',
      });
    }

    const all = [...playingXi, ...substitutes];
    if (new Set(all).size !== all.length) {
      throw new BadRequestException({
        message: 'A player may appear only once across the Playing 11 and substitutes',
        error: 'DUPLICATE_SQUAD_PLAYER',
      });
    }

    const notInPoll = all.filter((userId) => !inVoterIds.has(userId));
    if (notInPoll.length > 0) {
      throw new BadRequestException({
        message: 'Playing 11 and substitutes must be selected from players who voted IN',
        error: 'PLAYER_NOT_IN_POLL',
      });
    }

    const dto: LockPlayingXiDto = {
      teamId,
      playingXi,
      substitutes,
    };

    const match = await this.requireMatch(matchId);
    if (!XI_LOCKABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: `Playing 11 cannot be updated while the match is ${match.state}`,
        error: 'INVALID_MATCH_STATE',
      });
    }
    this.assertTeamInMatch(match, teamId);
    await this.validateSquad(match, dto);

    const players: { userId: string; role: MatchSquadRole; isActiveImpact: boolean }[] = [
      ...playingXi.map((userId) => ({
        userId,
        role: MatchSquadRole.PlayingXi,
        isActiveImpact: false,
      })),
      ...substitutes.map((userId) => ({
        userId,
        role: MatchSquadRole.Substitute,
        isActiveImpact: false,
      })),
    ];

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.matchSquad.findUnique({
        where: { matchId_teamId: { matchId, teamId } },
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
            teamId,
            lockedByUserId: actor.id,
            players: { create: players },
          },
        });
      }

      const participating = [match.homeTeamId, match.awayTeamId].filter(
        (id): id is string => id !== null,
      );
      const squadCount = await tx.matchSquad.count({ where: { matchId } });
      if (
        squadCount >= participating.length &&
        XI_LOCKABLE_STATES.includes(match.state as MatchState)
      ) {
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
      after: { teamId, playingXi, substitutes, source: 'participation_poll' },
    });
    await this.notifications.notify(NotificationTrigger.PlayingXiPosted, {
      recipientUserIds: all,
      data: { matchId, teamId },
    });
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

  /**
   * Scorer Match Setup dialog (§11.2): capture toss, derive first-innings sides,
   * move Live, and open innings 1. Idempotent before the first ball — toss can
   * be updated while no deliveries exist.
   */
  async startScoring(
    actor: AuthUser,
    matchId: string,
    dto: RecordTossRequest,
  ): Promise<MatchDetail> {
    const match = await this.requireMatchRow(matchId);
    const allowed = await this.permissions.check(Permission.START_MATCH, actor, { matchId });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to start scoring for this match',
        error: 'FORBIDDEN',
      });
    }

    const state = match.state as MatchState;
    const deliveryCount =
      state === MatchState.Live
        ? await this.prisma.delivery.count({ where: { innings: { matchId } } })
        : 0;

    if (state === MatchState.Live && deliveryCount > 0) {
      throw new BadRequestException({
        message: 'Toss cannot be changed after the first ball has been bowled',
        error: 'TOSS_LOCKED',
      });
    }

    const allowedStates: MatchState[] = [
      MatchState.PlayingXiLocked,
      MatchState.TossCompleted,
      MatchState.Delayed,
      MatchState.Live,
    ];
    if (!allowedStates.includes(state)) {
      if (state === MatchState.Scheduled) {
        throw new BadRequestException({
          message: 'Lock the Playing 11 for all teams before starting the match',
          error: 'PLAYING_XI_REQUIRED',
          fields: { playingXi: 'Playing 11 must be locked before match start' },
        });
      }
      throw new BadRequestException({
        message: 'The match is not in a state where scoring can begin',
        error: 'INVALID_MATCH_STATE',
      });
    }

    const inningsTeams = deriveInningsTeamsFromToss(match, dto.tossWinner, dto.decision);

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        tossWinner: dto.tossWinner,
        tossDecision: dto.decision,
        openingStrikerUserId: null,
        openingNonStrikerUserId: null,
        openingBowlerUserId: null,
        state: MatchState.Live,
      },
    });

    const existingInnings = await this.prisma.innings.findFirst({
      where: { matchId },
      orderBy: { sequence: 'asc' },
    });

    if (existingInnings) {
      await this.prisma.innings.update({
        where: { id: existingInnings.id },
        data: {
          battingTeamId: inningsTeams.battingTeamId,
          bowlingTeamId: inningsTeams.bowlingTeamId,
          battingIsExternal: inningsTeams.battingIsExternal,
          bowlingIsExternal: inningsTeams.bowlingIsExternal,
        },
      });
    } else {
      await this.scoring.startInnings(actor, matchId, {
        battingTeamId: inningsTeams.battingTeamId,
        bowlingTeamId: inningsTeams.bowlingTeamId,
        battingIsExternal: inningsTeams.battingIsExternal,
        bowlingIsExternal: inningsTeams.bowlingIsExternal,
        oversAllotted: match.oversPerInnings,
        expectedVersion: match.scorecardVersion,
      });
    }

    await this.audit.record({
      action: 'MATCH_SCORING_STARTED',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: {
        tossWinner: dto.tossWinner,
        tossDecision: dto.decision,
        battingFirstTeamId: inningsTeams.battingTeamId,
        bowlingFirstTeamId: inningsTeams.bowlingTeamId,
      },
    });

    return this.getDetail(matchId);
  }

  /**
   * Pre-scoring setup (§11): record toss, opening players, go Live, and open the
   * first innings. Guarded to the assigned Scorer (or other START_MATCH holders).
   */
  async startMatchSetup(
    actor: AuthUser,
    matchId: string,
    dto: StartMatchSetupRequest,
  ): Promise<MatchDetail> {
    const match = await this.requireMatchRow(matchId);
    const allowed = await this.permissions.check(Permission.START_MATCH, actor, { matchId });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to start this match',
        error: 'FORBIDDEN',
      });
    }

    if (
      match.state !== MatchState.PlayingXiLocked &&
      match.state !== MatchState.TossCompleted &&
      match.state !== MatchState.Delayed
    ) {
      throw new BadRequestException({
        message: 'Lock the Playing 11 for all teams before starting the match',
        error: 'PLAYING_XI_REQUIRED',
        fields: { playingXi: 'Playing 11 must be locked before match start' },
      });
    }

    if (dto.strikerUserId === dto.nonStrikerUserId) {
      throw new BadRequestException({
        message: 'Striker and non-striker must be different players',
        error: 'OPENERS_INVALID',
        fields: { nonStrikerUserId: 'Select a different non-striker' },
      });
    }

    const inningsTeams = deriveInningsTeamsFromToss(match, dto.tossWinner, dto.tossDecision);
    this.assertOpenerInSquad(
      match,
      dto.strikerUserId,
      inningsTeams.battingTeamId,
      'strikerUserId',
      'Striker must be in the batting Playing 11',
    );
    this.assertOpenerInSquad(
      match,
      dto.nonStrikerUserId,
      inningsTeams.battingTeamId,
      'nonStrikerUserId',
      'Non-striker must be in the batting Playing 11',
    );
    this.assertOpenerInSquad(
      match,
      dto.bowlerUserId,
      inningsTeams.bowlingTeamId,
      'bowlerUserId',
      'Bowler must be in the bowling Playing 11',
    );

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        tossWinner: dto.tossWinner,
        tossDecision: dto.tossDecision,
        openingStrikerUserId: dto.strikerUserId,
        openingNonStrikerUserId: dto.nonStrikerUserId,
        openingBowlerUserId: dto.bowlerUserId,
        state: MatchState.Live,
      },
    });

    await this.scoring.startInnings(actor, matchId, {
      battingTeamId: inningsTeams.battingTeamId,
      bowlingTeamId: inningsTeams.bowlingTeamId,
      battingIsExternal: inningsTeams.battingIsExternal,
      bowlingIsExternal: inningsTeams.bowlingIsExternal,
      oversAllotted: match.oversPerInnings,
      expectedVersion: match.scorecardVersion,
    });

    await this.audit.record({
      action: 'MATCH_STARTED',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: {
        tossWinner: dto.tossWinner,
        tossDecision: dto.tossDecision,
        openingStrikerUserId: dto.strikerUserId,
        openingNonStrikerUserId: dto.nonStrikerUserId,
        openingBowlerUserId: dto.bowlerUserId,
      },
    });

    return this.getDetail(matchId);
  }

  private assertOpenerInSquad(
    match: MatchRow,
    userId: string,
    teamId: string | null,
    field: string,
    message: string,
  ): void {
    if (!teamId) {
      throw new BadRequestException({
        message: 'Opening players cannot be validated for an external-only side',
        error: 'EXTERNAL_OPENER_NOT_SUPPORTED',
      });
    }
    const squad = match.squads.find((row) => row.teamId === teamId);
    const inXi = squad?.players.some(
      (player) => player.userId === userId && player.role === MatchSquadRole.PlayingXi,
    );
    if (!inXi) {
      throw new BadRequestException({
        message,
        error: 'OPENERS_INVALID',
        fields: { [field]: message },
      });
    }
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
    await this.scorerGrants.assignOrSwitch(matchId, dto.userId, actor.id);
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
      select: { id: true, isDeleted: true },
    });
    assertTournamentActive(tournament);
  }

  private async requireTournamentRecord(tournamentId: string): Promise<{
    id: string;
    type: TournamentType;
    ballType: BallType;
    matchSchedulingFormat: MatchSchedulingFormat | null;
  }> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        type: true,
        ballType: true,
        matchSchedulingFormat: true,
        isDeleted: true,
      },
    });
    assertTournamentActive(tournament);
    return {
      id: tournament.id,
      type: tournament.type as TournamentType,
      ballType: tournament.ballType as BallType,
      matchSchedulingFormat: tournament.matchSchedulingFormat as MatchSchedulingFormat | null,
    };
  }

  private async assertMatchDateAllowed(tournamentId: string, matchDate: string): Promise<void> {
    const rows = await this.prisma.tournamentDate.findMany({
      where: { tournamentId },
      select: { date: true },
    });
    if (rows.length === 0) {
      throw new BadRequestException({
        message: 'This tournament has no match days configured',
        error: 'NO_TOURNAMENT_DATES',
        fields: { matchDate: 'No tournament match days are configured' },
      });
    }
    const allowed = new Set(rows.map((row) => formatUtcIsoDate(row.date)));
    if (!allowed.has(matchDate)) {
      throw new BadRequestException({
        message: 'Match date must be one of the tournament match days',
        error: 'MATCH_DATE_NOT_ALLOWED',
        fields: { matchDate: 'Choose one of the tournament match days' },
      });
    }
  }

  private async assertTeamsInGroup(
    tournamentId: string,
    groupId: string,
    teamIds: (string | null | undefined)[],
  ): Promise<void> {
    const ids = teamIds.filter((id): id is string => Boolean(id));
    const group = await this.prisma.tournamentGroup.findFirst({
      where: { id: groupId, tournamentId },
      include: { teams: { select: { id: true } } },
    });
    if (!group) {
      throw new BadRequestException({
        message: 'Group not found in this tournament',
        error: 'GROUP_NOT_FOUND',
        fields: { groupId: 'Invalid group' },
      });
    }
    const groupTeamIds = new Set(group.teams.map((team) => team.id));
    for (const teamId of ids) {
      if (!groupTeamIds.has(teamId)) {
        throw new BadRequestException({
          message: 'Both teams must belong to the selected group',
          error: 'TEAM_NOT_IN_GROUP',
          fields: { groupId: 'Teams must belong to the selected group' },
        });
      }
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

  private async requireMatchRow(matchId: string): Promise<MatchRow> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: MATCH_INCLUDE,
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

  private async assertRoundRobinPairNotDuplicate(
    tournamentId: string,
    homeTeamId: string,
    awayTeamId: string,
  ): Promise<void> {
    const pairKey = normalizeTeamPairKey(homeTeamId, awayTeamId);
    const rows = await this.prisma.match.findMany({
      where: {
        tournamentId,
        ...ACTIVE_MATCH_WHERE,
        homeTeamId: { not: null },
        awayTeamId: { not: null },
      },
      select: { homeTeamId: true, awayTeamId: true },
    });

    for (const row of rows) {
      if (
        row.homeTeamId &&
        row.awayTeamId &&
        normalizeTeamPairKey(row.homeTeamId, row.awayTeamId) === pairKey
      ) {
        throw new BadRequestException({
          message: 'These teams are already scheduled to play in this round robin',
          error: 'DUPLICATE_ROUND_ROBIN_PAIRING',
          fields: {
            teamBId: 'These teams are already scheduled to play in this round robin.',
          },
        });
      }
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
      matchType: row.matchType as MatchType,
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

  private toListItem(row: MatchListRow): Omit<MatchListItem, 'displayState'> {
    const homeName = row.homeTeam?.name ?? 'TBD';
    const awayName = row.awayTeam?.name ?? row.externalOpponentName ?? 'TBD';

    return {
      id: row.id,
      tournamentId: row.tournamentId,
      matchCode: row.matchCode,
      state: row.state as MatchState,
      matchDate: row.matchDate ? formatUtcIsoDate(row.matchDate) : null,
      startTime: row.startTime?.toISOString() ?? null,
      teamA: {
        id: row.homeTeamId,
        name: homeName,
        logoUrl: row.homeTeam?.logoUrl ?? null,
      },
      teamB: {
        id: row.awayTeamId,
        name: awayName,
        logoUrl: row.awayTeam?.logoUrl ?? null,
      },
      groundLocation: row.groundLocation,
      resultSummary: this.buildListResultSummary(row, homeName, awayName),
      liveScore: null,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private buildListResultSummary(
    row: MatchListRow,
    homeName: string,
    awayName: string,
  ): string | null {
    const state = row.state as MatchState;
    if (!LIST_COMPLETED_STATES.includes(state)) {
      return null;
    }
    if (row.isNoResult) {
      return 'No Result';
    }
    const note = row.resultNote?.trim();
    if (note) {
      return note;
    }
    if (row.winningTeamId) {
      const winnerName =
        row.winningTeamId === row.homeTeamId
          ? homeName
          : row.winningTeamId === row.awayTeamId
            ? awayName
            : null;
      if (winnerName) {
        return `${winnerName} won`;
      }
    }
    return null;
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
    const inningsSides =
      row.tossWinner && row.tossDecision
        ? deriveInningsTeamsFromToss(
            row,
            row.tossWinner as MatchSide,
            row.tossDecision as TossDecision,
          )
        : null;
    return {
      ...this.toSummary(row),
      reportingTime: row.reportingTime?.toISOString() ?? null,
      groundLocation: row.groundLocation,
      geofenceLat: row.geofenceLat,
      geofenceLng: row.geofenceLng,
      tournamentTimezone: row.tournament.timezone,
      oversPerInnings: row.oversPerInnings,
      maxOversPerBowler: row.maxOversPerBowler,
      powerplayOvers: row.powerplayOvers,
      battingPowerplayOvers: row.battingPowerplayOvers,
      youtubeUrl: row.youtubeUrl,
      tossWinner: row.tossWinner as MatchSide | null,
      tossDecision: row.tossDecision as TossDecision | null,
      battingFirstTeamId: inningsSides?.battingTeamId ?? null,
      bowlingFirstTeamId: inningsSides?.bowlingTeamId ?? null,
      openingStrikerUserId: row.openingStrikerUserId,
      openingNonStrikerUserId: row.openingNonStrikerUserId,
      openingBowlerUserId: row.openingBowlerUserId,
      impactPlayerEnabled: row.tournament.impactPlayerEnabled,
      squads,
      activeScorers,
      externalPlayers: row.externalPlayers.map((player) => ({
        id: player.id,
        matchId: player.matchId,
        slot: player.slot,
        name: player.name,
        battingStyle: player.battingStyle,
        bowlingType: player.bowlingType,
      })),
      completedAt: row.completedAt?.toISOString() ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      confirmedByUserId: row.confirmedByUserId,
      autoConfirmed: row.autoConfirmed,
      manOfTheMatchUserId: row.manOfTheMatchUserId,
      manOfTheMatchSelectedAt: row.manOfTheMatchSelectedAt?.toISOString() ?? null,
      manOfTheMatchSelectedByUserId: row.manOfTheMatchSelectedByUserId,
      winningTeamId: row.winningTeamId,
      resultNote: row.resultNote,
      isNoResult: row.isNoResult,
    };
  }
}
