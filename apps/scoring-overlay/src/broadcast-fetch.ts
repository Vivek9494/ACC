import type { BallType, BroadcastPlayerStatsView, ScorecardResponse } from './types';

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
