import {
  computeParticipationPollClosesAt,
  computeParticipationPollOpensAt,
  formatMatchDateTimeLine,
  formatPollPlayerSkillLabel,
  isParticipationPollOpen,
  isAttendanceMatchDay,
  BallType,
  LateArrivalPenaltyState,
  MatchSquadRole,
  MatchState,
  Permission,
  PLAYING_XI_SIZE,
  PollVoteChoice,
  serverVenueTimezone,
  type AuthUser,
  type CaptainPlayingXiCardView,
  type ConfirmPollPlayingXiRequest,
  type ParticipationPollCardView,
  type ParticipationPollTallyView,
  type PlayerRegistrationRole,
  type PlayingXiConfirmFromPollView,
  RegistrationPlayerType,
  type PollPenaltyOwingPlayerRow,
  type PollPenaltyServingPlayerRow,
  type PollPlayingXiPlayerRow,
  type PollPlayingXiSelectionView,
  type PollTallyPlayerRow,
  PlayingXiNoShowRecoveryAction,
  type PlayingXiNoShowRecoveryRequest,
  enrichPollSuspensionRows,
  type PlayingXiSwitchRequest,
  UserRole,
  canAssignTeamRoles,
} from '@acc/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Match, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionService } from '../authz/permission.service';
import { isCaptainOrViceCaptain } from '../authz/team-leader.util';
import { LateArrivalPenaltyService } from '../late-arrival-penalty/late-arrival-penalty.service';
import { MatchesService } from '../matches/matches.service';
import { SuspensionService } from '../suspension/suspension.service';
import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentWhere } from '../tournaments/tournament-query';

const HIDDEN_MATCH_STATES: MatchState[] = [
  MatchState.Cancelled,
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
];

const PLAYING_XI_CARD_MATCH_STATES: MatchState[] = [
  MatchState.Scheduled,
  MatchState.Delayed,
  MatchState.PlayingXiLocked,
  MatchState.TossCompleted,
];

type PollMatchRow = Match & {
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  tournament: { id: string; name: string; ballType: string; timezone: string | null };
};

type MembershipRow = {
  teamId: string;
  tournamentId: string;
  team: { name: string };
  tournament: { ballType: string; name: string; timezone: string | null };
};

/** Leadership roles counted as squad members for leather poll visibility (§9.7). */
const POLL_SQUAD_LEADERSHIP_ROLES: UserRole[] = [
  UserRole.Captain,
  UserRole.ViceCaptain,
  UserRole.Manager,
];

const MEMBERSHIP_ROW_SELECT = {
  teamId: true,
  tournamentId: true,
  team: { select: { name: true } },
  tournament: { select: { ballType: true, name: true, timezone: true } },
} as const;

const POLL_MATCH_INCLUDE = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
  tournament: { select: { id: true, name: true, ballType: true, timezone: true } },
} as const satisfies Prisma.MatchInclude;

