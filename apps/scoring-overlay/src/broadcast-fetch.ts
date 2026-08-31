import type {
  BallType,
  BroadcastPlayerStatsView,
  MatchContext,
  MatchSide,
  ScorecardResponse,
  TossDecision,
} from './types';
import {
  DEFAULT_OVERLAY_THEME,
  isOverlayThemeKey,
  type OverlayThemeKey,
} from './themes/registry';

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

/** Per-match overlay theme key from match detail (public GET /matches/:id). */
export async function fetchMatchOverlayTheme(
  apiBase: string,
  matchId: string,
): Promise<OverlayThemeKey> {
  try {
    const res = await fetch(`${apiBase}/matches/${encodeURIComponent(matchId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return DEFAULT_OVERLAY_THEME;
    }
    const body = (await res.json()) as { overlayTheme?: string | null };
    if (body.overlayTheme != null && isOverlayThemeKey(body.overlayTheme)) {
      return body.overlayTheme;
    }
  } catch {
    // Fall back to default registered theme.
  }
  return DEFAULT_OVERLAY_THEME;
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
      overlayTheme?: string | null;
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
      externalPlayers?: Array<{
        id?: string;
        slot?: number;
        name?: string;
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

    const ctx: MatchContext = {
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
      overlayTheme:
        body.overlayTheme != null && isOverlayThemeKey(body.overlayTheme)
          ? body.overlayTheme
          : DEFAULT_OVERLAY_THEME,
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
      externalPlayers: (body.externalPlayers ?? [])
        .map((p) => {
          const id = p.id?.trim();
          const name = p.name?.trim();
          if (!id || !name) {
            return null;
          }
          return {
            id,
            slot: typeof p.slot === 'number' ? p.slot : 0,
            name,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null),
    };

    const id = matchId.trim();
    if (id) {
      matchCtxCache.set(matchCtxCacheKey(apiBase, id), ctx);
    }
    return ctx;
  } catch {
    return null;
  }
}

const MATCH_CTX_RETRY_BACKOFF_MS = [0, 200, 600] as const;

const matchCtxCache = new Map<string, MatchContext>();
const matchCtxInflight = new Map<string, Promise<MatchContext | null>>();
const matchCtxUnmet = new Set<string>();

function matchCtxCacheKey(apiBase: string, matchId: string): string {
  return `${apiBase}|${matchId}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export interface EnsureMatchContextOptions {
  /** True once the context holds what the caller needs (e.g. a batting side). */
  isSatisfied?: (ctx: MatchContext) => boolean;
  /** Identifies the requirement so one unmet refetch isn't repeated forever. */
  requirementKey?: string | null;
}

/**
 * Cached match detail with retries. Recovers a failed boot fetch on the next
 * caller (e.g. Show Innings Break) without a page reload. Concurrent callers
 * share one in-flight GET.
 */
export async function ensureMatchContext(
  apiBase: string,
  matchId: string,
  options?: EnsureMatchContextOptions,
): Promise<MatchContext | null> {
  const id = matchId.trim();
  if (!id) {
    return null;
  }
  const key = matchCtxCacheKey(apiBase, id);
  const isSatisfied = options?.isSatisfied ?? null;
  const requirementKey = options?.requirementKey?.trim() || null;
  const unmetKey = requirementKey ? `${key}|${requirementKey}` : null;

  const satisfied = (ctx: MatchContext | null): boolean => {
    if (!ctx) {
      return false;
    }
    if (!isSatisfied) {
      return true;
    }
    try {
      return isSatisfied(ctx);
    } catch {
      return true;
    }
  };

  const cached = matchCtxCache.get(key) ?? null;
  if (cached) {
    if (satisfied(cached)) {
      return cached;
    }
    if (unmetKey && matchCtxUnmet.has(unmetKey)) {
      return cached;
    }
  }

  const existing = matchCtxInflight.get(key);
  if (existing) {
    const ctx = await existing;
    if (ctx && unmetKey && !satisfied(ctx)) {
      matchCtxUnmet.add(unmetKey);
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
        if (unmetKey && !satisfied(last)) {
          matchCtxUnmet.add(unmetKey);
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
