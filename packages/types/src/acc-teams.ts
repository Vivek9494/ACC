/**
 * Fixed ACC leather-ball team display names (IDs are per-tournament).
 * Used for Stats / overlay Top 5 scoping — match by name within a tournament.
 */
export const ACC_FIXED_TEAM_NAMES = ['ACC 3', 'ACC 6', 'ACC 9', 'ACC 0'] as const;

export type AccFixedTeamName = (typeof ACC_FIXED_TEAM_NAMES)[number];

export function isAccFixedTeamName(name: string): boolean {
  const key = name.trim().toUpperCase();
  return (ACC_FIXED_TEAM_NAMES as readonly string[]).some(
    (fixed) => fixed.toUpperCase() === key,
  );
}

/**
 * ACC 3 / 6 / 9 / 0 that exist in `teams`, in fixed order.
 * Does not invent teams or fall back to non-ACC names.
 */
export function filterAccFixedTeamsInTournament<T extends { name: string }>(
  teams: readonly T[],
): T[] {
  const byName = new Map(
    teams.map((team) => [team.name.trim().toUpperCase(), team] as const),
  );
  const ordered: T[] = [];
  for (const name of ACC_FIXED_TEAM_NAMES) {
    const hit = byName.get(name.toUpperCase());
    if (hit) {
      ordered.push(hit);
    }
  }
  return ordered;
}