@Injectable()
export class ParticipationPollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly matches: MatchesService,
    private readonly penalties: LateArrivalPenaltyService,
    private readonly suspensions: SuspensionService,
    private readonly audit: AuditService,
  ) {}

  async loadCaptainDashboardCards(userId: string): Promise<{
    participationPoll: ParticipationPollCardView | null;
    playingXiCard: CaptainPlayingXiCardView | null;
  }> {
    const leadership = await this.prisma.roleAssignment.findMany({
      where: {
        userId,
        role: { in: [UserRole.Captain, UserRole.ViceCaptain] },
        teamId: { not: null },
      },
      select: { teamId: true, role: true },
    });
    const leadershipTeamIds = [
      ...new Set(leadership.map((row) => row.teamId).filter((id): id is string => id != null)),
    ];
    if (leadershipTeamIds.length === 0) {
      return { participationPoll: null, playingXiCard: null };
    }

    const memberships = await this.loadLeatherMemberships(userId);
    const now = new Date();

    const matches = await this.prisma.match.findMany({
      where: {
        isDeleted: false,
        state: { notIn: HIDDEN_MATCH_STATES },
        matchDate: { not: null },
        tournament: { ...activeTournamentWhere, ballType: BallType.Leather },
        OR: [{ homeTeamId: { in: leadershipTeamIds } }, { awayTeamId: { in: leadershipTeamIds } }],
      },
      include: POLL_MATCH_INCLUDE,
      orderBy: [{ matchDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    });

    for (const match of matches) {
      if (!match.matchDate) {
        continue;
      }
      const membership = memberships.find(
        (row) =>
          leadershipTeamIds.includes(row.teamId) &&
          (row.teamId === match.homeTeamId || row.teamId === match.awayTeamId),
      );
      if (!membership) {
        continue;
      }

      const scheduleZone = serverVenueTimezone(match.tournament.timezone);
      const opensAt = computeParticipationPollOpensAt(match, scheduleZone);
      if (now < opensAt) {
        continue;
      }

      const closesAt = computeParticipationPollClosesAt(match, scheduleZone);
      const pollOpen = isParticipationPollOpen(opensAt, closesAt, now);

      if (pollOpen) {
        const card = await this.buildCardForMembership(userId, match, membership);
        if (card) {
          return { participationPoll: card, playingXiCard: null };
        }
        continue;
      }

      const isLeaderTeam =
        leadershipTeamIds.includes(membership.teamId) &&
        (membership.teamId === match.homeTeamId || membership.teamId === match.awayTeamId);

      if (
        isLeaderTeam &&
        PLAYING_XI_CARD_MATCH_STATES.includes(match.state as MatchState)
      ) {
        const xiCard = await this.buildPlayingXiCard(match, membership);
        if (xiCard) {
          return { participationPoll: null, playingXiCard: xiCard };
        }
      }
      continue;
    }

    return { participationPoll: null, playingXiCard: null };
  }

  /**
   * Leather "Are you playing?" card for role dashboards (§9.7).
   * Eligible voters: every member of the ACC team's full roster (`TeamMembership`) for the
   * match's system team while the poll is open. External-opponent fixtures poll the ACC side only.
   */
  async loadDashboardPoll(userId: string): Promise<ParticipationPollCardView | null> {
    const memberships = await this.loadLeatherMemberships(userId);
    if (memberships.length === 0) {
      return null;
    }

    const teamIds = [...new Set(memberships.map((row) => row.teamId))];
    const now = new Date();

    const matches = await this.prisma.match.findMany({
      where: {
        isDeleted: false,
        state: { notIn: HIDDEN_MATCH_STATES },
        matchDate: { not: null },
        tournament: { ...activeTournamentWhere, ballType: BallType.Leather },
        OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
      },
      include: POLL_MATCH_INCLUDE,
      orderBy: [{ matchDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    });

    for (const match of matches) {
      if (!match.matchDate) {
        continue;
      }
      const scheduleZone = serverVenueTimezone(match.tournament.timezone);
      const opensAt = computeParticipationPollOpensAt(match, scheduleZone);
      if (now < opensAt) {
        continue;
      }

      const membership = memberships.find(
        (row) => row.teamId === match.homeTeamId || row.teamId === match.awayTeamId,
      );
      if (!membership) {
        continue;
      }

      const card = await this.buildCardForMembership(userId, match, membership);
      if (card?.isOpen) {
        return card;
      }
    }

    return null;
  }

  async submitVote(
    actor: AuthUser,
    pollId: string,
    choice: PollVoteChoice,
  ): Promise<ParticipationPollCardView> {
    const poll = await this.prisma.availabilityPoll.findUnique({
      where: { id: pollId },
      include: {
        match: { include: POLL_MATCH_INCLUDE },
        votes: { where: { userId: actor.id }, take: 1 },
      },
    });
    if (!poll) {
      throw new NotFoundException({ message: 'Poll not found', error: 'NOT_FOUND' });
    }

    await this.assertCanAccessPoll(actor, poll.match, poll.teamId);

    if (!poll.match.matchDate || !isParticipationPollOpen(poll.opensAt, poll.closesAt)) {
      throw new BadRequestException({
        message: 'This poll is closed for new votes',
        error: 'POLL_CLOSED',
      });
    }

    const isAvailable = choice === PollVoteChoice.In;

    await this.prisma.pollVote.upsert({
      where: { pollId_userId: { pollId, userId: actor.id } },
      create: { pollId, userId: actor.id, isAvailable, votedAt: new Date() },
      update: { isAvailable, votedAt: new Date() },
    });

    const membership = await this.requireMembership(actor.id, poll.teamId, poll.match.tournamentId);
    const card = await this.buildCardForMembership(actor.id, poll.match, membership, poll.id);
    if (!card) {
      throw new NotFoundException({ message: 'Poll not found', error: 'NOT_FOUND' });
    }
    return card;
  }

  async getTally(actor: AuthUser, pollId: string): Promise<ParticipationPollTallyView> {
    const poll = await this.prisma.availabilityPoll.findUnique({
      where: { id: pollId },
      include: {
        match: { include: POLL_MATCH_INCLUDE },
        team: { select: { name: true } },
        votes: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
          },
        },
      },
    });
    if (!poll) {
      throw new NotFoundException({ message: 'Poll not found', error: 'NOT_FOUND' });
    }

    await this.assertCanAccessPoll(actor, poll.match, poll.teamId);

    return this.buildTallyView(poll, true);
  }

  private async buildTallyView(
    poll: {
      id: string;
      matchId: string;
      teamId: string;
      match: PollMatchRow;
      team: { name: string };
      votes: {
        userId: string;
        isAvailable: boolean;
        votedAt: Date;
        user: {
          id: string;
          firstName: string;
          lastName: string;
          profilePhotoUrl: string | null;
        };
      }[];
    },
    canViewPending: boolean,
  ): Promise<ParticipationPollTallyView> {
    const roster = await this.prisma.teamMembership.findMany({
      where: { teamId: poll.teamId, tournamentId: poll.match.tournamentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });

    const registrations = await this.prisma.registration.findMany({
      where: {
        tournamentId: poll.match.tournamentId,
        userId: { in: roster.map((member) => member.userId) },
      },
      select: {
        userId: true,
        battingPosition: true,
        fieldingPosition: true,
        bowlingType: true,
        playerRole: true,
      },
    });
    const registrationByUser = new Map(registrations.map((row) => [row.userId, row]));

    const voteByUser = new Map(poll.votes.map((vote) => [vote.userId, vote]));

    const tallyRow = (
      user: {
        id: string;
        firstName: string;
        lastName: string;
        profilePhotoUrl: string | null;
      },
      votedAt?: Date | null,
    ): PollTallyPlayerRow => {
      const registration = registrationByUser.get(user.id);
      return {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePhotoUrl: user.profilePhotoUrl,
        votedAt: votedAt?.toISOString() ?? null,
        skillLabel: registration
          ? formatPollPlayerSkillLabel({
              battingPosition: registration.battingPosition,
              fieldingPosition: registration.fieldingPosition,
              bowlingType: registration.bowlingType,
              playerRole: registration.playerRole as PlayerRegistrationRole | null,
            })
          : null,
      };
    };

    const inRows: PollTallyPlayerRow[] = [];
    const outRows: PollTallyPlayerRow[] = [];
    const pendingRows: PollTallyPlayerRow[] = [];

    for (const member of roster) {
      const vote = voteByUser.get(member.userId);
      if (!vote) {
        pendingRows.push(tallyRow(member.user));
      } else if (vote.isAvailable) {
        inRows.push(tallyRow(member.user, vote.votedAt));
      } else {
        outRows.push(tallyRow(member.user, vote.votedAt));
      }
    }

    return {
      pollId: poll.id,
      matchId: poll.matchId,
      teamName: poll.team.name,
      timezone: poll.match.tournament.timezone,
      inCount: inRows.length,
      outCount: outRows.length,
      pendingCount: canViewPending ? pendingRows.length : 0,
      in: inRows,
      out: outRows,
      pending: canViewPending ? pendingRows : [],
      canViewPending,
    };
  }

  /** Leather match detail — In/Out poll as Playing XI selection (captain/VC/scorer). */
  async getPlayingXiConfirmFromPoll(
    actor: AuthUser,
    matchId: string,
    teamId: string,
  ): Promise<PlayingXiConfirmFromPollView> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: POLL_MATCH_INCLUDE,
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    if (match.tournament.ballType !== BallType.Leather) {
      throw new BadRequestException({
        message: 'Playing 11 from poll is only available for leather-ball matches',
        error: 'INVALID_BALL_TYPE',
      });
    }
    if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) {
      throw new BadRequestException({
        message: 'Team is not part of this match',
        error: 'TEAM_NOT_IN_MATCH',
      });
    }
    if (!PLAYING_XI_CARD_MATCH_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Playing 11 can no longer be updated for this match',
        error: 'INVALID_MATCH_STATE',
      });
    }

    await this.assertCanConfirmPlayingXi(actor, match, teamId);

    const scheduleZone = serverVenueTimezone(match.tournament.timezone);
    const opensAt = computeParticipationPollOpensAt(match, scheduleZone);
    const closesAt = computeParticipationPollClosesAt(match, scheduleZone);
    const poll = await this.ensurePoll(match, teamId, opensAt, closesAt);

    const fullPoll = await this.prisma.availabilityPoll.findUnique({
      where: { id: poll.id },
      include: {
        match: { include: POLL_MATCH_INCLUDE },
        team: { select: { name: true } },
        votes: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
          },
        },
      },
    });
    if (!fullPoll) {
      throw new NotFoundException({ message: 'Poll not found', error: 'NOT_FOUND' });
    }

    const tally = await this.buildTallyView(fullPoll, true);

    const squad = await this.prisma.matchSquad.findUnique({
      where: { matchId_teamId: { matchId, teamId } },
      select: {
        isFinalized: true,
        players: { select: { userId: true, role: true } },
      },
    });
    const savedPlayingXiIds =
      squad?.players.filter((p) => p.role === MatchSquadRole.PlayingXi).map((p) => p.userId) ?? [];

    const canUsePollConfirm =
      canAssignTeamRoles(actor) ||
      (await isCaptainOrViceCaptain(
        this.prisma,
        actor.id,
        match.tournamentId,
        teamId,
      ));

    const [rawPendingSuspensions, actionedSuspensions] = await Promise.all([
      this.suspensions.listPendingForMatchTeam(matchId, teamId),
      this.suspensions.listActionedForMatchTeam(matchId, teamId),
    ]);
    const voteByUser = new Map(fullPoll.votes.map((vote) => [vote.userId, vote.isAvailable]));
    const pendingSuspensions = enrichPollSuspensionRows(rawPendingSuspensions, voteByUser);

    return {
      pollId: fullPoll.id,
      matchId,
      teamId,
      teamName: fullPoll.team.name,
      isFinalized: squad?.isFinalized ?? false,
      savedPlayingXiIds,
      canUsePollConfirm,
      tally,
      pendingSuspensions,
      actionedSuspensions,
    };
  }

  async getPlayingXiSelection(actor: AuthUser, pollId: string): Promise<PollPlayingXiSelectionView> {
    const poll = await this.requirePollForCaptainXi(actor, pollId);
    const { inRows, outRows } = await this.buildInOutRows(poll);
    const leatherBall = poll.match.tournament.ballType === BallType.Leather;
    const enrichedInRows = leatherBall
      ? await this.enrichInRowsWithMatchCounts(inRows, poll.match.tournamentId)
      : inRows;
    const squadRoles = await this.loadSquadRoles(poll.matchId, poll.teamId);
    const scheduleZone = serverVenueTimezone(poll.match.tournament.timezone);

    const inWithRoles = enrichedInRows.map((row) => ({
      ...row,
      squadRole: squadRoles.get(row.userId) ?? null,
    }));

    const squad = await this.prisma.matchSquad.findUnique({
      where: { matchId_teamId: { matchId: poll.matchId, teamId: poll.teamId } },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
            },
          },
        },
      },
    });

    const punches = await this.prisma.matchAttendancePunch.findMany({
      where: { matchId: poll.matchId, teamId: poll.teamId },
      select: { userId: true },
    });
    const punchedUserIds = new Set(punches.map((row) => row.userId));

    const captainAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        teamId: poll.teamId,
        tournamentId: poll.match.tournamentId,
        role: UserRole.Captain,
      },
      select: { userId: true },
    });
    const captainUserId = captainAssignment?.userId ?? null;

    const playingXi: PollPlayingXiPlayerRow[] = [];
    const substitutes: PollPlayingXiPlayerRow[] = [];
    if (squad) {
      const squadUserIds = squad.players.map((player) => player.userId);
      const squadRegistrations = await this.prisma.registration.findMany({
        where: { tournamentId: poll.match.tournamentId, userId: { in: squadUserIds } },
        select: {
          userId: true,
          battingPosition: true,
          fieldingPosition: true,
          bowlingType: true,
          playerRole: true,
          playerType: true,
        },
      });
      const registrationByUser = new Map(squadRegistrations.map((row) => [row.userId, row]));

      for (const player of squad.players) {
        if (player.role !== MatchSquadRole.PlayingXi && player.role !== MatchSquadRole.Substitute) {
          continue;
        }
        const registration = registrationByUser.get(player.userId);
        const row: PollPlayingXiPlayerRow = {
          userId: player.user.id,
          firstName: player.user.firstName,
          lastName: player.user.lastName,
          profilePhotoUrl: player.user.profilePhotoUrl,
          skillLabel: registration
            ? formatPollPlayerSkillLabel({
                battingPosition: registration.battingPosition,
                fieldingPosition: registration.fieldingPosition,
                bowlingType: registration.bowlingType,
                playerRole: registration.playerRole as PlayerRegistrationRole | null,
              })
            : null,
          playerType: this.toRegistrationPlayerType(registration?.playerType ?? null),
          squadRole:
            player.role === MatchSquadRole.PlayingXi ? 'PLAYING_XI' : 'SUBSTITUTE',
          hasPunched: punchedUserIds.has(player.userId),
          isTeamCaptain: player.user.id === captainUserId,
          isWicketkeeper: registration?.fieldingPosition === 'Wicketkeeper',
        };
        if (player.role === MatchSquadRole.PlayingXi) {
          playingXi.push(row);
        } else {
          substitutes.push(row);
        }
      }
    }

    const rosterUserIds = await this.prisma.teamMembership.findMany({
      where: { teamId: poll.teamId, tournamentId: poll.match.tournamentId },
      select: { userId: true },
    });

    const inWithPunch = inWithRoles.map((row) => ({
      ...row,
      hasPunched: punchedUserIds.has(row.userId),
    }));

    const penaltyServing = await this.loadPenaltyServingRows(
      poll.teamId,
      poll.matchId,
      rosterUserIds.map((row) => row.userId),
      punchedUserIds,
    );
    const penaltyOwing = await this.loadPenaltyOwingRows(
      poll.teamId,
      poll.matchId,
      poll.match.tournamentId,
      rosterUserIds.map((row) => row.userId),
    );

    const isMatchDay = isAttendanceMatchDay(
      {
        matchDate: poll.match.matchDate,
        startTime: poll.match.startTime,
      },
      scheduleZone,
    );

    const recoveryActionsEnabled =
      isMatchDay && PLAYING_XI_CARD_MATCH_STATES.includes(poll.match.state as MatchState);

    const switchActionsEnabled =
      squad != null && PLAYING_XI_CARD_MATCH_STATES.includes(poll.match.state as MatchState);

    const squadUserIds = new Set([
      ...playingXi.map((row) => row.userId),
      ...substitutes.map((row) => row.userId),
    ]);
    const penaltyServerUserIds = new Set(penaltyServing.map((row) => row.userId));

    const onGroundSwapCandidates =
      isMatchDay && switchActionsEnabled
        ? await this.loadOnGroundSwapCandidates(
            poll.match.tournamentId,
            poll.teamId,
            poll.matchId,
            rosterUserIds.map((row) => row.userId),
            squadUserIds,
            penaltyServerUserIds,
          )
        : [];

    const excludedFromUnselected = new Set([...squadUserIds, ...penaltyServerUserIds]);
    const preMatchUnselected: PollPlayingXiPlayerRow[] = inWithPunch
      .filter((row) => !excludedFromUnselected.has(row.userId))
      .map((row) => ({ ...row, squadRole: null }));

    const groundFilter = <T extends { hasPunched?: boolean }>(rows: T[]): T[] =>
      isMatchDay ? rows.filter((row) => row.hasPunched === true) : rows;

    const switchSubstituteCandidates = switchActionsEnabled
      ? groundFilter(substitutes)
      : [];
    const switchPenaltyServerCandidates = switchActionsEnabled
      ? groundFilter(penaltyServing)
      : [];
    const switchUnselectedCandidates = switchActionsEnabled
      ? isMatchDay
        ? onGroundSwapCandidates
        : preMatchUnselected
      : [];

    const recoveryEligiblePlayingXi =
      recoveryActionsEnabled && squad != null
        ? this.computeRecoveryEligiblePlayingXi(playingXi, substitutes)
        : [];

    const penaltyServersOnGround: PollPlayingXiPlayerRow[] = recoveryActionsEnabled
      ? penaltyServing
          .filter((row) => punchedUserIds.has(row.userId))
          .map((row) => ({
            ...row,
            squadRole: null,
            hasPunched: true,
          }))
      : [];

    return {
      pollId: poll.id,
      matchId: poll.matchId,
      teamId: poll.teamId,
      teamName: poll.team.name,
      inCount: inRows.length,
      outCount: outRows.length,
      in: inWithPunch,
      out: outRows,
      hasSavedSquad: squad != null,
      isMatchDay,
      playingXi,
      substitutes,
      penaltyServing,
      penaltyOwing,
      onGroundSwapCandidates,
      recoveryActionsEnabled,
      recoveryEligiblePlayingXi,
      penaltyServersOnGround,
      switchActionsEnabled,
      switchSubstituteCandidates,
      switchPenaltyServerCandidates,
      switchUnselectedCandidates,
    };
  }

  private async loadPenaltyServingRows(
    teamId: string,
    matchId: string,
    rosterUserIds: string[],
    punchedUserIds: ReadonlySet<string>,
  ): Promise<PollPenaltyServingPlayerRow[]> {
    if (rosterUserIds.length === 0) {
      return [];
    }
    const penalties = await this.prisma.lateArrivalPenalty.findMany({
      where: {
        teamId,
        assignedServeMatchId: matchId,
        state: LateArrivalPenaltyState.Assigned,
        playerId: { in: rosterUserIds },
      },
      include: {
        player: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
      },
    });
    const tournamentId = (
      await this.prisma.match.findUnique({
        where: { id: matchId },
        select: { tournamentId: true },
      })
    )?.tournamentId;
    if (!tournamentId) {
      return [];
    }
    const registrations = await this.prisma.registration.findMany({
      where: { tournamentId, userId: { in: penalties.map((row) => row.playerId) } },
      select: {
        userId: true,
        battingPosition: true,
        fieldingPosition: true,
        bowlingType: true,
        playerRole: true,
      },
    });
    const registrationByUser = new Map(registrations.map((row) => [row.userId, row]));
    return penalties.map((row) => {
      const registration = registrationByUser.get(row.playerId);
      return {
        penaltyId: row.id,
        userId: row.player.id,
        firstName: row.player.firstName,
        lastName: row.player.lastName,
        profilePhotoUrl: row.player.profilePhotoUrl,
        statusLabel: 'Serving Penalty',
        hasPunched: punchedUserIds.has(row.player.id),
        skillLabel: registration
          ? formatPollPlayerSkillLabel({
              battingPosition: registration.battingPosition,
              fieldingPosition: registration.fieldingPosition,
              bowlingType: registration.bowlingType,
              playerRole: registration.playerRole as PlayerRegistrationRole | null,
            })
          : null,
      };
    });
  }

  async confirmPlayingXi(
    actor: AuthUser,
    pollId: string,
    body: ConfirmPollPlayingXiRequest,
  ): Promise<PollPlayingXiSelectionView> {
    const poll = await this.requirePollForCaptainXi(actor, pollId);
    const { inRows } = await this.buildInOutRows(poll);
    const inVoterIds = new Set(inRows.map((row) => row.userId));

    if (body.playingXi.length !== PLAYING_XI_SIZE) {
      throw new BadRequestException({
        message: `Select exactly ${PLAYING_XI_SIZE} players for the Playing 11`,
        error: 'INVALID_PLAYING_XI_SIZE',
      });
    }

    const penaltyServerUserIds = body.penaltyServerUserIds ?? [];
    const squadSelection = new Set([...body.playingXi, ...body.substitutes]);
    const overlap = penaltyServerUserIds.filter((userId) => squadSelection.has(userId));
    if (overlap.length > 0) {
      throw new BadRequestException({
        message: 'Penalty servers cannot be in the Playing 11 or substitutes',
        error: 'PENALTY_SERVER_IN_SQUAD',
      });
    }

    await this.matches.lockPlayingXiFromPoll(
      actor,
      poll.matchId,
      poll.teamId,
      body.playingXi,
      body.substitutes,
      inVoterIds,
    );

    await this.penalties.syncServeDesignations(
      actor,
      poll.teamId,
      poll.matchId,
      penaltyServerUserIds,
    );

    return this.getPlayingXiSelection(actor, pollId);
  }

  async applyNoShowRecovery(
    actor: AuthUser,
    pollId: string,
    body: PlayingXiNoShowRecoveryRequest,
  ): Promise<PollPlayingXiSelectionView> {
    const poll = await this.requirePollForCaptainXi(actor, pollId);
    const scheduleZone = serverVenueTimezone(poll.match.tournament.timezone);
    const isMatchDay = isAttendanceMatchDay(
      { matchDate: poll.match.matchDate, startTime: poll.match.startTime },
      scheduleZone,
    );
    if (!isMatchDay) {
      throw new BadRequestException({
        message: 'No-show recovery is only available on match day',
        error: 'NOT_MATCH_DAY',
      });
    }

    const view = await this.getPlayingXiSelection(actor, pollId);
    if (!view.recoveryActionsEnabled) {
      throw new BadRequestException({
        message: 'No-show recovery is not available for this match',
        error: 'RECOVERY_DISABLED',
      });
    }

    const eligible = view.recoveryEligiblePlayingXi.some(
      (row) => row.userId === body.absentUserId,
    );
    if (!eligible) {
      throw new BadRequestException({
        message: 'This player is not eligible for no-show recovery',
        error: 'NOT_RECOVERY_ELIGIBLE',
      });
    }

    const punch = await this.prisma.matchAttendancePunch.findUnique({
      where: {
        matchId_userId: { matchId: poll.matchId, userId: body.replacementUserId },
      },
      select: { id: true, teamId: true },
    });
    if (!punch || punch.teamId !== poll.teamId) {
      throw new BadRequestException({
        message: 'Replacement must have punched in on the ground',
        error: 'REPLACEMENT_NOT_ON_GROUND',
      });
    }

    if (body.action === PlayingXiNoShowRecoveryAction.PromotePenaltyServer) {
      const server = view.penaltyServersOnGround.find(
        (row) => row.userId === body.replacementUserId,
      );
      if (!server) {
        throw new BadRequestException({
          message: 'Replacement must be a penalty server designated for this match',
          error: 'NOT_PENALTY_SERVER',
        });
      }

      const penalty = await this.prisma.lateArrivalPenalty.findFirst({
        where: {
          playerId: body.replacementUserId,
          teamId: poll.teamId,
          state: LateArrivalPenaltyState.Assigned,
          assignedServeMatchId: poll.matchId,
        },
        select: { id: true },
      });
      if (!penalty) {
        throw new BadRequestException({
          message: 'Penalty server designation not found',
          error: 'NOT_PENALTY_SERVER',
        });
      }

      await this.matches.replacePlayingXiPlayer(
        actor,
        poll.matchId,
        poll.teamId,
        body.absentUserId,
        body.replacementUserId,
      );

      await this.penalties.cancelPenalty(actor, poll.teamId, penalty.id, {
        reason: 'Promoted into Playing 11 from penalty serve (no-show recovery)',
      });

      await this.audit.record({
        action: 'PLAYING_XI_NO_SHOW_RECOVERY',
        actorUserId: actor.id,
        targetUserId: body.replacementUserId,
        targetEntityType: 'match',
        targetEntityId: poll.matchId,
        before: { absentUserId: body.absentUserId },
        after: { replacementUserId: body.replacementUserId },
        details: {
          action: body.action,
          teamId: poll.teamId,
          penaltyCancelled: true,
        },
      });
    } else if (body.action === PlayingXiNoShowRecoveryAction.SwapInOnGround) {
      const candidate = view.onGroundSwapCandidates.find(
        (row) => row.userId === body.replacementUserId,
      );
      if (!candidate) {
        throw new BadRequestException({
          message: 'Replacement must be an on-ground own-squad player outside the squad',
          error: 'INVALID_SWAP_CANDIDATE',
        });
      }

      await this.matches.replacePlayingXiPlayer(
        actor,
        poll.matchId,
        poll.teamId,
        body.absentUserId,
        body.replacementUserId,
      );

      await this.audit.record({
        action: 'PLAYING_XI_NO_SHOW_RECOVERY',
        actorUserId: actor.id,
        targetUserId: body.replacementUserId,
        targetEntityType: 'match',
        targetEntityId: poll.matchId,
        before: { absentUserId: body.absentUserId },
        after: { replacementUserId: body.replacementUserId },
        details: {
          action: body.action,
          teamId: poll.teamId,
          penaltyCancelled: false,
        },
      });
    } else {
      throw new BadRequestException({
        message: 'Invalid recovery action',
        error: 'INVALID_ACTION',
      });
    }

    return this.getPlayingXiSelection(actor, pollId);
  }

  async applyPlayingXiSwitch(
    actor: AuthUser,
    pollId: string,
    body: PlayingXiSwitchRequest,
  ): Promise<PollPlayingXiSelectionView> {
    const poll = await this.requirePollForCaptainXi(actor, pollId);
    const view = await this.getPlayingXiSelection(actor, pollId);

    if (!view.switchActionsEnabled) {
      throw new BadRequestException({
        message: 'Playing 11 switches are locked for this match',
        error: 'SWITCH_DISABLED',
      });
    }

    if (!view.playingXi.some((row) => row.userId === body.replacedUserId)) {
      throw new BadRequestException({
        message: 'Only a Playing 11 player may be switched out',
        error: 'NOT_IN_PLAYING_XI',
      });
    }

    const penaltyServer = view.switchPenaltyServerCandidates.find(
      (row) => row.userId === body.replacementUserId,
    );
    const isSubstitute = view.switchSubstituteCandidates.some(
      (row) => row.userId === body.replacementUserId,
    );
    const isUnselected = view.switchUnselectedCandidates.some(
      (row) => row.userId === body.replacementUserId,
    );

    if (!penaltyServer && !isSubstitute && !isUnselected) {
      throw new BadRequestException({
        message: 'Replacement is not an eligible switch candidate',
        error: 'INVALID_REPLACEMENT',
      });
    }

    if (view.isMatchDay) {
      const punch = await this.prisma.matchAttendancePunch.findUnique({
        where: {
          matchId_userId: { matchId: poll.matchId, userId: body.replacementUserId },
        },
        select: { id: true },
      });
      if (!punch) {
        throw new BadRequestException({
          message: 'Replacement must have punched in on the ground',
          error: 'REPLACEMENT_NOT_ON_GROUND',
        });
      }
    }

    let penaltyCancelled = false;
    if (penaltyServer) {
      if (body.confirmPenaltyCancellation !== true) {
        throw new BadRequestException({
          message: 'Penalty cancellation must be confirmed to promote a penalty server',
          error: 'PENALTY_CONFIRMATION_REQUIRED',
        });
      }
      await this.penalties.cancelPenalty(actor, poll.teamId, penaltyServer.penaltyId, {
        reason: 'Promoted into Playing 11 via captain switch',
      });
      penaltyCancelled = true;
    }

    await this.matches.switchPlayingXiPlayer(
      actor,
      poll.matchId,
      poll.teamId,
      body.replacedUserId,
      body.replacementUserId,
    );

    await this.audit.record({
      action: 'PLAYING_XI_SWITCH',
      actorUserId: actor.id,
      targetUserId: body.replacementUserId,
      targetEntityType: 'match',
      targetEntityId: poll.matchId,
      before: { replacedUserId: body.replacedUserId },
      after: { replacementUserId: body.replacementUserId },
      details: {
        teamId: poll.teamId,
        penaltyCancelled,
      },
    });

    return this.getPlayingXiSelection(actor, pollId);
  }

  private async loadPenaltyOwingRows(
    teamId: string,
    matchId: string,
    tournamentId: string,
    rosterUserIds: string[],
  ): Promise<PollPenaltyOwingPlayerRow[]> {
    if (rosterUserIds.length === 0) {
      return [];
    }

    const penalties = await this.prisma.lateArrivalPenalty.findMany({
      where: {
        teamId,
        playerId: { in: rosterUserIds },
        state: { in: [LateArrivalPenaltyState.Owed, LateArrivalPenaltyState.Assigned] },
      },
      include: {
        player: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
      },
      orderBy: [{ player: { firstName: 'asc' } }, { player: { lastName: 'asc' } }],
    });

    const registrations = await this.prisma.registration.findMany({
      where: { tournamentId, userId: { in: penalties.map((row) => row.playerId) } },
      select: {
        userId: true,
        battingPosition: true,
        fieldingPosition: true,
        bowlingType: true,
        playerRole: true,
      },
    });
    const registrationByUser = new Map(registrations.map((row) => [row.userId, row]));

    return penalties.map((row) => {
      const registration = registrationByUser.get(row.playerId);
      const designatedForThisMatch =
        row.state === LateArrivalPenaltyState.Assigned && row.assignedServeMatchId === matchId;

      return {
        penaltyId: row.id,
        userId: row.player.id,
        firstName: row.player.firstName,
        lastName: row.player.lastName,
        profilePhotoUrl: row.player.profilePhotoUrl,
        skillLabel: registration
          ? formatPollPlayerSkillLabel({
              battingPosition: registration.battingPosition,
              fieldingPosition: registration.fieldingPosition,
              bowlingType: registration.bowlingType,
              playerRole: registration.playerRole as PlayerRegistrationRole | null,
            })
          : null,
        penaltyState:
          row.state === LateArrivalPenaltyState.Assigned ? 'ASSIGNED' : 'OWED',
        designatedForThisMatch,
        canDesignateForThisMatch:
          row.state === LateArrivalPenaltyState.Owed || designatedForThisMatch,
      };
    });
  }

  private async loadOnGroundSwapCandidates(
    tournamentId: string,
    teamId: string,
    matchId: string,
    rosterUserIds: string[],
    squadUserIds: ReadonlySet<string>,
    penaltyServerUserIds: ReadonlySet<string>,
  ): Promise<PollPlayingXiPlayerRow[]> {
    if (rosterUserIds.length === 0) {
      return [];
    }

    const punches = await this.prisma.matchAttendancePunch.findMany({
      where: { matchId, teamId, userId: { in: rosterUserIds } },
      select: { userId: true },
    });
    const punchedIds = punches
      .map((row) => row.userId)
      .filter((userId) => !squadUserIds.has(userId) && !penaltyServerUserIds.has(userId));

    if (punchedIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: punchedIds } },
      select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const registrations = await this.prisma.registration.findMany({
      where: { tournamentId, userId: { in: punchedIds } },
      select: {
        userId: true,
        battingPosition: true,
        fieldingPosition: true,
        bowlingType: true,
        playerRole: true,
      },
    });
    const registrationByUser = new Map(registrations.map((row) => [row.userId, row]));

    return users.map((user) => {
      const registration = registrationByUser.get(user.id);
      return {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePhotoUrl: user.profilePhotoUrl,
        skillLabel: registration
          ? formatPollPlayerSkillLabel({
              battingPosition: registration.battingPosition,
              fieldingPosition: registration.fieldingPosition,
              bowlingType: registration.bowlingType,
              playerRole: registration.playerRole as PlayerRegistrationRole | null,
            })
          : null,
        squadRole: null,
        hasPunched: true,
      };
    });
  }

  private computeRecoveryEligiblePlayingXi(
    playingXi: PollPlayingXiPlayerRow[],
    substitutes: PollPlayingXiPlayerRow[],
  ): PollPlayingXiPlayerRow[] {
    const anySubPunched = substitutes.some((row) => row.hasPunched === true);
    return playingXi.filter((row) => row.hasPunched !== true && !anySubPunched);
  }

  private async requirePollForCaptainXi(
    actor: AuthUser,
    pollId: string,
  ): Promise<
    Prisma.AvailabilityPollGetPayload<{
      include: {
        match: { include: typeof POLL_MATCH_INCLUDE };
        team: { select: { name: true } };
      };
    }>
  > {
    const poll = await this.prisma.availabilityPoll.findUnique({
      where: { id: pollId },
      include: {
        match: { include: POLL_MATCH_INCLUDE },
        team: { select: { name: true } },
      },
    });
    if (!poll) {
      throw new NotFoundException({ message: 'Poll not found', error: 'NOT_FOUND' });
    }

    await this.assertCanConfirmPlayingXi(actor, poll.match, poll.teamId);

    if (!poll.match.matchDate) {
      throw new BadRequestException({ message: 'Match date is required', error: 'INVALID_MATCH' });
    }

    if (poll.match.tournament.ballType !== BallType.Leather) {
      throw new BadRequestException({
        message: 'Playing 11 from poll is only available for leather-ball matches',
        error: 'INVALID_BALL_TYPE',
      });
    }

    const scheduleZone = serverVenueTimezone(poll.match.tournament.timezone);
    const opensAt = computeParticipationPollOpensAt(poll.match, scheduleZone);
    const closesAt = computeParticipationPollClosesAt(poll.match, scheduleZone);
    if (isParticipationPollOpen(opensAt, closesAt)) {
      throw new BadRequestException({
        message: 'Playing 11 can only be confirmed after the poll closes',
        error: 'POLL_STILL_OPEN',
      });
    }

    if (!PLAYING_XI_CARD_MATCH_STATES.includes(poll.match.state as MatchState)) {
      throw new BadRequestException({
        message: 'Playing 11 can no longer be updated for this match',
        error: 'INVALID_MATCH_STATE',
      });
    }

    return poll;
  }

  private async buildInOutRows(poll: {
    id: string;
    teamId: string;
    match: PollMatchRow;
  }): Promise<{ inRows: PollTallyPlayerRow[]; outRows: PollTallyPlayerRow[] }> {
    const fullPoll = await this.prisma.availabilityPoll.findUnique({
      where: { id: poll.id },
      include: {
        votes: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
          },
        },
      },
    });
    if (!fullPoll) {
      throw new NotFoundException({ message: 'Poll not found', error: 'NOT_FOUND' });
    }

    const roster = await this.prisma.teamMembership.findMany({
      where: { teamId: poll.teamId, tournamentId: poll.match.tournamentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });

    const registrations = await this.prisma.registration.findMany({
      where: {
        tournamentId: poll.match.tournamentId,
        userId: { in: roster.map((member) => member.userId) },
      },
      select: {
        userId: true,
        battingPosition: true,
        fieldingPosition: true,
        bowlingType: true,
        playerRole: true,
        playerType: true,
      },
    });
    const registrationByUser = new Map(registrations.map((row) => [row.userId, row]));
    const voteByUser = new Map(fullPoll.votes.map((vote) => [vote.userId, vote]));

    const tallyRow = (
      user: {
        id: string;
        firstName: string;
        lastName: string;
        profilePhotoUrl: string | null;
      },
      votedAt?: Date | null,
    ): PollTallyPlayerRow => {
      const registration = registrationByUser.get(user.id);
      return {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePhotoUrl: user.profilePhotoUrl,
        votedAt: votedAt?.toISOString() ?? null,
        skillLabel: registration
          ? formatPollPlayerSkillLabel({
              battingPosition: registration.battingPosition,
              fieldingPosition: registration.fieldingPosition,
              bowlingType: registration.bowlingType,
              playerRole: registration.playerRole as PlayerRegistrationRole | null,
            })
          : null,
        playerType: this.toRegistrationPlayerType(registration?.playerType ?? null),
      };
    };

    const inRows: PollTallyPlayerRow[] = [];
    const outRows: PollTallyPlayerRow[] = [];

    for (const member of roster) {
      const vote = voteByUser.get(member.userId);
      if (vote?.isAvailable) {
        inRows.push(tallyRow(member.user, vote.votedAt));
      } else if (vote && !vote.isAvailable) {
        outRows.push(tallyRow(member.user, vote.votedAt));
      }
    }

    return { inRows, outRows };
  }

  private async loadSquadRoles(
    matchId: string,
    teamId: string,
  ): Promise<Map<string, 'PLAYING_XI' | 'SUBSTITUTE'>> {
    const squad = await this.prisma.matchSquad.findUnique({
      where: { matchId_teamId: { matchId, teamId } },
      include: { players: { select: { userId: true, role: true } } },
    });
    const roles = new Map<string, 'PLAYING_XI' | 'SUBSTITUTE'>();
    if (!squad) {
      return roles;
    }
    for (const player of squad.players) {
      if (player.role === MatchSquadRole.PlayingXi) {
        roles.set(player.userId, 'PLAYING_XI');
      } else if (player.role === MatchSquadRole.Substitute) {
        roles.set(player.userId, 'SUBSTITUTE');
      }
    }
    return roles;
  }

  private async buildPlayingXiCard(
    match: PollMatchRow,
    membership: MembershipRow,
  ): Promise<CaptainPlayingXiCardView | null> {
    if (!match.matchDate) {
      return null;
    }

    const teamId = membership.teamId;
    const scheduleZone = serverVenueTimezone(match.tournament.timezone);
    const opensAt = computeParticipationPollOpensAt(match, scheduleZone);
    const closesAt = computeParticipationPollClosesAt(match, scheduleZone);
    const poll = await this.ensurePoll(match, teamId, opensAt, closesAt);
    const homeName = match.homeTeam?.name ?? 'TBD';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';

    const existingSquad = await this.prisma.matchSquad.findUnique({
      where: { matchId_teamId: { matchId: match.id, teamId } },
      select: { id: true },
    });

    return {
      pollId: poll.id,
      matchId: match.id,
      teamId,
      tournamentName: match.tournament.name,
      teamName: membership.team.name,
      opponentName: this.opponentName(match, teamId),
      matchTitle: `${homeName} vs ${awayName}`,
      dateTimeLine: formatMatchDateTimeLine(match, scheduleZone, { includeZoneAbbrev: true }),
      venue: match.groundLocation,
      hasSavedSquad: existingSquad != null,
    };
  }

  /**
   * Leather squad memberships for poll visibility: full roster (`TeamMembership`) plus
   * Captain / VC / Manager assignments (leadership is on the team but may not be rostered).
   */
  private async loadLeatherMemberships(userId: string): Promise<MembershipRow[]> {
    const [rosterRows, leadershipAssignments] = await Promise.all([
      this.prisma.teamMembership.findMany({
        where: {
          userId,
          tournament: { ...activeTournamentWhere, ballType: BallType.Leather },
        },
        select: MEMBERSHIP_ROW_SELECT,
      }),
      this.prisma.roleAssignment.findMany({
        where: {
          userId,
          teamId: { not: null },
          tournamentId: { not: null },
          role: { in: POLL_SQUAD_LEADERSHIP_ROLES },
        },
        select: { teamId: true, tournamentId: true },
      }),
    ]);

    const leadershipRows = await this.membershipRowsFromLeadershipAssignments(
      leadershipAssignments,
    );
    return this.mergeMembershipRows([...rosterRows, ...leadershipRows]);
  }

  private async requireMembership(
    userId: string,
    teamId: string,
    tournamentId: string,
  ): Promise<MembershipRow> {
    const membership = await this.findLeatherMembership(userId, teamId, tournamentId);
    if (!membership) {
      throw new ForbiddenException({ message: 'Not on this team roster', error: 'FORBIDDEN' });
    }
    return membership;
  }

  private async findLeatherMembership(
    userId: string,
    teamId: string,
    tournamentId: string,
  ): Promise<MembershipRow | null> {
    const rosterRow = await this.prisma.teamMembership.findFirst({
      where: { userId, teamId, tournamentId },
      select: MEMBERSHIP_ROW_SELECT,
    });
    if (rosterRow) {
      return rosterRow;
    }

    const leadership = await this.prisma.roleAssignment.findFirst({
      where: {
        userId,
        teamId,
        tournamentId,
        role: { in: POLL_SQUAD_LEADERSHIP_ROLES },
      },
      select: { teamId: true, tournamentId: true },
    });
    if (!leadership?.teamId || !leadership.tournamentId) {
      return null;
    }

    const rows = await this.membershipRowsFromLeadershipAssignments([leadership]);
    return rows[0] ?? null;
  }

  private async membershipRowsFromLeadershipAssignments(
    assignments: { teamId: string | null; tournamentId: string | null }[],
  ): Promise<MembershipRow[]> {
    const scoped = assignments.filter(
      (row): row is { teamId: string; tournamentId: string } =>
        row.teamId != null && row.tournamentId != null,
    );
    if (scoped.length === 0) {
      return [];
    }

    const tournamentIds = [...new Set(scoped.map((row) => row.tournamentId))];
    const teamIds = [...new Set(scoped.map((row) => row.teamId))];

    const [tournaments, teams] = await Promise.all([
      this.prisma.tournament.findMany({
        where: {
          id: { in: tournamentIds },
          ...activeTournamentWhere,
          ballType: BallType.Leather,
        },
        select: { id: true, name: true, timezone: true, ballType: true },
      }),
      this.prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true },
      }),
    ]);

    const tournamentById = new Map(tournaments.map((row) => [row.id, row]));
    const teamById = new Map(teams.map((row) => [row.id, row]));
    const rows: MembershipRow[] = [];

    for (const assignment of scoped) {
      const tournament = tournamentById.get(assignment.tournamentId);
      const team = teamById.get(assignment.teamId);
      if (!tournament || !team) {
        continue;
      }
      rows.push({
        teamId: assignment.teamId,
        tournamentId: assignment.tournamentId,
        team: { name: team.name },
        tournament: {
          ballType: tournament.ballType,
          name: tournament.name,
          timezone: tournament.timezone,
        },
      });
    }

    return rows;
  }

  private mergeMembershipRows(rows: MembershipRow[]): MembershipRow[] {
    const byKey = new Map<string, MembershipRow>();
    for (const row of rows) {
      byKey.set(`${row.tournamentId}:${row.teamId}`, row);
    }
    return [...byKey.values()];
  }

  private async assertCanConfirmPlayingXi(
    actor: AuthUser,
    match: PollMatchRow,
    teamId: string,
  ): Promise<void> {
    if (canAssignTeamRoles(actor)) {
      return;
    }

    const activeScorer = await this.prisma.matchScorerGrant.findFirst({
      where: { matchId: match.id, userId: actor.id, revokedAt: null },
      select: { id: true },
    });
    if (activeScorer) {
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

  private async assertCanAccessPoll(
    actor: AuthUser,
    match: PollMatchRow,
    teamId: string,
  ): Promise<void> {
    await this.requireMembership(actor.id, teamId, match.tournamentId);
    const allowed = await this.permissions.check(Permission.VOTE_AVAILABILITY_POLL, actor, {
      matchId: match.id,
      teamId,
      tournamentId: match.tournamentId,
    });
    if (!allowed) {
      throw new ForbiddenException({ message: 'Cannot access this poll', error: 'FORBIDDEN' });
    }
  }

  private async buildCardForMembership(
    userId: string,
    match: PollMatchRow,
    membership: MembershipRow,
    existingPollId?: string,
  ): Promise<ParticipationPollCardView | null> {
    if (!match.matchDate) {
      return null;
    }

    const teamId = membership.teamId;
    const teamName = membership.team.name;
    const opponentName = this.opponentName(match, teamId);
    const persistedTimezone = match.tournament.timezone;
    const scheduleZone = serverVenueTimezone(persistedTimezone);
    const opensAt = computeParticipationPollOpensAt(match, scheduleZone);
    const closesAt = computeParticipationPollClosesAt(match, scheduleZone);
    const poll =
      existingPollId != null
        ? await this.prisma.availabilityPoll.findUnique({ where: { id: existingPollId } })
        : await this.ensurePoll(match, teamId, opensAt, closesAt);

    if (!poll) {
      return null;
    }

    const vote = await this.prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId } },
    });

    const homeName = match.homeTeam?.name ?? 'TBD';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';

    return {
      pollId: poll.id,
      matchId: match.id,
      teamId,
      tournamentName: match.tournament.name,
      teamName,
      opponentName,
      matchTitle: `${homeName} vs ${awayName}`,
      dateTimeLine: formatMatchDateTimeLine(match, scheduleZone, { includeZoneAbbrev: true }),
      venue: match.groundLocation,
      opensAt: opensAt.toISOString(),
      closesAt: closesAt.toISOString(),
      timezone: persistedTimezone,
      timezoneFallback: persistedTimezone == null,
      isOpen: isParticipationPollOpen(opensAt, closesAt),
      userVote: vote ? (vote.isAvailable ? PollVoteChoice.In : PollVoteChoice.Out) : null,
      canViewPollResults: true,
    };
  }

  private opponentName(match: PollMatchRow, teamId: string): string {
    if (match.homeTeamId === teamId) {
      return match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';
    }
    return match.homeTeam?.name ?? 'TBD';
  }

  private async ensurePoll(
    match: PollMatchRow,
    teamId: string,
    opensAt: Date,
    closesAt: Date,
  ): Promise<{ id: string }> {
    return this.prisma.availabilityPoll.upsert({
      where: { matchId_teamId: { matchId: match.id, teamId } },
      create: { matchId: match.id, teamId, opensAt, closesAt },
      update: { opensAt, closesAt },
      select: { id: true },
    });
  }

  private toRegistrationPlayerType(
    value: string | null | undefined,
  ): RegistrationPlayerType | null {
    if (value === RegistrationPlayerType.FullTime || value === RegistrationPlayerType.PartTime) {
      return value;
    }
    return null;
  }

  private async enrichInRowsWithMatchCounts(
    rows: PollTallyPlayerRow[],
    tournamentId: string,
  ): Promise<PollTallyPlayerRow[]> {
    const partTimeUserIds = rows
      .filter((row) => row.playerType === RegistrationPlayerType.PartTime)
      .map((row) => row.userId);
    const matchCounts = await this.countTournamentLockedXiMatches(tournamentId, partTimeUserIds);
    return rows.map((row) => ({
      ...row,
      matchesPlayedCount:
        row.playerType === RegistrationPlayerType.PartTime
          ? (matchCounts.get(row.userId) ?? 0)
          : null,
    }));
  }

  /** Locked Playing XI appearances in one tournament (same basis as My Matches XI rows). */
  private async countTournamentLockedXiMatches(
    tournamentId: string,
    userIds: string[],
  ): Promise<Map<string, number>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.matchSquadPlayer.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        role: MatchSquadRole.PlayingXi,
        squad: {
          match: {
            tournamentId,
            isDeleted: false,
            state: { not: MatchState.Cancelled },
          },
        },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.userId, row._count._all]));
  }
}
