import type {
  BallType,
  BroadcastPlayerStatsView,
  MatchContext,
  MatchSide,
  ScorecardResponse,
  TossDecision,
} from './types';

export async function fetchScorecard(
  apiBase: string,
  matchId: string,
): Promise<ScorecardResponse | null> {
  try {
    const res = await fetch(
      `${apiBase}/matches/${encodeURIComponent(matchId)}/scorecard`,
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as ScorecardResponse;
  } catch {
    return null;
  }
}

export async function fetchMatchBallType(
  apiBase: string,
  matchId: string,
): Promise<BallType> {
  try {
    const res = await fetch(`${apiBase}/matches/${encodeURIComponent(matchId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return 'TENNIS';
    }
    const body = (await res.json()) as { ballType?: string };
    return body.ballType === 'LEATHER' ? 'LEATHER' : 'TENNIS';
  } catch {
    return 'TENNIS';
  }
}

/** Public match detail + tournament team logos (presigned). */
export async function fetchMatchContext(
  apiBase: string,
  matchId: string,
): Promise<MatchContext | null> {
  try {
    const res = await fetch(`${apiBase}/matches/${encodeURIComponent(matchId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as {
      tournamentId?: string;
      homeTeamId?: string | null;
      awayTeamId?: string | null;
      homeTeamName?: string | null;
      awayTeamName?: string | null;
      externalOpponentName?: string | null;
      tossWinner?: MatchSide | null;
      tossDecision?: TossDecision | null;
      powerplayOvers?: number | null;
      resultNote?: string | null;
    };

    const tournamentId = body.tournamentId?.trim() ?? '';
    const logosByTeamId: Record<string, string | null> = {};

    if (tournamentId) {
      try {
        const teamsRes = await fetch(
          `${apiBase}/tournaments/${encodeURIComponent(tournamentId)}/teams`,
          { method: 'GET', headers: { Accept: 'application/json' } },
        );
        if (teamsRes.ok) {
          const teams = (await teamsRes.json()) as Array<{
            id: string;
            logoUrl: string | null;
          }>;
          for (const team of teams) {
            logosByTeamId[team.id] = team.logoUrl;
          }
        }
      } catch {
        // Logos optional — initials fallback.
      }
    }

    return {
      tournamentId,
      homeTeamId: body.homeTeamId ?? null,
      awayTeamId: body.awayTeamId ?? null,
      homeTeamName: body.homeTeamName ?? null,
      awayTeamName: body.awayTeamName ?? null,
      externalOpponentName: body.externalOpponentName ?? null,
      tossWinner: body.tossWinner ?? null,
      tossDecision: body.tossDecision ?? null,
      powerplayOvers:
        typeof body.powerplayOvers === 'number' && body.powerplayOvers > 0
          ? body.powerplayOvers
          : null,
      resultNote: body.resultNote ?? null,
      logosByTeamId,
    };
  } catch {
    return null;
  }
}

export async function fetchBroadcastPlayerStats(
  apiBase: string,
  userId: string,
  ballType: BallType,
): Promise<BroadcastPlayerStatsView | null> {
  try {
    const url = new URL(
      `${apiBase}/broadcast/players/${encodeURIComponent(userId)}/stats`,
    );
    url.searchParams.set('ballType', ballType);
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as BroadcastPlayerStatsView;
  } catch {
    return null;
  }
}
