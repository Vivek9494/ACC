import {
  type BatterCard,
  BatsmanPickerRole,
  BatsmanPickerStatus,
  type BatsmanPickerPlayerRow,
  type BatsmanPickerResponse,
  type BattingStyle,
  type AddExternalBatsmanRequest,
  type AuthUser,
  type ExternalPlayerView,
  formatDismissalShort,
  MatchAuditAction,
  MatchSquadRole,
  MatchState,
  type InningsScorecard,
} from '@acc/types';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { activeMatchFirstWhere } from '../matches/match-query';
import { ScorecardReader } from './scorecard-reader';

interface PlayerProfile {
  userId: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  battingStyle: string | null;
}

const SCORABLE_STATES: MatchState[] = [MatchState.Live, MatchState.RainInterrupted];

@Injectable()
export class BatsmanPickerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
    private readonly audit: AuditService,
  ) {}

  async getPicker(
    matchId: string,
    inningsId: string,
    role: BatsmanPickerRole,
    options: {
      otherSlotUserId?: string | null;
    } = {},
  ): Promise<BatsmanPickerResponse> {
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

    if (inningsRow.battingIsExternal) {
      return this.getExternalPicker(matchId, inningsId, match.externalOpponentName, inn, role, options);
    }

    return this.getRegisteredPicker(match, inn, inningsId, role, options);
  }

  async addExternalBatsman(
    actor: AuthUser,
    matchId: string,
    inningsId: string,
    dto: AddExternalBatsmanRequest,
  ): Promise<ExternalPlayerView> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException({ message: 'Batsman name is required', error: 'NAME_REQUIRED' });
    }

    const match = await this.prisma.match.findFirst({ where: activeMatchFirstWhere(matchId) });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    if (!SCORABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'External batters can only be added during live scoring',
        error: 'MATCH_NOT_SCORABLE',
      });
    }

    const inningsRow = await this.prisma.innings.findFirst({
      where: { id: inningsId, matchId },
    });
    if (!inningsRow) {
      throw new NotFoundException({ message: 'Innings not found', error: 'INNINGS_NOT_FOUND' });
    }
    if (!inningsRow.battingIsExternal) {
      throw new BadRequestException({
        message: 'Name-only batters can only be added for the external opponent',
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
        battingStyle: dto.battingStyle ? (dto.battingStyle as BattingStyle) : null,
      },
    });

    await this.audit.record({
      action: MatchAuditAction.ExternalBatsmanAdded,
      actorUserId: actor.id,
      targetEntityType: 'external_player',
      targetEntityId: created.id,
      after: {
        matchId,
        inningsId,
        slot: created.slot,
        name: created.name,
        battingStyle: created.battingStyle,
      },
    });

    return this.toExternalView(created);
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
    role: BatsmanPickerRole,
    options: { otherSlotUserId?: string | null },
  ): Promise<BatsmanPickerResponse> {
    if (!inn.battingTeamId) {
      throw new BadRequestException({
        message: 'Batting team is not set for this innings',
        error: 'BATTING_TEAM_UNKNOWN',
      });
    }

    const squad = match.squads.find((row) => row.teamId === inn.battingTeamId);
    if (!squad) {
      throw new BadRequestException({
        message: 'Batting team squad is not locked',
        error: 'SQUAD_NOT_LOCKED',
      });
    }

    const playingXi = squad.players.filter((p) => p.role === MatchSquadRole.PlayingXi);
    const substitutes = squad.players.filter((p) => p.role === MatchSquadRole.Substitute);
    const rosterIds = [...playingXi.map((p) => p.userId), ...substitutes.map((p) => p.userId)];

    const profiles = await this.loadProfiles(match.tournamentId, rosterIds);
    const allSquadUserIds = match.squads.flatMap((s) => s.players.map((p) => p.userId));
    const [nameProfiles, externalNameMap] = await Promise.all([
      this.loadProfiles(match.tournamentId, allSquadUserIds),
      this.loadExternalNameMap(match.id),
    ]);
    // Include external bowler/fielder names so dismissals resolve (e.g. ACC vs Gujarat Stars).
    const nameOf = this.buildNameResolver(nameProfiles, externalNameMap);

    const batterById = new Map(inn.batters.map((b) => [b.playerId, b]));
    const players = rosterIds.map((userId) =>
      this.toRegisteredRow({
        userId,
        profile: profiles.get(userId),
        card: batterById.get(userId),
        inn,
        role,
        otherSlotUserId: options.otherSlotUserId ?? null,
        nameOf,
      }),
    );

    return {
      matchId: match.id,
      inningsId,
      battingTeamId: inn.battingTeamId,
      battingTeamName: squad.team.name,
      battingSideIsExternal: false,
      role,
      players,
      availableSubstitutes: [],
    };
  }

  private async getExternalPicker(
    matchId: string,
    inningsId: string,
    externalOpponentName: string | null,
    inn: InningsScorecard,
    role: BatsmanPickerRole,
    options: { otherSlotUserId?: string | null },
  ): Promise<BatsmanPickerResponse> {
    const externals = await this.prisma.externalPlayer.findMany({
      where: { matchId },
      orderBy: { slot: 'asc' },
    });

    const externalNameMap = new Map(externals.map((row) => [row.id, row.name]));
    const allSquadUserIds = await this.loadOpponentUserIds(matchId, inn);
    const nameProfiles = await this.loadProfiles(
      (
        await this.prisma.match.findFirstOrThrow({
          where: activeMatchFirstWhere(matchId),
          select: { tournamentId: true },
        })
      )
        .tournamentId,
      allSquadUserIds,
    );
    const nameOf = this.buildNameResolver(nameProfiles, externalNameMap);

    const batterById = new Map(inn.batters.map((b) => [b.playerId, b]));
    const players = externals.map((external) => {
      const { firstName, lastName } = this.splitName(external.name);
      return this.toExternalRow({
        participantId: external.id,
        firstName,
        lastName,
        battingStyle: external.battingStyle,
        card: batterById.get(external.id),
        inn,
        role,
        otherSlotUserId: options.otherSlotUserId ?? null,
        nameOf,
      });
    });

    return {
      matchId,
      inningsId,
      battingTeamId: null,
      battingTeamName: externalOpponentName?.trim() || 'External Team',
      battingSideIsExternal: true,
      role,
      players,
      availableSubstitutes: [],
    };
  }

  private async loadExternalNameMap(matchId: string): Promise<Map<string, string>> {
    const externals = await this.prisma.externalPlayer.findMany({
      where: { matchId },
      select: { id: true, name: true },
    });
    return new Map(externals.map((row) => [row.id, row.name]));
  }

  private async loadOpponentUserIds(matchId: string, inn: InningsScorecard): Promise<string[]> {
    const ids = new Set<string>();
    for (const batter of inn.batters) {
      ids.add(batter.playerId);
      if (batter.bowlerId) ids.add(batter.bowlerId);
      if (batter.fielderId) ids.add(batter.fielderId);
    }
    if (inn.currentStrikerId) ids.add(inn.currentStrikerId);
    if (inn.currentNonStrikerId) ids.add(inn.currentNonStrikerId);
    if (inn.currentBowlerId) ids.add(inn.currentBowlerId);

    const externals = await this.prisma.externalPlayer.findMany({
      where: { matchId },
      select: { id: true },
    });
    const externalIds = new Set(externals.map((row) => row.id));
    return [...ids].filter((id) => !externalIds.has(id));
  }

  private buildNameResolver(
    userProfiles: Map<string, PlayerProfile>,
    externalNames: Map<string, string>,
  ): (id: string | null) => string {
    return (id: string | null): string => {
      if (!id) return '—';
      const external = externalNames.get(id);
      if (external) return external;
      const profile = userProfiles.get(id);
      return profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Player';
    };
  }

  private splitName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] ?? 'Player';
    if (parts.length <= 1) return { firstName: first, lastName: '' };
    return { firstName: first, lastName: parts.slice(1).join(' ') };
  }

  private toRegisteredRow(args: {
    userId: string;
    profile: PlayerProfile | undefined;
    card: BatterCard | undefined;
    inn: InningsScorecard;
    role: BatsmanPickerRole;
    otherSlotUserId: string | null;
    nameOf: (id: string | null) => string;
  }): BatsmanPickerPlayerRow {
    return this.toParticipantRow({
      ...args,
      participantId: args.userId,
      isExternal: false,
    });
  }

  private toExternalRow(args: {
    participantId: string;
    firstName: string;
    lastName: string;
    battingStyle: string | null;
    card: BatterCard | undefined;
    inn: InningsScorecard;
    role: BatsmanPickerRole;
    otherSlotUserId: string | null;
    nameOf: (id: string | null) => string;
  }): BatsmanPickerPlayerRow {
    const base = this.toParticipantRow({
      userId: args.participantId,
      profile: {
        userId: args.participantId,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePhotoUrl: null,
        battingStyle: args.battingStyle,
      },
      card: args.card,
      inn: args.inn,
      role: args.role,
      otherSlotUserId: args.otherSlotUserId,
      nameOf: args.nameOf,
      participantId: args.participantId,
      isExternal: true,
    });
    return base;
  }

  private toParticipantRow(args: {
    userId: string;
    profile: PlayerProfile | undefined;
    card: BatterCard | undefined;
    inn: InningsScorecard;
    role: BatsmanPickerRole;
    otherSlotUserId: string | null;
    nameOf: (id: string | null) => string;
    participantId: string;
    isExternal: boolean;
  }): BatsmanPickerPlayerRow {
    const { userId, profile, card, inn, role, otherSlotUserId, nameOf, isExternal } = args;
    const atCrease = userId === inn.currentStrikerId || userId === inn.currentNonStrikerId;
    const isOut = card?.isOut === true;

    let status: BatsmanPickerStatus;
    if (isOut) {
      status = BatsmanPickerStatus.Out;
    } else if (atCrease) {
      status = BatsmanPickerStatus.AtCrease;
    } else if (card?.retiredHurt) {
      status = BatsmanPickerStatus.RetiredHurt;
    } else {
      status = BatsmanPickerStatus.YetToBat;
    }

    const dismissalText = isOut && card
      ? `${card.runs} (${card.balls}) • ${formatDismissalShort(card, nameOf)}`
      : card?.retiredHurt
        ? `${card.runs} (${card.balls}) • Retired hurt`
        : null;

    const selected =
      status === BatsmanPickerStatus.AtCrease ||
      (role === BatsmanPickerRole.Striker && userId === inn.currentStrikerId) ||
      (role === BatsmanPickerRole.NonStriker && userId === inn.currentNonStrikerId);

    const selectable = this.isSelectable({
      userId,
      status,
      card,
      role,
      otherSlotUserId,
      atCrease,
      isOut,
    });

    return {
      userId,
      firstName: profile?.firstName ?? 'Player',
      lastName: profile?.lastName ?? '',
      profilePhotoUrl: profile?.profilePhotoUrl ?? null,
      battingStyle: profile?.battingStyle ?? null,
      isExternal,
      status,
      runs: card?.runs ?? null,
      balls: card?.balls ?? null,
      dismissalText,
      selectable,
      selected,
    };
  }

  private isSelectable(args: {
    userId: string;
    status: BatsmanPickerStatus;
    card: BatterCard | undefined;
    role: BatsmanPickerRole;
    otherSlotUserId: string | null;
    atCrease: boolean;
    isOut: boolean;
  }): boolean {
    const { userId, status, card, role, otherSlotUserId, atCrease, isOut } = args;
    if (isOut) return false;
    if (otherSlotUserId && userId === otherSlotUserId) return false;

    if (role === BatsmanPickerRole.Incoming) {
      if (atCrease) return false;
      return this.eligibleIncoming(card);
    }

    if (role === BatsmanPickerRole.Striker && userId === otherSlotUserId) return false;
    if (role === BatsmanPickerRole.NonStriker && userId === otherSlotUserId) return false;

    if (status === BatsmanPickerStatus.AtCrease) return true;
    return status === BatsmanPickerStatus.YetToBat;
  }

  private eligibleIncoming(card: BatterCard | undefined): boolean {
    if (!card) return true;
    if (card.isOut) return false;
    if (card.retiredHurt) return true;
    if (card.balls === 0) return true;
    return !card.isOut;
  }

  private toExternalView(row: {
    id: string;
    matchId: string;
    slot: number;
    name: string;
    battingStyle: string | null;
  }): ExternalPlayerView {
    return {
      id: row.id,
      matchId: row.matchId,
      slot: row.slot,
      name: row.name,
      battingStyle: row.battingStyle,
      bowlingType: null,
    };
  }

  private async loadProfiles(
    tournamentId: string,
    userIds: string[],
  ): Promise<Map<string, PlayerProfile>> {
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
        select: { userId: true, battingStyle: true },
      }),
    ]);

    const styleByUser = new Map(
      registrations.map((row) => [row.userId, row.battingStyle as BattingStyle | null]),
    );

    return new Map(
      users.map((user) => [
        user.id,
        {
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePhotoUrl: user.profilePhotoUrl,
          battingStyle: styleByUser.get(user.id) ?? null,
        },
      ]),
    );
  }
}
