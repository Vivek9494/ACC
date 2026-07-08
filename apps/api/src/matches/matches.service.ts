import {
  type AssignScorerRequest,
  type AuthUser,
  type HandoverScorerRequest,
  LIVE_MATCH_STATES,
  canMidMatchSwapMatchScorer,
  MATCH_END_STATES,
  MATCH_STATE_TRANSITIONS,
  MatchCardDisplayState,
  MatchSchedulingFormat,
  MatchSquadRole,
  MatchState,
  MatchType,
  isKnockoutMatchType,
  type MatchDetail,
  type MatchListItem,
  type MatchLiveScoreSummary,
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
  type SwapMatchScorerRequest,
  TournamentType,
  BallType,
  HomeAway,
  UserRole,
  canAssignTeamRoles,
  canViewAdminUsersDirectory,
  formatUtcIsoDate,
  calendarDateFromUtcMidnightIso,
  compareIsoDateOnly,
  formatTodayDateOnlyInZone,
  isAllowedMatchDelayIncrement,
  isDateWithinLeatherSpan,
  isIsoDateOnly,
  isPreLiveMatchState,
  isMatchDayTodayInZone,
  serverVenueTimezone,
  assertLiveStartAllowedOnSchedule,
  validateMatchDetailStatusTransition,
  validateBattingPowerplayOvers,
  validateMaxOversPerBowler,
  validatePowerplayOvers,
  normalizeTeamPairKey,
  PLAYING_XI_SIZE,
  RegistrationPlayerType,
  ScorerRevokedReason,
  buildMatchPlayingXiFinalizationStatus,
  countPlayingXiStarters,
  isExternalOpponentMatch,
  type ExternalPlayerView,
  type FinalizeBothPlayingXiRequest,
  type RoundRobinMatchSetupContext,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { MatchScorerGrantService } from '../authz/match-scorer.service';
import { PermissionService } from '../authz/permission.service';
import { isCaptainOrViceCaptain } from '../authz/team-leader.util';
import { NotificationAudienceService } from '../notifications/notification-audience.service';
import {
  NotificationsService,
  NotificationTrigger,
} from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { selectableUserWhere } from '../users/user-query';
import { activeTeamWhere } from '../teams/team-query';
import { StandingsService } from '../standings/standings.service';
import { ScoringService } from '../scoring/scoring.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { LiveService } from '../live/live.service';
import { assertTournamentActive } from '../tournaments/tournament-query';
import { TournamentScorersService } from '../tournaments/tournament-scorers.service';
import { TennisMatchScoringAuthService } from '../tournaments/tennis-match-scoring-auth.service';
import { SuspensionService } from '../suspension/suspension.service';
import { assertCanCreateMatchFixture } from './create-match-auth.util';
import { assertCanManageUpcomingMatch } from './match-manage-auth.util';
import {
  deriveInningsTeamsFromToss,
} from './match-start.utils';
import type { CreateMatchDto } from './dto/create-match.dto';
import type { FinalizeBothPlayingXiDto } from './dto/finalize-both-playing-xi.dto';
import type { LockPlayingXiDto } from './dto/lock-playing-xi.dto';
import type { UpdateMatchDto } from './dto/update-match.dto';

/** Suspension statuses that count as "currently suspended" (?10.2���?10.5). */
const ACTIVE_SUSPENSION_STATUSES = ['PENDING', 'CARRIED_FORWARD'] as const;

/** States in which a team's Playing 11 may be locked / re-locked (?5.2). */
const XI_LOCKABLE_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.Delayed,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
];

/** Maps a state-transition target to the permission that authorises it. */
// Status transitions share UPDATE_MATCH_STATUS / CANCEL_MATCH (§5.2). START_MATCH and
// COMPLETE_MATCH remain on the dedicated scoring endpoints (toss + first ball, in-game finish).
const STATE_PERMISSION: Partial<Record<MatchState, Permission>> = {
  LIVE: Permission.UPDATE_MATCH_STATUS,
  COMPLETED: Permission.UPDATE_MATCH_STATUS,
  NO_RESULT: Permission.UPDATE_MATCH_STATUS,
  RAIN_INTERRUPTED: Permission.UPDATE_MATCH_STATUS,
  DELAYED: Permission.UPDATE_MATCH_STATUS,
  CANCELLED: Permission.CANCEL_MATCH,
};

/** States that record the completion timestamp that starts the ?13.1 window. */
const COMPLETION_STATES: MatchState[] = [MatchState.Completed, MatchState.NoResult];

/** Excludes soft-deleted rows from schedules and round-robin pair guards. */
const ACTIVE_MATCH_WHERE = { isDeleted: false } as const satisfies Prisma.MatchWhereInput;

