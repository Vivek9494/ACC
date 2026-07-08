import {
  BallType,
  DEFAULT_VENUE_TIMEZONE,
  PRE_LIVE_MATCH_STATES,
  formatTodayDateOnlyInZone,
  getTodayCalendarPartsInZone,
  getYearInZone,
  isMatchDayTomorrowInZone,
  serverVenueTimezone,
} from '@acc/types';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { selectableUserWhere } from '../users/user-query';
import { NotificationAudienceService } from './notification-audience.service';
import { NotificationsService, NotificationTrigger } from './notifications.service';

/** How long before a stored close time (§17 Phase C #11/#12) the reminder fires. */
const CLOSE_REMINDER_LEAD_MS = 10 * 60_000;
/** Width of the minute-cron catch window; matches EVERY_MINUTE cadence. */
const CLOSE_WINDOW_WIDTH_MS = 60_000;

/**
 * Timed (§17 Phase C) notification jobs. Each method is invoked by the
 * {@link NotificationScheduler} cron entry points, computes who is DUE "now" in
 * the Ontario/EDT convention, resolves an audience via
 * {@link NotificationAudienceService}, and dispatches through
 * {@link NotificationsService} with a `dedupeKey` so a double-fire (overlap /
 * retry / multi-instance) never double-sends. No direct FCM.
 */
@Injectable()
export class NotificationTimedJobsService {
  private readonly logger = new Logger(NotificationTimedJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audience: NotificationAudienceService,
  ) {}

  /** All 10:00 AM Eastern daily jobs (#9 poll, #10 match, #13 birthday). */
  async runDailyMorningJobs(now: Date = new Date()): Promise<void> {
    await this.sendPollReminders(now);
    await this.sendMatchReminders(now);
    await this.sendBirthdayNotifications(now);
  }

  /** All frequent close-window checks (#11 registration, #12 video, deferred reg-open). */
  async runCloseWindowChecks(now: Date = new Date()): Promise<void> {
    await this.sendRegistrationOpened(now);
    await this.sendRegistrationClosing(now);
    await this.sendVideoUploadClosing(now);
  }

  // --- #9 Poll reminder (Leather only) -------------------------------------

  /**
   * Daily 10 AM EDT: for every OPEN leather availability poll, remind the team's
   * roster members who have NOT voted yet. Deduped per poll per Eastern day.
   */
  async sendPollReminders(now: Date = new Date()): Promise<void> {
    const polls = await this.prisma.availabilityPoll.findMany({
      where: {
        closesAt: { gt: now },
        match: {
          isDeleted: false,
          tournament: { isDeleted: false, ballType: BallType.Leather },
        },
      },
      select: {
        id: true,
        matchId: true,
        teamId: true,
        match: { select: { tournamentId: true, tournament: { select: { timezone: true } } } },
        votes: { select: { userId: true } },
      },
    });

    for (const poll of polls) {
      try {
        const roster = await this.prisma.teamMembership.findMany({
          where: {
            teamId: poll.teamId,
            tournamentId: poll.match.tournamentId,
            user: { is: selectableUserWhere },
          },
          select: { userId: true },
        });
        const voted = new Set(poll.votes.map((vote) => vote.userId));
        const nonVoters = [...new Set(roster.map((row) => row.userId))].filter(
          (userId) => !voted.has(userId),
        );
        if (nonVoters.length === 0) {
          continue;
        }
        const zone = serverVenueTimezone(poll.match.tournament.timezone);
        const dayKey = formatTodayDateOnlyInZone(zone, now);
        await this.notifications.sendToAudience(nonVoters, {
          triggerKey: NotificationTrigger.PollReminder,
          dedupeKey: `${NotificationTrigger.PollReminder}:${poll.id}:${dayKey}`,
          title: 'Availability poll',
          body: 'Reminder: let your team know if you can play. Tap to vote in the poll.',
          data: { matchId: poll.matchId, teamId: poll.teamId, screen: 'poll' },
          audienceSummary: `Poll ${poll.id} non-voters`,
        });
      } catch (err) {
        this.logger.error(`Poll reminder failed for poll ${poll.id}`, err as Error);
      }
    }
  }

