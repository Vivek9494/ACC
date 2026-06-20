import {
  BALLS_PER_OVER,
  type GuestBatterView,
  type GuestDashboard,
  type GuestFeaturedLiveMatch,
  type GuestThisOverBall,
  type InningsScorecard,
  MatchState,
  type TournamentSummary,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match, Tournament } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { activeTournamentRelationWhere, activeTournamentWhere } from '../tournaments/tournament-query';
import { ScorecardReader } from '../scoring/scorecard-reader';

type TournamentWithCounts = Tournament & { _count: { teams: number } };

const LIVE_STATES: MatchState[] = [MatchState.Live, MatchState.RainInterrupted];

function oversFromBalls(balls: number): number {
  return balls / BALLS_PER_OVER;
}

function fmtRate(n: number): number {
  return Math.round(n * 10) / 10;
}

@Injectable()
export class GuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
  ) {}

  async getDashboard(): Promise<GuestDashboard> {
    const [featuredLiveMatch, tournaments] = await Promise.all([
      this.loadFeaturedLiveMatch(),
      this.listPublicTournaments(),
    ]);
    return { featuredLiveMatch, tournaments };
  }

  private async loadFeaturedLiveMatch(): Promise<GuestFeaturedLiveMatch | null> {
    const match = await this.prisma.match.findFirst({
      where: { state: { in: LIVE_STATES }, ...activeTournamentRelationWhere },
      orderBy: [{ matchDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        tournament: { select: { name: true } },
      },
    });

    if (!match) {
      return null;
    }

    try {
      const card = await this.scorecardReader.build(match);
      const inn = card.innings.at(-1);
      if (!inn || inn.closed) {
        return null;
      }

      const nameMap = await this.loadPlayerNames(match.id, inn);
      return this.toFeaturedLiveMatch(match, card.innings.at(-1)!, nameMap);
    } catch {
      return null;
    }
  }

  private async loadPlayerNames(
    matchId: string,
    inn: InningsScorecard,
  ): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const b of inn.batters) {
      ids.add(b.playerId);
    }
    if (inn.currentStrikerId) ids.add(inn.currentStrikerId);
    if (inn.currentNonStrikerId) ids.add(inn.currentNonStrikerId);

    const squadRows = await this.prisma.matchSquadPlayer.findMany({
      where: {
        userId: { in: [...ids] },
        squad: { matchId },
      },
      select: {
        userId: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const map = new Map<string, string>();
    for (const row of squadRows) {
      map.set(row.userId, `${row.user.firstName} ${row.user.lastName}`.trim());
    }

    const missing = [...ids].filter((id) => !map.has(id));
    if (missing.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: missing } },
        select: { id: true, firstName: true, lastName: true },
      });
      for (const user of users) {
        map.set(user.id, `${user.firstName} ${user.lastName}`.trim());
      }
    }

    return map;
  }

  private toFeaturedLiveMatch(
    match: Match & {
      homeTeam: { id: string; name: string } | null;
      awayTeam: { id: string; name: string } | null;
      tournament: { name: string };
    },
    inn: InningsScorecard,
    nameMap: Map<string, string>,
  ): GuestFeaturedLiveMatch {
    const teamName = this.battingTeamName(match, inn.battingTeamId);
    const score =
      inn.closed && inn.wickets >= 10 ? `${inn.runs}` : `${inn.runs}/${inn.wickets}`;
    const overs = `${inn.oversText} OVERS`;

    const batters = this.buildBatterRows(inn, nameMap);
    const runRate =
      inn.legalBalls > 0 ? fmtRate(inn.runs / oversFromBalls(inn.legalBalls)) : 0;
    const remainingOvers =
      inn.oversAllotted !== null
        ? Math.max(0, oversFromBalls(inn.oversAllotted * BALLS_PER_OVER - inn.legalBalls))
        : 0;
    const projectedRuns = Math.round(inn.runs + runRate * remainingOvers);

    return {
      matchId: match.id,
      tournamentName: match.tournament.name,
      battingTeamName: teamName,
      score,
      overs,
      batters,
      projectedRuns,
      runRate,
      thisOver: this.buildThisOver(inn),
    };
  }

  private battingTeamName(
    match: Match & {
      homeTeam: { id: string; name: string } | null;
      awayTeam: { id: string; name: string } | null;
    },
    battingTeamId: string | null,
  ): string {
    if (battingTeamId === match.homeTeamId) {
      return match.homeTeam?.name ?? 'Home';
    }
    if (battingTeamId === match.awayTeamId) {
      return match.awayTeam?.name ?? match.externalOpponentName ?? 'Away';
    }
    return 'Team';
  }

  private buildBatterRows(inn: InningsScorecard, nameMap: Map<string, string>): GuestBatterView[] {
    const striker = inn.batters.find((b) => b.playerId === inn.currentStrikerId);
    const nonStriker = inn.batters.find((b) => b.playerId === inn.currentNonStrikerId);
    const rows: GuestBatterView[] = [];

    const push = (card: typeof striker, onStrike: boolean): void => {
      if (!card || card.isOut) {
        return;
      }
      rows.push({
        name: nameMap.get(card.playerId) ?? 'Batter',
        runs: card.runs,
        balls: card.balls,
        isOut: card.isOut,
        onStrike,
      });
    };

    push(striker, true);
    push(nonStriker, false);

    return rows;
  }

  private buildThisOver(inn: InningsScorecard): GuestThisOverBall[] {
    const currentOver = inn.recentOvers.at(-1);
    if (!currentOver) {
      return [];
    }

    return currentOver.balls.map((code) => {
      const normalized = code.toLowerCase();
      let emphasis: GuestThisOverBall['emphasis'] = 'normal';
      if (normalized === 'w') {
        emphasis = 'wicket';
      } else if (normalized === '4' || normalized === '6') {
        emphasis = 'primary';
      }
      return { code, emphasis };
    });
  }

  private async listPublicTournaments(): Promise<TournamentSummary[]> {
    const rows = await this.prisma.tournament.findMany({
      where: {
        ...activeTournamentWhere,
        state: { in: ['LIVE', 'TEAMS_FINALIZED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'] },
      },
      orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { teams: true } } },
    });

    return rows.map((row) => this.toTournamentSummary(row));
  }

  private toTournamentSummary(row: TournamentWithCounts): TournamentSummary {
    return {
      id: row.id,
      name: row.name,
      year: row.year,
      type: row.type,
      state: row.state,
      ballType: row.ballType,
      posterUrl: row.posterUrl,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      locationAddress: row.locationAddress,
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
      teamCount: row._count.teams,
    };
  }
}
