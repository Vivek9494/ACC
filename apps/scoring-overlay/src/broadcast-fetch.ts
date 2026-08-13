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
      squads?: Array<{
        teamId?: string;
        players?: Array<{
          userId?: string;
          firstName?: string;
          lastName?: string;
          role?: string;
          battingOrder?: number | null;
        }>;
      }>;
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
      squads: (body.squads ?? [])
        .map((squad) => {
          const teamId = squad.teamId?.trim() ?? '';
          if (!teamId) {
            return null;
          }
          return {
            teamId,
            players: (squad.players ?? [])
              .map((p) => {
                const userId = p.userId?.trim();
                if (!userId) {
                  return null;
                }
                return {
                  userId,
                  firstName: p.firstName?.trim() ?? '',
                  lastName: p.lastName?.trim() ?? '',
                  role: p.role?.trim() || 'PLAYING_XI',
                  battingOrder:
                    typeof p.battingOrder === 'number' ? p.battingOrder : null,
                };
              })
              .filter((p): p is NonNullable<typeof p> => p != null),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s != null),
    };
  } catch {
    return null;
  }
}

const MATCH_CTX_RETRY_BACKOFF_MS = [0, 200, 600] as const;

const matchCtxCache = new Map<string, MatchContext>();
const matchCtxInflight = new Map<string, Promise<MatchContext | null>>();
const matchCtxNoSquad = new Set<string>();

function matchCtxCacheKey(apiBase: string, matchId: string): string {
  return `${apiBase}|${matchId}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function hasPlayingXiInContext(
  ctx: MatchContext | null,
  battingTeamId: string | null,
): boolean {
  if (!ctx || !battingTeamId) {
    return false;
  }
  return ctx.squads.some(
    (squad) =>
      squad.teamId === battingTeamId &&
      squad.players.some((p) => p.role === 'PLAYING_XI'),
  );
}

/**
 * Cached match detail with retries. Recovers a failed boot fetch on the next
 * caller (e.g. Show Innings Break) without a page reload. Concurrent callers
 * share one in-flight GET.
 */
export async function ensureMatchContext(
  apiBase: string,
  matchId: string,
  options?: { battingTeamId?: string | null },
): Promise<MatchContext | null> {
  const id = matchId.trim();
  if (!id) {
    return null;
  }
  const key = matchCtxCacheKey(apiBase, id);
  const battingTeamId = options?.battingTeamId?.trim() || null;
  const noSquadKey = battingTeamId ? `${key}|${battingTeamId}` : null;

  const cached = matchCtxCache.get(key) ?? null;
  if (cached) {
    if (!battingTeamId || hasPlayingXiInContext(cached, battingTeamId)) {
      return cached;
    }
    if (noSquadKey && matchCtxNoSquad.has(noSquadKey)) {
      return cached;
    }
  }

  const existing = matchCtxInflight.get(key);
  if (existing) {
    const ctx = await existing;
    if (ctx && battingTeamId && !hasPlayingXiInContext(ctx, battingTeamId) && noSquadKey) {
      matchCtxNoSquad.add(noSquadKey);
    }
    return ctx;
  }

  const pending = (async (): Promise<MatchContext | null> => {
    let last: MatchContext | null = null;
    for (const waitMs of MATCH_CTX_RETRY_BACKOFF_MS) {
      if (waitMs > 0) {
        await delay(waitMs);
      }
      last = await fetchMatchContext(apiBase, id);
      if (last) {
        matchCtxCache.set(key, last);
        if (battingTeamId && !hasPlayingXiInContext(last, battingTeamId) && noSquadKey) {
          matchCtxNoSquad.add(noSquadKey);
        }
        return last;
      }
    }
    return last;
  })();

  matchCtxInflight.set(key, pending);
  try {
    return await pending;
  } finally {
    matchCtxInflight.delete(key);
  }
}

/** Public tournament team roster (fielding-side career picker). */
export interface TeamRosterPlayer {
  userId: string;
  firstName: string;
  lastName: string;
}

export async function fetchTeamRoster(
  apiBase: string,
  tournamentId: string,
  teamId: string,
): Promise<TeamRosterPlayer[]> {
  try {
    const tid = tournamentId.trim();
    const id = teamId.trim();
    if (!tid || !id) {
      return [];
    }
    const res = await fetch(
      `${apiBase}/tournaments/${encodeURIComponent(tid)}/teams/${encodeURIComponent(id)}`,
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
    if (!res.ok) {
      return [];
    }
    const body = (await res.json()) as {
      players?: Array<{
        userId?: string;
        firstName?: string;
        lastName?: string;
      }>;
    };
    const out: TeamRosterPlayer[] = [];
    for (const p of body.players ?? []) {
      const userId = p.userId?.trim();
      if (!userId) {
        continue;
      }
      out.push({
        userId,
        firstName: p.firstName?.trim() ?? '',
        lastName: p.lastName?.trim() ?? '',
      });
    }
    return out;
  } catch {
    return [];
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
