import {
  BallType,
  MatchState,
  buildPlayerMomMatchFigures,
  type OwnPlayerMomMatchesView,
  type OwnPlayerMomStatsSummary,
  type PlayerMomMatchSummary,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';

const MOM_MATCH_STATES: MatchState[] = [MatchState.Completed, MatchState.ScorecardLocked];

interface MomMatchRow {
  id: string;
  matchDate: Date | null;
  resultNote: string | null;
  manOfTheMatchSelectedAt: Date | null;
  completedAt: Date | null;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
  externalOpponentName: string | null;
  tournament: { id: string; name: string };
}

@Injectable()
export class PlayerMomStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecards: ScorecardReader,
  ) {}

  async buildSummary(userId: string, ballType: BallType): Promise<OwnPlayerMomStatsSummary> {
    const rows = await this.fetchMomMatchRows(userId, ballType);
    if (rows.length === 0) {
      return { count: 0, mostRecent: null };
    }
    const mostRecent = await this.toMatchSummary(rows[0]!, userId);
    return { count: rows.length, mostRecent };
  }

  async listMatches(userId: string, ballType: BallType): Promise<OwnPlayerMomMatchesView> {
    const rows = await this.fetchMomMatchRows(userId, ballType);
    const matches = await Promise.all(rows.map((row) => this.toMatchSummary(row, userId)));
    return { ballType, count: matches.length, matches };
  }

  private async fetchMomMatchRows(userId: string, ballType: BallType): Promise<MomMatchRow[]> {
    return this.prisma.match.findMany({
      where: {
        manOfTheMatchUserId: userId,
        isDeleted: false,
        state: { in: MOM_MATCH_STATES },
        tournament: { ballType, isDeleted: false },
      },
      orderBy: [
        { manOfTheMatchSelectedAt: 'desc' },
        { completedAt: 'desc' },
        { matchDate: 'desc' },
      ],
      select: {
        id: true,
        matchDate: true,
        resultNote: true,
        manOfTheMatchSelectedAt: true,
        completedAt: true,
        externalOpponentName: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        tournament: { select: { id: true, name: true } },
      },
    });
  }

  private async toMatchSummary(row: MomMatchRow, userId: string): Promise<PlayerMomMatchSummary> {
    const scorecard = await this.scorecards.byMatchId(row.id);
    return {
      matchId: row.id,
      tournamentId: row.tournament.id,
      tournamentName: row.tournament.name,
      matchDate: row.matchDate?.toISOString().slice(0, 10) ?? null,
      homeTeamName: row.homeTeam?.name ?? 'Home',
      awayTeamName: row.awayTeam?.name ?? row.externalOpponentName ?? 'Away',
      resultNote: row.resultNote,
      figures: buildPlayerMomMatchFigures(scorecard, userId),
      awardedAt: row.manOfTheMatchSelectedAt?.toISOString() ?? null,
    };
  }
}
