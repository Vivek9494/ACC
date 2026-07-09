import {
  BALLS_PER_OVER,
  type BowlerPickerPlayerRow,
  type BowlerPickerResponse,
  BowlerPickerIneligibility,
  type BowlerCard,
  bowlingTypeDisplayLabel,
  formatBowlerOmRw,
  type AddExternalBowlerRequest,
  type AuthUser,
  type ExternalPlayerView,
  MatchAuditAction,
  MatchSquadRole,
  MatchState,
  type InningsScorecard,
  isExternalOpponentMatch,
} from '@acc/types';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { activeMatchFirstWhere } from '../matches/match-query';
import { toScoringEvent } from './delivery-mapper';
import { isConsecutiveOverViolation } from './engine/validation';
import type { ScoringEvent } from './engine/types';
import { ScorecardReader } from './scorecard-reader';

interface BowlerProfile {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  bowlingType: string | null;
}

const SCORABLE_STATES: MatchState[] = [MatchState.Live, MatchState.RainInterrupted];

@Injectable()
export class BowlerPickerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
    private readonly audit: AuditService,
  ) {}

  async getPicker(matchId: string, inningsId: string): Promise<BowlerPickerResponse> {
    const match = await this.prisma.match.findFirst({
      where: activeMatchFirstWhere(matchId),
      include: {
        squads: {
          include: {
            team: { select: { id: true, name: true } },
            players: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profilePhotoUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }

    const inningsRow = await this.prisma.innings.findFirst({
      where: { id: inningsId, matchId },
    });
    if (!inningsRow) {
      throw new NotFoundException({ message: 'Innings not found', error: 'INNINGS_NOT_FOUND' });
    }

    const card = await this.scorecardReader.build(match);
    const inn = card.innings.find((row) => row.inningsId === inningsId);
    if (!inn) {
      throw new NotFoundException({ message: 'Innings not found', error: 'INNINGS_NOT_FOUND' });
    }

    const deliveries = await this.prisma.delivery.findMany({
      where: { inningsId, isVoided: false },
      orderBy: { sequence: 'asc' },
    });
    const events = deliveries.map((d) => toScoringEvent(d));
    const maxOversPerBowler = match.maxOversPerBowler ?? null;

    if (inningsRow.bowlingIsExternal) {
      return this.getExternalPicker(
        matchId,
        inningsId,
        match.externalOpponentName,
        inn,
        events,
        maxOversPerBowler,
      );
    }

    return this.getRegisteredPicker(match, inn, inningsId, events, maxOversPerBowler);
  }

  async addExternalBowler(
    actor: AuthUser,
    matchId: string,
    inningsId: string,
    dto: AddExternalBowlerRequest,
  ): Promise<ExternalPlayerView> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException({ message: 'Bowler name is required', error: 'NAME_REQUIRED' });
    }

    const match = await this.prisma.match.findFirst({ where: activeMatchFirstWhere(matchId) });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    if (!SCORABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'External bowlers can only be added during live scoring',
        error: 'MATCH_NOT_SCORABLE',
      });
    }

    const inningsRow = await this.prisma.innings.findFirst({
      where: { id: inningsId, matchId },
    });
    if (!inningsRow) {
      throw new NotFoundException({ message: 'Innings not found', error: 'INNINGS_NOT_FOUND' });
    }
    if (!inningsRow.bowlingIsExternal) {
      throw new BadRequestException({
        message: 'Name-only bowlers can only be added for the external opponent',
        error: 'EXTERNAL_SIDE_REQUIRED',
      });
    }

    const maxSlot = await this.prisma.externalPlayer.aggregate({
      where: { matchId },
      _max: { slot: true },
    });
    const nextSlot = (maxSlot._max.slot ?? 0) + 1;

    const created = await this.prisma.externalPlayer.create({
      data: {
        matchId,
        slot: nextSlot,
        name,
        bowlingType: dto.bowlingType?.trim() || null,
      },
    });

    await this.audit.record({
      action: MatchAuditAction.ExternalBowlerAdded,
      actorUserId: actor.id,
      targetEntityType: 'external_player',
      targetEntityId: created.id,
      after: {
        matchId,
        inningsId,
        slot: created.slot,
        name: created.name,
        bowlingType: created.bowlingType,
      },
    });

    return this.toExternalView(created);
  }

  /** §9.5: rename a name-only external opponent player during live scoring. */
  async renameExternalPlayer(
    actor: AuthUser,
    matchId: string,
    playerId: string,
    name: string,
  ): Promise<ExternalPlayerView> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException({ message: 'Player name is required', error: 'NAME_REQUIRED' });
    }

    const match = await this.prisma.match.findFirst({ where: activeMatchFirstWhere(matchId) });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    if (!isExternalOpponentMatch(match)) {
      throw new BadRequestException({
        message: 'External players can only be renamed for external-opponent fixtures',
        error: 'NOT_EXTERNAL_OPPONENT',
      });
    }
    if (!SCORABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'External players can only be renamed during live scoring',
        error: 'MATCH_NOT_SCORABLE',
      });
    }

    const existing = await this.prisma.externalPlayer.findUnique({ where: { id: playerId } });
    if (!existing || existing.matchId !== matchId) {
      throw new NotFoundException({ message: 'External player not found', error: 'NOT_FOUND' });
    }

    const duplicate = await this.prisma.externalPlayer.findFirst({
      where: {
        matchId,
        id: { not: playerId },
        name: { equals: trimmed, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException({
        message: 'This player name is already on the opponent list',
        error: 'DUPLICATE_OPPONENT_NAME',
      });
    }

    const updated = await this.prisma.externalPlayer.update({
      where: { id: playerId },
      data: { name: trimmed },
    });

    await this.audit.record({
      action: MatchAuditAction.ExternalPlayerRenamed,
      actorUserId: actor.id,
      targetEntityType: 'external_player',
      targetEntityId: updated.id,
      before: { name: existing.name },
      after: { matchId, name: updated.name, slot: updated.slot },
    });

    return this.toExternalView(updated);
  }

  private async getRegisteredPicker(
    match: {
      id: string;
      tournamentId: string;
      squads: Array<{
        teamId: string;
        team: { id: string; name: string };
        players: Array<{
          userId: string;
          role: string;
          user: { firstName: string; lastName: string; profilePhotoUrl: string | null };
        }>;
      }>;
    },
    inn: InningsScorecard,
    inningsId: string,
    events: ScoringEvent[],
    maxOversPerBowler: number | null,
  ): Promise<BowlerPickerResponse> {
    if (!inn.bowlingTeamId) {
      throw new BadRequestException({
        message: 'Bowling team is not set for this innings',
        error: 'BOWLING_TEAM_UNKNOWN',
      });
    }

    const squad = match.squads.find((row) => row.teamId === inn.bowlingTeamId);
    if (!squad) {
      throw new BadRequestException({
        message: 'Bowling team squad is not locked',
        error: 'SQUAD_NOT_LOCKED',
      });
    }

    const playingXi = squad.players.filter((p) => p.role === MatchSquadRole.PlayingXi);
    const rosterIds = playingXi.map((p) => p.userId);
    const profiles = await this.loadBowlingProfiles(match.tournamentId, rosterIds);
    const bowlerById = new Map(inn.bowlers.map((b) => [b.playerId, b]));

    const players = rosterIds.map((userId) =>
      this.toRow({
        participantId: userId,
        profile: profiles.get(userId),
        card: bowlerById.get(userId),
        inn,
        events,
        maxOversPerBowler,
        isExternal: false,
      }),
    );

    return {
      matchId: match.id,
      inningsId,
      bowlingTeamId: inn.bowlingTeamId,
      bowlingTeamName: squad.team.name,
      bowlingSideIsExternal: false,
      maxOversPerBowler,
      players,
    };
  }

  private async getExternalPicker(
    matchId: string,
    inningsId: string,
    externalOpponentName: string | null,
    inn: InningsScorecard,
    events: ScoringEvent[],
    maxOversPerBowler: number | null,
  ): Promise<BowlerPickerResponse> {
    const externals = await this.prisma.externalPlayer.findMany({
      where: { matchId },
      orderBy: { slot: 'asc' },
    });

    const bowlerById = new Map(inn.bowlers.map((b) => [b.playerId, b]));
    const players = externals.map((external) => {
      const { firstName, lastName } = this.splitName(external.name);
      return this.toRow({
        participantId: external.id,
        profile: {
          userId: external.id,
          firstName,
          lastName,
          profilePhotoUrl: null,
          bowlingType: external.bowlingType,
        },
        card: bowlerById.get(external.id),
        inn,
        events,
        maxOversPerBowler,
        isExternal: true,
      });
    });

    return {
      matchId,
      inningsId,
      bowlingTeamId: null,
      bowlingTeamName: externalOpponentName?.trim() || 'External Team',
      bowlingSideIsExternal: true,
      maxOversPerBowler,
      players,
    };
  }

  private toRow(args: {
    participantId: string;
    profile: BowlerProfile | undefined;
    card: BowlerCard | undefined;
    inn: InningsScorecard;
    events: ScoringEvent[];
    maxOversPerBowler: number | null;
    isExternal: boolean;
  }): BowlerPickerPlayerRow {
    const { participantId, profile, card, inn, events, maxOversPerBowler, isExternal } = args;
    const bowlingType = profile?.bowlingType ?? null;
    const bowlingTypeLabel = bowlingTypeDisplayLabel(bowlingType);
    const figuresOmRw =
      card && card.legalBalls > 0 ? formatBowlerOmRw(card) : null;

    const { selectable, ineligibility, ineligibilityHint } = this.eligibility(
      participantId,
      events,
      card,
      maxOversPerBowler,
    );

    const selected = participantId === inn.currentBowlerId;

    return {
      userId: participantId,
      firstName: profile?.firstName ?? 'Player',
      lastName: profile?.lastName ?? '',
      profilePhotoUrl: profile?.profilePhotoUrl ?? null,
      bowlingType,
      bowlingTypeLabel,
      figuresOmRw,
      isExternal,
      selectable,
      selected,
      ineligibility,
      ineligibilityHint,
    };
  }

  private eligibility(
    participantId: string,
    events: ScoringEvent[],
    card: BowlerCard | undefined,
    maxOversPerBowler: number | null,
  ): {
    selectable: boolean;
    ineligibility: BowlerPickerIneligibility | null;
    ineligibilityHint: string | null;
  } {
    if (this.isQuotaReached(card, maxOversPerBowler)) {
      return {
        selectable: false,
        ineligibility: BowlerPickerIneligibility.QuotaReached,
        ineligibilityHint: 'Quota reached',
      };
    }
    if (isConsecutiveOverViolation(events, participantId)) {
      return {
        selectable: false,
        ineligibility: BowlerPickerIneligibility.ConsecutiveOver,
        ineligibilityHint: 'Bowled previous over',
      };
    }
    return { selectable: true, ineligibility: null, ineligibilityHint: null };
  }

  private isQuotaReached(card: BowlerCard | undefined, maxOvers: number | null): boolean {
    if (!maxOvers || !card) return false;
    return card.legalBalls >= maxOvers * BALLS_PER_OVER;
  }

  private splitName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] ?? 'Player';
    if (parts.length <= 1) return { firstName: first, lastName: '' };
    return { firstName: first, lastName: parts.slice(1).join(' ') };
  }

  private toExternalView(row: {
    id: string;
    matchId: string;
    slot: number;
    name: string;
    battingStyle: string | null;
    bowlingType: string | null;
  }): ExternalPlayerView {
    return {
      id: row.id,
      matchId: row.matchId,
      slot: row.slot,
      name: row.name,
      battingStyle: row.battingStyle,
      bowlingType: row.bowlingType,
    };
  }

  private async loadBowlingProfiles(
    tournamentId: string,
    userIds: string[],
  ): Promise<Map<string, BowlerProfile>> {
    if (userIds.length === 0) return new Map();

    const [users, registrations] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePhotoUrl: true,
        },
      }),
      this.prisma.registration.findMany({
        where: { tournamentId, userId: { in: userIds } },
        select: { userId: true, bowlingType: true },
      }),
    ]);

    const typeByUser = new Map(registrations.map((row) => [row.userId, row.bowlingType]));

    return new Map(
      users.map((user) => [
        user.id,
        {
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePhotoUrl: user.profilePhotoUrl,
          bowlingType: typeByUser.get(user.id) ?? null,
        },
      ]),
    );
  }
}
