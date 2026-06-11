/** Combine YYYY-MM-DD + HH:mm (local) into an ISO 8601 UTC string. */
export function combineLocalDateAndTimeToIso(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) {
    return null;
  }
  const combined = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );
  return combined.toISOString();
}

/** Date-only field as UTC midnight ISO (matches existing tournament create behaviour). */
export function dateOnlyToUtcIso(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

export function compareIsoDates(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}