type MatchRow = Prisma.MatchGetPayload<{
  include: {
    homeTeam: { select: { name: true } };
    awayTeam: { select: { name: true } };
    group: { select: { name: true } };
    tournament: { select: { name: true; impactPlayerEnabled: true; type: true; ballType: true; timezone: true; oversPerInnings: true } };
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

// `MatchScorerGrant.userId` is intentionally not a hard FK (?2), so scorer
// names are resolved in a separate lookup rather than via an include.
const MATCH_INCLUDE = {
  homeTeam: { select: { name: true } },
  awayTeam: { select: { name: true } },
  group: { select: { name: true } },
  tournament: { select: { name: true, impactPlayerEnabled: true, type: true, ballType: true, timezone: true, oversPerInnings: true } },
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
  group: { select: { name: true } },
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
 * Stable hash of a confirmed squad (sorted userIds by role) so a §17 Playing-11
 * notification de-dups on an unchanged re-confirm but re-fires on a real roster
 * change (impact candidates are excluded — they aren't part of the announced XI).
 */
function playingXiRosterHash(
  playingXi: readonly string[],
  substitutes: readonly string[],
): string {
  const xi = [...playingXi].sort().join(',');
  const subs = [...substitutes].sort().join(',');
  return `xi:${xi}|sub:${subs}`;
}

/** Short venue-local date/time string for notification bodies (Ontario convention). */
function formatMatchDateForNotification(startTime: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: serverVenueTimezone(null),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(startTime);
}

/**
 * Match setup & lifecycle (spec ?5.2, ?11): creation, the state machine,
 * Playing-11 lock (?9.7, ?8), toss capture (?11.2) and the per-match Scorer
 * grant including mid-match handover (?11.1).
 */
@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly scorerGrants: MatchScorerGrantService,
    private readonly notifications: NotificationsService,
    private readonly notificationAudience: NotificationAudienceService,
    private readonly audit: AuditService,
    private readonly standings: StandingsService,
    private readonly scoring: ScoringService,
    private readonly mediaUrls: MediaUrlResolver,
    private readonly tournamentScorers: TournamentScorersService,
    private readonly tennisMatchScoringAuth: TennisMatchScoringAuthService,
    private readonly live: LiveService,
    private readonly suspensions: SuspensionService,
  ) {}

  // --- Creation & reads ----------------------------------------------------

  async create(actor: AuthUser, tournamentId: string, dto: CreateMatchDto): Promise<MatchDetail> {
    const tournament = await this.requireTournamentRecord(tournamentId);

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

    await assertCanCreateMatchFixture(
      this.permissions,
      this.prisma,
      actor,
      { id: tournament.id, ballType: tournament.ballType as BallType },
      dto.homeTeamId,
    );
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
    // Knockout rounds pair teams across groups — group is optional and the
    // belong-to-group constraint is skipped for them.
    const isKnockout = isKnockoutMatchType(dto.matchType);
    if (isGroupStage && !isKnockout) {
      if (!dto.groupId) {
        throw new BadRequestException({
          message: 'Group is required for group-stage fixtures',
          error: 'GROUP_REQUIRED',
          fields: { groupId: 'Group is required' },
        });
      }
      await this.assertTeamsInGroup(tournamentId, dto.groupId, [dto.homeTeamId, dto.awayTeamId]);
    } else if (dto.groupId && !isGroupStage) {
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
          groupId: isKnockoutMatchType(matchType) ? null : dto.groupId ?? null,
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
          homeAway: dto.homeAway ?? null,
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

    await this.notifyMatchScheduleAudience({
      matchId: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      startTime: match.startTime,
      reschedule: false,
    });

    return this.getDetail(match.id, actor);
  }

  /**
   * §17 Phase B: notify both teams' squads when a match is scheduled or its
   * date/time changes. External-opponent fixtures have only the home squad.
   * Deduped per match (schedule) or per new start time (reschedule) so a save
   * that doesn't move the fixture won't re-notify. Best-effort.
   */
  private async notifyMatchScheduleAudience(input: {
    matchId: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    startTime: Date | null;
    reschedule: boolean;
  }): Promise<void> {
    try {
      const teamIds = [input.homeTeamId, input.awayTeamId].filter(
        (id): id is string => id != null,
      );
      const audienceSets = await Promise.all(
        teamIds.map((id) => this.notificationAudience.resolveTeamSquad(id)),
      );
      const userIds = [...new Set(audienceSets.flat())];
      if (userIds.length === 0) {
        return;
      }
      const whenText = input.startTime
        ? formatMatchDateForNotification(input.startTime)
        : null;
      const trigger = input.reschedule
        ? NotificationTrigger.MatchRescheduled
        : NotificationTrigger.MatchScheduled;
      const dedupeKey = input.reschedule
        ? `${trigger}:${input.matchId}:${input.startTime?.toISOString() ?? 'na'}`
        : `${trigger}:${input.matchId}`;
      const body = input.reschedule
        ? whenText
          ? `Your match has been moved to ${whenText}.`
          : 'Your match schedule has changed.'
        : whenText
          ? `A new match is scheduled for ${whenText}.`
          : 'A new match has been scheduled.';
      await this.notifications.sendToAudience(userIds, {
        triggerKey: trigger,
        dedupeKey,
        title: input.reschedule ? 'Match rescheduled' : 'Match scheduled',
        body,
        data: { matchId: input.matchId, screen: 'match' },
        audienceSummary: `${input.reschedule ? 'Reschedule' : 'Schedule'} of match ${input.matchId} to both squads`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send schedule notification for match ${input.matchId}`,
        err as Error,
      );
    }
  }

  /** Edit an upcoming fixture (Admin / Club Manager only). */
  async update(actor: AuthUser, matchId: string, dto: UpdateMatchDto): Promise<MatchDetail> {
    const existing = await this.requireActiveMatchRow(matchId);
    await assertCanManageUpcomingMatch(
      this.permissions,
      actor,
      {
        id: existing.id,
        tournamentId: existing.tournamentId,
        state: existing.state as MatchState,
      },
      Permission.EDIT_MATCH,
    );

    const tournament = await this.requireTournamentRecord(existing.tournamentId);
    const fixture = await this.validateFixtureDto(actor, tournament, dto, {
      mode: 'update',
      excludeMatchId: existing.id,
      existing,
    });

    if (
      existing.state !== MatchState.Scheduled &&
      existing.state !== MatchState.Delayed &&
      (fixture.homeTeamId !== existing.homeTeamId ||
        fixture.awayTeamId !== existing.awayTeamId ||
        (fixture.externalOpponentName ?? null) !== (existing.externalOpponentName ?? null))
    ) {
      throw new BadRequestException({
        message: 'Teams cannot be changed after match setup has progressed',
        error: 'TEAMS_LOCKED',
      });
    }

    const beforeSnapshot = this.fixtureAuditSnapshot(existing);

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        groupId: fixture.groupId,
        matchCode: fixture.matchCode,
        matchType: fixture.matchType,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        externalOpponentName: fixture.externalOpponentName,
        roundRobinPairKey: fixture.roundRobinPairKey,
        matchDate: new Date(`${fixture.matchDate}T00:00:00.000Z`),
        startTime: new Date(fixture.startTime),
        reportingTime: fixture.reportingTime ? new Date(fixture.reportingTime) : null,
        groundLocation: fixture.groundLocation,
        geofenceLat: fixture.geofenceLat,
        geofenceLng: fixture.geofenceLng,
        oversPerInnings: fixture.oversPerInnings,
        maxOversPerBowler: fixture.maxOversPerBowler,
        powerplayOvers: fixture.powerplayOvers,
        battingPowerplayOvers: fixture.battingPowerplayOvers,
        homeAway: fixture.homeAway,
        youtubeUrl: fixture.youtubeUrl,
      },
    });

    await this.audit.record({
      action: 'MATCH_UPDATED',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: beforeSnapshot,
      after: this.fixtureAuditSnapshot(await this.requireActiveMatchRow(matchId)),
    });

    const newStartTime = new Date(fixture.startTime);
    const newMatchDate = new Date(`${fixture.matchDate}T00:00:00.000Z`);
    const dateTimeChanged =
      existing.startTime?.getTime() !== newStartTime.getTime() ||
      existing.matchDate?.getTime() !== newMatchDate.getTime();
    if (dateTimeChanged) {
      await this.notifyMatchScheduleAudience({
        matchId,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        startTime: newStartTime,
        reschedule: true,
      });
    }

    return this.getDetail(matchId, actor);
  }

  /** Soft-delete an upcoming fixture (Admin / Club Manager only). */
  async remove(actor: AuthUser, matchId: string): Promise<void> {
    const existing = await this.requireActiveMatchRow(matchId);
    await assertCanManageUpcomingMatch(
      this.permissions,
      actor,
      {
        id: existing.id,
        tournamentId: existing.tournamentId,
        state: existing.state as MatchState,
      },
      Permission.DELETE_MATCH,
    );

    const deletedAt = new Date();
    const beforeSnapshot = this.fixtureAuditSnapshot(existing);

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        isDeleted: true,
        deletedAt,
        deletedById: actor.id,
      },
    });

    await this.audit.record({
      action: 'MATCH_SOFT_DELETED',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: beforeSnapshot,
      after: { isDeleted: true, deletedAt: deletedAt.toISOString(), deletedById: actor.id },
    });
  }

  async list(
    tournamentId: string,
    teamId?: string,
    viewer?: AuthUser | null,
  ): Promise<MatchListItem[]> {
    const includeDeletedMatches = viewer?.role === UserRole.Admin;
    const rows = await this.prisma.match.findMany({
      where: {
        tournamentId,
        ...(includeDeletedMatches ? {} : ACTIVE_MATCH_WHERE),
        ...(teamId ? { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] } : {}),
      },
      include: MATCH_LIST_INCLUDE,
      orderBy: [{ matchDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    });
    const deleterIds = [
      ...new Set(rows.map((row) => row.deletedById).filter((id): id is string => Boolean(id))),
    ];
    const deleterNames = await this.namesFor(deleterIds);
    const items = prepareMatchListForDisplay(
      await Promise.all(
        rows.map((row) => this.toListItem(row, deleterNames.get(row.deletedById ?? '') ?? null)),
      ),
    );
    return this.attachMatchListPermissions(items, viewer);
  }

  private formatListUserName(
    user: { firstName: string; lastName: string } | null | undefined,
  ): string | null {
    if (!user) {
      return null;
    }
    const name = `${user.firstName} ${user.lastName}`.trim();
    return name.length > 0 ? name : null;
  }

  private async toListItem(
    row: MatchListRow,
    deletedBy: { firstName: string; lastName: string } | null = null,
  ): Promise<Omit<MatchListItem, 'displayState'>> {
    const homeName = row.homeTeam?.name ?? 'TBD';
    const awayName = row.awayTeam?.name ?? row.externalOpponentName ?? 'TBD';
    const [homeLogo, awayLogo] = await this.mediaUrls.resolveReadUrls([
      row.homeTeam?.logoUrl ?? null,
      row.awayTeam?.logoUrl ?? null,
    ]);

    return {
      id: row.id,
      tournamentId: row.tournamentId,
      matchCode: row.matchCode,
      state: row.state as MatchState,
      matchDate: row.matchDate ? formatUtcIsoDate(row.matchDate) : null,
      startTime: row.startTime?.toISOString() ?? null,
      delayMinutes: row.delayMinutes ?? 0,
      teamA: {
        id: row.homeTeamId,
        name: homeName,
        logoUrl: homeLogo ?? null,
      },
      teamB: {
        id: row.awayTeamId,
        name: awayName,
        logoUrl: awayLogo ?? null,
      },
      groundLocation: row.groundLocation,
      homeAway: (row.homeAway as HomeAway | null) ?? null,
      resultSummary: this.buildListResultSummary(row, homeName, awayName),
      liveScore: await this.resolveListLiveScore(row.id, row.state as MatchState),
      completedAt: row.completedAt?.toISOString() ?? null,
      isDeleted: row.isDeleted,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedByName: row.isDeleted ? this.formatListUserName(deletedBy) : null,
      groupId: row.groupId,
      groupName: row.group?.name ?? null,
    };
  }

  /** Partial/live score line for in-progress or cancelled fixtures with cached scoring. */
  private async resolveListLiveScore(
    matchId: string,
    state: MatchState,
  ): Promise<MatchLiveScoreSummary | null> {
    if (
      state !== MatchState.Live &&
      state !== MatchState.RainInterrupted &&
      state !== MatchState.Cancelled
    ) {
      return null;
    }
    const cached = await this.live.getCached(matchId);
    if (!cached || cached.innings.length === 0) {
      return null;
    }
    const innings = cached.innings[cached.innings.length - 1]!;
    return {
      inningsNumber: innings.sequence,
      runs: innings.runs,
      wickets: innings.wickets,
      oversText: innings.oversText,
    };
  }

  private async attachMatchListPermissions(
    items: MatchListItem[],
    viewer?: AuthUser | null,
  ): Promise<MatchListItem[]> {
    if (!viewer) {
      return items;
    }
    return Promise.all(
      items.map(async (item) => ({
        ...item,
        ...(await this.resolveMatchListPermissions(viewer, item)),
      })),
    );
  }

  private async resolveMatchListPermissions(
    viewer: AuthUser,
    item: MatchListItem,
  ): Promise<{ canEdit: boolean; canDelete: boolean }> {
    const refs = { tournamentId: item.tournamentId, matchId: item.id };
    const [canEdit, canDelete] = await Promise.all([
      this.permissions.check(Permission.EDIT_MATCH, viewer, refs),
      this.permissions.check(Permission.DELETE_MATCH, viewer, refs),
    ]);
    return {
      canEdit:
        canEdit &&
        !item.isDeleted &&
        item.displayState === MatchCardDisplayState.Scheduled,
      canDelete:
        canDelete &&
        !item.isDeleted &&
        item.displayState === MatchCardDisplayState.Scheduled,
    };
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

  async getDetail(matchId: string, viewer?: AuthUser | null): Promise<MatchDetail> {
    const row = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: MATCH_INCLUDE,
    });
    if (!row || row.isDeleted) {
      throw new NotFoundException({ message: 'Match not found', error: 'NOT_FOUND' });
    }
    const scorerIds = row.scorerGrants.filter((g) => g.revokedAt === null).map((g) => g.userId);
    const names = await this.namesFor(scorerIds);
    const detail = this.toDetail(row, names);
    const penaltyByTeam = await this.suspensions.listPenaltyServingForSquads(
      matchId,
      detail.squads.map((squad) => squad.teamId),
    );
    detail.squads = detail.squads.map((squad) => ({
      ...squad,
      penaltyServing: penaltyByTeam.get(squad.teamId) ?? [],
    }));
    if (row.tournament.ballType === BallType.Tennis) {
      detail.tennisScorer = await this.tournamentScorers.buildMatchTennisScorerView(
        viewer,
        row.tournamentId,
        row.state as MatchState,
        detail.activeScorers,
      );
    }
    return detail;
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

  /** Selectable players for a team's Playing-11 screen, with suspended badge (?9.7). */
  async squadCandidates(matchId: string, teamId: string): Promise<SquadCandidate[]> {
    const match = await this.requireMatch(matchId);
    this.assertTeamInMatch(match, teamId);

    const members = await this.prisma.teamMembership.findMany({
      where: { tournamentId: match.tournamentId, teamId, user: selectableUserWhere },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const userIds = members.map((m) => m.userId);
    const [registrations, suspendedIds] = await Promise.all([
      this.prisma.registration.findMany({
        where: { tournamentId: match.tournamentId, userId: { in: userIds } },
        select: { userId: true, battingStyle: true, bowlingStyle: true, playerType: true },
      }),
      this.suspendedUserIds(match.tournamentId, userIds, matchId),
    ]);
    const regByUser = new Map(registrations.map((r) => [r.userId, r]));

    return members.map((m) => {
      const reg = regByUser.get(m.userId);
      const playerType =
        reg?.playerType === RegistrationPlayerType.FullTime ||
        reg?.playerType === RegistrationPlayerType.PartTime
          ? reg.playerType
          : null;
      return {
        userId: m.userId,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        battingStyle: reg?.battingStyle ?? null,
        bowlingStyle: reg?.bowlingStyle ?? null,
        playerType,
        isSuspended: suspendedIds.has(m.userId),
      };
    });
  }

  // --- Playing 11 lock (?9.7, ?8) ------------------------------------------

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
    await this.assertPlayingXiAuthorization(actor, match, dto.teamId);
    await this.suspensions.assertPlayingXiExcludesPendingSuspensions(
      matchId,
      dto.teamId,
      dto.playingXi,
    );
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
          data: {
            lockedByUserId: actor.id,
            lockedAt: new Date(),
            isFinalized: true,
            finalizedByUserId: actor.id,
            finalizedAt: new Date(),
          },
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
            isFinalized: true,
            finalizedByUserId: actor.id,
            finalizedAt: new Date(),
            players: { create: players },
          },
        });
      }

      // §5.2: Playing 11 Locked once every participating system team has finalized
      // and (for external opponents) all 11 opponent names are entered.
      await this.tryTransitionPlayingXiLockedTx(tx, matchId, match);
    });

    await this.suspensions.markRemainingPendingAsServed(matchId, dto.teamId);

    await this.audit.record({
      action: 'MATCH_XI_LOCKED',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: { teamId: dto.teamId, playingXi: dto.playingXi, substitutes: dto.substitutes },
    });
    await this.notifyPlayingXiConfirmed(matchId, dto.teamId, dto.playingXi, dto.substitutes);

    return this.getDetail(matchId, actor);
  }

  /**
   * §17 Phase B: notify a team's confirmed Playing 11 + substitutes. Called from
   * every finalize path (direct lock, both-teams, poll-based). Deduped by roster
   * hash so an unchanged re-confirm is suppressed but a real change re-notifies.
   * Best-effort — never fails the lock.
   */
  private async notifyPlayingXiConfirmed(
    matchId: string,
    teamId: string,
    playingXi: string[],
    substitutes: string[],
  ): Promise<void> {
    const recipients = [...new Set([...playingXi, ...substitutes])];
    if (recipients.length === 0) {
      return;
    }
    try {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          externalOpponentName: true,
          startTime: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      });
      const opponentName =
        match == null
          ? 'your opponent'
          : teamId === match.homeTeamId
            ? (match.awayTeam?.name ?? match.externalOpponentName ?? 'your opponent')
            : (match.homeTeam?.name ?? 'your opponent');
      const whenText = match?.startTime
        ? formatMatchDateForNotification(match.startTime)
        : null;
      const body = whenText
        ? `Your Playing 11 vs ${opponentName} on ${whenText} is confirmed.`
        : `Your Playing 11 vs ${opponentName} is confirmed.`;
      await this.notifications.sendToAudience(recipients, {
        triggerKey: NotificationTrigger.PlayingXiPosted,
        dedupeKey: `${NotificationTrigger.PlayingXiPosted}:${matchId}:${teamId}:${playingXiRosterHash(playingXi, substitutes)}`,
        title: 'Playing 11 confirmed',
        body,
        data: { matchId, teamId, screen: 'match' },
        audienceSummary: `Playing 11 + subs for team ${teamId} in match ${matchId}`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send playing-11 notification for match ${matchId} team ${teamId}`,
        err as Error,
      );
    }
  }

  /** Scorer / Admin / CM: confirm Playing 11 for both teams in one step (§11). */
  async finalizeBothPlayingXi(
    actor: AuthUser,
    matchId: string,
    dto: FinalizeBothPlayingXiDto,
  ): Promise<MatchDetail> {
    await this.assertCanVerifyPlayingXi(actor, matchId);
    const match = await this.requireMatchRow(matchId);
    if (!XI_LOCKABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Playing 11 can only be verified before the match goes live',
        error: 'INVALID_MATCH_STATE',
      });
    }

    const homeName = match.homeTeam?.name ?? 'Home';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'Away';
    const teamNames = new Map<string, string>([
      ...(match.homeTeamId ? [[match.homeTeamId, homeName] as const] : []),
      ...(match.awayTeamId ? [[match.awayTeamId, awayName] as const] : []),
    ]);

    const byTeamId = new Map(dto.teams.map((team) => [team.teamId, team]));
    for (const teamId of [match.homeTeamId, match.awayTeamId]) {
      if (!teamId || !byTeamId.has(teamId)) {
        throw new BadRequestException({
          message: 'Both participating teams must be included',
          error: 'INVALID_TEAM_SET',
        });
      }
    }

    const homeTeamId = match.homeTeamId;
    const awayTeamId = match.awayTeamId;
    const homeDto = homeTeamId ? byTeamId.get(homeTeamId) : undefined;
    const awayDto = awayTeamId ? byTeamId.get(awayTeamId) : undefined;
    const homeValid = (homeDto?.playingXi.length ?? 0) === PLAYING_XI_SIZE;
    const awayValid = (awayDto?.playingXi.length ?? 0) === PLAYING_XI_SIZE;

    if (!homeValid || !awayValid) {
      if (homeValid && !awayValid && awayTeamId) {
        throw new BadRequestException({
          message: `Please select ${teamNames.get(awayTeamId) ?? 'the other team'}'s Playing 11`,
          error: 'INCOMPLETE_PLAYING_XI',
        });
      }
      if (!homeValid && awayValid && homeTeamId) {
        throw new BadRequestException({
          message: `Please select ${teamNames.get(homeTeamId) ?? 'the other team'}'s Playing 11`,
          error: 'INCOMPLETE_PLAYING_XI',
        });
      }
      throw new BadRequestException({
        message: `Select exactly ${PLAYING_XI_SIZE} players for each team's Playing 11`,
        error: 'INVALID_PLAYING_XI_SIZE',
      });
    }

    for (const team of dto.teams) {
      await this.lockPlayingXi(actor, matchId, team);
    }

    return this.getDetail(matchId, actor);
  }

  /** Pre-match: add a name-only player to the external opponent roster (§9.5). */
  async addOpponentPlayer(
    actor: AuthUser,
    matchId: string,
    name: string,
  ): Promise<ExternalPlayerView> {
    await this.assertCanVerifyPlayingXi(actor, matchId);
    const match = await this.requireMatchRow(matchId);
    if (!isExternalOpponentMatch(match)) {
      throw new BadRequestException({
        message: 'Opponent players can only be added for external-opponent fixtures',
        error: 'NOT_EXTERNAL_OPPONENT',
      });
    }
    if (!XI_LOCKABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Opponent players can only be edited before the match goes live',
        error: 'INVALID_MATCH_STATE',
      });
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException({
        message: 'Enter a player name',
        error: 'NAME_REQUIRED',
      });
    }

    const existing = await this.prisma.externalPlayer.findMany({
      where: { matchId },
      select: { id: true, name: true, slot: true },
    });
    if (existing.length >= PLAYING_XI_SIZE) {
      throw new BadRequestException({
        message: 'Maximum of 11 opponent players reached',
        error: 'OPPONENT_ROSTER_FULL',
      });
    }
    const duplicate = existing.some(
      (row) => row.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      throw new BadRequestException({
        message: 'This player name is already on the opponent list',
        error: 'DUPLICATE_OPPONENT_NAME',
      });
    }

    const nextSlot = existing.reduce((max, row) => Math.max(max, row.slot), 0) + 1;
    const created = await this.prisma.externalPlayer.create({
      data: { matchId, slot: nextSlot, name: trimmed },
    });

    await this.tryTransitionPlayingXiLocked(matchId);

    await this.audit.record({
      action: 'OPPONENT_PLAYER_ADDED',
      actorUserId: actor.id,
      targetEntityType: 'external_player',
      targetEntityId: created.id,
      after: { matchId, name: trimmed, slot: nextSlot },
    });

    return {
      id: created.id,
      matchId: created.matchId,
      slot: created.slot,
      name: created.name,
      battingStyle: created.battingStyle,
      bowlingType: created.bowlingType,
    };
  }

  /** Pre-match: remove a name-only opponent player (§9.5). */
  async removeOpponentPlayer(actor: AuthUser, matchId: string, playerId: string): Promise<MatchDetail> {
    await this.assertCanVerifyPlayingXi(actor, matchId);
    const match = await this.requireMatchRow(matchId);
    if (!isExternalOpponentMatch(match)) {
      throw new BadRequestException({
        message: 'Opponent players can only be edited for external-opponent fixtures',
        error: 'NOT_EXTERNAL_OPPONENT',
      });
    }
    if (!XI_LOCKABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Opponent players can only be edited before the match goes live',
        error: 'INVALID_MATCH_STATE',
      });
    }

    const row = await this.prisma.externalPlayer.findUnique({ where: { id: playerId } });
    if (!row || row.matchId !== matchId) {
      throw new NotFoundException({ message: 'Opponent player not found', error: 'NOT_FOUND' });
    }

    await this.prisma.externalPlayer.delete({ where: { id: playerId } });

    if (match.state === MatchState.PlayingXiLocked) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { state: MatchState.Scheduled },
      });
    }

    await this.audit.record({
      action: 'OPPONENT_PLAYER_REMOVED',
      actorUserId: actor.id,
      targetEntityType: 'external_player',
      targetEntityId: playerId,
      before: { matchId, name: row.name, slot: row.slot },
    });

    return this.getDetail(matchId, actor);
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

  /** Poll-based Playing XI confirm ��� IN voters only, unlimited substitutes (?9.7). */
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
    await this.suspensions.assertPlayingXiExcludesPendingSuspensions(matchId, teamId, playingXi);
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
          data: {
            lockedByUserId: actor.id,
            lockedAt: new Date(),
            isFinalized: true,
            finalizedByUserId: actor.id,
            finalizedAt: new Date(),
          },
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
            isFinalized: true,
            finalizedByUserId: actor.id,
            finalizedAt: new Date(),
            players: { create: players },
          },
        });
      }

      const participating = [match.homeTeamId, match.awayTeamId].filter(
        (id): id is string => id !== null,
      );
      const finalizedCount = await tx.matchSquad.count({
        where: {
          matchId,
          isFinalized: true,
          teamId: { in: participating },
        },
      });
      if (
        finalizedCount >= participating.length &&
        XI_LOCKABLE_STATES.includes(match.state as MatchState)
      ) {
        await tx.match.update({
          where: { id: matchId },
          data: { state: MatchState.PlayingXiLocked },
        });
      }
    });

    await this.suspensions.markRemainingPendingAsServed(matchId, teamId);

    await this.audit.record({
      action: 'MATCH_XI_LOCKED',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      after: { teamId, playingXi, substitutes, source: 'participation_poll' },
    });
    await this.notifyPlayingXiConfirmed(matchId, teamId, playingXi, substitutes);
  }

  // --- Toss (?11.2) --------------------------------------------------------

  async recordToss(
    actor: AuthUser,
    matchId: string,
    dto: RecordTossRequest,
  ): Promise<MatchDetail> {
    await this.assertCanRecordToss(actor, matchId);
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

  private async assertCanRecordToss(actor: AuthUser, matchId: string): Promise<void> {
    const match = await this.requireMatch(matchId);
    if (match.tournament.ballType === BallType.Tennis) {
      await this.tennisMatchScoringAuth.assertCanRecordToss(actor, matchId);
      return;
    }
    const allowed = await this.permissions.check(Permission.RECORD_TOSS, actor, { matchId });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have permission to record the toss for this match',
        error: 'FORBIDDEN',
      });
    }
  }

  /**
   * Scorer Match Setup dialog (?11.2): capture toss, derive first-innings sides,
   * move Live, and open innings 1. Idempotent before the first ball ��� toss can
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

    await this.assertBothTeamsFinalized(match);

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
      MatchState.Scheduled,
      MatchState.PlayingXiLocked,
      MatchState.TossCompleted,
      MatchState.Delayed,
      MatchState.Live,
    ];
    if (!allowedStates.includes(state)) {
      throw new BadRequestException({
        message: 'The match is not in a state where scoring can begin',
        error: 'INVALID_MATCH_STATE',
      });
    }

    const inningsTeams = deriveInningsTeamsFromToss(match, dto.tossWinner, dto.decision);

    if (state !== MatchState.Live) {
      const timeZone = serverVenueTimezone(match.tournament.timezone);
      const scheduleGuard = assertLiveStartAllowedOnSchedule({
        matchDate: match.matchDate,
        startTime: match.startTime,
        timeZone,
      });
      if (!scheduleGuard.ok) {
        throw new BadRequestException({
          message: scheduleGuard.message,
          error: scheduleGuard.error,
        });
      }
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        tossWinner: dto.tossWinner,
        tossDecision: dto.decision,
        openingStrikerUserId: null,
        openingNonStrikerUserId: null,
        openingBowlerUserId: null,
        state: MatchState.Live,
        ...(match.delayMinutes > 0 ? { delayMinutes: 0 } : {}),
      },
    });

    const existingInnings = await this.prisma.innings.findFirst({
      where: { matchId },
      orderBy: { sequence: 'asc' },
    });

    try {
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
    } catch (err) {
      if (!existingInnings) {
        await this.prisma.match.update({
          where: { id: matchId },
          data: { state },
        });
      }
      throw err;
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

    return this.getDetail(matchId, actor);
  }

  /**
   * Pre-scoring setup (?11): record toss, opening players, go Live, and open the
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

    await this.assertBothTeamsFinalized(match);

    if (match.awaitingTeams) {
      throw new BadRequestException({
        message: 'Both teams must be assigned before this knockout match can start',
        error: 'KNOCKOUT_AWAITING_TEAMS',
      });
    }

    if (
      match.state !== MatchState.Scheduled &&
      match.state !== MatchState.PlayingXiLocked &&
      match.state !== MatchState.TossCompleted &&
      match.state !== MatchState.Delayed
    ) {
      throw new BadRequestException({
        message: 'The match is not in a state where scoring can begin',
        error: 'INVALID_MATCH_STATE',
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

    const timeZone = serverVenueTimezone(match.tournament.timezone);
    const scheduleGuard = assertLiveStartAllowedOnSchedule({
      matchDate: match.matchDate,
      startTime: match.startTime,
      timeZone,
    });
    if (!scheduleGuard.ok) {
      throw new BadRequestException({
        message: scheduleGuard.message,
        error: scheduleGuard.error,
      });
    }

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        tossWinner: dto.tossWinner,
        tossDecision: dto.tossDecision,
        openingStrikerUserId: dto.strikerUserId,
        openingNonStrikerUserId: dto.nonStrikerUserId,
        openingBowlerUserId: dto.bowlerUserId,
        state: MatchState.Live,
        ...(match.delayMinutes > 0 ? { delayMinutes: 0 } : {}),
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

    return this.getDetail(matchId, actor);
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
    const match = await this.requireMatchRow(matchId);
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
    if (next === MatchState.Delayed) {
      throw new BadRequestException({
        message: 'Use the dedicated delay endpoint to record a delay duration',
        error: 'USE_DEDICATED_ENDPOINT',
      });
    }
    if (next === MatchState.Live && current !== MatchState.RainInterrupted) {
      throw new BadRequestException({
        message: 'Use Start Scoring to go live and open the first innings',
        error: 'USE_DEDICATED_ENDPOINT',
      });
    }

    const timeZone = serverVenueTimezone(match.tournament.timezone);
    const scheduleGuard = validateMatchDetailStatusTransition({
      state: current,
      matchDate: match.matchDate,
      startTime: match.startTime,
      timeZone,
      target: next,
    });
    if (!scheduleGuard.ok) {
      throw new BadRequestException({
        message: scheduleGuard.message,
        error: scheduleGuard.error,
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

    // ?13.1: completion stamps the moment the 5-hour confirm window starts (UTC).
    const completedAt =
      COMPLETION_STATES.includes(next) && !match.completedAt ? new Date() : undefined;

    const wasScorable = LIVE_MATCH_STATES.includes(current);
    let outgoingScorerId: string | null = null;
    if (next === MatchState.Cancelled && wasScorable) {
      const activeGrant = await this.scorerGrants.getActiveGrant(matchId);
      outgoingScorerId = activeGrant?.userId ?? null;
    }

    const clearDelayOnLive = next === MatchState.Live && match.delayMinutes > 0;

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        state: next,
        ...(completedAt ? { completedAt } : {}),
        ...(clearDelayOnLive ? { delayMinutes: 0 } : {}),
      },
    });

    // ?11.1: per-match Scorer grants are auto-revoked at match end.
    if (MATCH_END_STATES.includes(next)) {
      await this.scorerGrants.revokeAllForMatch(matchId);
    }

    if (outgoingScorerId) {
      this.live.notifyScorerRevoked(matchId, outgoingScorerId, ScorerRevokedReason.Cancelled);
    }
    await this.audit.record({
      action: 'MATCH_STATE_CHANGE',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: {
        state: current,
        ...(clearDelayOnLive ? { delayMinutes: match.delayMinutes } : {}),
      },
      after: {
        state: next,
        ...(clearDelayOnLive ? { delayMinutes: 0, delayClearedOnLive: true } : {}),
      },
    });

    if (COMPLETION_STATES.includes(next)) {
      await this.suspensions.generateForCompletedMatch(matchId);
    }

    return this.getDetail(matchId, actor);
  }

  /** Apply a cumulative pre-live delay (§5.2) — Admin / Club Manager only. */
  async applyDelay(
    actor: AuthUser,
    matchId: string,
    addMinutes: number,
  ): Promise<MatchDetail> {
    if (!canViewAdminUsersDirectory(actor.role)) {
      throw new ForbiddenException({
        message: 'You do not have permission to delay this match',
        error: 'FORBIDDEN',
      });
    }
    if (!isAllowedMatchDelayIncrement(addMinutes)) {
      throw new BadRequestException({
        message: 'Select a valid delay duration',
        error: 'INVALID_DELAY_MINUTES',
      });
    }

    const match = await this.requireMatchRow(matchId);
    const current = match.state as MatchState;

    if (!isPreLiveMatchState(current)) {
      throw new BadRequestException({
        message: 'Delay can only be applied before the match goes Live',
        error: 'MATCH_NOT_DELAY_ELIGIBLE',
      });
    }
    if (!match.startTime) {
      throw new BadRequestException({
        message: 'Set a match start time before recording a delay',
        error: 'MATCH_START_TIME_REQUIRED',
      });
    }

    const timeZone = serverVenueTimezone(match.tournament.timezone);
    if (
      !isMatchDayTodayInZone(
        { matchDate: match.matchDate, startTime: match.startTime },
        timeZone,
      )
    ) {
      throw new BadRequestException({
        message: 'Delay can only be applied on match day',
        error: 'MATCH_NOT_MATCH_DAY',
      });
    }

    const needsStateChange = current !== MatchState.Delayed;
    if (
      needsStateChange &&
      !MATCH_STATE_TRANSITIONS[current].includes(MatchState.Delayed)
    ) {
      throw new BadRequestException({
        message: `Cannot transition from ${current} to ${MatchState.Delayed}`,
        error: 'INVALID_STATE_TRANSITION',
      });
    }

    const nextDelayMinutes = (match.delayMinutes ?? 0) + addMinutes;

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        delayMinutes: nextDelayMinutes,
        ...(needsStateChange ? { state: MatchState.Delayed } : {}),
      },
    });

    await this.audit.record({
      action: 'MATCH_DELAY_APPLIED',
      actorUserId: actor.id,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: { state: current, delayMinutes: match.delayMinutes ?? 0 },
      after: {
        state: needsStateChange ? MatchState.Delayed : current,
        delayMinutes: nextDelayMinutes,
        addedMinutes: addMinutes,
      },
    });

    return this.getDetail(matchId, actor);
  }

  // --- Scorer assignment & handover (?11.1) --------------------------------

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

    if (match.tournament.ballType === BallType.Tennis) {
      await this.tournamentScorers.assertCanManage(actor, match.tournamentId);
      this.tournamentScorers.assertMatchScorerAssignable(match.state as MatchState);
      await this.tournamentScorers.assertUserInCurrentScorerSet(match.tournamentId, dto.userId);
    } else {
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
    }

    const scorerUser = await this.prisma.user.findFirst({
      where: { id: dto.userId, ...selectableUserWhere },
      select: { id: true },
    });
    if (!scorerUser) {
      throw new BadRequestException({
        message: 'Selected scorer is inactive or unavailable',
        error: 'USER_NOT_SELECTABLE',
      });
    }

    if (match.tournament.ballType === BallType.Tennis) {
      await this.scorerGrants.replaceActiveGrant(matchId, dto.userId, actor.id);
    } else {
      await this.scorerGrants.assignOrSwitch(matchId, dto.userId, actor.id);
    }
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
    return this.getDetail(matchId, actor);
  }

  /**
   * Admin/Club Manager mid-match scorer swap (DP1/DP2). The tournament's five-scorer
   * pool stays locked; only the per-match grant changes. Ball events are untouched.
   */
  async swapMatchScorer(
    actor: AuthUser,
    matchId: string,
    dto: SwapMatchScorerRequest,
  ): Promise<MatchDetail> {
    if (!canMidMatchSwapMatchScorer(actor.role)) {
      throw new ForbiddenException({
        message: 'Only Admin or Club Manager may swap the scorer mid-match',
        error: 'FORBIDDEN',
      });
    }

    const match = await this.requireMatch(matchId);
    if (match.tournament.ballType !== BallType.Tennis) {
      throw new BadRequestException({
        message: 'Mid-match scorer swap applies to tennis matches only',
        error: 'INVALID_BALL_TYPE',
      });
    }

    const state = match.state as MatchState;
    if (!LIVE_MATCH_STATES.includes(state)) {
      throw new BadRequestException({
        message: 'Mid-match scorer swap is only allowed while the match is live',
        error: 'MATCH_NOT_LIVE',
      });
    }

    await this.tournamentScorers.assertUserInCurrentScorerSet(match.tournamentId, dto.userId);

    const scorerUser = await this.prisma.user.findFirst({
      where: { id: dto.userId, ...selectableUserWhere },
      select: { id: true },
    });
    if (!scorerUser) {
      throw new BadRequestException({
        message: 'Selected scorer is inactive or unavailable',
        error: 'USER_NOT_SELECTABLE',
      });
    }

    const activeGrant = await this.scorerGrants.getActiveGrant(matchId);
    const fromUserId = activeGrant?.userId ?? null;
    if (fromUserId === dto.userId) {
      throw new BadRequestException({
        message: 'Selected scorer is already assigned to this match',
        error: 'SCORER_ALREADY_ASSIGNED',
      });
    }

    await this.scorerGrants.replaceActiveGrant(matchId, dto.userId, actor.id);
    await this.audit.record({
      action: 'MATCH_SCORER_MID_MATCH_SWAP',
      actorUserId: actor.id,
      targetUserId: dto.userId,
      targetEntityType: 'match',
      targetEntityId: matchId,
      before: fromUserId ? { fromUserId } : undefined,
      after: { toUserId: dto.userId },
    });

    if (fromUserId) {
      this.live.notifyScorerRevoked(matchId, fromUserId, ScorerRevokedReason.Swap);
    }
    this.live.notifyScorerAssigned(dto.userId, matchId);

    await this.notifications.notify(NotificationTrigger.ScorerAssigned, {
      recipientUserIds: [dto.userId],
      data: { matchId },
    });
    return this.getDetail(matchId, actor);
  }

  /**
   * Mid-match handover (?11.1): revoke the outgoing scorer (or all active
   * grants) and grant the incoming one. The new scorer resumes from the
   * server's last confirmed state ��� scoring state lives in the append-only
   * delivery stream, so no replay is needed here.
   */
  async handoverScorer(
    actor: AuthUser,
    matchId: string,
    dto: HandoverScorerRequest,
  ): Promise<MatchDetail> {
    await this.requireMatch(matchId);

    const scorerUser = await this.prisma.user.findFirst({
      where: { id: dto.toUserId, ...selectableUserWhere },
      select: { id: true },
    });
    if (!scorerUser) {
      throw new BadRequestException({
        message: 'Selected scorer is inactive or unavailable',
        error: 'USER_NOT_SELECTABLE',
      });
    }

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
    return this.getDetail(matchId, actor);
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
    return this.getDetail(matchId, actor);
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

  private async assertMatchDateAllowed(
    tournamentId: string,
    matchDate: string,
    options?: { existingMatchDateIso?: string | null },
  ): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { ballType: true, startAt: true, endAt: true, timezone: true },
    });
    if (!tournament) {
      throw new BadRequestException({
        message: 'Tournament not found',
        error: 'TOURNAMENT_NOT_FOUND',
        fields: { matchDate: 'Tournament not found' },
      });
    }

    const timeZone = serverVenueTimezone(tournament.timezone);
    const todayOnly = formatTodayDateOnlyInZone(timeZone);
    const existingDateOnly = options?.existingMatchDateIso
      ? calendarDateFromUtcMidnightIso(options.existingMatchDateIso)
      : null;
    const isUnchangedPastDate =
      existingDateOnly != null &&
      matchDate === existingDateOnly &&
      compareIsoDateOnly(matchDate, todayOnly) < 0;

    if (compareIsoDateOnly(matchDate, todayOnly) < 0 && !isUnchangedPastDate) {
      throw new BadRequestException({
        message: 'Match date cannot be in the past',
        error: 'MATCH_DATE_IN_PAST',
        fields: { matchDate: 'Choose today or a future date' },
      });
    }

    if (tournament.ballType === BallType.Leather) {
      const spanStart = formatUtcIsoDate(tournament.startAt);
      const spanEnd = formatUtcIsoDate(tournament.endAt);
      if (!isDateWithinLeatherSpan(matchDate, spanStart, spanEnd)) {
        throw new BadRequestException({
          message: 'Match date must fall within the tournament span',
          error: 'MATCH_DATE_NOT_ALLOWED',
          fields: { matchDate: 'Choose a date within the tournament span' },
        });
      }
      return;
    }

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
    externalOpponentName: string | null;
    completedAt: Date | null;
    delayMinutes: number;
    tournament: { impactPlayerEnabled: boolean; type: string; ballType: string };
  }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        state: true,
        tournamentId: true,
        homeTeamId: true,
        awayTeamId: true,
        externalOpponentName: true,
        completedAt: true,
        delayMinutes: true,
        tournament: { select: { impactPlayerEnabled: true, type: true, ballType: true } },
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

  /** Captain/VC of `teamId`, assigned Scorer, Admin, or Club Manager (§11). */
  private async assertPlayingXiAuthorization(
    actor: AuthUser,
    match: { id: string; tournamentId: string },
    teamId: string,
  ): Promise<void> {
    if (canAssignTeamRoles(actor)) {
      return;
    }

    if (await this.scorerGrants.hasActiveGrant(match.id, actor.id)) {
      return;
    }

    const isLeader = await isCaptainOrViceCaptain(
      this.prisma,
      actor.id,
      match.tournamentId,
      teamId,
    );
    if (isLeader) {
      return;
    }

    const allowed = await this.permissions.check(Permission.SELECT_PLAYING_11, actor, {
      matchId: match.id,
      teamId,
      tournamentId: match.tournamentId,
    });
    if (!allowed) {
      throw new ForbiddenException({
        message: 'You may only confirm the Playing 11 for a team you captain',
        error: 'FORBIDDEN',
      });
    }
  }

  private async assertCanVerifyPlayingXi(actor: AuthUser, matchId: string): Promise<void> {
    if (canAssignTeamRoles(actor)) {
      return;
    }
    if (await this.scorerGrants.hasActiveGrant(matchId, actor.id)) {
      return;
    }
    throw new ForbiddenException({
      message: 'Only the assigned scorer or an organizer may verify Playing 11 for both teams',
      error: 'FORBIDDEN',
    });
  }

  private async assertBothTeamsFinalized(
    match: {
      id: string;
      homeTeamId: string | null;
      awayTeamId: string | null;
      externalOpponentName: string | null;
    },
  ): Promise<void> {
    const participating = [match.homeTeamId, match.awayTeamId].filter(
      (id): id is string => id !== null,
    );
    const squads = await this.prisma.matchSquad.findMany({
      where: { matchId: match.id, teamId: { in: participating } },
      include: { players: true, team: { select: { name: true } } },
    });

    for (const teamId of participating) {
      const squad = squads.find((row) => row.teamId === teamId);
      const xiCount = squad
        ? countPlayingXiStarters(
            squad.players.map((player) => ({ role: player.role as string })),
          )
        : 0;
      if (!squad?.isFinalized || xiCount !== PLAYING_XI_SIZE) {
        throw new BadRequestException({
          message: 'Both teams must finalize their Playing 11 before starting the match',
          error: 'PLAYING_XI_NOT_FINALIZED',
          fields: {
            playingXi: 'Verify Playing 11 for all participating teams before starting',
          },
        });
      }
    }

    if (isExternalOpponentMatch(match)) {
      const externalCount = await this.prisma.externalPlayer.count({ where: { matchId: match.id } });
      if (externalCount !== PLAYING_XI_SIZE) {
        throw new BadRequestException({
          message: 'Add all 11 opponent players before starting the match',
          error: 'OPPONENT_ROSTER_INCOMPLETE',
          fields: {
            opponentPlayers: `${externalCount}/${PLAYING_XI_SIZE} opponent players added`,
          },
        });
      }
    }
  }

  private async tryTransitionPlayingXiLocked(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        state: true,
        homeTeamId: true,
        awayTeamId: true,
        externalOpponentName: true,
      },
    });
    if (!match) {
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await this.tryTransitionPlayingXiLockedTx(tx, matchId, match);
    });
  }

  private async tryTransitionPlayingXiLockedTx(
    tx: Prisma.TransactionClient,
    matchId: string,
    match: {
      state: string;
      homeTeamId: string | null;
      awayTeamId: string | null;
      externalOpponentName: string | null;
    },
  ): Promise<void> {
    if (!XI_LOCKABLE_STATES.includes(match.state as MatchState)) {
      return;
    }

    const participating = [match.homeTeamId, match.awayTeamId].filter(
      (id): id is string => id !== null,
    );
    const finalizedCount = await tx.matchSquad.count({
      where: {
        matchId,
        isFinalized: true,
        teamId: { in: participating },
      },
    });
    if (finalizedCount < participating.length) {
      return;
    }

    if (isExternalOpponentMatch(match)) {
      const externalCount = await tx.externalPlayer.count({ where: { matchId } });
      if (externalCount < PLAYING_XI_SIZE) {
        return;
      }
    }

    await tx.match.update({
      where: { id: matchId },
      data: { state: MatchState.PlayingXiLocked },
    });
  }

  private async assertRoundRobinPairNotDuplicate(
    tournamentId: string,
    homeTeamId: string,
    awayTeamId: string,
    excludeMatchId?: string,
  ): Promise<void> {
    const pairKey = normalizeTeamPairKey(homeTeamId, awayTeamId);
    const rows = await this.prisma.match.findMany({
      where: {
        tournamentId,
        ...ACTIVE_MATCH_WHERE,
        homeTeamId: { not: null },
        awayTeamId: { not: null },
        ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
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
      where: { id: { in: ids }, tournamentId, ...activeTeamWhere },
    });
    if (found !== ids.length) {
      throw new BadRequestException({
        message: 'A team does not belong to this tournament',
        error: 'TEAM_NOT_IN_TOURNAMENT',
      });
    }
  }

  /** Validates the ?9.7/?8 squad composition rules. */
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

    // ?9.7: suspended players may be in the 11 but never as substitutes.
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
      tournamentName: row.tournament.name,
      ballType: row.tournament.ballType as BallType,
      matchCode: row.matchCode,
      matchType: row.matchType as MatchType,
      state: row.state as MatchState,
      homeTeamId: row.homeTeamId,
      homeTeamName: row.homeTeam?.name ?? null,
      awayTeamId: row.awayTeamId,
      awayTeamName: row.awayTeam?.name ?? null,
      externalOpponentName: row.externalOpponentName,
      homeAway: (row.homeAway as HomeAway | null) ?? null,
      matchDate: row.matchDate?.toISOString() ?? null,
      startTime: row.startTime?.toISOString() ?? null,
      delayMinutes: row.delayMinutes ?? 0,
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
      isFinalized: squad.isFinalized,
      finalizedByUserId: squad.finalizedByUserId,
      finalizedAt: squad.finalizedAt?.toISOString() ?? null,
      players: squad.players.map((p) => ({
        userId: p.userId,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        role: p.role as MatchSquadRole,
        isActiveImpact: p.isActiveImpact,
        battingOrder: p.battingOrder,
      })),
      penaltyServing: [],
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
      groupId: row.groupId,
      groupName: row.group?.name ?? null,
      reportingTime: row.reportingTime?.toISOString() ?? null,
      groundLocation: row.groundLocation,
      geofenceLat: row.geofenceLat,
      geofenceLng: row.geofenceLng,
      tournamentTimezone: row.tournament.timezone,
      tournamentOversPerInnings: row.tournament.oversPerInnings,
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
      tennisScorer: null,
    };
  }

  private async requireActiveMatchRow(matchId: string): Promise<
    Prisma.MatchGetPayload<{
      select: {
        id: true;
        tournamentId: true;
        state: true;
        homeTeamId: true;
        awayTeamId: true;
        externalOpponentName: true;
        groupId: true;
        matchCode: true;
        matchType: true;
        matchDate: true;
        startTime: true;
        reportingTime: true;
        groundLocation: true;
        geofenceLat: true;
        geofenceLng: true;
        oversPerInnings: true;
        maxOversPerBowler: true;
        powerplayOvers: true;
        battingPowerplayOvers: true;
        homeAway: true;
        youtubeUrl: true;
        roundRobinPairKey: true;
        isDeleted: true;
      };
    }>
  > {
    const row = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        state: true,
        homeTeamId: true,
        awayTeamId: true,
        externalOpponentName: true,
        groupId: true,
        matchCode: true,
        matchType: true,
        matchDate: true,
        startTime: true,
        reportingTime: true,
        groundLocation: true,
        geofenceLat: true,
        geofenceLng: true,
        oversPerInnings: true,
        maxOversPerBowler: true,
        powerplayOvers: true,
        battingPowerplayOvers: true,
        homeAway: true,
        youtubeUrl: true,
        roundRobinPairKey: true,
        isDeleted: true,
      },
    });
    if (!row || row.isDeleted) {
      throw new NotFoundException({ message: 'Match not found', error: 'NOT_FOUND' });
    }
    return row;
  }

  private fixtureAuditSnapshot(row: {
    state: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    externalOpponentName: string | null;
    groupId: string | null;
    matchCode: string | null;
    matchType: string;
    matchDate: Date | null;
    startTime: Date | null;
    reportingTime: Date | null;
    groundLocation: string | null;
    geofenceLat: number | null;
    geofenceLng: number | null;
    oversPerInnings: number | null;
    maxOversPerBowler: number | null;
    powerplayOvers: number | null;
    battingPowerplayOvers: number | null;
    homeAway: string | null;
    youtubeUrl: string | null;
    isDeleted: boolean;
  }): Prisma.InputJsonValue {
    return {
      state: row.state,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      externalOpponentName: row.externalOpponentName,
      groupId: row.groupId,
      matchCode: row.matchCode,
      matchType: row.matchType,
      matchDate: row.matchDate?.toISOString() ?? null,
      startTime: row.startTime?.toISOString() ?? null,
      reportingTime: row.reportingTime?.toISOString() ?? null,
      groundLocation: row.groundLocation,
      geofenceLat: row.geofenceLat,
      geofenceLng: row.geofenceLng,
      oversPerInnings: row.oversPerInnings,
      maxOversPerBowler: row.maxOversPerBowler,
      powerplayOvers: row.powerplayOvers,
      battingPowerplayOvers: row.battingPowerplayOvers,
      homeAway: row.homeAway,
      youtubeUrl: row.youtubeUrl,
      isDeleted: row.isDeleted,
    };
  }

  private async validateFixtureDto(
    actor: AuthUser,
    tournament: {
      id: string;
      ballType: BallType;
      matchSchedulingFormat: MatchSchedulingFormat | null;
    },
    dto: CreateMatchDto,
    options: {
      mode: 'create' | 'update';
      excludeMatchId?: string;
      existing?: {
        homeTeamId: string | null;
        awayTeamId: string | null;
        externalOpponentName: string | null;
        matchDate: Date | null;
      };
    },
  ): Promise<{
    homeTeamId: string;
    awayTeamId: string | null;
    externalOpponentName: string | null;
    groupId: string | null;
    matchCode: string | null;
    matchType: MatchType;
    matchDate: string;
    startTime: string;
    reportingTime: string | null;
    groundLocation: string;
    geofenceLat: number;
    geofenceLng: number;
    oversPerInnings: number;
    maxOversPerBowler: number;
    powerplayOvers: number | null;
    battingPowerplayOvers: number | null;
    homeAway: HomeAway | null;
    roundRobinPairKey: string | null;
    youtubeUrl: string | null;
  }> {
    const tournamentId = tournament.id;

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

    if (options.mode === 'create') {
      await assertCanCreateMatchFixture(
        this.permissions,
        this.prisma,
        actor,
        { id: tournament.id, ballType: tournament.ballType },
        dto.homeTeamId,
      );
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
    const isRoundRobin = tournament.matchSchedulingFormat === MatchSchedulingFormat.RoundRobin;

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
        options.excludeMatchId,
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
    // Knockout rounds pair teams across groups — group is optional and the
    // belong-to-group constraint is skipped for them.
    const isKnockout = isKnockoutMatchType(dto.matchType);
    if (isGroupStage && !isKnockout) {
      if (!dto.groupId) {
        throw new BadRequestException({
          message: 'Group is required for group-stage fixtures',
          error: 'GROUP_REQUIRED',
          fields: { groupId: 'Group is required' },
        });
      }
      await this.assertTeamsInGroup(tournamentId, dto.groupId, [dto.homeTeamId, dto.awayTeamId]);
    } else if (dto.groupId && !isGroupStage) {
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
    await this.assertMatchDateAllowed(tournamentId, dto.matchDate, {
      existingMatchDateIso:
        options.mode === 'update' && options.existing?.matchDate
          ? options.existing.matchDate.toISOString()
          : null,
    });

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

    const roundRobinPairKey =
      isRoundRobin && dto.homeTeamId && dto.awayTeamId
        ? normalizeTeamPairKey(dto.homeTeamId, dto.awayTeamId)
        : null;

    return {
      homeTeamId: dto.homeTeamId,
      awayTeamId: dto.awayTeamId ?? null,
      externalOpponentName: dto.externalOpponentName?.trim() || null,
      groupId: isKnockoutMatchType(dto.matchType) ? null : dto.groupId ?? null,
      matchCode: dto.matchCode ?? null,
      matchType: dto.matchType,
      matchDate: dto.matchDate,
      startTime: dto.startTime,
      reportingTime:
        !isRoundRobin && dto.reportingTime ? dto.reportingTime : null,
      groundLocation: dto.groundLocation.trim(),
      geofenceLat: dto.geofenceLat,
      geofenceLng: dto.geofenceLng,
      oversPerInnings: dto.oversPerInnings,
      maxOversPerBowler: dto.maxOversPerBowler,
      powerplayOvers: dto.powerplayOvers ?? null,
      battingPowerplayOvers: isTennisBall ? (dto.battingPowerplayOvers ?? null) : null,
      homeAway: dto.homeAway ?? null,
      roundRobinPairKey,
      youtubeUrl: dto.youtubeUrl ?? null,
    };
  }
}