  // --- #10 Match reminder (1 day before) -----------------------------------

  /**
   * Daily 10 AM EDT: notify both squads of every pre-live match whose venue-local
   * calendar day is tomorrow. Deduped once per match.
   */
  async sendMatchReminders(now: Date = new Date()): Promise<void> {
    const windowStart = new Date(now.getTime() - 24 * 60 * 60_000);
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60_000);
    const matches = await this.prisma.match.findMany({
      where: {
        isDeleted: false,
        state: { in: PRE_LIVE_MATCH_STATES },
        OR: [
          { startTime: { gte: windowStart, lte: windowEnd } },
          { AND: [{ startTime: null }, { matchDate: { gte: windowStart, lte: windowEnd } }] },
        ],
      },
      select: {
        id: true,
        matchDate: true,
        startTime: true,
        homeTeamId: true,
        awayTeamId: true,
        tournament: { select: { timezone: true } },
      },
    });

    for (const match of matches) {
      try {
        const zone = serverVenueTimezone(match.tournament.timezone);
        if (!isMatchDayTomorrowInZone(match, zone, now)) {
          continue;
        }
        const teamIds = [match.homeTeamId, match.awayTeamId].filter(
          (id): id is string => id != null,
        );
        const audienceSets = await Promise.all(
          teamIds.map((id) => this.audience.resolveTeamSquad(id)),
        );
        const userIds = [...new Set(audienceSets.flat())];
        if (userIds.length === 0) {
          continue;
        }
        await this.notifications.sendToAudience(userIds, {
          triggerKey: NotificationTrigger.MatchReminder,
          dedupeKey: `${NotificationTrigger.MatchReminder}:${match.id}`,
          title: 'Match tomorrow',
          body: 'You have a match tomorrow. Tap for details.',
          data: { matchId: match.id, screen: 'match' },
          audienceSummary: `Both squads of match ${match.id}`,
        });
      } catch (err) {
        this.logger.error(`Match reminder failed for match ${match.id}`, err as Error);
      }
    }
  }

  // --- #11 Registration closing / reg-open ---------------------------------

  /** Deferred from Phase B: fire once when a tournament's registration window opens. */
  async sendRegistrationOpened(now: Date = new Date()): Promise<void> {
    const tournaments = await this.prisma.tournament.findMany({
      where: {
        isDeleted: false,
        registrationOpenAt: { gt: new Date(now.getTime() - CLOSE_WINDOW_WIDTH_MS), lte: now },
      },
      select: { id: true, name: true },
    });
    for (const tournament of tournaments) {
      await this.dispatchTournamentAudience(tournament, {
        triggerKey: NotificationTrigger.RegistrationOpened,
        dedupeKey: `${NotificationTrigger.RegistrationOpened}:${tournament.id}`,
        title: 'Registration open',
        body: `Registration is now open for ${tournament.name}. Tap to register.`,
        screen: 'tournament',
      });
    }
  }

  /** ~10 min before registration closes, notify the tournament audience. */
  async sendRegistrationClosing(now: Date = new Date()): Promise<void> {
    const tournaments = await this.prisma.tournament.findMany({
      where: {
        isDeleted: false,
        registrationCloseAt: this.closeWindow(now),
      },
      select: { id: true, name: true },
    });
    for (const tournament of tournaments) {
      await this.dispatchTournamentAudience(tournament, {
        triggerKey: NotificationTrigger.RegistrationClosing,
        dedupeKey: `${NotificationTrigger.RegistrationClosing}:${tournament.id}`,
        title: 'Registration closing soon',
        body: `Registration for ${tournament.name} closes in about 10 minutes.`,
        screen: 'tournament',
      });
    }
  }

  // --- #12 Video upload closing --------------------------------------------

  /**
   * ~10 min before the video upload deadline, notify registered players — only
   * when the tournament requires video and has a deadline set.
   */
  async sendVideoUploadClosing(now: Date = new Date()): Promise<void> {
    const tournaments = await this.prisma.tournament.findMany({
      where: {
        isDeleted: false,
        videoRequired: true,
        videoUploadEndDate: this.closeWindow(now),
      },
      select: { id: true, name: true },
    });
    for (const tournament of tournaments) {
      try {
        const userIds = await this.audience.resolveTournamentRegisteredPlayers(tournament.id);
        if (userIds.length === 0) {
          continue;
        }
        await this.notifications.sendToAudience(userIds, {
          triggerKey: NotificationTrigger.VideoUploadClosing,
          dedupeKey: `${NotificationTrigger.VideoUploadClosing}:${tournament.id}`,
          title: 'Video upload closing soon',
          body: `The skill video deadline for ${tournament.name} is in about 10 minutes.`,
          data: { tournamentId: tournament.id, screen: 'tournament' },
          audienceSummary: `Registered players of tournament ${tournament.id}`,
        });
      } catch (err) {
        this.logger.error(
          `Video-upload-closing reminder failed for tournament ${tournament.id}`,
          err as Error,
        );
      }
    }
  }

  // --- #13 Birthday --------------------------------------------------------

  /**
   * Daily 10 AM EDT: for each active user whose birthday (month+day) is today in
   * Eastern, notify all active users. Deduped per birthday person per year.
   */
  async sendBirthdayNotifications(now: Date = new Date()): Promise<void> {
    const today = getTodayCalendarPartsInZone(DEFAULT_VENUE_TIMEZONE, now);
    const birthdayUsers = await this.prisma.$queryRaw<
      Array<{ id: string; firstName: string; lastName: string }>
    >`
      SELECT u.id, u."firstName", u."lastName"
      FROM "User" u
      WHERE u."deletedAt" IS NULL
        AND u."isActive" = true
        AND EXTRACT(MONTH FROM u."dateOfBirth") = ${today.month}
        AND EXTRACT(DAY FROM u."dateOfBirth") = ${today.day}
    `;
    if (birthdayUsers.length === 0) {
      return;
    }

    const year = getYearInZone(DEFAULT_VENUE_TIMEZONE, now);
    const allUsers = await this.audience.resolveAllActiveUsers();
    if (allUsers.length === 0) {
      return;
    }

    for (const person of birthdayUsers) {
      try {
        const name = `${person.firstName} ${person.lastName}`.trim();
        await this.notifications.sendToAudience(allUsers, {
          triggerKey: NotificationTrigger.Birthday,
          dedupeKey: `${NotificationTrigger.Birthday}:${person.id}:${year}`,
          title: 'Happy Birthday!',
          body: `Wish ${name} a happy birthday today!`,
          data: { userId: person.id, screen: 'profile' },
          audienceSummary: `Birthday of ${person.id} to all active users`,
        });
      } catch (err) {
        this.logger.error(`Birthday notification failed for user ${person.id}`, err as Error);
      }
    }
  }

  // --- helpers -------------------------------------------------------------

  /** Prisma filter matching a stored close time that falls 10 minutes ahead of `now`. */
  private closeWindow(now: Date): { gt: Date; lte: Date } {
    const start = new Date(now.getTime() + CLOSE_REMINDER_LEAD_MS);
    return { gt: start, lte: new Date(start.getTime() + CLOSE_WINDOW_WIDTH_MS) };
  }

  /** Resolve the type-based tournament audience and dispatch a single payload. */
  private async dispatchTournamentAudience(
    tournament: { id: string; name: string },
    payload: { triggerKey: string; dedupeKey: string; title: string; body: string; screen: string },
  ): Promise<void> {
    try {
      const userIds = await this.audience.resolveTournamentAudience(tournament.id);
      if (userIds.length === 0) {
        return;
      }
      await this.notifications.sendToAudience(userIds, {
        triggerKey: payload.triggerKey,
        dedupeKey: payload.dedupeKey,
        title: payload.title,
        body: payload.body,
        data: { tournamentId: tournament.id, screen: payload.screen },
        audienceSummary: `Tournament ${tournament.id} audience`,
      });
    } catch (err) {
      this.logger.error(
        `Timed tournament notification failed for ${tournament.id} (${payload.triggerKey})`,
        err as Error,
      );
    }
  }
}
