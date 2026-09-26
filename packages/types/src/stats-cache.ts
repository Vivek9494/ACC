/**
 * Redis keys for cached tournament aggregates (leaderboard / standings /
 * tournament-stats). Versioned so invalidation is a single INCR — old value
 * keys expire via TTL without SCAN/KEYS.
 */

/** Monotonic aggregate-cache version for a tournament. */
export function tournamentAggregatesVersionKey(tournamentId: string): string {
  return `stats:agg:ver:${tournamentId}`;
}

export function leaderboardCacheKey(
  tournamentId: string,
  teamScope: string,
  version: string,
): string {
  return `stats:leaderboard:${tournamentId}:${teamScope}:v${version}`;
}

export function standingsCacheKey(tournamentId: string, version: string): string {
  return `stats:standings:${tournamentId}:v${version}`;
}

export function tournamentStatsCacheKey(
  tournamentId: string,
  teamScope: string,
  version: string,
): string {
  return `stats:tournament-stats:${tournamentId}:${teamScope}:v${version}`;
}

/** Monotonic career-cache version for a player (covers every ball type). */
export function playerCareerVersionKey(userId: string): string {
  return `stats:career:ver:${userId}`;
}

export function playerCareerCacheKey(userId: string, ballType: string, version: string): string {
  return `stats:career:${userId}:${ballType}:v${version}`;
}

/** Normalize optional teamId filter into a stable cache scope segment. */
export function statsCacheTeamScope(teamId?: string | null): string {
  return teamId && teamId.length > 0 ? teamId : 'all';
}
