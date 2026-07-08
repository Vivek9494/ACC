import {
  BallType,
  deriveChaseEquation,
  formatChaseNeedsLine,
  formatMatchResultNote,
  formatMyMatchScheduledFooterLine,
  formatMyMatchTeamScoreLine,
  InningsType,
  MatchCardDisplayState,
  MatchState,
  type MyMatchListItem,
  type MyMatchesResponse,
  type MyMatchesTournamentOption,
  sortMyMatchesForDisplay,
  deriveMatchCardDisplayState,
  type ScorecardResponse,
  resolveOversAllotment,
  formatUtcIsoDate,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import { type Match, type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from '../scoring/scorecard-reader';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { activeTournamentRelationWhere } from '../tournaments/tournament-query';
import { myMatchesStateWhere, findPlayingXiMatchIds } from '../matches/match-visibility.utils';

type MatchRow = Match & {
  homeTeam: { id: string; name: string; logoUrl: string | null } | null;
  awayTeam: { id: string; name: string; logoUrl: string | null } | null;
  tournament: {
    id: string;
    name: string;
    ballType: string;
    oversPerInnings: number | null;
    timezone: string | null;
  };
};

const SCORECARD_STATES: MatchState[] = [
  MatchState.Live,
  MatchState.RainInterrupted,
  MatchState.Completed,
  MatchState.ScorecardLocked,
  MatchState.NoResult,
  MatchState.Cancelled,
];

const MY_MATCH_INCLUDE = {
  homeTeam: { select: { id: true, name: true, logoUrl: true } },
  awayTeam: { select: { id: true, name: true, logoUrl: true } },
  tournament: { select: { id: true, name: true, ballType: true, oversPerInnings: true, timezone: true } },
} as const satisfies Prisma.MatchInclude;

@Injectable()
export class MyMatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scorecardReader: ScorecardReader,
    private readonly mediaUrls: MediaUrlResolver,
  ) {}

  async listForUser(userId: string): Promise<MyMatchesResponse> {
    const matchIds = await findPlayingXiMatchIds(this.prisma, userId);
    if (matchIds.length === 0) {
      return { ballTypes: [], matches: [], tournaments: [] };
    }

    const rows = await this.prisma.match.findMany({
      where: {
        id: { in: matchIds },
        isDeleted: false,
        ...myMatchesStateWhere,
        ...activeTournamentRelationWhere,
      },
      include: MY_MATCH_INCLUDE,
    });

    const items = await Promise.all(rows.map((row) => this.toListItem(row)));
    const matches = sortMyMatchesForDisplay(items);
    const ballTypes = [...new Set(matches.map((match) => match.ballType))].sort();
    const tournaments = this.collectTournaments(matches);

    return { ballTypes, matches, tournaments };
  }

  private collectTournaments(matches: readonly MyMatchListItem[]): MyMatchesTournamentOption[] {
    const byId = new Map<string, MyMatchesTournamentOption>();
    for (const match of matches) {
      if (!byId.has(match.tournamentId)) {
        byId.set(match.tournamentId, {
          id: match.tournamentId,
          name: match.tournamentName,
          ballType: match.ballType,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private async toListItem(row: MatchRow): Promise<MyMatchListItem> {
    const state = row.state as MatchState;
    const displayState = deriveMatchCardDisplayState(state);
    const homeName = row.homeTeam?.name ?? 'TBD';
    const awayName = row.awayTeam?.name ?? row.externalOpponentName ?? 'TBD';
    const homeId = row.homeTeamId;
    const awayId = row.awayTeamId;

    const matchDate = row.matchDate ? formatUtcIsoDate(row.matchDate) : null;
    const startTime = row.startTime?.toISOString() ?? null;

    const [homeLogo, awayLogo] = await this.mediaUrls.resolveReadUrls([
      row.homeTeam?.logoUrl ?? null,
      row.awayTeam?.logoUrl ?? null,
    ]);

    let teamA = this.emptyTeamRow(homeId, homeName, homeLogo ?? null);
    let teamB = this.emptyTeamRow(awayId, awayName, awayLogo ?? null);
    let footerLine: string | null = null;

    if (displayState === MatchCardDisplayState.Scheduled) {
      footerLine = formatMyMatchScheduledFooterLine({
        matchDate,
        startTime,
        tournamentTimezone: row.tournament.timezone,
        delayMinutes: row.delayMinutes ?? 0,
      });
    } else if (displayState === MatchCardDisplayState.Cancelled) {
      footerLine = null;
    } else if (SCORECARD_STATES.includes(state)) {
      try {
        const card = await this.scorecardReader.build(row);
        const winnerId = card.result.winningTeamId;
        teamA = this.teamRowFromScorecard(homeId, homeName, homeLogo ?? null, card, winnerId);
        teamB = this.teamRowFromScorecard(awayId, awayName, awayLogo ?? null, card, winnerId);
        footerLine = this.resolveFooterLine(row, displayState, card, homeName, awayName);
      } catch {
        footerLine =
          displayState === MatchCardDisplayState.Completed
            ? this.persistedResultLine(row, homeName, awayName)
            : null;
      }
    }

    return {
      id: row.id,
      tournamentId: row.tournamentId,
      tournamentName: row.tournament.name,
      ballType: row.tournament.ballType as BallType,
      tournamentTimezone: row.tournament.timezone,
      state,
      displayState,
      matchDate,
      startTime,
      delayMinutes: row.delayMinutes ?? 0,
      teamA,
      teamB,
      footerLine,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private emptyTeamRow(
    id: string | null,
    name: string,
    logoUrl: string | null,
  ): MyMatchListItem['teamA'] {
    return { id, name, logoUrl, scoreLine: null, isWinner: false };
  }

  private teamRowFromScorecard(
    teamId: string | null,
    name: string,
    logoUrl: string | null,
    card: ScorecardResponse,
    winnerId: string | null,
  ): MyMatchListItem['teamA'] {
    const innings = card.innings.filter((inn) => inn.battingTeamId === teamId);
    return {
      id: teamId,
      name,
      logoUrl,
      scoreLine: formatMyMatchTeamScoreLine(innings),
      isWinner: winnerId !== null && winnerId === teamId,
    };
  }

  private resolveFooterLine(
    row: MatchRow,
    displayState: MatchCardDisplayState,
    card: ScorecardResponse,
    homeName: string,
    awayName: string,
  ): string | null {
    if (displayState === MatchCardDisplayState.Live) {
      return this.liveFooterLine(row, card, homeName, awayName);
    }
    return this.completedFooterLine(row, card, homeName, awayName);
  }

  private liveFooterLine(
    row: MatchRow,
    card: ScorecardResponse,
    homeName: string,
    awayName: string,
  ): string | null {
    return this.chaseLine(card, row, homeName, awayName);
  }

  private chaseLine(
    card: ScorecardResponse,
    row: MatchRow,
    homeName: string,
    awayName: string,
  ): string | null {
    const normals = card.innings.filter((inn) => inn.inningsType === InningsType.Normal);
    if (normals.length < 2) {
      return null;
    }
    const chaseInnings = normals[1]!;
    if (chaseInnings.closed) {
      return null;
    }
    const firstInnings = normals[0]!;
    const target = card.effectiveTarget ?? firstInnings.runs + 1;
    const oversPerInnings = resolveOversAllotment(
      chaseInnings.oversAllotted,
      firstInnings.oversAllotted,
      row.tournament.oversPerInnings,
    );
    if (oversPerInnings == null) {
      return null;
    }
    const chase = deriveChaseEquation(
      chaseInnings.runs,
      chaseInnings.legalBalls,
      target,
      oversPerInnings,
    );
    const chasingTeamId = chaseInnings.battingTeamId;
    const chasingName =
      chasingTeamId === row.homeTeamId
        ? homeName
        : chasingTeamId === row.awayTeamId
          ? awayName
          : 'Chasing team';
    return `${chasingName} ${formatChaseNeedsLine(chase.runsNeeded, chase.ballsRemaining)}`;
  }

  private completedFooterLine(
    row: MatchRow,
    card: ScorecardResponse,
    homeName: string,
    awayName: string,
  ): string | null {
    const persisted = this.persistedResultLine(row, homeName, awayName);
    if (persisted) {
      return persisted;
    }
    if (card.result.note) {
      return card.result.note;
    }
    const winnerId = card.result.winningTeamId;
    const winnerName =
      winnerId === row.homeTeamId ? homeName : winnerId === row.awayTeamId ? awayName : 'Winner';
    return formatMatchResultNote(winnerName, card.result);
  }

  private persistedResultLine(row: MatchRow, homeName: string, awayName: string): string | null {
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
}
