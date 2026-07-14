/** Resolve tournament id from role (`id`) or legacy registration (`tournamentId`) params. */
export function tournamentIdFromParams(params: {
  id?: string | string[];
  tournamentId?: string | string[];
}): string {
  const raw = params.id ?? params.tournamentId;
  if (Array.isArray(raw)) {
    return raw[0] ?? '';
  }
  return raw ?? '';
}
