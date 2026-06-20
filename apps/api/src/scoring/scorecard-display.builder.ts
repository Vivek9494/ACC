import type {
  InningsScorecard,
  ScorecardDisplayContext,
  ScorecardInningsLabels,
  ScorecardResponse,
} from '@acc/types';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

type MatchContext = {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  externalOpponentName: string | null;
  homeTeam: { id: string; name: string; logoUrl: string | null } | null;
  awayTeam: { id: string; name: string; logoUrl: string | null } | null;
  squads: {
    teamId: string;
    team: { id: string; name: string; logoUrl: string | null };
    players: { userId: string; user: { firstName: string; lastName: string } }[];
  }[];
  externalPlayers: { id: string; name: string }[];
};

type InningsRow = {
  id: string;
  battingIsExternal: boolean;
  bowlingIsExternal: boolean;
};

function collectParticipantIds(card: ScorecardResponse): Set<string> {
  const ids = new Set<string>();
  const add = (id: string | null | undefined): void => {
    if (id) {
      ids.add(id);
    }
  };

  for (const inn of card.innings) {
    add(inn.currentStrikerId);
    add(inn.currentNonStrikerId);
    add(inn.currentBowlerId);
    for (const batter of inn.batters) {
      add(batter.playerId);
      add(batter.bowlerId);
      add(batter.fielderId);
      add(batter.fielder2Id);
    }
    for (const bowler of inn.bowlers) {
      add(bowler.playerId);
    }
    for (const fow of inn.fallOfWickets) {
      add(fow.playerId);
    }
    for (const stand of inn.partnerships) {
      for (const id of stand.batterIds) {
        add(id);
      }
      for (const br of stand.batterRuns) {
        add(br.playerId);
      }
    }
    if (inn.partnership) {
      for (const id of inn.partnership.batterIds) {
        add(id);
      }
    }
  }

  return ids;
}

/**
 * Resolves participant and team display labels for a derived scorecard. Keeps
 * name resolution server-side so the public scorecard endpoint is self-contained
 * (registered users, external/name-only players, and external batting sides).
 */
@Injectable()
export class ScorecardDisplayBuilder {
  constructor(private readonly prisma: PrismaService) {}

  build(
    match: MatchContext,
    card: Omit<ScorecardResponse, 'display'>,
    inningsRows: InningsRow[],
  ): ScorecardDisplayContext {
    const playerIds = collectParticipantIds({ ...card, display: { players: {}, innings: [] } });
    return {
      players: this.resolvePlayerNamesFromMatch(match, playerIds),
      innings: card.innings.map((inn) =>
        this.inningsLabels(match, inn, inningsRows.find((row) => row.id === inn.inningsId)),
      ),
    };
  }

  /** Async fallback for ids not present on the match snapshot (e.g. late squad edits). */
  async enrichPlayers(
    matchId: string,
    players: Record<string, string>,
    ids: Set<string>,
  ): Promise<Record<string, string>> {
    const missing = [...ids].filter((id) => !(id in players));
    if (missing.length === 0) {
      return players;
    }

    const next = { ...players };
    const users = await this.prisma.user.findMany({
      where: { id: { in: missing } },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const user of users) {
      next[user.id] = `${user.firstName} ${user.lastName}`.trim();
    }

    const stillMissing = missing.filter((id) => !(id in next));
    if (stillMissing.length > 0) {
      const externals = await this.prisma.externalPlayer.findMany({
        where: { matchId, id: { in: stillMissing } },
        select: { id: true, name: true },
      });
      for (const ext of externals) {
        next[ext.id] = ext.name;
      }
    }

    return next;
  }

  private resolvePlayerNamesFromMatch(
    match: MatchContext,
    ids: Set<string>,
  ): Record<string, string> {
    const players: Record<string, string> = {};

    for (const squad of match.squads) {
      for (const p of squad.players) {
        players[p.userId] = `${p.user.firstName} ${p.user.lastName}`.trim();
      }
    }
    for (const ext of match.externalPlayers) {
      players[ext.id] = ext.name;
    }

    return players;
  }

  private inningsLabels(
    match: MatchContext,
    inn: InningsScorecard,
    row: InningsRow | undefined,
  ): ScorecardInningsLabels {
    const batting = this.teamSideLabel(match, inn.battingTeamId, row?.battingIsExternal ?? false);
    const bowling = this.teamSideLabel(match, inn.bowlingTeamId, row?.bowlingIsExternal ?? false);
    return {
      inningsId: inn.inningsId,
      battingTeamId: inn.battingTeamId,
      battingTeamName: batting.name,
      battingTeamLogoUrl: batting.logoUrl,
      bowlingTeamId: inn.bowlingTeamId,
      bowlingTeamName: bowling.name,
    };
  }

  private teamSideLabel(
    match: MatchContext,
    teamId: string | null,
    isExternal: boolean,
  ): { name: string; logoUrl: string | null } {
    if (teamId) {
      if (teamId === match.homeTeamId && match.homeTeam) {
        return { name: match.homeTeam.name, logoUrl: match.homeTeam.logoUrl };
      }
      if (teamId === match.awayTeamId && match.awayTeam) {
        return { name: match.awayTeam.name, logoUrl: match.awayTeam.logoUrl };
      }
      const squad = match.squads.find((s) => s.teamId === teamId);
      if (squad) {
        return { name: squad.team.name, logoUrl: squad.team.logoUrl };
      }
    }
    if (isExternal) {
      return { name: match.externalOpponentName?.trim() || 'Opponent', logoUrl: null };
    }
    return { name: 'Team', logoUrl: null };
  }
}

export { collectParticipantIds, type MatchContext, type InningsRow };
