/** Lightweight pub/sub so match status changes refresh open match lists. */

type MatchDataInvalidationListener = () => void;

const listeners = new Set<MatchDataInvalidationListener>();

export function subscribeMatchDataInvalidation(
  listener: MatchDataInvalidationListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call after a match status/schedule mutation succeeds (Detail, delay, etc.). */
export function invalidateMatchData(): void {
  for (const listener of listeners) {
    listener();
  }
}
