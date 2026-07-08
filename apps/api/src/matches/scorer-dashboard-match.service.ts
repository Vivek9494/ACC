import {
  buildMatchPlayingXiFinalizationStatus,
  buildScorerStartMatchAvailability,
  isExternalOpponentMatch,
  isScorerMatchResumable,
  MatchState,
  serverVenueTimezone,
  type ScorerStartableMatch,
} from '@acc/types';
import { Injectable } from '@nestjs/common';
import type { Match } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MediaUrlResolver } from '../storage/media-url.resolver';
import { activeTournamentRelationWhere } from '../tournaments/tournament-query';
import {
  formatScorerMatchDateTimeLine,
  isDashboardScorerCardVisible,
  SCORER_DASHBOARD_CARD_STATES,
  SCORER_IN_PROGRESS_MATCH_STATES,
  SCORER_STARTABLE_MATCH_STATES,
} from './match-start.utils';

/**
 * Shared dashboard scorer card loader (§11.1) — active per-match grant holders,
 * including users on neither team. Used by Player and Captain/VC dashboards.
 */
@Injectable()
export class ScorerDashboardMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrls: MediaUrlResolver,
  ) {}

  async loadStartableMatch(userId: string): Promise<ScorerStartableMatch | null> {
    const grantRows = await this.prisma.matchScorerGrant.findMany({
      where: {
        userId,
        revokedAt: null,
        match: {
          isDeleted: false,
          state: { in: [...SCORER_DASHBOARD_CARD_STATES] },
          ...activeTournamentRelationWhere,
        },
      },
      include: {
        match: {
          include: {
            homeTeam: { select: { id: true, name: true, logoUrl: true } },
            awayTeam: { select: { id: true, name: true, logoUrl: true } },
            tournament: { select: { name: true, timezone: true } },
            _count: { select: { innings: true, externalPlayers: true } },
            squads: {
              select: {
                teamId: true,
                isFinalized: true,
                players: { select: { role: true } },
              },
            },
          },
        },
      },
      orderBy: [{ match: { matchDate: 'asc' } }, { match: { startTime: 'asc' } }],
    });

    const visibleGrants = grantRows.filter((grant) =>
      isDashboardScorerCardVisible(
        grant.match.state,
        grant.match,
        grant.match.tournament.timezone,
      ),
    );

    const inProgress = visibleGrants.find((grant) =>
      isScorerMatchResumable(
        grant.match.state as MatchState,
        grant.match._count.innings > 0,
      ),
    );
    if (inProgress) {
      return this.toStartableMatch(inProgress.match);
    }

    const startable = visibleGrants.find((grant) => {
      const state = grant.match.state;
      const hasSession = grant.match._count.innings > 0;
      if ((SCORER_STARTABLE_MATCH_STATES as readonly string[]).includes(state)) {
        return true;
      }
      // LIVE/RAIN without innings — surface Start Match to recover via startScoring.
      return (
        (SCORER_IN_PROGRESS_MATCH_STATES as readonly string[]).includes(state) &&
        !hasSession
      );
    });
    if (startable) {
      return this.toStartableMatch(startable.match);
    }

    return null;
  }

  private async toStartableMatch(
    match: Match & {
      homeTeam: { id: string; name: string; logoUrl: string | null } | null;
      awayTeam: { id: string; name: string; logoUrl: string | null } | null;
      tournament: { name: string; timezone: string | null };
      _count: { innings: number; externalPlayers: number };
      squads: {
        teamId: string;
        isFinalized: boolean;
        players: { role: string }[];
      }[];
    },
  ): Promise<ScorerStartableMatch> {
    const homeName = match.homeTeam?.name ?? 'TBD';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'TBD';
    const state = match.state as MatchState;
    const hasScoringSession = match._count.innings > 0;
    const finalization = buildMatchPlayingXiFinalizationStatus({
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeTeamName: homeName,
      awayTeamName: awayName,
      squads: match.squads,
      externalOpponentPlayerCount: isExternalOpponentMatch(match)
        ? match._count.externalPlayers
        : undefined,
    });
    const [homeLogo, awayLogo] = await this.mediaUrls.resolveReadUrls([
      match.homeTeam?.logoUrl ?? null,
      match.awayTeam?.logoUrl ?? null,
    ]);
    const timeZone = serverVenueTimezone(match.tournament.timezone);
    const startAvailability = buildScorerStartMatchAvailability({
      matchDate: match.matchDate,
      startTime: match.startTime,
      timeZone,
      bothTeamsFinalized: finalization.bothTeamsFinalized,
    });
    return {
      matchId: match.id,
      tournamentName: match.tournament.name.toUpperCase(),
      dateTimeLine: formatScorerMatchDateTimeLine(match, match.tournament.timezone, {
        includeZoneAbbrev: true,
      }),
      teamA: {
        name: homeName,
        logoUrl: homeLogo ?? null,
        score: null,
        overs: null,
        isWinner: false,
      },
      teamB: {
        name: awayName,
        logoUrl: awayLogo ?? null,
        score: null,
        overs: null,
        isWinner: false,
      },
      state,
      hasScoringSession,
      homeTeamId: finalization.homeTeamId,
      awayTeamId: finalization.awayTeamId,
      homeTeamFinalized: finalization.homeTeamFinalized,
      awayTeamFinalized: finalization.awayTeamFinalized,
      bothTeamsFinalized: finalization.bothTeamsFinalized,
      playingXiLocked: finalization.bothTeamsFinalized,
      canStartMatch: startAvailability.canStartMatch,
      startAllowedAt: startAvailability.startAllowedAt,
      startAllowedAtLine: startAvailability.startAllowedAtLine,
      startMatchBlockedReason: startAvailability.blockedReason,
    };
  }
}
